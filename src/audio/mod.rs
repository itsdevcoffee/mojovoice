//! Audio capture using CPAL (Cross-Platform Audio Library)

use anyhow::{Context, Result};
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::{Device, Stream, StreamConfig};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tracing::{info, warn};

const TARGET_SAMPLE_RATE: u32 = 16000;

/// Audio device configuration
struct AudioSetup {
    device: Device,
    config: StreamConfig,
    sample_rate: u32,
    channels: u16,
}

/// Set up the default audio input device
fn setup_audio_device() -> Result<AudioSetup> {
    let host = cpal::default_host();
    let device = host
        .default_input_device()
        .context("No input device available. Check microphone permissions.")?;

    let default_config = device
        .default_input_config()
        .context("Failed to get default input config")?;

    info!(
        "Audio device: {} ({}Hz, {} ch)",
        device.name().unwrap_or_else(|_| "Unknown".to_string()),
        default_config.sample_rate().0,
        default_config.channels()
    );

    Ok(AudioSetup {
        config: default_config.config(),
        sample_rate: default_config.sample_rate().0,
        channels: default_config.channels(),
        device,
    })
}

/// Build an input stream that collects samples into a shared buffer
fn build_capture_stream(
    setup: &AudioSetup,
    buffer: Arc<Mutex<Vec<f32>>>,
    started: Arc<AtomicBool>,
) -> Result<Stream> {
    let stream = setup.device.build_input_stream(
        &setup.config,
        move |data: &[f32], _: &cpal::InputCallbackInfo| {
            if !started.swap(true, Ordering::Relaxed) {
                info!("Recording started - speak now!");
            }
            buffer.lock().unwrap().extend_from_slice(data);
        },
        |err| eprintln!("Stream error: {}", err),
        None,
    )?;
    stream.play()?;
    Ok(stream)
}

/// Extract samples from the shared buffer after recording
fn extract_samples(buffer: Arc<Mutex<Vec<f32>>>) -> Vec<f32> {
    Arc::try_unwrap(buffer)
        .map(|mutex| mutex.into_inner().unwrap())
        .unwrap_or_else(|arc| arc.lock().unwrap().clone())
}

/// Convert stereo to mono by averaging channels
fn to_mono(samples: Vec<f32>, channels: u16) -> Vec<f32> {
    if channels == 2 {
        samples
            .chunks_exact(2)
            .map(|chunk| (chunk[0] + chunk[1]) / 2.0)
            .collect()
    } else {
        samples
    }
}

/// Capture audio from default microphone for fixed duration.
/// Returns f32 PCM samples at 16kHz mono (Whisper requirement).
pub fn capture(duration_secs: u32, _sample_rate: u32) -> Result<Vec<f32>> {
    info!("Starting audio capture: {}s", duration_secs);

    let setup = setup_audio_device()?;
    let expected_samples =
        (setup.sample_rate * duration_secs) as usize * setup.channels as usize;
    let buffer = Arc::new(Mutex::new(Vec::with_capacity(expected_samples)));
    let started = Arc::new(AtomicBool::new(false));

    let stream = build_capture_stream(&setup, buffer.clone(), started)?;
    std::thread::sleep(Duration::from_secs(duration_secs as u64));
    drop(stream);

    let samples = extract_samples(buffer);
    log_capture_stats(&samples, &setup);

    let mono_samples = to_mono(samples, setup.channels);
    finalize_audio_samples(mono_samples, setup.sample_rate, TARGET_SAMPLE_RATE)
}

/// Capture in toggle mode - stops when signal received or max duration reached
pub fn capture_toggle(max_duration_secs: u32, _sample_rate: u32) -> Result<Vec<f32>> {
    use crate::state::toggle::should_stop;

    info!("Starting toggle mode capture (max {}s)", max_duration_secs);

    let setup = setup_audio_device()?;
    let expected_samples =
        (setup.sample_rate * max_duration_secs) as usize * setup.channels as usize;
    let buffer = Arc::new(Mutex::new(Vec::with_capacity(expected_samples)));
    let started = Arc::new(AtomicBool::new(false));

    let stream = build_capture_stream(&setup, buffer.clone(), started)?;

    let poll_interval = Duration::from_millis(100);
    let max_duration = Duration::from_secs(max_duration_secs as u64);
    let start = Instant::now();

    loop {
        std::thread::sleep(poll_interval);

        if should_stop() {
            info!("Stop signal received");
            break;
        }

        if start.elapsed() >= max_duration {
            info!("Max duration reached ({}s)", max_duration_secs);
            break;
        }
    }

    // Buffer trailing words for 1 second after stop
    info!("Buffering trailing audio (1s)...");
    std::thread::sleep(Duration::from_secs(1));

    drop(stream);

    let samples = extract_samples(buffer);
    log_capture_stats(&samples, &setup);

    let mono_samples = to_mono(samples, setup.channels);
    finalize_audio_samples(mono_samples, setup.sample_rate, TARGET_SAMPLE_RATE)
}

