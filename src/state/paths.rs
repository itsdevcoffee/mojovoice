use anyhow::{Context, Result};
use directories::ProjectDirs;
use std::path::PathBuf;

/// Get the state directory for mojovoice (~/.local/state/mojovoice)
pub fn get_state_dir() -> Result<PathBuf> {
    let proj_dirs = ProjectDirs::from("", "", "mojovoice")
        .context("Failed to determine project directories")?;

    // Use state_dir on Linux, fall back to data_local_dir
    let state_dir = proj_dirs
        .state_dir()
        .unwrap_or_else(|| proj_dirs.data_local_dir());

    std::fs::create_dir_all(state_dir)?;
    Ok(state_dir.to_path_buf())
}

/// Get the log directory for mojovoice (~/.local/state/mojovoice/logs)
pub fn get_log_dir() -> Result<PathBuf> {
    let log_dir = get_state_dir()?.join("logs");
    std::fs::create_dir_all(&log_dir)?;
    Ok(log_dir)
}

/// Get the recording PID file path
pub fn get_pid_file() -> Result<PathBuf> {
    Ok(get_state_dir()?.join("recording.pid"))
}

/// Get the daemon PID file path
pub fn get_daemon_pid_file() -> Result<PathBuf> {
    Ok(get_state_dir()?.join("daemon.pid"))
}

/// Get the listen session PID file path (separate from recording PID)
pub fn get_listen_pid_file() -> Result<PathBuf> {
    Ok(get_state_dir()?.join("listen.pid"))
}

/// Get the data directory for mojovoice (~/.local/share/mojovoice)
pub fn get_data_dir() -> Result<PathBuf> {
    let proj_dirs = ProjectDirs::from("", "", "mojovoice")
        .context("Failed to determine project directories")?;

    let data_dir = proj_dirs.data_local_dir();
    std::fs::create_dir_all(data_dir)?;
    Ok(data_dir.to_path_buf())
}

/// Get the transcription history file path (~/.local/share/mojovoice/history.jsonl)
pub fn get_history_file() -> Result<PathBuf> {
    Ok(get_data_dir()?.join("history.jsonl"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_state_dir_creation() {
        let dir = get_state_dir();
        assert!(dir.is_ok());
    }

    #[test]
    fn test_listen_pid_file_is_distinct_from_recording_pid() {
        let listen_pid = get_listen_pid_file().unwrap();
        let recording_pid = get_pid_file().unwrap();
        assert_ne!(listen_pid, recording_pid);
        assert!(listen_pid.to_string_lossy().ends_with("listen.pid"));
    }
}
