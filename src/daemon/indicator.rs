//! What the daemon is doing right now (idle / recording / transcribing) and how the
//! last dictation ended, for status indicators. On Windows this drives a system tray
//! icon and an on-screen status overlay (see `tray`); on Linux, status bars like Waybar
//! read the state files in `state::toggle` instead.

use std::sync::Mutex;
use std::sync::atomic::{AtomicU8, Ordering};
use std::time::Instant;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[repr(u8)]
pub enum Activity {
    Idle = 0,
    Recording = 1,
    Transcribing = 2,
}

/// How a dictation ended
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Outcome {
    Transcribed(String),
    NoSpeech,
    Failed(String),
}

static ACTIVITY: AtomicU8 = AtomicU8::new(Activity::Idle as u8);
static LAST_OUTCOME: Mutex<Option<(Instant, Outcome)>> = Mutex::new(None);

pub fn set(activity: Activity) {
    ACTIVITY.store(activity as u8, Ordering::SeqCst);
}

/// Record how a dictation ended and return to idle
pub fn finish(outcome: Outcome) {
    if let Ok(mut last) = LAST_OUTCOME.lock() {
        *last = Some((Instant::now(), outcome));
    }
    set(Activity::Idle);
}

#[cfg(windows)]
pub fn get() -> Activity {
    match ACTIVITY.load(Ordering::SeqCst) {
        1 => Activity::Recording,
        2 => Activity::Transcribing,
        _ => Activity::Idle,
    }
}

#[cfg(windows)]
fn last_outcome() -> Option<(Instant, Outcome)> {
    LAST_OUTCOME.lock().ok().and_then(|last| last.clone())
}

/// Windows tray icon, status overlay and global hotkey, which all need a thread
/// running a Win32 message loop, so they share one.
#[cfg(windows)]
pub mod tray {
    use super::{Activity, Outcome, get, last_outcome};
    use anyhow::{Context, Result};
    use global_hotkey::hotkey::HotKey;
    use global_hotkey::{GlobalHotKeyEvent, GlobalHotKeyManager, HotKeyState};
    use std::process::Child;
    use std::sync::Arc;
    use std::sync::atomic::{AtomicBool, Ordering};
    use std::sync::mpsc;
    use std::thread;
    use std::time::{Duration, Instant};
    use tracing::{error, info, warn};
    use tray_icon::menu::{Menu, MenuEvent, MenuItem};
    use tray_icon::{Icon, TrayIcon, TrayIconBuilder};

    pub struct UiOptions {
        /// Global hotkey, e.g. "Alt+Shift+Digit1"
        pub hotkey: Option<String>,
        /// Hold the hotkey to record, release to transcribe (instead of press/press)
        pub push_to_talk: bool,
        /// Show the on-screen status overlay
        pub overlay: bool,
    }

