use anyhow::{Context, Result};
use std::io::{BufRead, BufReader, Write};
use std::os::unix::net::UnixStream;
use std::time::Duration;
use tracing::info;

use super::protocol::{DaemonRequest, DaemonResponse};
use super::server::{get_socket_path, is_daemon_running};

/// Timeout for daemon communication (30 seconds)
const DAEMON_TIMEOUT: Duration = Duration::from_secs(30);

/// Send request to daemon and get response
pub fn send_request(request: &DaemonRequest) -> Result<DaemonResponse> {
    let socket_path = get_socket_path()?;

    let mut stream =
        UnixStream::connect(&socket_path).context("Failed to connect to daemon. Is it running?")?;

    // Set timeout for both read and write operations
    stream
        .set_read_timeout(Some(DAEMON_TIMEOUT))
        .context("Failed to set read timeout")?;
    stream
        .set_write_timeout(Some(DAEMON_TIMEOUT))
        .context("Failed to set write timeout")?;

    // Send request
    let request_json = serde_json::to_string(request)?;
    info!("Sending to daemon: {}", request_json);
    stream.write_all(request_json.as_bytes())?;
    stream.write_all(b"\n")?;
    stream.flush()?;

    // Read response
    let mut reader = BufReader::new(stream);
    let mut line = String::new();
    reader
        .read_line(&mut line)
        .context("Failed to read daemon response (timeout or connection closed)")?;

    let response: DaemonResponse =
        serde_json::from_str(line.trim()).context("Failed to parse daemon response")?;

    Ok(response)
}

/// Stop recording via daemon
pub fn daemon_stop_recording() -> Result<()> {
    if !is_daemon_running() {
        anyhow::bail!("Daemon is not running");
    }

    let request = DaemonRequest::StopRecording;
    let response = send_request(&request)?;

    match response {
        DaemonResponse::Ok { .. } => Ok(()),
        DaemonResponse::Error { message } => {
            anyhow::bail!("Stop failed: {}", message)
        },
        _ => anyhow::bail!("Unexpected response: {:?}", response),
    }
}

/// Cancel recording via daemon (discard without transcribing)
pub fn daemon_cancel_recording() -> Result<()> {
    if !is_daemon_running() {
        // Silently succeed if daemon not running
        return Ok(());
    }

    let request = DaemonRequest::CancelRecording;
    let response = send_request(&request)?;

    match response {
        DaemonResponse::Ok { .. } => Ok(()),
        DaemonResponse::Error { message } => {
            anyhow::bail!("Cancel failed: {}", message)
        },
        _ => anyhow::bail!("Unexpected response: {:?}", response),
    }
}