fn log_capture_stats(samples: &[f32], setup: &AudioSetup) {
    let actual_duration =
        samples.len() as f32 / (setup.sample_rate * setup.channels as u32) as f32;
    info!(
        "Captured {} samples ({:.2}s at {}Hz)",
        samples.len(),
        actual_duration,
        setup.sample_rate
    );
}

/// Resample to target rate if needed, with 1kHz tolerance
fn finalize_audio_samples(
    raw_samples: Vec<f32>,
    source_rate: u32,
    target_rate: u32,
) -> Result<Vec<f32>> {
    if raw_samples.is_empty() {
        warn!("No audio captured - check microphone permissions");
        return Ok(Vec::new());
    }

    let needs_resample = (source_rate as i32 - target_rate as i32).abs() > 1000;
    let samples = if needs_resample {
        info!("Resampling {}Hz -> {}Hz", source_rate, target_rate);
        resample(&raw_samples, source_rate, target_rate)
    } else {
        raw_samples
    };

    info!(
        "Final audio: {} samples ({:.2}s)",
        samples.len(),
        samples.len() as f32 / target_rate as f32
    );

    Ok(samples)
}

/// High-quality resampling using rubato (sinc interpolation)
fn resample(samples: &[f32], from_rate: u32, to_rate: u32) -> Vec<f32> {
    use rubato::{FftFixedIn, Resampler};

    let samples_f64: Vec<f64> = samples.iter().map(|&s| s as f64).collect();
    let chunk_size = 1024;

    let mut resampler = match FftFixedIn::<f64>::new(
        from_rate as usize,
        to_rate as usize,
        chunk_size,
        2,
        1,
    ) {
        Ok(r) => r,
        Err(e) => {
            warn!("Resampler init failed: {}, using linear fallback", e);
            return resample_linear(samples, from_rate as f32 / to_rate as f32);
        },
    };

    let mut output_f64: Vec<f64> = Vec::new();

    for chunk in samples_f64.chunks(chunk_size) {
        let input = if chunk.len() < chunk_size {
            let mut padded = chunk.to_vec();
            padded.resize(chunk_size, 0.0);
            vec![padded]
        } else {
            vec![chunk.to_vec()]
        };

        match resampler.process(&input, None) {
            Ok(output) => {
                if let Some(channel) = output.first() {
                    output_f64.extend(channel);
                }
            },
            Err(e) => {
                warn!("Resample error: {}, using linear fallback", e);
                return resample_linear(samples, from_rate as f32 / to_rate as f32);
            },
        }
    }

    output_f64.iter().map(|&s| s as f32).collect()
}

/// Fallback linear interpolation resampling
fn resample_linear(samples: &[f32], ratio: f32) -> Vec<f32> {
    let output_len = (samples.len() as f32 / ratio) as usize;
    (0..output_len)
        .map(|i| {
            let src_pos = i as f32 * ratio;
            let src_idx = src_pos as usize;
            let frac = src_pos - src_idx as f32;

            if src_idx + 1 < samples.len() {
                samples[src_idx] * (1.0 - frac) + samples[src_idx + 1] * frac
            } else if src_idx < samples.len() {
                samples[src_idx]
            } else {
                0.0
            }
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_resample_linear_upsampling() {
        let samples = vec![0.0, 1.0, 0.0, -1.0];
        let result = resample_linear(&samples, 0.5); // 2x upsampling
        assert!(result.len() > samples.len());
    }

    #[test]
    fn test_resample_linear_downsampling() {
        let samples: Vec<f32> = (0..100).map(|x| (x as f32).sin()).collect();
        let result = resample_linear(&samples, 2.0); // 2x downsampling
        assert!(result.len() < samples.len());
    }
}
