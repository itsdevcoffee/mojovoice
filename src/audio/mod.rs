//! Audio capture using CPAL (Cross-Platform Audio Library)

use anyhow::{Context, Result};
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::{Device, Stream, StreamConfig};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tracing::{info, warn};

const TARGET_SAMPLE_RATE: u32 = 16000;

/// Audio device info for UI display
#[allow(dead_code)] // Public API - called from Tauri UI
#[derive(Debug, Clone)]
pub struct AudioDeviceInfo {
    /// Human-readable device name (displayed in UI)
    pub name: String,
    /// Whether this is the system default device
    pub is_default: bool,
    /// Internal device identifier for CPAL (ALSA device name on Linux)
    /// When None, uses the name field directly
    pub internal_name: Option<String>,
}

/// List available audio input devices
/// On Linux with PipeWire, this queries both CPAL/ALSA and PipeWire sources
#[allow(dead_code)] // Public API - called from Tauri UI
pub fn list_input_devices() -> Result<Vec<AudioDeviceInfo>> {
    #[cfg(target_os = "linux")]
    {
        // Try to get devices from PipeWire first (more comprehensive on modern Linux)
        if let Ok(pipewire_devices) = list_pipewire_devices() {
            if !pipewire_devices.is_empty() {
                info!("Found {} PipeWire audio source(s)", pipewire_devices.len());
                return Ok(pipewire_devices);
            }
        }
        warn!("PipeWire enumeration failed or empty, falling back to CPAL/ALSA");
    }

    // Fallback: Use CPAL's ALSA backend (works on all platforms)
    list_cpal_devices()
}

/// List devices using CPAL's native backend (ALSA on Linux, CoreAudio on macOS, WASAPI on Windows)
fn list_cpal_devices() -> Result<Vec<AudioDeviceInfo>> {
    let host = cpal::default_host();
    let default_device_name = host.default_input_device().and_then(|d| d.name().ok());

    let mut devices = Vec::new();
    let mut skipped_count = 0;

    for (idx, device) in host
        .input_devices()
        .context("Failed to enumerate input devices")?
        .enumerate()
    {
        match device.name() {
            Ok(name) => {
                devices.push(AudioDeviceInfo {
                    is_default: default_device_name.as_ref() == Some(&name),
                    name: name.clone(),
                    internal_name: Some(name),
                });
            }
            Err(e) => {
                skipped_count += 1;
                warn!("Skipped device {}: failed to get name ({})", idx, e);
            }
        }
    }

    if skipped_count > 0 {
        warn!(
            "Skipped {} device(s) - they may be virtual or unavailable",
            skipped_count
        );
    }

    info!("Found {} available audio input device(s) via CPAL", devices.len());

    Ok(devices)
}