    /// Start the UI thread: tray icon (always), status overlay and global hotkey (if
    /// enabled). `shutdown` is set when the user picks "Quit" from the tray menu.
    pub fn spawn(options: UiOptions, shutdown: Arc<AtomicBool>) -> Result<()> {
        let parsed = match options.hotkey.as_deref().map(str::parse::<HotKey>) {
            Some(Ok(h)) => Some(h),
            Some(Err(e)) => {
                warn!(
                    "Invalid hotkey '{}': {}",
                    options.hotkey.as_deref().unwrap_or(""),
                    e
                );
                None
            },
            None => None,
        };
        let hotkey_label = options.hotkey.clone().filter(|_| parsed.is_some());
        let push_to_talk = options.push_to_talk;
        let overlay_enabled = options.overlay;
        let (ready_tx, ready_rx) = mpsc::channel::<Result<(), String>>();

        thread::Builder::new()
            .name("ui".into())
            .spawn(move || {
                // Before any window exists, so the overlay renders crisply on high-DPI
                // screens
                overlay::enable_dpi_awareness();

                // Hotkey failures shouldn't take the tray down with them
                let manager = parsed.and_then(|h| match GlobalHotKeyManager::new() {
                    Ok(m) => match m.register(h) {
                        Ok(()) => Some(m),
                        Err(e) => {
                            warn!("Failed to register hotkey: {}", e);
                            None
                        },
                    },
                    Err(e) => {
                        warn!("Global hotkeys unavailable: {}", e);
                        None
                    },
                });
                let hotkey_label = hotkey_label.filter(|_| manager.is_some());

                let quit = MenuItem::new("Quit MojoVoice daemon", true, None);
                let menu = Menu::new();
                if let Err(e) = menu.append(&quit) {
                    warn!("Failed to build tray menu: {}", e);
                }
                let tray = match TrayIconBuilder::new()
                    .with_icon(icon_for(Activity::Idle))
                    .with_tooltip(tooltip(Activity::Idle, hotkey_label.as_deref()))
                    .with_menu(Box::new(menu))
                    .build()
                {
                    Ok(t) => t,
                    Err(e) => {
                        let _ = ready_tx.send(Err(e.to_string()));
                        return;
                    },
                };
                let overlay = if overlay_enabled {
                    overlay::Overlay::create()
                } else {
                    None
                };
                let _ = ready_tx.send(Ok(()));

                let hints = Hints {
                    hotkey: hotkey_label,
                    push_to_talk,
                };
                run(&tray, overlay, quit.id().clone(), &hints, &shutdown);
                drop(manager);
            })
            .context("Failed to start UI thread")?;

        ready_rx
            .recv()
            .context("UI thread exited unexpectedly")?
            .map_err(|e| anyhow::anyhow!("Failed to create tray icon: {}", e))?;

        thread::Builder::new()
            .name("hotkey-events".into())
            .spawn(move || handle_hotkey_events(push_to_talk))
            .context("Failed to start hotkey event thread")?;

        info!(
            "Tray icon created{}{}{}",
            options
                .hotkey
                .map(|h| format!("; hotkey {}", h))
                .unwrap_or_default(),
            if push_to_talk { " (push-to-talk)" } else { "" },
            if overlay_enabled { "; overlay on" } else { "" }
        );
        Ok(())
    }

    struct Hints {
        hotkey: Option<String>,
        push_to_talk: bool,
    }

    /// How long a finished dictation's result stays on screen
    const SHOW_DONE: Duration = Duration::from_millis(1600);
    const SHOW_ERROR: Duration = Duration::from_secs(5);

    /// Pump Win32 messages (tray, menu, WM_HOTKEY) and keep the tray icon and overlay
    /// in sync with the daemon's activity
    fn run(
        tray: &TrayIcon,
        mut overlay: Option<overlay::Overlay>,
        quit_id: tray_icon::menu::MenuId,
        hints: &Hints,
        shutdown: &AtomicBool,
    ) {
        use windows_sys::Win32::UI::WindowsAndMessaging::{
            DispatchMessageW, MSG, PM_REMOVE, PeekMessageW, TranslateMessage,
        };

        let mut shown = Activity::Idle;
        let mut shown_status: Option<(String, u32)> = None;
        loop {
            // SAFETY: standard message pump; MSG is plain data used only on this thread
            unsafe {
                let mut msg: MSG = std::mem::zeroed();
                while PeekMessageW(&mut msg, std::ptr::null_mut(), 0, 0, PM_REMOVE) != 0 {
                    TranslateMessage(&msg);
                    DispatchMessageW(&msg);
                }
            }

            while let Ok(event) = MenuEvent::receiver().try_recv() {
                if event.id == quit_id {
                    info!("Quit requested from tray");
                    shutdown.store(true, Ordering::SeqCst);
                }
            }

            let now = get();
            if now != shown {
                if let Err(e) = tray.set_icon(Some(icon_for(now))) {
                    warn!("Failed to update tray icon: {}", e);
                }
                let _ = tray.set_tooltip(Some(tooltip(now, hints.hotkey.as_deref())));
                shown = now;
            }

            if let Some(overlay) = overlay.as_mut() {
                let status = overlay_status(now, last_outcome(), hints);
                if status != shown_status {
                    match &status {
                        Some((text, color)) => overlay.show(text, *color),
                        None => overlay.hide(),
                    }
                    shown_status = status;
                }
            }

            thread::sleep(Duration::from_millis(30));
        }
    }

