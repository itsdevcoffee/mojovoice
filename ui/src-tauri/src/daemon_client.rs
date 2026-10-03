//! Daemon access for the desktop app, built on the mojovoice crate's client so the
//! protocol and transport (Unix socket / Windows named pipe) live in one place.

use anyhow::Result;
use serde::{Deserialize, Serialize};

pub use mojovoice::daemon::{DaemonRequest, DaemonResponse, is_daemon_running};

/// Send a request to the daemon and get response
pub fn send_request(request: DaemonRequest) -> Result<DaemonResponse> {
    mojovoice::daemon::send_request(&request)
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

    match send_request(DaemonRequest::GetStatus)? {
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
            uptime_secs: Some(uptime_secs),
        }),
        DaemonResponse::Error { message } => {
            anyhow::bail!("Failed to get daemon status: {}", message)
        },
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
