//! What the daemon is doing right now (idle / recording / transcribing), for status
//! indicators. On Windows this drives a system tray icon (see `tray`); on Linux,
//! status bars like Waybar read the state files in `state::toggle` instead.

use std::sync::atomic::{AtomicU8, Ordering};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[repr(u8)]
pub enum Activity {
    Idle = 0,
    Recording = 1,
    Transcribing = 2,
}

static ACTIVITY: AtomicU8 = AtomicU8::new(Activity::Idle as u8);

pub fn set(activity: Activity) {
    ACTIVITY.store(activity as u8, Ordering::SeqCst);
}

#[cfg(windows)]
pub fn get() -> Activity {
    match ACTIVITY.load(Ordering::SeqCst) {
        1 => Activity::Recording,
        2 => Activity::Transcribing,
        _ => Activity::Idle,
    }
}

/// Windows tray icon and global hotkey, which both need a thread running a Win32
/// message loop, so they share one.
#[cfg(windows)]
pub mod tray {
    use super::{Activity, get};
    use anyhow::{Context, Result};
    use global_hotkey::hotkey::HotKey;
    use global_hotkey::{GlobalHotKeyEvent, GlobalHotKeyManager, HotKeyState};
    use std::sync::Arc;
    use std::sync::atomic::{AtomicBool, Ordering};
    use std::sync::mpsc;
    use std::thread;
    use std::time::Duration;
    use tracing::{error, info, warn};
    use tray_icon::menu::{Menu, MenuEvent, MenuItem};
    use tray_icon::{Icon, TrayIcon, TrayIconBuilder};

    /// Start the UI thread: tray icon (always) and global hotkey (if configured).
    /// `shutdown` is set when the user picks "Quit" from the tray menu.
    pub fn spawn(hotkey: Option<String>, shutdown: Arc<AtomicBool>) -> Result<()> {
        let parsed = match hotkey.as_deref().map(str::parse::<HotKey>) {
            Some(Ok(h)) => Some(h),
            Some(Err(e)) => {
                warn!(
                    "Invalid hotkey '{}': {}",
                    hotkey.as_deref().unwrap_or(""),
                    e
                );
                None
            },
            None => None,
        };
        let hotkey_label = hotkey.clone().filter(|_| parsed.is_some());
        let (ready_tx, ready_rx) = mpsc::channel::<Result<(), String>>();

        thread::Builder::new()
            .name("ui".into())
            .spawn(move || {
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
                let _ = ready_tx.send(Ok(()));

                run(&tray, quit.id().clone(), hotkey_label.as_deref(), &shutdown);
                drop(manager);
            })
            .context("Failed to start UI thread")?;

        ready_rx
            .recv()
            .context("UI thread exited unexpectedly")?
            .map_err(|e| anyhow::anyhow!("Failed to create tray icon: {}", e))?;

        thread::Builder::new()
            .name("hotkey-events".into())
            .spawn(|| {
                for event in GlobalHotKeyEvent::receiver().iter() {
                    info!("Hotkey {:?}", event.state());
                    if event.state() == HotKeyState::Pressed {
                        run_toggle();
                    }
                }
            })
            .context("Failed to start hotkey event thread")?;

        info!(
            "Tray icon created{}",
            hotkey
                .map(|h| format!("; hotkey {}", h))
                .unwrap_or_default()
        );
        Ok(())
    }

    /// Pump Win32 messages (tray, menu, WM_HOTKEY) and keep the icon in sync with the
    /// daemon's activity
    fn run(
        tray: &TrayIcon,
        quit_id: tray_icon::menu::MenuId,
        hotkey: Option<&str>,
        shutdown: &AtomicBool,
    ) {
        use windows_sys::Win32::UI::WindowsAndMessaging::{
            DispatchMessageW, MSG, PM_REMOVE, PeekMessageW, TranslateMessage,
        };

        let mut shown = Activity::Idle;
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
                let _ = tray.set_tooltip(Some(tooltip(now, hotkey)));
                shown = now;
            }

            thread::sleep(Duration::from_millis(30));
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

    /// Run `mojovoice start` (toggle) as a hidden background process, reusing the CLI's
    /// toggle logic (start or stop recording, then type the transcription)
    fn run_toggle() {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;

        let exe = match std::env::current_exe() {
            Ok(exe) => exe,
            Err(e) => {
                error!("Hotkey: can't locate mojovoice executable: {}", e);
                return;
            },
        };

        match std::process::Command::new(exe)
            .arg("start")
            .creation_flags(CREATE_NO_WINDOW)
            .stdin(std::process::Stdio::null())
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .spawn()
        {
            // Reap the child in the background so its handle doesn't linger
            Ok(mut child) => {
                info!("Hotkey: started 'mojovoice start' (pid {})", child.id());
                thread::spawn(move || match child.wait() {
                    Ok(status) if !status.success() => {
                        warn!("Hotkey: 'mojovoice start' exited with {}", status)
                    },
                    _ => {},
                });
            },
            Err(e) => error!("Hotkey: failed to run 'mojovoice start': {}", e),
        }
    }
}