    /// Overlay text and color (GDI COLORREF, 0x00BBGGRR) for the current state, or
    /// None to hide it
    fn overlay_status(
        activity: Activity,
        outcome: Option<(Instant, Outcome)>,
        hints: &Hints,
    ) -> Option<(String, u32)> {
        const RED: u32 = 0x0044_44EF;
        const AMBER: u32 = 0x000B_9EF5;
        const GREEN: u32 = 0x005E_C522;
        const GREY: u32 = 0x00B8_A39C;

        match activity {
            Activity::Recording => {
                let hint = match (&hints.hotkey, hints.push_to_talk) {
                    (Some(_), true) => " · release to transcribe".to_string(),
                    (Some(h), false) => format!(" · {} to stop", super::display_hotkey(h)),
                    (None, _) => String::new(),
                };
                Some((format!("●  Recording{}", hint), RED))
            },
            Activity::Transcribing => Some(("◌  Transcribing…".to_string(), AMBER)),
            Activity::Idle => match outcome {
                Some((at, Outcome::Transcribed(text))) if at.elapsed() < SHOW_DONE => {
                    Some((format!("✓  {}", preview(&text, 48)), GREEN))
                },
                Some((at, Outcome::NoSpeech)) if at.elapsed() < SHOW_DONE => {
                    Some(("No speech detected".to_string(), GREY))
                },
                Some((at, Outcome::Failed(message))) if at.elapsed() < SHOW_ERROR => {
                    Some((format!("✕  {}", preview(&message, 64)), RED))
                },
                _ => None,
            },
        }
    }

    /// First `max` characters of `text`, with an ellipsis if cut
    fn preview(text: &str, max: usize) -> String {
        let text = text.trim();
        if text.chars().count() <= max {
            text.to_string()
        } else {
            format!("{}…", text.chars().take(max).collect::<String>())
        }
    }

    fn tooltip(activity: Activity, hotkey: Option<&str>) -> String {
        match (activity, hotkey) {
            (Activity::Recording, Some(h)) => format!("MojoVoice: recording (press {} to stop)", h),
            (Activity::Recording, None) => "MojoVoice: recording".into(),
            (Activity::Transcribing, _) => "MojoVoice: transcribing…".into(),
            (Activity::Idle, Some(h)) => format!("MojoVoice: ready (press {} to dictate)", h),
            (Activity::Idle, None) => "MojoVoice: ready".into(),
        }
    }

    /// A filled circle: grey when idle, red while recording, amber while transcribing
    fn icon_for(activity: Activity) -> Icon {
        const SIZE: u32 = 32;
        let (r, g, b) = match activity {
            Activity::Idle => (0x6b, 0x72, 0x80),
            Activity::Recording => (0xef, 0x44, 0x44),
            Activity::Transcribing => (0xf5, 0x9e, 0x0b),
        };
        let center = (SIZE as f32 - 1.0) / 2.0;
        let radius = SIZE as f32 / 2.0 - 2.0;
        let mut rgba = Vec::with_capacity((SIZE * SIZE * 4) as usize);
        for y in 0..SIZE {
            for x in 0..SIZE {
                let dist = ((x as f32 - center).powi(2) + (y as f32 - center).powi(2)).sqrt();
                // 1px anti-aliased edge
                let alpha = ((radius - dist + 0.5).clamp(0.0, 1.0) * 255.0) as u8;
                rgba.extend_from_slice(&[r, g, b, alpha]);
            }
        }
        Icon::from_rgba(rgba, SIZE, SIZE).expect("valid 32x32 RGBA icon")
    }

    /// Taps shorter than this in push-to-talk mode are treated as accidental
    const MIN_PUSH_TO_TALK: Duration = Duration::from_millis(300);

