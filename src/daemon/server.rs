use anyhow::{Context, Result};
use std::fs;
use std::io::{BufRead, BufReader, Write};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread::{self, JoinHandle};
use tracing::{error, info, warn};

use crate::audio::{capture_toggle, list_input_devices};
use crate::daemon::client::is_daemon_running;
use crate::daemon::indicator::{self, Activity, Outcome};
use crate::daemon::protocol::{DaemonRequest, DaemonResponse};
use crate::daemon::transport;
use crate::history::{self, HistoryEntry, enforce_max_entries};
use crate::state;
use interprocess::local_socket::prelude::*;
// Transcriber trait is now used via Box<dyn ...>

/// Validate configured audio device exists, returns None (system default) if not found.
/// If the device is stale (no longer available), updates the config file to remove it.
fn validate_audio_device(configured_device: Option<String>) -> Option<String> {
    let name = configured_device.as_ref()?;

    match list_input_devices() {
        Ok(devices) => {
            let device_exists = devices.iter().any(|d| &d.name == name);
            if device_exists {
                configured_device
            } else {
                let available: Vec<_> = devices.iter().map(|d| d.name.as_str()).collect();
                warn!(
                    "Configured audio device '{}' not found. Available: {:?}. Falling back to system default.",
                    name, available
                );

                // Update config to remove the stale device
                if let Ok(mut config) = crate::config::load() {
                    config.audio.device_name = None;
                    if let Err(e) = crate::config::save(&config) {
                        warn!("Failed to update config with cleared device: {}", e);
                    } else {
                        info!("Updated config: cleared stale device_name");
                    }
                }

                None
            }
        },
        Err(e) => {
            warn!(
                "Failed to list audio devices: {}. Using configured device anyway.",
                e
            );
            configured_device
        },
    }
}

/// Shared state for async recording
struct RecordingState {
    handle: Option<JoinHandle<Result<Vec<f32>>>>,
    audio: Option<Vec<f32>>,
}

/// Daemon server state
struct DaemonServer {
    transcriber: Arc<Mutex<Box<dyn crate::transcribe::Transcriber>>>,
    recording_state: Arc<Mutex<RecordingState>>,
    shutdown: Arc<AtomicBool>,
    model_name: String,
    gpu_enabled: bool,
    gpu_name: String,
    start_time: std::time::Instant,
}

impl DaemonServer {
    fn new(_model_path: &Path) -> Result<Self> {
        let config = crate::config::load()?;

        info!("Loading whisper model into GPU memory...");

        if let Some(ref p) = config.model.prompt {
            if !p.is_empty() {
                warn!(
                    "model.prompt in config is deprecated and will be ignored; use mojovoice vocab add instead."
                );
            }
        }

        let vocab_prompt = crate::vocab::VocabStore::open()
            .and_then(|s| s.get_prompt_string(224))
            .unwrap_or(None);

        let transcriber = crate::transcribe::load_engine(
            &config.model.path,
            &config.model.language,
            vocab_prompt,
        )?;

        // GPU status for status reporting, from the engine actually in use
        let (gpu_enabled, gpu_name) = transcriber.device_label();
        info!("Model loaded ({})", gpu_name);

        // Extract model name from path basename (unique per model variant)
        // We use path instead of model_id because model_id is the HuggingFace repo
        // which may be shared by multiple quantization variants (e.g., Q4, Q4K, Q8)
        let model_name = config
            .model
            .path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("unknown")
            .to_string();

        Ok(Self {
            transcriber: Arc::new(Mutex::new(transcriber)),
            recording_state: Arc::new(Mutex::new(RecordingState {
                handle: None,
                audio: None,
            })),
            shutdown: Arc::new(AtomicBool::new(false)),
            model_name,
            gpu_enabled,
            gpu_name,
            start_time: std::time::Instant::now(),
        })
    }

