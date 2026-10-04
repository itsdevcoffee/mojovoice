use anyhow::{Context, Result};
#[cfg(unix)]
use nix::sys::signal::{self, Signal};
#[cfg(unix)]
use nix::unistd::Pid;
use std::fs;
use std::io::Write;
use std::sync::atomic::{AtomicBool, Ordering};
use tracing::info;

use super::paths::get_listen_pid_file;
use super::paths::get_pid_file;

/// Global flag to signal recording should stop
pub static STOP_RECORDING: AtomicBool = AtomicBool::new(false);

/// Set with `STOP_RECORDING` when the recording is being cancelled: the audio is
/// thrown away, so there's no point buffering trailing audio first
pub static DISCARD_RECORDING: AtomicBool = AtomicBool::new(false);

/// Check whether a process is still running
#[cfg(unix)]
fn process_alive(pid: u32) -> bool {
    signal::kill(Pid::from_raw(pid as i32), None).is_ok()
}

/// Check whether a process is still running
#[cfg(windows)]
fn process_alive(pid: u32) -> bool {
    use windows_sys::Win32::Foundation::{CloseHandle, STILL_ACTIVE};
    use windows_sys::Win32::System::Threading::{
        GetExitCodeProcess, OpenProcess, PROCESS_QUERY_LIMITED_INFORMATION,
    };

    // SAFETY: plain Win32 calls; the handle is checked and closed before returning
    unsafe {
        let handle = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid);
        if handle.is_null() {
            return false;
        }
        let mut exit_code = 0u32;
        let ok = GetExitCodeProcess(handle, &mut exit_code) != 0;
        CloseHandle(handle);
        ok && exit_code == STILL_ACTIVE as u32
    }
}

/// Windows has no SIGUSR1, so a stop request is a `stop-<pid>` file that the target
/// process watches for (see `setup_signal_handler`)
#[cfg(windows)]
fn stop_file(pid: u32) -> Result<std::path::PathBuf> {
    Ok(super::paths::get_state_dir()?.join(format!("stop-{}", pid)))
}

/// Ask a recording or listen process to stop
fn send_stop(pid: u32) -> Result<()> {
    #[cfg(unix)]
    signal::kill(Pid::from_raw(pid as i32), Signal::SIGUSR1)
        .context("Failed to send stop signal")?;
    #[cfg(windows)]
    fs::write(stop_file(pid)?, "").context("Failed to write stop request")?;
    Ok(())
}

/// Recording state information
#[derive(Debug)]
pub struct RecordingState {
    pub pid: u32,
    /// Timestamp when recording started (Unix epoch seconds)
    /// Useful for displaying recording duration in Waybar
    #[allow(dead_code)]
    pub started_at: u64,
}

/// Check if a recording is currently in progress
pub fn is_recording() -> Result<Option<RecordingState>> {
    let pid_file = get_pid_file()?;

    if !pid_file.exists() {
        return Ok(None);
    }

    let content = fs::read_to_string(&pid_file)?;
    let mut lines = content.lines();

    let pid: u32 = lines.next().and_then(|s| s.parse().ok()).unwrap_or(0);

    let started_at: u64 = lines.next().and_then(|s| s.parse().ok()).unwrap_or(0);

    if pid == 0 {
        // Invalid PID file, clean up
        let _ = fs::remove_file(&pid_file);
        return Ok(None);
    }

    // Check if process is still running
    let process_exists = process_alive(pid);

    if !process_exists {
        // Stale PID file, clean up
        info!("Cleaning up stale PID file (process {} not running)", pid);
        let _ = fs::remove_file(&pid_file);
        return Ok(None);
    }

    Ok(Some(RecordingState { pid, started_at }))
}

/// Mark recording as started (create PID file)
pub fn start_recording() -> Result<()> {
    let pid_file = get_pid_file()?;
    let pid = std::process::id();
    let started_at = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .context("System time is before UNIX epoch")?
        .as_secs();

    let mut file = fs::File::create(&pid_file).context("Failed to create PID file")?;

    writeln!(file, "{}", pid)?;
    writeln!(file, "{}", started_at)?;

    info!(
        "Recording started (PID: {}, file: {})",
        pid,
        pid_file.display()
    );

    // Ensure processing file is gone
    let _ = cleanup_processing();

    // Refresh Waybar
    refresh_waybar();

    Ok(())
}

