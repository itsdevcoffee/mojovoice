//! Integration tests for daemon protocol serialization and communication
//!
//! Tests request/response serialization, error handling, and protocol contracts.

use mojovoice::daemon::protocol::{DaemonRequest, DaemonResponse};

#[test]
fn test_request_ping_serialization() {
    let request = DaemonRequest::Ping;
    let json = serde_json::to_string(&request).unwrap();
    let parsed: DaemonRequest = serde_json::from_str(&json).unwrap();

    match parsed {
        DaemonRequest::Ping => {}, // Success
        _ => panic!("Expected Ping variant"),
    }
}

#[test]
fn test_request_start_recording_serialization() {
    let request = DaemonRequest::StartRecording { max_duration: 300 };
    let json = serde_json::to_string(&request).unwrap();
    let parsed: DaemonRequest = serde_json::from_str(&json).unwrap();

    match parsed {
        DaemonRequest::StartRecording { max_duration } => {
            assert_eq!(max_duration, 300);
        },
        _ => panic!("Expected StartRecording variant"),
    }
}

#[test]
fn test_request_stop_recording_serialization() {
    let request = DaemonRequest::StopRecording;
    let json = serde_json::to_string(&request).unwrap();
    let parsed: DaemonRequest = serde_json::from_str(&json).unwrap();

    match parsed {
        DaemonRequest::StopRecording => {}, // Success
        _ => panic!("Expected StopRecording variant"),
    }
}

#[test]
fn test_request_shutdown_serialization() {
    let request = DaemonRequest::Shutdown;
    let json = serde_json::to_string(&request).unwrap();
    let parsed: DaemonRequest = serde_json::from_str(&json).unwrap();

    match parsed {
        DaemonRequest::Shutdown => {}, // Success
        _ => panic!("Expected Shutdown variant"),
    }
}

#[test]
fn test_request_transcribe_audio_serialization() {
    let samples = vec![0.1f32, -0.2, 0.3, -0.4, 0.5];
    let request = DaemonRequest::TranscribeAudio { samples: samples.clone() };
    let json = serde_json::to_string(&request).unwrap();
    let parsed: DaemonRequest = serde_json::from_str(&json).unwrap();

    match parsed {
        DaemonRequest::TranscribeAudio { samples: parsed_samples } => {
            assert_eq!(parsed_samples.len(), 5);
            assert!((parsed_samples[0] - 0.1).abs() < 1e-6);
            assert!((parsed_samples[1] - (-0.2)).abs() < 1e-6);
        },
        _ => panic!("Expected TranscribeAudio variant"),
    }
}

#[test]
fn test_response_ok_serialization() {
    let response = DaemonResponse::Ok {
        message: "pong".to_string(),
    };
    let json = serde_json::to_string(&response).unwrap();
    let parsed: DaemonResponse = serde_json::from_str(&json).unwrap();

    match parsed {
        DaemonResponse::Ok { message } => {
            assert_eq!(message, "pong");
        },
        _ => panic!("Expected Ok variant"),
    }
}

#[test]
fn test_response_recording_serialization() {
    let response = DaemonResponse::Recording;
    let json = serde_json::to_string(&response).unwrap();
    let parsed: DaemonResponse = serde_json::from_str(&json).unwrap();

    match parsed {
        DaemonResponse::Recording => {}, // Success
        _ => panic!("Expected Recording variant"),
    }
}

#[test]
fn test_response_success_serialization() {
    let response = DaemonResponse::Success {
        text: "transcribed text".to_string(),
    };
    let json = serde_json::to_string(&response).unwrap();
    let parsed: DaemonResponse = serde_json::from_str(&json).unwrap();

    match parsed {
        DaemonResponse::Success { text } => {
            assert_eq!(text, "transcribed text");
        },
        _ => panic!("Expected Success variant"),
    }
}

#[test]
fn test_response_error_serialization() {
    let response = DaemonResponse::Error {
        message: "Already recording".to_string(),
    };
    let json = serde_json::to_string(&response).unwrap();
    let parsed: DaemonResponse = serde_json::from_str(&json).unwrap();

    match parsed {
        DaemonResponse::Error { message } => {
            assert_eq!(message, "Already recording");
        },
        _ => panic!("Expected Error variant"),
    }
}

#[test]
fn test_malformed_request_json() {
    let bad_json = r#"{"type": "unknown_command"}"#;
    let result: Result<DaemonRequest, _> = serde_json::from_str(bad_json);
    assert!(result.is_err(), "Should fail to parse unknown command");
}

#[test]
fn test_malformed_response_json() {
    let bad_json = r#"{"invalid": "data"}"#;
    let result: Result<DaemonResponse, _> = serde_json::from_str(bad_json);
    assert!(result.is_err(), "Should fail to parse invalid response");
}

#[test]
fn test_empty_json() {
    let empty = "";
    let result: Result<DaemonRequest, _> = serde_json::from_str(empty);
    assert!(result.is_err(), "Should fail to parse empty string");
}

#[test]
fn test_response_with_special_characters() {
    let response = DaemonResponse::Success {
        text: "Text with \"quotes\" and\nnewlines\tand\ttabs".to_string(),
    };
    let json = serde_json::to_string(&response).unwrap();
    let parsed: DaemonResponse = serde_json::from_str(&json).unwrap();

    match parsed {
        DaemonResponse::Success { text } => {
            assert_eq!(text, "Text with \"quotes\" and\nnewlines\tand\ttabs");
        },
        _ => panic!("Expected Success variant"),
    }
}

#[test]
fn test_response_with_unicode() {
    let response = DaemonResponse::Success {
        text: "Unicode: 你好世界 🎉 émojis".to_string(),
    };
    let json = serde_json::to_string(&response).unwrap();
    let parsed: DaemonResponse = serde_json::from_str(&json).unwrap();

    match parsed {
        DaemonResponse::Success { text } => {
            assert_eq!(text, "Unicode: 你好世界 🎉 émojis");
        },
        _ => panic!("Expected Success variant"),
    }
}