    /// Save audio recording as WAV file with timestamp
    /// Returns the path to the saved file on success
    fn save_audio_recording(
        samples: &[f32],
        output_dir: &Path,
        sample_rate: u32,
    ) -> Result<PathBuf> {
        // Create output directory if it doesn't exist
        std::fs::create_dir_all(output_dir).context("Failed to create audio clips directory")?;

        // Generate filename with timestamp
        let timestamp = chrono::Local::now().format("%Y%m%d_%H%M%S");
        let filename = format!("recording_{}.wav", timestamp);
        let filepath = output_dir.join(filename);

        // Write WAV file
        let spec = hound::WavSpec {
            channels: 1,
            sample_rate,
            bits_per_sample: 32,
            sample_format: hound::SampleFormat::Float,
        };

        let mut writer =
            hound::WavWriter::create(&filepath, spec).context("Failed to create WAV file")?;

        for &sample in samples {
            writer
                .write_sample(sample)
                .context("Failed to write sample")?;
        }

        writer.finalize().context("Failed to finalize WAV file")?;

        info!("Audio saved to: {}", filepath.display());
        Ok(filepath)
    }

    fn handle_client(&self, stream: transport::Stream) -> Result<()> {
        let mut reader = BufReader::new(&stream);
        let mut line = String::new();

        reader.read_line(&mut line)?;

        let request: DaemonRequest =
            serde_json::from_str(line.trim()).context("Failed to parse request")?;

        // Log request type (not full content for large payloads like TranscribeAudio)
        match &request {
            DaemonRequest::TranscribeAudio { samples } => {
                info!(
                    "Received TranscribeAudio request ({} samples)",
                    samples.len()
                );
            },
            _ => {
                info!("Received from client: {}", line.trim());
            },
        }

        let response = match request {
            DaemonRequest::Ping => DaemonResponse::Ok {
                message: "pong".to_string(),
            },
            DaemonRequest::StartRecording { max_duration } => {
                let response = self.handle_start_recording(max_duration)?;
                if matches!(response, DaemonResponse::Recording) {
                    indicator::set(Activity::Recording);
                }
                response
            },
            DaemonRequest::StopRecording => {
                indicator::set(Activity::Transcribing);
                let response = self.handle_stop_recording();
                indicator::finish(match &response {
                    Ok(DaemonResponse::Success { text }) if text.trim().is_empty() => {
                        Outcome::NoSpeech
                    },
                    Ok(DaemonResponse::Success { text }) => Outcome::Transcribed(text.clone()),
                    Ok(DaemonResponse::Error { message }) => Outcome::Failed(message.clone()),
                    Err(e) => Outcome::Failed(format!("{:#}", e)),
                    Ok(_) => Outcome::NoSpeech,
                });
                response?
            },
            DaemonRequest::CancelRecording => {
                let response = self.handle_cancel_recording();
                indicator::set(Activity::Idle);
                response?
            },
            DaemonRequest::TranscribeAudio { samples } => {
                indicator::set(Activity::Transcribing);
                let response = self.handle_transcribe_audio(samples);
                indicator::set(Activity::Idle);
                response?
            },
            DaemonRequest::Shutdown => {
                info!("Shutdown requested");
                self.shutdown.store(true, Ordering::SeqCst);
                DaemonResponse::Ok {
                    message: "shutting down".to_string(),
                }
            },
            DaemonRequest::GetStatus => DaemonResponse::Status {
                model_name: self.model_name.clone(),
                gpu_enabled: self.gpu_enabled,
                gpu_name: self.gpu_name.clone(),
                uptime_secs: self.start_time.elapsed().as_secs(),
            },
        };

        let response_json = serde_json::to_string(&response)?;
        let mut writer = &stream;
        writer.write_all(response_json.as_bytes())?;
        writer.write_all(b"\n")?;
        writer.flush()?;

        Ok(())
    }