    /// React to hotkey presses by running the CLI, reusing its toggle logic: the first
    /// `mojovoice start` starts recording, the next stops, transcribes and types.
    /// Push-to-talk runs the first on press and the second on release.
    fn handle_hotkey_events(push_to_talk: bool) {
        let mut held: Option<(Instant, Option<Child>)> = None;
        for event in GlobalHotKeyEvent::receiver().iter() {
            info!("Hotkey {:?}", event.state());
            match (push_to_talk, event.state()) {
                (false, HotKeyState::Pressed) => reap(run_cli("start")),
                (true, HotKeyState::Pressed) => held = Some((Instant::now(), run_cli("start"))),
                (true, HotKeyState::Released) => {
                    let Some((pressed_at, start)) = held.take() else {
                        continue;
                    };
                    // Let the start reach the daemon before stopping it
                    if let Some(mut child) = start {
                        wait_up_to(&mut child, Duration::from_secs(5));
                    }
                    let action = if pressed_at.elapsed() < MIN_PUSH_TO_TALK {
                        "cancel"
                    } else {
                        "start"
                    };
                    reap(run_cli(action));
                },
                (false, HotKeyState::Released) => {},
            }
        }
    }

    /// Run `mojovoice <arg>` as a hidden background process
    fn run_cli(arg: &str) -> Option<Child> {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;

        let exe = match std::env::current_exe() {
            Ok(exe) => exe,
            Err(e) => {
                error!("Hotkey: can't locate mojovoice executable: {}", e);
                return None;
            },
        };
        match std::process::Command::new(exe)
            .arg(arg)
            .creation_flags(CREATE_NO_WINDOW)
            .stdin(std::process::Stdio::null())
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .spawn()
        {
            Ok(child) => {
                info!("Hotkey: started 'mojovoice {}' (pid {})", arg, child.id());
                Some(child)
            },
            Err(e) => {
                error!("Hotkey: failed to run 'mojovoice {}': {}", arg, e);
                None
            },
        }
    }

    /// Wait for the child in the background so its handle doesn't linger
    fn reap(child: Option<Child>) {
        if let Some(mut child) = child {
            thread::spawn(move || match child.wait() {
                Ok(status) if !status.success() => {
                    warn!("Hotkey: 'mojovoice' exited with {}", status)
                },
                _ => {},
            });
        }
    }

    fn wait_up_to(child: &mut Child, timeout: Duration) {
        let deadline = Instant::now() + timeout;
        while Instant::now() < deadline {
            match child.try_wait() {
                Ok(Some(_)) | Err(_) => return,
                Ok(None) => thread::sleep(Duration::from_millis(20)),
            }
        }
        warn!(
            "Hotkey: 'mojovoice start' still running after {:?}",
            timeout
        );
    }

    /// A small always-on-top status "pill" near the bottom of the screen. It never
    /// takes focus and clicks pass straight through it.
    mod overlay {
        use std::sync::Mutex;
        use std::sync::atomic::{AtomicIsize, Ordering};
        use windows_sys::Win32::Foundation::{HWND, LPARAM, LRESULT, RECT, WPARAM};
        use windows_sys::Win32::Graphics::Gdi::{
            BeginPaint, CLEARTYPE_QUALITY, CreateFontW, CreateRoundRectRgn, CreateSolidBrush,
            DT_CENTER, DT_END_ELLIPSIS, DT_SINGLELINE, DT_VCENTER, DeleteObject, DrawTextW,
            EndPaint, FillRect, InvalidateRect, PAINTSTRUCT, SelectObject, SetBkMode, SetTextColor,
            SetWindowRgn, TRANSPARENT,
        };
        use windows_sys::Win32::System::LibraryLoader::GetModuleHandleW;
        use windows_sys::Win32::UI::HiDpi::{
            DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2, GetDpiForSystem,
            SetProcessDpiAwarenessContext,
        };
        use windows_sys::Win32::UI::WindowsAndMessaging::{
            CreateWindowExW, DefWindowProcW, GetClientRect, HWND_TOPMOST, LWA_ALPHA,
            RegisterClassExW, SPI_GETWORKAREA, SW_HIDE, SW_SHOWNOACTIVATE, SWP_NOACTIVATE,
            SWP_NOMOVE, SWP_NOSIZE, SetLayeredWindowAttributes, SetWindowPos, ShowWindow,
            SystemParametersInfoW, WM_PAINT, WNDCLASSEXW, WS_EX_LAYERED, WS_EX_NOACTIVATE,
            WS_EX_TOOLWINDOW, WS_EX_TOPMOST, WS_EX_TRANSPARENT, WS_POPUP,
        };

