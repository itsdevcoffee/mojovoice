//! Global toggle hotkey, owned by the daemon (Windows only).
//!
//! On Linux a compositor/desktop keybinding runs `mojovoice start` instead. On Windows
//! the daemon registers the hotkey itself so it works without the desktop app; each
//! press runs `mojovoice start` in the background, reusing the CLI's toggle logic
//! (start or stop recording, then type the transcription).

use anyhow::{Context, Result};
use global_hotkey::hotkey::HotKey;
use global_hotkey::{GlobalHotKeyEvent, GlobalHotKeyManager, HotKeyState};
use std::sync::mpsc;
use std::thread;
use tracing::{error, info};

/// Register `hotkey` (e.g. "Ctrl+Alt+Space") and start handling presses.
/// Returns once the hotkey is registered, or with the registration error.
pub fn spawn(hotkey: &str) -> Result<()> {
    let parsed: HotKey = hotkey
        .parse()
        .with_context(|| format!("Invalid hotkey '{}'", hotkey))?;
    let (ready_tx, ready_rx) = mpsc::channel::<Result<(), String>>();

    // The manager must live on a thread running a Win32 message loop
    thread::Builder::new()
        .name("hotkey-pump".into())
        .spawn(move || {
            let manager = match GlobalHotKeyManager::new() {
                Ok(m) => m,
                Err(e) => {
                    let _ = ready_tx.send(Err(e.to_string()));
                    return;
                },
            };
            if let Err(e) = manager.register(parsed) {
                let _ = ready_tx.send(Err(e.to_string()));
                return;
            }
            let _ = ready_tx.send(Ok(()));
            pump_messages();
            drop(manager);
        })
        .context("Failed to start hotkey thread")?;

    ready_rx
        .recv()
        .context("Hotkey thread exited unexpectedly")?
        .map_err(|e| anyhow::anyhow!("Failed to register hotkey '{}': {}", hotkey, e))?;

    thread::Builder::new()
        .name("hotkey-events".into())
        .spawn(|| {
            for event in GlobalHotKeyEvent::receiver().iter() {
                if event.state() == HotKeyState::Pressed {
                    run_toggle();
                }
            }
        })
        .context("Failed to start hotkey event thread")?;

    info!("Global hotkey registered: {}", hotkey);
    Ok(())
}

/// Run the Win32 message loop for this thread (delivers WM_HOTKEY to the manager)
fn pump_messages() {
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        DispatchMessageW, GetMessageW, MSG, TranslateMessage,
    };

    // SAFETY: standard message loop; MSG is plain data and only used on this thread
    unsafe {
        let mut msg: MSG = std::mem::zeroed();
        while GetMessageW(&mut msg, std::ptr::null_mut(), 0, 0) > 0 {
            TranslateMessage(&msg);
            DispatchMessageW(&msg);
        }
    }
}

/// Run `mojovoice start` (toggle) as a hidden background process
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
        // Reap the child in the background so it doesn't linger as a zombie handle
        Ok(mut child) => {
            thread::spawn(move || {
                let _ = child.wait();
            });
        },
        Err(e) => error!("Hotkey: failed to run 'mojovoice start': {}", e),
    }
}
