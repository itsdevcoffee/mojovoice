//! Integration tests for transcription
//!
//! These tests require:
//! - The daemon running with a loaded model (`mojovoice daemon &`)
//! - The mojo-audio library available (`lib/libmojo_audio.so`)
//!
//! Run locally with: `cargo test --test transcription -- --ignored`

use mojovoice::daemon::{DaemonRequest, DaemonResponse, is_daemon_running, send_request};
use std::path::Path;

/// Load WAV file and return audio samples as f32 (16kHz mono)
fn load_wav_file(path: &Path) -> Result<Vec<f32>, Box<dyn std::error::Error>> {
    use hound::WavReader;
    use rubato::{Resampler, SincFixedIn, SincInterpolationParameters, SincInterpolationType, WindowFunction};

    const TARGET_SAMPLE_RATE: u32 = 16000;

    let mut reader = WavReader::open(path)?;
    let spec = reader.spec();

    // Read samples based on format
    let samples: Vec<f32> = match spec.sample_format {
        hound::SampleFormat::Float => reader.samples::<f32>().map(|s| s.unwrap()).collect(),
        hound::SampleFormat::Int => {
            let max_val = (1 << (spec.bits_per_sample - 1)) as f32;
            reader
                .samples::<i32>()
                .map(|s| s.unwrap() as f32 / max_val)
                .collect()
        }
    };

    // Convert stereo to mono if needed
    let mono_samples: Vec<f32> = if spec.channels == 2 {
        samples
            .chunks(2)
            .map(|chunk| (chunk[0] + chunk[1]) / 2.0)
            .collect()
    } else {
        samples
    };

    // Resample to 16kHz if needed
    let audio_16k: Vec<f32> = if spec.sample_rate != TARGET_SAMPLE_RATE {
        let params = SincInterpolationParameters {
            sinc_len: 256,
            f_cutoff: 0.95,
            interpolation: SincInterpolationType::Linear,
            oversampling_factor: 256,
            window: WindowFunction::BlackmanHarris2,
        };

        let mut resampler = SincFixedIn::<f32>::new(
            TARGET_SAMPLE_RATE as f64 / spec.sample_rate as f64,
            2.0,
            params,
            mono_samples.len(),
            1,
        )?;

        let waves_in = vec![mono_samples];
        let mut waves_out = resampler.process(&waves_in, None)?;
        waves_out.remove(0)
    } else {
        mono_samples
    };

    Ok(audio_16k)
}

#[test]
#[ignore] // Requires daemon with model loaded
fn test_transcribe_sample_audio() {
    // Check daemon is running
    assert!(
        is_daemon_running(),
        "Daemon is not running. Start it first with: mojovoice daemon &"
    );

    // Load sample audio file
    let audio_path = Path::new("assets/audio/samples/sample-mojovoice-clip.wav");
    assert!(
        audio_path.exists(),
        "Sample audio file not found: {}",
        audio_path.display()
    );

    let samples = load_wav_file(audio_path).expect("Failed to load WAV file");
    assert!(!samples.is_empty(), "Audio file is empty");

    // Calculate duration
    let duration_secs = samples.len() as f32 / 16000.0;
    assert!(
        duration_secs > 1.0 && duration_secs < 30.0,
        "Audio duration should be between 1-30 seconds, got {:.2}s",
        duration_secs
    );

    // Send to daemon for transcription
    let response = send_request(&DaemonRequest::TranscribeAudio { samples })
        .expect("Failed to send request to daemon");

    // Verify successful transcription
    match response {
        DaemonResponse::Success { text } => {
            assert!(!text.is_empty(), "Transcription should not be empty");

            // The sample audio says "testing 1, 2, 3" (case insensitive check)
            let text_lower = text.to_lowercase();
            assert!(
                text_lower.contains("testing") || text_lower.contains("test"),
                "Transcription should contain 'testing' or 'test', got: {}",
                text
            );

            println!("Transcription successful: {}", text);
        }
        DaemonResponse::Error { message } => {
            panic!("Transcription failed with error: {}", message);
        }
        other => {
            panic!("Unexpected response: {:?}", other);
        }
    }
}

#[test]
#[ignore] // Requires daemon with model loaded
fn test_transcribe_empty_audio_returns_error() {
    assert!(
        is_daemon_running(),
        "Daemon is not running. Start it first with: mojovoice daemon &"
    );

    // Send empty audio
    let response = send_request(&DaemonRequest::TranscribeAudio { samples: vec![] })
        .expect("Failed to send request to daemon");

    // Should return an error for empty audio
    match response {
        DaemonResponse::Error { message } => {
            assert!(
                message.to_lowercase().contains("empty") || message.to_lowercase().contains("no audio"),
                "Error message should mention empty/no audio, got: {}",
                message
            );
        }
        DaemonResponse::Success { text } => {
            // Some implementations return success with "no speech detected"
            assert!(
                text.to_lowercase().contains("no speech"),
                "Expected error or 'no speech detected', got success: {}",
                text
            );
        }
        other => {
            panic!("Expected Error response for empty audio, got: {:?}", other);
        }
    }
}

#[test]
#[ignore] // Requires daemon with model loaded
fn test_transcribe_silence_returns_minimal_output() {
    assert!(
        is_daemon_running(),
        "Daemon is not running. Start it first with: mojovoice daemon &"
    );

    // Generate 2 seconds of silence (16kHz)
    let silence: Vec<f32> = vec![0.0; 32000];

    let response = send_request(&DaemonRequest::TranscribeAudio { samples: silence })
        .expect("Failed to send request to daemon");

    // Silence should produce minimal output - either empty, "no speech",
    // or a very short hallucination (common behavior for Whisper models)
    match response {
        DaemonResponse::Success { text } => {
            // Whisper models may hallucinate short outputs on silence
            // We just verify it's not a long transcription
            assert!(
                text.len() < 50,
                "Silence should produce minimal output, got {} chars: {}",
                text.len(),
                text
            );
            println!("Silence produced: {:?}", text);
        }
        DaemonResponse::Error { message } => {
            // Also acceptable - some implementations error on pure silence
            println!("Silence produced error (acceptable): {}", message);
        }
        other => {
            panic!("Unexpected response for silence: {:?}", other);
        }
    }
}
