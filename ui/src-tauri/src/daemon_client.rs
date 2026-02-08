use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::io::{BufRead, BufReader, Write};
use std::os::unix::net::UnixStream;
use std::path::PathBuf;

/// Request to daemon (matches main mojovoice protocol)
#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum DaemonRequest {
    #[serde(rename = "start_recording")]
    StartRecording { max_duration: u32 },
    #[serde(rename = "stop_recording")]
    StopRecording,
    #[serde(rename = "cancel_recording")]
    CancelRecording,
    #[serde(rename = "shutdown")]
    Shutdown,
    #[serde(rename = "ping")]
    Ping,
    #[serde(rename = "get_status")]
    GetStatus,
}

/// Response from daemon
#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "status")]
pub enum DaemonResponse {
    #[serde(rename = "ok")]
    Ok { message: String },
    #[serde(rename = "recording")]
    Recording,
    #[serde(rename = "success")]
    Success { text: String },
    #[serde(rename = "error")]
    Error { message: String },
    #[serde(rename = "status")]
    Status {
        model_name: String,
        gpu_enabled: bool,
        gpu_name: String,
        /// Optional for backwards compatibility with older daemons
        #[serde(default)]
        uptime_secs: Option<u64>,
    },
}

/// Get the daemon socket path (must match the path used by the CLI daemon server)
fn get_socket_path() -> Result<PathBuf> {
    let state_dir = mojovoice::state::get_state_dir()
        .context("Failed to get state directory")?;
    Ok(state_dir.join("daemon.sock"))
}

/// Send a request to the daemon and get response
pub fn send_request(request: DaemonRequest) -> Result<DaemonResponse> {
    let socket_path = get_socket_path()?;

    if !socket_path.exists() {
        anyhow::bail!("Daemon socket not found. Is daemon running?");
    }

    // Connect to daemon
    let mut stream = UnixStream::connect(&socket_path)
        .context("Failed to connect to daemon socket")?;

    // Serialize request
    let request_json = serde_json::to_string(&request)
        .context("Failed to serialize request")?;

    // Send request (newline-delimited)
    stream.write_all(request_json.as_bytes())?;
    stream.write_all(b"\n")?;
    stream.flush()?;

    // Read response
    let mut reader = BufReader::new(stream);
    let mut response_line = String::new();
    reader.read_line(&mut response_line)
        .context("Failed to read response from daemon")?;

    // Parse response
    let response: DaemonResponse = serde_json::from_str(response_line.trim())
        .context("Failed to parse daemon response")?;

    Ok(response)
}

/// Check if daemon is running
pub fn is_daemon_running() -> bool {
    let socket_path = match get_socket_path() {
        Ok(p) => p,
        Err(_) => return false,
    };

    if !socket_path.exists() {
        return false;
    }

    // Try to ping
    send_request(DaemonRequest::Ping).is_ok()
}

/// Get daemon status with detailed info
pub fn get_status() -> Result<DaemonStatusInfo> {
    if !is_daemon_running() {
        return Ok(DaemonStatusInfo {
            running: false,
            model_loaded: false,
            gpu_enabled: false,
            gpu_name: None,
            uptime_secs: None,
        });
    }

    let response = send_request(DaemonRequest::GetStatus)?;

    match response {
        DaemonResponse::Status {
            gpu_enabled,
            gpu_name,
            uptime_secs,
            ..
        } => Ok(DaemonStatusInfo {
            running: true,
            model_loaded: true,
            gpu_enabled,
            gpu_name: Some(gpu_name),
            uptime_secs, // Already Option<u64> for backwards compatibility
        }),
        DaemonResponse::Error { message } => {
            anyhow::bail!("Failed to get daemon status: {}", message)
        }
        _ => anyhow::bail!("Unexpected response from daemon"),
    }
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DaemonStatusInfo {
    pub running: bool,
    pub model_loaded: bool,
    pub gpu_enabled: bool,
    pub gpu_name: Option<String>,
    pub uptime_secs: Option<u64>,
}