/// Refresh UI status bar (Waybar/Polybar/etc.) using configured command
pub fn refresh_waybar() {
    // Load config to get refresh command
    let config = match crate::config::load() {
        Ok(c) => c,
        Err(_) => return, // Silently fail if config unavailable
    };

    if let Some(cmd) = config.output.refresh_command {
        // Parse command string into program + args
        let parts: Vec<&str> = cmd.split_whitespace().collect();
        if let Some((program, args)) = parts.split_first() {
            let _ = std::process::Command::new(program)
                .args(args)
                .spawn()
                .map(|mut child| {
                    // Immediately detach by not waiting on the child
                    let _ = child.stdin.take();
                    let _ = child.stdout.take();
                    let _ = child.stderr.take();
                });
        }
    }
}

/// Start processing state (create processing file)
pub fn start_processing() -> Result<()> {
    let processing_file = super::paths::get_state_dir()?.join("processing");
    fs::write(&processing_file, "")?;
    refresh_waybar();
    Ok(())
}

/// Stop processing state (remove processing file)
pub fn cleanup_processing() -> Result<()> {
    let processing_file = super::paths::get_state_dir()?.join("processing");
    if processing_file.exists() {
        fs::remove_file(&processing_file)?;
        refresh_waybar();
    }
    Ok(())
}

/// Stop a running recording (SIGUSR1 on Unix, stop file on Windows)
#[allow(dead_code)]
pub fn stop_recording(state: &RecordingState) -> Result<()> {
    info!(
        "Sending stop signal to recording process (PID: {})",
        state.pid
    );
    send_stop(state.pid).context("Failed to stop recording process")
}

/// Clean up PID file (called when recording ends)
pub fn cleanup_recording() -> Result<()> {
    let pid_file = get_pid_file()?;
    if pid_file.exists() {
        fs::remove_file(&pid_file)?;
        info!("Cleaned up PID file");
        // Start processing state visually
        let _ = start_processing();
    }
    Ok(())
}

/// Check if a listen session is currently in progress
pub fn is_listening() -> Result<Option<RecordingState>> {
    let pid_file = get_listen_pid_file()?;

    if !pid_file.exists() {
        return Ok(None);
    }

    let content = fs::read_to_string(&pid_file)?;
    let mut lines = content.lines();

    let pid: u32 = lines.next().and_then(|s| s.parse().ok()).unwrap_or(0);
    let started_at: u64 = lines.next().and_then(|s| s.parse().ok()).unwrap_or(0);

    if pid == 0 {
        let _ = fs::remove_file(&pid_file);
        return Ok(None);
    }

    let process_exists = process_alive(pid);
    if !process_exists {
        info!(
            "Cleaning up stale listen PID file (process {} not running)",
            pid
        );
        let _ = fs::remove_file(&pid_file);
        return Ok(None);
    }

    Ok(Some(RecordingState { pid, started_at }))
}

/// Mark listen session as started (create listen.pid)
pub fn start_listen() -> Result<()> {
    let pid_file = get_listen_pid_file()?;
    let pid = std::process::id();
    let started_at = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .context("System time is before UNIX epoch")?
        .as_secs();

    let mut file = fs::File::create(&pid_file).context("Failed to create listen PID file")?;
    writeln!(file, "{}", pid)?;
    writeln!(file, "{}", started_at)?;
    info!(
        "Listen session started (PID: {}, file: {})",
        pid,
        pid_file.display()
    );
    Ok(())
}

/// Clean up listen PID file
pub fn cleanup_listen() -> Result<()> {
    let pid_file = get_listen_pid_file()?;
    if pid_file.exists() {
        fs::remove_file(&pid_file)?;
        info!("Cleaned up listen PID file");
    }
    Ok(())
}

