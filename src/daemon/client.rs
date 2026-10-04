use anyhow::{Context, Result};
use std::io::{BufRead, BufReader, Write};
use std::time::Duration;
use tracing::info;

use super::protocol::{DaemonRequest, DaemonResponse};
use super::transport;

const DAEMON_TIMEOUT: Duration = Duration::from_secs(30);
const PING_TIMEOUT: Duration = Duration::from_secs(2);

/// Write one newline-delimited JSON request and read one response line.
fn exchange(stream: &transport::Stream, request_json: &str) -> Result<DaemonResponse> {
    let mut writer = stream;
    writer.write_all(request_json.as_bytes())?;
    writer.write_all(b"\n")?;
    writer.flush()?;

    let mut line = String::new();
    BufReader::new(stream)
        .read_line(&mut line)
        .context("Failed to read daemon response (timeout or connection closed)")?;

    serde_json::from_str(line.trim()).context("Failed to parse daemon response")
}

pub fn send_request(request: &DaemonRequest) -> Result<DaemonResponse> {
    let stream = transport::connect(DAEMON_TIMEOUT)?;

    let request_json = serde_json::to_string(request)?;
    match request {
        DaemonRequest::TranscribeAudio { samples } => {
            info!(
                "Sending TranscribeAudio request ({} samples, {} bytes)",
                samples.len(),
                request_json.len()
            );
        },
        _ => info!("Sending to daemon: {}", request_json),
    }

    exchange(&stream, &request_json)
}

/// Check if the daemon is running by pinging it
pub fn is_daemon_running() -> bool {
    let Ok(stream) = transport::connect(PING_TIMEOUT) else {
        return false;
    };
    let Ok(ping) = serde_json::to_string(&DaemonRequest::Ping) else {
        return false;
    };
    exchange(&stream, &ping).is_ok()
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

/// Shutdown the daemon
pub fn daemon_shutdown() -> Result<()> {
    if !is_daemon_running() {
        anyhow::bail!("Daemon is not running");
    }
    let response = send_request(&DaemonRequest::Shutdown)?;
    expect_ok_response(response, "Shutdown")
}

/// Status info returned from daemon
#[allow(dead_code)] // Fields populated from daemon response, may not all be read directly
#[derive(Debug)]
pub struct DaemonStatusInfo {
    pub model_name: String,
    pub gpu_enabled: bool,
    pub gpu_name: String,
    pub uptime_secs: u64,
}

/// Get daemon status (model, GPU info)
pub fn daemon_get_status() -> Result<DaemonStatusInfo> {
    if !is_daemon_running() {
        anyhow::bail!("Daemon is not running");
    }
    let response = send_request(&DaemonRequest::GetStatus)?;
    match response {
        DaemonResponse::Status {
            model_name,
            gpu_enabled,
            gpu_name,
            uptime_secs,
        } => Ok(DaemonStatusInfo {
            model_name,
            gpu_enabled,
            gpu_name,
            uptime_secs,
        }),
        DaemonResponse::Error { message } => anyhow::bail!("Status error: {}", message),
        _ => anyhow::bail!("Unexpected response from daemon"),
    }
}