        /// Background: #1E1E2E (COLORREF is 0x00BBGGRR)
        const BACKGROUND: u32 = 0x002E_1E1E;

        /// Text and color painted by `wnd_proc`
        static CONTENT: Mutex<(Vec<u16>, u32)> = Mutex::new((Vec::new(), 0));
        static FONT: AtomicIsize = AtomicIsize::new(0);
        static PADDING: AtomicIsize = AtomicIsize::new(16);

        pub fn enable_dpi_awareness() {
            // SAFETY: process-wide setting with no pointers involved
            unsafe {
                SetProcessDpiAwarenessContext(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2);
            }
        }

        fn wide(s: &str) -> Vec<u16> {
            s.encode_utf16().chain(std::iter::once(0)).collect()
        }

        pub struct Overlay {
            hwnd: HWND,
        }

        impl Overlay {
            pub fn create() -> Option<Self> {
                // SAFETY: plain Win32 window creation on the UI thread, which owns the
                // window and pumps its messages; all pointers outlive the calls
                unsafe {
                    let scale = GetDpiForSystem() as f32 / 96.0;
                    let px = |v: f32| (v * scale).round() as i32;
                    let (width, height) = (px(380.0), px(44.0));

                    let instance = GetModuleHandleW(std::ptr::null());
                    let class_name = wide("MojoVoiceStatusOverlay");
                    let mut class: WNDCLASSEXW = std::mem::zeroed();
                    class.cbSize = std::mem::size_of::<WNDCLASSEXW>() as u32;
                    class.lpfnWndProc = Some(wnd_proc);
                    class.hInstance = instance;
                    class.lpszClassName = class_name.as_ptr();
                    RegisterClassExW(&class);

                    // Bottom center of the primary monitor's work area (above the taskbar)
                    let mut work: RECT = std::mem::zeroed();
                    SystemParametersInfoW(
                        SPI_GETWORKAREA,
                        0,
                        &mut work as *mut RECT as *mut std::ffi::c_void,
                        0,
                    );
                    let x = work.left + ((work.right - work.left) - width) / 2;
                    let y = work.bottom - height - px(28.0);

                    let hwnd = CreateWindowExW(
                        WS_EX_TOPMOST
                            | WS_EX_TOOLWINDOW
                            | WS_EX_NOACTIVATE
                            | WS_EX_LAYERED
                            | WS_EX_TRANSPARENT,
                        class_name.as_ptr(),
                        class_name.as_ptr(),
                        WS_POPUP,
                        x,
                        y,
                        width,
                        height,
                        std::ptr::null_mut(),
                        std::ptr::null_mut(),
                        instance,
                        std::ptr::null(),
                    );
                    if hwnd.is_null() {
                        tracing::warn!(
                            "Couldn't create status overlay: {}",
                            std::io::Error::last_os_error()
                        );
                        return None;
                    }
                    SetLayeredWindowAttributes(hwnd, 0, 235, LWA_ALPHA);
                    let radius = px(16.0);
                    let region = CreateRoundRectRgn(0, 0, width + 1, height + 1, radius, radius);
                    SetWindowRgn(hwnd, region, 1);

                    let face = wide("Segoe UI");
                    let font = CreateFontW(
                        -px(15.0),
                        0,
                        0,
                        0,
                        600,
                        0,
                        0,
                        0,
                        1, // DEFAULT_CHARSET
                        0,
                        0,
                        CLEARTYPE_QUALITY as _,
                        0,
                        face.as_ptr(),
                    );
                    FONT.store(font as isize, Ordering::SeqCst);
                    PADDING.store(px(18.0) as isize, Ordering::SeqCst);

                    Some(Self { hwnd })
                }
            }