    fn handle_start_recording(&self, max_duration: u32) -> Result<DaemonResponse> {
        // Atomic check-and-set: mutex ensures no race between check and state update
        let mut state = self
            .recording_state
            .lock()
            .map_err(|e| anyhow::anyhow!("Recording state mutex poisoned: {}", e))?;

        // Check if already recording
        if state.handle.is_some() {
            return Ok(DaemonResponse::Error {
                message: "Already recording".to_string(),
            });
        }

        info!("Starting background recording (max {}s)", max_duration);

        // Load config and validate device exists
        let config = crate::config::load()?;
        let device_name = validate_audio_device(config.audio.device_name.clone());
        let trailing = std::time::Duration::from_millis(config.audio.trailing_buffer_ms as u64);

        // Create PID file for UI state (Waybar uses this)
        state::toggle::start_recording()?;

        // Set up signal handler for this recording session
        state::toggle::setup_signal_handler()?;

        // Spawn recording thread
        let handle = thread::spawn(move || {
            capture_toggle(max_duration, 16000, device_name.as_deref(), trailing)
        });

        state.handle = Some(handle);
        state.audio = None;

        Ok(DaemonResponse::Recording)
    }

    fn handle_cancel_recording(&self) -> Result<DaemonResponse> {
        let mut state = self
            .recording_state
            .lock()
            .map_err(|e| anyhow::anyhow!("Recording state mutex poisoned: {}", e))?;

        // Check if recording - if not, silently succeed
        let handle = match state.handle.take() {
            Some(h) => h,
            None => {
                // Not recording - silently succeed
                return Ok(DaemonResponse::Ok {
                    message: "cancelled".to_string(),
                });
            },
        };

        info!("Cancel requested - discarding recording");

        // Send stop signal (discarding: no trailing buffer)
        state::toggle::DISCARD_RECORDING.store(true, Ordering::SeqCst);
        state::toggle::STOP_RECORDING.store(true, Ordering::SeqCst);

        // Wait for recording thread to finish and discard samples
        drop(state); // Release lock while waiting
        let _ = handle
            .join()
            .map_err(|_| anyhow::anyhow!("Recording thread panicked"))?;

        // Reset stop flags for next recording
        state::toggle::STOP_RECORDING.store(false, Ordering::SeqCst);
        state::toggle::DISCARD_RECORDING.store(false, Ordering::SeqCst);

        // CRITICAL: Clean up state files so waybar returns to idle
        // Remove recording.pid file (waybar checks this first)
        let pid_file = state::paths::get_pid_file()?;
        if pid_file.exists() {
            std::fs::remove_file(&pid_file)?;
            info!("Removed recording.pid file");
        }

        // Clean up any processing state
        let _ = state::toggle::cleanup_processing();

        // Trigger waybar refresh to return to idle
        state::toggle::refresh_waybar();

        info!("Recording cancelled");

        Ok(DaemonResponse::Ok {
            message: "cancelled".to_string(),
        })
    }