/// Query PipeWire/PulseAudio for available audio sources (Linux only)
#[cfg(target_os = "linux")]
fn list_pipewire_devices() -> Result<Vec<AudioDeviceInfo>> {
    use std::process::Command;

    // Try pactl first (works with both PulseAudio and PipeWire)
    let output = Command::new("pactl")
        .args(["list", "sources", "short"])
        .output()
        .context("Failed to run pactl - PulseAudio/PipeWire not available")?;

    if !output.status.success() {
        anyhow::bail!("pactl command failed");
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut devices = Vec::new();

    // Get default source
    let default_source = Command::new("pactl")
        .args(["get-default-source"])
        .output()
        .ok()
        .and_then(|o| {
            if o.status.success() {
                Some(String::from_utf8_lossy(&o.stdout).trim().to_string())
            } else {
                None
            }
        });

    // Parse pactl output: ID  NAME  MODULE  SAMPLE_SPEC  STATE
    for line in stdout.lines() {
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() >= 2 {
            let source_name = parts[1].to_string();

            // Skip monitor sources (outputs) - we only want input sources
            if source_name.ends_with(".monitor") {
                continue;
            }

            // Get human-readable description
            let description = get_source_description(&source_name).unwrap_or_else(|| source_name.clone());

            devices.push(AudioDeviceInfo {
                name: description,
                is_default: default_source.as_ref() == Some(&source_name),
                internal_name: Some(source_name), // Store PipeWire source name
            });
        }
    }

    Ok(devices)
}

/// Get human-readable description for a PipeWire source
#[cfg(target_os = "linux")]
fn get_source_description(source_name: &str) -> Option<String> {
    use std::process::Command;

    let output = Command::new("pactl")
        .args(["list", "sources"])
        .output()
        .ok()?;

    if !output.status.success() {
        return None;
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut in_target_source = false;

    for line in stdout.lines() {
        let trimmed = line.trim();

        // Check if we're entering the target source section
        if trimmed.starts_with("Name: ") && trimmed.contains(source_name) {
            in_target_source = true;
            continue;
        }

        // If we're in the target source, look for Description
        if in_target_source {
            if trimmed.starts_with("Description: ") {
                return Some(trimmed.strip_prefix("Description: ")?.trim().to_string());
            }

            // Stop if we hit another source
            if trimmed.starts_with("Name: ") {
                break;
            }
        }
    }

    None
}

/// Temporarily set a PipeWire source as the default input
/// This allows CPAL to use it via the "default" ALSA device
#[cfg(target_os = "linux")]
fn set_pipewire_source_temporarily(source_name: &str) -> Result<()> {
    use std::process::Command;

    info!("Setting PipeWire default source to: {}", source_name);

    let output = Command::new("pactl")
        .args(["set-default-source", source_name])
        .output()
        .context("Failed to run pactl")?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        anyhow::bail!("Failed to set default source: {}", stderr);
    }

    Ok(())
}

#[cfg(not(target_os = "linux"))]
fn set_pipewire_source_temporarily(_source_name: &str) -> Result<()> {
    // No-op on non-Linux platforms
    Ok(())
}

/// Get the current PipeWire/PulseAudio default source name
#[cfg(target_os = "linux")]
fn get_pipewire_default_source() -> Result<String> {
    use std::process::Command;

    let output = Command::new("pactl")
        .args(["info"])
        .output()
        .context("Failed to run pactl")?;

    if !output.status.success() {
        anyhow::bail!("pactl info failed");
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    for line in stdout.lines() {
        if line.starts_with("Default Source:") {
            if let Some(source) = line.strip_prefix("Default Source:") {
                return Ok(source.trim().to_string());
            }
        }
    }

    anyhow::bail!("Could not find default source in pactl info")
}

/// Audio device configuration
struct AudioSetup {
    device: Device,
    config: StreamConfig,
    sample_rate: u32,
    channels: u16,
}

/// Set up an audio input device by name, or the default if None
fn setup_audio_device(device_name: Option<&str>) -> Result<AudioSetup> {
    // On Linux with PipeWire, handle device selection specially
    #[cfg(target_os = "linux")]
    {
        if let Some(name) = device_name {
            // Try to resolve device name (handles both display names and internal names)
            if let Ok(internal_name) = resolve_device_name(name) {
                info!("Resolved device '{}' to PipeWire source '{}'", name, internal_name);
                // Set as default PipeWire source, then use ALSA "default" device
                if let Err(e) = set_pipewire_source_temporarily(&internal_name) {
                    warn!("Failed to set PipeWire source: {}. Falling back to default device.", e);
                } else {
                    return setup_cpal_device(Some("default"));
                }
            }

            // Fallback: try direct CPAL device lookup
            info!("Using device name '{}' directly with CPAL", name);
        } else {
            // No device specified - use PipeWire's actual default source
            // CPAL's default_input_device() doesn't respect PipeWire's default on Linux
            match get_pipewire_default_source() {
                Ok(source) => {
                    info!("Using PipeWire default source: {}", source);
                    // The source is already the default in PipeWire, just use CPAL's "default"
                    return setup_cpal_device(Some("default"));
                }
                Err(e) => {
                    warn!("Failed to get PipeWire default source: {}. Using CPAL default.", e);
                }
            }
        }
    }

    // Standard CPAL device selection for ALSA device names or other platforms
    setup_cpal_device(device_name)
}

/// Resolve a device name (display name or internal name) to a PipeWire source name
/// Returns the internal PipeWire source name if found
#[cfg(target_os = "linux")]
fn resolve_device_name(name: &str) -> Result<String> {
    // If it already looks like a PipeWire source name, use it directly
    if name.contains('.') || name.starts_with("alsa_") || name.starts_with("bluez_") {
        return Ok(name.to_string());
    }

    // Query PipeWire for all sources and match by display name
    let devices = list_pipewire_devices()
        .context("Failed to query PipeWire devices")?;

    // Try exact match on display name
    for device in &devices {
        if device.name == name {
            if let Some(ref internal) = device.internal_name {
                return Ok(internal.clone());
            }
        }
    }

    // Try partial match (case-insensitive)
    let name_lower = name.to_lowercase();
    for device in &devices {
        if device.name.to_lowercase().contains(&name_lower) {
            if let Some(ref internal) = device.internal_name {
                warn!("Using partial match: '{}' -> '{}'", name, device.name);
                return Ok(internal.clone());
            }
        }
    }

    anyhow::bail!("Device '{}' not found in PipeWire sources", name)
}

/// Set up CPAL device using standard ALSA/CoreAudio/WASAPI device names
fn setup_cpal_device(device_name: Option<&str>) -> Result<AudioSetup> {
    let host = cpal::default_host();

    let device = match device_name {
        Some(name) => {
            // Collect devices once, then find by name
            let devices: Vec<_> = host
                .input_devices()
                .context("Failed to enumerate input devices")?
                .collect();

            devices
                .into_iter()
                .find(|d| d.name().ok().as_deref() == Some(name))
                .ok_or_else(|| {
                    // Re-enumerate for error message (devices consumed by find)
                    let available: Vec<String> = host
                        .input_devices()
                        .ok()
                        .map(|devs| devs.filter_map(|d| d.name().ok()).collect())
                        .unwrap_or_default();
                    anyhow::anyhow!(
                        "Audio device '{}' not found. Available: {:?}. \
                        Update config or select 'System Default' in Settings.",
                        name,
                        available
                    )
                })?
        },
        None => host
            .default_input_device()
            .context("No input device available. Check microphone permissions.")?,
    };

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

/// Capture audio from microphone for fixed duration.
/// Returns f32 PCM samples at 16kHz mono (Whisper requirement).
pub fn capture(
    duration_secs: u32,
    _sample_rate: u32,
    device_name: Option<&str>,
) -> Result<Vec<f32>> {
    info!("Starting audio capture: {}s", duration_secs);

    let setup = setup_audio_device(device_name)?;
    let expected_samples = (setup.sample_rate * duration_secs) as usize * setup.channels as usize;
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
pub fn capture_toggle(
    max_duration_secs: u32,
    _sample_rate: u32,
    device_name: Option<&str>,
) -> Result<Vec<f32>> {
    use crate::state::toggle::should_stop;

    info!("Starting toggle mode capture (max {}s)", max_duration_secs);

    let setup = setup_audio_device(device_name)?;
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
    let actual_duration = samples.len() as f32 / (setup.sample_rate * setup.channels as u32) as f32;
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

    let mut resampler =
        match FftFixedIn::<f64>::new(from_rate as usize, to_rate as usize, chunk_size, 2, 1) {
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