            pub fn show(&mut self, text: &str, color: u32) {
                if let Ok(mut content) = CONTENT.lock() {
                    *content = (text.encode_utf16().collect(), color);
                }
                // SAFETY: hwnd is our live overlay window, used on its owning thread
                unsafe {
                    InvalidateRect(self.hwnd, std::ptr::null(), 1);
                    ShowWindow(self.hwnd, SW_SHOWNOACTIVATE);
                    // Stay above windows that became topmost after us, without
                    // activating
                    SetWindowPos(
                        self.hwnd,
                        HWND_TOPMOST,
                        0,
                        0,
                        0,
                        0,
                        SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE,
                    );
                }
            }

            pub fn hide(&mut self) {
                // SAFETY: hwnd is our live overlay window, used on its owning thread
                unsafe {
                    ShowWindow(self.hwnd, SW_HIDE);
                }
            }
        }

        unsafe extern "system" fn wnd_proc(
            hwnd: HWND,
            msg: u32,
            wparam: WPARAM,
            lparam: LPARAM,
        ) -> LRESULT {
            if msg != WM_PAINT {
                // SAFETY: forwarding the message as received
                return unsafe { DefWindowProcW(hwnd, msg, wparam, lparam) };
            }
            let (mut text, color) = CONTENT.lock().map(|c| c.clone()).unwrap_or((Vec::new(), 0));
            // SAFETY: standard WM_PAINT handling on the window's own thread; GDI objects
            // created here are released before returning
            unsafe {
                let mut ps: PAINTSTRUCT = std::mem::zeroed();
                let hdc = BeginPaint(hwnd, &mut ps);
                let mut rect: RECT = std::mem::zeroed();
                GetClientRect(hwnd, &mut rect);
                let brush = CreateSolidBrush(BACKGROUND);
                FillRect(hdc, &rect, brush);
                DeleteObject(brush as _);

                SetBkMode(hdc, TRANSPARENT as _);
                SetTextColor(hdc, color);
                let font = FONT.load(Ordering::SeqCst);
                let previous = if font != 0 {
                    SelectObject(hdc, font as _)
                } else {
                    std::ptr::null_mut()
                };
                let pad = PADDING.load(Ordering::SeqCst) as i32;
                rect.left += pad;
                rect.right -= pad;
                DrawTextW(
                    hdc,
                    text.as_mut_ptr(),
                    text.len() as i32,
                    &mut rect,
                    DT_CENTER | DT_VCENTER | DT_SINGLELINE | DT_END_ELLIPSIS,
                );
                if !previous.is_null() {
                    SelectObject(hdc, previous);
                }
                EndPaint(hwnd, &ps);
            }
            0
        }
    }
}

/// "Alt+Shift+Digit1" -> "Alt+Shift+1" (global-hotkey key names to what's on the key)
#[cfg(windows)]
fn display_hotkey(combo: &str) -> String {
    combo
        .split('+')
        .map(|part| {
            part.strip_prefix("Key")
                .or_else(|| part.strip_prefix("Digit"))
                .filter(|rest| rest.len() == 1)
                .unwrap_or(part)
        })
        .collect::<Vec<_>>()
        .join("+")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn finish_records_outcome_and_goes_idle() {
        set(Activity::Transcribing);
        finish(Outcome::NoSpeech);
        assert_eq!(ACTIVITY.load(Ordering::SeqCst), Activity::Idle as u8);
        let last = LAST_OUTCOME.lock().unwrap().clone().map(|(_, o)| o);
        assert_eq!(last, Some(Outcome::NoSpeech));
    }
}