    fn handle_stop_recording(&self) -> Result<DaemonResponse> {
        let mut state = self
            .recording_state
            .lock()
            .map_err(|e| anyhow::anyhow!("Recording state mutex poisoned: {}", e))?;

        // Check if recording
        let handle = match state.handle.take() {
            Some(h) => h,
            None => {
                return Ok(DaemonResponse::Error {
                    message: "Not recording".to_string(),
                });
            },
        };

        info!("Stop requested - signaling recording thread");

        // Send stop signal
        state::toggle::STOP_RECORDING.store(true, Ordering::SeqCst);

        // Wait for recording thread to finish
        drop(state); // Release lock while waiting
        let samples = handle
            .join()
            .map_err(|_| anyhow::anyhow!("Recording thread panicked"))??;

        // Reset stop flags for next recording
        state::toggle::STOP_RECORDING.store(false, Ordering::SeqCst);
        state::toggle::DISCARD_RECORDING.store(false, Ordering::SeqCst);

        info!("Captured {} samples", samples.len());

        if samples.is_empty() {
            return Ok(DaemonResponse::Error {
                message: "No audio captured".to_string(),
            });
        }

        // Save audio if enabled in config, capture the saved path
        let config = crate::config::load()?;
        let saved_audio_path = if config.audio.save_audio_clips {
            match Self::save_audio_recording(
                &samples,
                &config.audio.audio_clips_path,
                config.audio.sample_rate,
            ) {
                Ok(path) => Some(path),
                Err(e) => {
                    warn!("Failed to save audio recording: {}", e);
                    None
                },
            }
        } else {
            None
        };

        // CRITICAL: Remove recording.pid BEFORE creating processing file
        // Otherwise Waybar keeps showing "recording" (checks recording.pid first)
        state::toggle::cleanup_recording()?;

        // Create processing state file for Waybar (now recording.pid is gone)
        state::toggle::start_processing()?;

        // Transcribe with the persistent model
        info!("Transcribing {} samples...", samples.len());
        let mut transcriber = self
            .transcriber
            .lock()
            .map_err(|e| anyhow::anyhow!("Transcriber mutex poisoned: {}", e))?;

        let text = match transcriber.transcribe(&samples) {
            Ok(t) => {
                info!("Transcription completed successfully");
                t
            },
            Err(e) => {
                error!("Transcription failed with error: {}", e);
                error!("Error chain: {:?}", e);
                let _ = state::toggle::cleanup_processing();
                return Ok(DaemonResponse::Error {
                    message: format!("Transcription error: {}", e),
                });
            },
        };

        if text.is_empty() {
            let _ = state::toggle::cleanup_processing();
            return Ok(DaemonResponse::Error {
                message: "No speech detected".to_string(),
            });
        }

        info!("Transcribed: {}", text);

        // Calculate recording duration from sample count
        // samples / sample_rate * 1000 = duration_ms
        let duration_ms = (samples.len() as u64 * 1000) / config.audio.sample_rate as u64;

        // Convert saved audio path to string for history entry
        let audio_path = saved_audio_path.map(|p| p.to_string_lossy().to_string());

        // Save to history
        let history_entry = HistoryEntry::new(
            text.clone(),
            duration_ms,
            self.model_name.clone(),
            audio_path,
        );

        if let Err(e) = history::append_entry(&history_entry) {
            warn!("Failed to save history entry: {}", e);
        } else {
            // Enforce max_entries limit if set
            if let Some(max) = config.history.max_entries {
                if let Err(e) = enforce_max_entries(max as usize) {
                    warn!("Failed to enforce max_entries: {}", e);
                }
            }
        }

        // Clean up processing state file (recording.pid already removed above)
        state::toggle::cleanup_processing()?;

        Ok(DaemonResponse::Success { text })
    }

    /// Handle transcribe audio request (for file transcription)
    fn handle_transcribe_audio(&self, samples: Vec<f32>) -> Result<DaemonResponse> {
        info!("Transcribing {} samples from file...", samples.len());

        if samples.is_empty() {
            return Ok(DaemonResponse::Error {
                message: "No audio samples provided".to_string(),
            });
        }

        // Transcribe with the persistent model
        let mut transcriber = self
            .transcriber
            .lock()
            .map_err(|e| anyhow::anyhow!("Transcriber mutex poisoned: {}", e))?;

        let text = match transcriber.transcribe(&samples) {
            Ok(t) => {
                info!("Transcription completed successfully");
                t
            },
            Err(e) => {
                error!("Transcription failed: {}", e);
                return Ok(DaemonResponse::Error {
                    message: format!("Transcription error: {}", e),
                });
            },
        };

        if text.is_empty() {
            return Ok(DaemonResponse::Success {
                text: "(no speech detected)".to_string(),
            });
        }

        info!("Transcribed: {}", text);
        Ok(DaemonResponse::Success { text })
    }
}

