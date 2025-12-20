use anyhow::{Context, Result};
use nix::sys::signal::{self, Signal};
use nix::unistd::Pid;
use std::fs;
use std::io::Write;
use std::sync::atomic::{AtomicBool, Ordering};
use tracing::info;

use super::paths::get_pid_file;

/// Global flag to signal recording should stop
pub static STOP_RECORDING: AtomicBool = AtomicBool::new(false);

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
    let process_exists = signal::kill(Pid::from_raw(pid as i32), None).is_ok();

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

/// Stop a running recording by sending SIGUSR1
#[allow(dead_code)]
pub fn stop_recording(state: &RecordingState) -> Result<()> {
    info!(
        "Sending stop signal to recording process (PID: {})",
        state.pid
    );

    signal::kill(Pid::from_raw(state.pid as i32), Signal::SIGUSR1)
        .context("Failed to send stop signal to recording process")?;

    Ok(())
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

/// Set up signal handler for SIGUSR1
pub fn setup_signal_handler() -> Result<()> {
    // Register handler for SIGUSR1
    unsafe {
        signal::signal(
            Signal::SIGUSR1,
            signal::SigHandler::Handler(handle_stop_signal),
        )
        .context("Failed to set up signal handler")?;
    }
    Ok(())
}

/// Signal handler function
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

    #[test]
    fn test_recording_state_lifecycle() {
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
}
