use anyhow::{Context, Result};
use std::io::{BufRead, BufReader, Write};
use std::os::unix::net::UnixStream;
use std::time::Duration;
use tracing::info;

use super::protocol::{DaemonRequest, DaemonResponse};
use super::server::{get_socket_path, is_daemon_running};

const DAEMON_TIMEOUT: Duration = Duration::from_secs(30);

pub fn send_request(request: &DaemonRequest) -> Result<DaemonResponse> {
    let socket_path = get_socket_path()?;

    let mut stream =
        UnixStream::connect(&socket_path).context("Failed to connect to daemon. Is it running?")?;

    stream
        .set_read_timeout(Some(DAEMON_TIMEOUT))
        .context("Failed to set read timeout")?;
    stream
        .set_write_timeout(Some(DAEMON_TIMEOUT))
        .context("Failed to set write timeout")?;

    let request_json = serde_json::to_string(request)?;
    match request {
        DaemonRequest::TranscribeAudio { samples } => {
            info!(
                "Sending TranscribeAudio request ({} samples, {} bytes)",
                samples.len(),
                request_json.len()
            );
        }
        _ => info!("Sending to daemon: {}", request_json),
    }
    stream.write_all(request_json.as_bytes())?;
    stream.write_all(b"\n")?;
    stream.flush()?;

    let mut reader = BufReader::new(stream);
    let mut line = String::new();
    reader
        .read_line(&mut line)
        .context("Failed to read daemon response (timeout or connection closed)")?;

    serde_json::from_str(line.trim()).context("Failed to parse daemon response")
}

fn expect_ok_response(response: DaemonResponse, operation: &str) -> Result<()> {
    match response {
        DaemonResponse::Ok { .. } => Ok(()),
        DaemonResponse::Error { message } => anyhow::bail!("{} failed: {}", operation, message),
        _ => anyhow::bail!("Unexpected response: {:?}", response),
    }
}

pub fn daemon_stop_recording() -> Result<()> {
    if !is_daemon_running() {
        anyhow::bail!("Daemon is not running");
    }
    let response = send_request(&DaemonRequest::StopRecording)?;
    expect_ok_response(response, "Stop")
}

pub fn daemon_cancel_recording() -> Result<()> {
    if !is_daemon_running() {
        return Ok(());
    }
    let response = send_request(&DaemonRequest::CancelRecording)?;
    expect_ok_response(response, "Cancel")
}