/// Opt the daemon out of Windows power throttling (EcoQoS). Windows 11 throttles
/// background processes without a window, like the daemon, which can make
/// transcription many times slower.
#[cfg(windows)]
fn disable_power_throttling() {
    use windows_sys::Win32::System::Threading::{
        GetCurrentProcess, PROCESS_POWER_THROTTLING_CURRENT_VERSION,
        PROCESS_POWER_THROTTLING_EXECUTION_SPEED, PROCESS_POWER_THROTTLING_STATE,
        ProcessPowerThrottling, SetProcessInformation,
    };

    let state = PROCESS_POWER_THROTTLING_STATE {
        Version: PROCESS_POWER_THROTTLING_CURRENT_VERSION,
        // Control execution speed throttling, and turn it off
        ControlMask: PROCESS_POWER_THROTTLING_EXECUTION_SPEED,
        StateMask: 0,
    };
    // SAFETY: passes a correctly sized PROCESS_POWER_THROTTLING_STATE for the current process
    let ok = unsafe {
        SetProcessInformation(
            GetCurrentProcess(),
            ProcessPowerThrottling,
            &state as *const _ as *const std::ffi::c_void,
            std::mem::size_of::<PROCESS_POWER_THROTTLING_STATE>() as u32,
        )
    };
    if ok == 0 {
        warn!(
            "Couldn't disable power throttling: {}",
            std::io::Error::last_os_error()
        );
    } else {
        info!("Power throttling disabled for the daemon");
    }
}

/// Run the daemon server
pub fn run_daemon(model_path: &Path) -> Result<()> {
    #[cfg(windows)]
    disable_power_throttling();

    if is_daemon_running() {
        anyhow::bail!("Daemon is already running. Stop it first or use the existing daemon.");
    }
    // Nothing answered, so any leftover socket file is stale
    transport::remove_stale()?;

    // Clean up any stale state files from previous session
    // This ensures Waybar starts in idle state, not processing
    let _ = state::toggle::cleanup_processing();
    let pid_file = state::paths::get_pid_file()?;
    if pid_file.exists() {
        info!("Removing stale recording.pid file");
        let _ = fs::remove_file(&pid_file);
    }

    // Non-blocking accept so we can check the shutdown flag periodically
    let listener = transport::bind()?;

    // Write daemon PID file
    let daemon_pid_file = state::paths::get_daemon_pid_file()?;
    fs::write(&daemon_pid_file, std::process::id().to_string())?;
    info!(
        "Daemon PID {} written to {}",
        std::process::id(),
        daemon_pid_file.display()
    );

    // Validate audio device configuration at startup
    if let Ok(config) = crate::config::load() {
        if config.audio.device_name.is_some() {
            // This will log a warning if the device is not found
            let _ = validate_audio_device(config.audio.device_name);
        }
    }

    info!("Daemon listening on {}", transport::endpoint());

    let server = DaemonServer::new(model_path)?;

    let config = crate::config::load().ok();
    let hotkey = config.as_ref().and_then(|c| c.hotkey.toggle.clone());
    // Windows: tray icon and status overlay showing idle/recording/transcribing, plus
    // the global hotkey
    #[cfg(windows)]
    {
        let options = super::indicator::tray::UiOptions {
            hotkey,
            push_to_talk: config
                .as_ref()
                .is_some_and(|c| c.hotkey.mode == crate::config::HotkeyMode::PushToTalk),
            overlay: config.as_ref().is_none_or(|c| c.overlay.enabled),
        };
        if let Err(e) = super::indicator::tray::spawn(options, server.shutdown.clone()) {
            warn!("{:#}", e);
        }
    }
    #[cfg(not(windows))]
    if let Some(hotkey) = hotkey {
        warn!(
            "hotkey.toggle ({}) is only supported on Windows; bind 'mojovoice start' in your desktop environment instead",
            hotkey
        );
    }

    loop {
        // Check shutdown flag
        if server.shutdown.load(Ordering::SeqCst) {
            info!("Shutdown flag set, exiting");
            break;
        }

        match listener.accept() {
            Ok(stream) => {
                if let Err(e) = server.handle_client(stream) {
                    error!("Error handling client: {}", e);
                }
            },
            Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                // No pending connections, sleep briefly and check shutdown flag
                std::thread::sleep(std::time::Duration::from_millis(100));
            },
            Err(e) => {
                error!("Error accepting connection: {}", e);
            },
        }
    }

    // Dropping the listener removes the Unix socket file
    drop(listener);
    if daemon_pid_file.exists() {
        fs::remove_file(&daemon_pid_file)?;
    }

    info!("Daemon shut down");
    Ok(())
}
