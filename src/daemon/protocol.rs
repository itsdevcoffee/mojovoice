use serde::{Deserialize, Serialize};

/// Request from client to daemon
#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum DaemonRequest {
    #[serde(rename = "start_recording")]
    StartRecording { max_duration: u32 },
    #[serde(rename = "stop_recording")]
    StopRecording,
    #[serde(rename = "cancel_recording")]
    CancelRecording,
    #[serde(rename = "transcribe_audio")]
    TranscribeAudio {
        /// Audio samples (16kHz mono f32)
        samples: Vec<f32>,
    },
    #[serde(rename = "shutdown")]
    Shutdown,
    #[serde(rename = "ping")]
    Ping,
    #[serde(rename = "get_status")]
    GetStatus,
}

/// Response from daemon to client
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
    },
}