/// Stop a running listen session (SIGUSR1 on Unix, stop file on Windows)
pub fn stop_listen(state: &RecordingState) -> Result<()> {
    info!("Sending stop signal to listen process (PID: {})", state.pid);
    send_stop(state.pid).context("Failed to stop listen process")
}

/// Make stop requests from other processes set `STOP_RECORDING`
#[cfg(unix)]
pub fn setup_signal_handler() -> Result<()> {
    // SAFETY: the handler only stores to an atomic, which is async-signal-safe
    unsafe {
        signal::signal(
            Signal::SIGUSR1,
            signal::SigHandler::Handler(handle_stop_signal),
        )
        .context("Failed to set up signal handler")?;
    }
    Ok(())
}

/// Make stop requests from other processes set `STOP_RECORDING`. The daemon calls
/// this for every recording, so the watcher thread is started only once.
#[cfg(windows)]
pub fn setup_signal_handler() -> Result<()> {
    static WATCHER: std::sync::Once = std::sync::Once::new();
    let file = stop_file(std::process::id())?;
    let _ = fs::remove_file(&file);
    WATCHER.call_once(|| {
        std::thread::spawn(move || {
            loop {
                if file.exists() {
                    let _ = fs::remove_file(&file);
                    STOP_RECORDING.store(true, Ordering::SeqCst);
                }
                std::thread::sleep(std::time::Duration::from_millis(100));
            }
        });
    });
    Ok(())
}

/// Signal handler function
#[cfg(unix)]
extern "C" fn handle_stop_signal(_: i32) {
    STOP_RECORDING.store(true, Ordering::SeqCst);
}

/// Check if stop was requested
pub fn should_stop() -> bool {
    STOP_RECORDING.load(Ordering::SeqCst)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::{Mutex, OnceLock};

    // Serializes tests that share on-disk PID files to prevent race conditions
    // when cargo runs tests in parallel (the default).
    static PID_FILE_LOCK: OnceLock<Mutex<()>> = OnceLock::new();
    fn pid_lock() -> std::sync::MutexGuard<'static, ()> {
        PID_FILE_LOCK.get_or_init(|| Mutex::new(())).lock().unwrap()
    }

    #[test]
    fn test_recording_state_lifecycle() {
        let _guard = pid_lock();
        // Clean up any existing state
        let _ = cleanup_recording();

        // Should not be recording initially
        assert!(is_recording().unwrap().is_none());

        // Start recording
        start_recording().unwrap();

        // Should be recording now
        let state = is_recording().unwrap();
        assert!(state.is_some());
        assert_eq!(state.unwrap().pid, std::process::id());

        // Clean up
        cleanup_recording().unwrap();

        // Should not be recording after cleanup
        assert!(is_recording().unwrap().is_none());
    }

    #[test]
    fn test_listen_state_lifecycle() {
        let _guard = pid_lock();
        let _ = cleanup_listen();
        assert!(is_listening().unwrap().is_none());

        start_listen().unwrap();

        let state = is_listening().unwrap();
        assert!(state.is_some());
        assert_eq!(state.unwrap().pid, std::process::id());

        cleanup_listen().unwrap();
        assert!(is_listening().unwrap().is_none());
    }

    #[test]
    fn test_listen_stale_pid_is_cleaned_up() {
        let _guard = pid_lock();
        use std::io::Write;

        let pid_file = super::super::paths::get_listen_pid_file().unwrap();
        let mut file = std::fs::File::create(&pid_file).unwrap();
        writeln!(file, "99999999").unwrap();
        writeln!(file, "0").unwrap();
        drop(file);

        let result = is_listening().unwrap();
        assert!(result.is_none());
        assert!(
            !pid_file.exists(),
            "stale PID file should have been removed"
        );
    }

    #[test]
    fn test_listen_and_recording_pid_files_are_independent() {
        let _guard = pid_lock();
        let _ = cleanup_listen();
        let _ = cleanup_recording();

        start_listen().unwrap();
        assert!(is_listening().unwrap().is_some());
        assert!(is_recording().unwrap().is_none());

        cleanup_listen().unwrap();
    }
}
