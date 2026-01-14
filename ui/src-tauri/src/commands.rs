use serde::{Deserialize, Serialize};
use tauri::Emitter;
use crate::daemon_client;

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DaemonStatus {
    pub running: bool,
    pub model_loaded: bool,
    pub gpu_enabled: bool,
    pub gpu_name: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TranscriptionEntry {
    pub id: String,
    pub text: String,
    pub timestamp: i64,
    pub duration_ms: u64,
    pub model: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SystemInfo {
    pub cpu_cores: usize,
    pub total_ram_gb: f32,
    pub gpu_available: bool,
    pub gpu_vram_mb: Option<u32>,
    pub platform: String,
}

/// Check if the mojovoice daemon is running
#[tauri::command]
pub async fn get_daemon_status() -> Result<DaemonStatus, String> {
    match daemon_client::get_status() {
        Ok(status) => Ok(DaemonStatus {
            running: status.running,
            model_loaded: status.model_loaded,
            gpu_enabled: status.gpu_enabled,
            gpu_name: status.gpu_name,
        }),
        Err(e) => {
            eprintln!("Failed to get daemon status: {}", e);
            // Return offline status on error
            Ok(DaemonStatus {
                running: false,
                model_loaded: false,
                gpu_enabled: false,
                gpu_name: None,
            })
        }
    }
}

/// Start recording audio
#[tauri::command]
pub async fn start_recording() -> Result<(), String> {
    // Read timeout from config
    let config = get_config().await?;
    let timeout_secs = config.audio.timeout_secs;

    let request = daemon_client::DaemonRequest::StartRecording {
        max_duration: timeout_secs,
    };

    match daemon_client::send_request(request) {
        Ok(response) => match response {
            daemon_client::DaemonResponse::Recording => {
                println!("Recording started");
                Ok(())
            }
            daemon_client::DaemonResponse::Error { message } => {
                Err(format!("Daemon error: {}", message))
            }
            _ => Err("Unexpected response from daemon".to_string()),
        },
        Err(e) => Err(format!("Failed to start recording: {}", e)),
    }
}

/// Stop recording and transcribe
#[tauri::command]
pub async fn stop_recording() -> Result<String, String> {
    let request = daemon_client::DaemonRequest::StopRecording;

    match daemon_client::send_request(request) {
        Ok(response) => match response {
            daemon_client::DaemonResponse::Success { text } => {
                println!("Transcription: {}", text);

                // Trigger status bar refresh (reads user's config)
                refresh_statusbar();

                Ok(text)
            }
            daemon_client::DaemonResponse::Error { message } => {
                Err(format!("Daemon error: {}", message))
            }
            _ => Err("Unexpected response from daemon".to_string()),
        },
        Err(e) => Err(format!("Failed to stop recording: {}", e)),
    }
}

/// Cancel recording without transcribing (silent, no-op if not recording)
#[tauri::command]
pub async fn cancel_recording() -> Result<(), String> {
    let request = daemon_client::DaemonRequest::CancelRecording;

    match daemon_client::send_request(request) {
        Ok(response) => match response {
            daemon_client::DaemonResponse::Ok { .. } => {
                // Trigger status bar refresh so waybar returns to idle state
                refresh_statusbar();
                Ok(())
            }
            daemon_client::DaemonResponse::Error { message } => {
                Err(format!("Daemon error: {}", message))
            }
            _ => Err("Unexpected response from daemon".to_string()),
        },
        // Silently succeed even on connection errors (daemon might not be running)
        Err(_) => Ok(()),
    }
}

/// Refresh status bar (execute user-configured refresh_command)
fn refresh_statusbar() {
    // Read config to get refresh_command
    let config_path = dirs::config_dir()
        .map(|dir| dir.join("mojovoice").join("config.toml"));

    let Some(config_path) = config_path else {
        eprintln!("Could not determine config path");
        return;
    };

    // Read and parse config
    let Ok(config_str) = std::fs::read_to_string(&config_path) else {
        eprintln!("Could not read config file");
        return;
    };

    let Ok(config) = toml::from_str::<toml::Value>(&config_str) else {
        eprintln!("Could not parse config");
        return;
    };

    // Get refresh_command from config.output.refresh_command
    let Some(refresh_cmd) = config
        .get("output")
        .and_then(|o| o.get("refresh_command"))
        .and_then(|c| c.as_str())
    else {
        // No refresh command configured, skip silently
        return;
    };

    // Parse command string into program + args (e.g., "pkill -RTMIN+8 waybar")
    let parts: Vec<&str> = refresh_cmd.split_whitespace().collect();
    if let Some((program, args)) = parts.split_first() {
        let _ = std::process::Command::new(program)
            .args(args)
            .spawn()
            .map(|mut child| {
                // Detach immediately (non-blocking)
                let _ = child.stdin.take();
                let _ = child.stdout.take();
                let _ = child.stderr.take();
            });
    }
}

/// Get transcription history
#[tauri::command]
pub async fn get_transcription_history() -> Result<Vec<TranscriptionEntry>, String> {
    // TODO: Query transcription history from daemon or local DB
    Ok(vec![
        TranscriptionEntry {
            id: "1".to_string(),
            text: "This is a test transcription from earlier".to_string(),
            timestamp: 1704067200,
            duration_ms: 1500,
            model: "whisper-large-v3-turbo".to_string(),
        },
    ])
}

/// Progress update for model downloads
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadProgress {
    pub model_name: String,
    pub downloaded_bytes: u64,
    pub total_bytes: u64,
    pub speed_bps: u64,
    pub status: String, // "downloading", "verifying", "complete", "error"
}

/// Download a Whisper model with progress events
#[tauri::command]
pub async fn download_model(model_name: String, window: tauri::Window) -> Result<String, String> {
    use std::io::{Read, Write, BufWriter};

    // Find model in registry
    let registry = get_model_registry();
    let model = registry.iter()
        .find(|m| m.name == model_name)
        .ok_or_else(|| format!("Model '{}' not found in registry", model_name))?;

    let models_dir = get_models_dir()?;
    std::fs::create_dir_all(&models_dir)
        .map_err(|e| format!("Failed to create models directory: {}", e))?;

    let dest_path = models_dir.join(&model.filename);
    let temp_path = dest_path.with_extension("download");

    // Check if already downloaded and valid
    if dest_path.exists() {
        eprintln!("Model already exists, verifying checksum...");
        let _ = window.emit("download-progress", DownloadProgress {
            model_name: model_name.clone(),
            downloaded_bytes: 0,
            total_bytes: 0,
            speed_bps: 0,
            status: "verifying".into(),
        });

        if verify_sha256(&dest_path, &model.sha256)? {
            let _ = window.emit("download-progress", DownloadProgress {
                model_name: model_name.clone(),
                downloaded_bytes: 0,
                total_bytes: 0,
                speed_bps: 0,
                status: "complete".into(),
            });
            return Ok(dest_path.to_string_lossy().to_string());
        }
        // Invalid checksum, re-download
        std::fs::remove_file(&dest_path)
            .map_err(|e| format!("Failed to remove invalid model: {}", e))?;
    }

    eprintln!("Downloading {} ({} MB) from {}", model.name, model.size_mb, model.url);

    // Start download
    let response = ureq::get(&model.url)
        .call()
        .map_err(|e| format!("Failed to connect: {}", e))?;

    let total_bytes = response
        .header("content-length")
        .and_then(|s| s.parse::<u64>().ok())
        .unwrap_or(model.size_mb as u64 * 1_000_000);

    let mut reader = response.into_reader();
    let file = std::fs::File::create(&temp_path)
        .map_err(|e| format!("Failed to create temp file: {}", e))?;
    let mut writer = BufWriter::new(file);

    let mut buffer = [0u8; 65536]; // 64KB buffer
    let mut downloaded_bytes: u64 = 0;
    let mut last_emit_time = std::time::Instant::now();
    let start_time = std::time::Instant::now();

    loop {
        let bytes_read = reader.read(&mut buffer)
            .map_err(|e| format!("Download error: {}", e))?;

        if bytes_read == 0 {
            break;
        }

        writer.write_all(&buffer[..bytes_read])
            .map_err(|e| format!("Write error: {}", e))?;

        downloaded_bytes += bytes_read as u64;

        // Emit progress every 100ms
        let now = std::time::Instant::now();
        if now.duration_since(last_emit_time).as_millis() >= 100 {
            let elapsed = now.duration_since(start_time).as_secs_f64();
            let speed_bps = if elapsed > 0.0 {
                (downloaded_bytes as f64 / elapsed) as u64
            } else {
                0
            };

            let _ = window.emit("download-progress", DownloadProgress {
                model_name: model_name.clone(),
                downloaded_bytes,
                total_bytes,
                speed_bps,
                status: "downloading".into(),
            });

            last_emit_time = now;
        }
    }

    writer.flush().map_err(|e| format!("Flush error: {}", e))?;
    drop(writer);

    eprintln!("Download complete, verifying checksum...");
    let _ = window.emit("download-progress", DownloadProgress {
        model_name: model_name.clone(),
        downloaded_bytes: total_bytes,
        total_bytes,
        speed_bps: 0,
        status: "verifying".into(),
    });

    // Verify checksum
    if !verify_sha256(&temp_path, &model.sha256)? {
        std::fs::remove_file(&temp_path).ok();
        let _ = window.emit("download-progress", DownloadProgress {
            model_name: model_name.clone(),
            downloaded_bytes: 0,
            total_bytes: 0,
            speed_bps: 0,
            status: "error".into(),
        });
        return Err("Checksum verification failed. Download may be corrupted.".into());
    }

    // Move to final location
    std::fs::rename(&temp_path, &dest_path)
        .map_err(|e| format!("Failed to move downloaded file: {}", e))?;

    let _ = window.emit("download-progress", DownloadProgress {
        model_name: model_name.clone(),
        downloaded_bytes: total_bytes,
        total_bytes,
        speed_bps: 0,
        status: "complete".into(),
    });

    eprintln!("Model saved to {}", dest_path.display());
    Ok(dest_path.to_string_lossy().to_string())
}

/// Verify SHA256 checksum of a file
fn verify_sha256(path: &std::path::Path, expected: &str) -> Result<bool, String> {
    use sha2::{Sha256, Digest};
    use std::io::Read;

    let mut file = std::fs::File::open(path)
        .map_err(|e| format!("Failed to open file for verification: {}", e))?;

    let mut hasher = Sha256::new();
    let mut buffer = [0u8; 65536];

    loop {
        let bytes_read = file.read(&mut buffer)
            .map_err(|e| format!("Read error during verification: {}", e))?;
        if bytes_read == 0 {
            break;
        }
        hasher.update(&buffer[..bytes_read]);
    }

    let result = hasher.finalize();
    let actual = hex::encode(result);

    Ok(actual == expected)
}

/// Get system information
#[tauri::command]
pub async fn get_system_info() -> Result<SystemInfo, String> {
    Ok(SystemInfo {
        cpu_cores: num_cpus::get(),
        total_ram_gb: 32.0, // TODO: Get actual RAM
        gpu_available: true,
        gpu_vram_mb: Some(24576), // TODO: Query actual VRAM
        platform: std::env::consts::OS.to_string(),
    })
}

/// Configuration structure matching config.toml
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AppConfig {
    pub model: ModelConfig,
    pub audio: AudioConfig,
    pub output: OutputConfig,
    #[serde(default)]
    pub ui: UiConfig,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ModelConfig {
    pub path: String,
    pub model_id: String,
    pub draft_model_path: Option<String>,
    pub language: String,
    pub prompt: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AudioConfig {
    pub sample_rate: u32,
    pub timeout_secs: u32,
    pub save_audio_clips: bool,
    pub audio_clips_path: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct OutputConfig {
    pub append_space: bool,
    pub refresh_command: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UiConfig {
    pub scale_preset: String,
    pub custom_scale: f32,
}

impl Default for UiConfig {
    fn default() -> Self {
        Self {
            scale_preset: "medium".to_string(),
            custom_scale: 1.0,
        }
    }
}

/// Get current configuration
#[tauri::command]
pub async fn get_config() -> Result<AppConfig, String> {
    let config_path = dirs::config_dir()
        .ok_or("Could not determine config directory")?
        .join("mojovoice")
        .join("config.toml");

    let config_str = std::fs::read_to_string(&config_path)
        .map_err(|e| format!("Failed to read config: {}", e))?;

    let config: AppConfig = toml::from_str(&config_str)
        .map_err(|e| format!("Failed to parse config: {}", e))?;

    Ok(config)
}

/// Save configuration
#[tauri::command]
pub async fn save_config(config: AppConfig) -> Result<(), String> {
    let config_path = dirs::config_dir()
        .ok_or("Could not determine config directory")?
        .join("mojovoice")
        .join("config.toml");

    let config_str = toml::to_string_pretty(&config)
        .map_err(|e| format!("Failed to serialize config: {}", e))?;

    std::fs::write(&config_path, config_str)
        .map_err(|e| format!("Failed to write config: {}", e))?;

    Ok(())
}

/// Start the mojovoice daemon
#[tauri::command]
pub async fn start_daemon() -> Result<(), String> {
    // Check if already running
    if daemon_client::is_daemon_running() {
        return Err("Daemon is already running".to_string());
    }

    // Find mojovoice binary
    let binary = find_mojovoice_binary().ok_or("Could not find mojovoice binary")?;

    eprintln!("Starting daemon with binary: {}", binary);

    std::process::Command::new(&binary)
        .args(["daemon", "up"])
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .spawn()
        .map_err(|e| format!("Failed to start daemon: {}", e))?;

    // Wait for daemon to be ready (max 5 seconds)
    for i in 0..50 {
        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
        if daemon_client::is_daemon_running() {
            eprintln!("Daemon started successfully after {}ms", i * 100);
            return Ok(());
        }
    }

    Err("Daemon failed to start within 5 seconds".to_string())
}

/// Stop the mojovoice daemon
#[tauri::command]
pub async fn stop_daemon() -> Result<(), String> {
    // Check if running
    if !daemon_client::is_daemon_running() {
        return Err("Daemon is not running".to_string());
    }

    // Send shutdown command
    let shutdown_request = daemon_client::DaemonRequest::Shutdown;
    daemon_client::send_request(shutdown_request)
        .map_err(|e| format!("Failed to send shutdown: {}", e))?;

    // Wait for daemon to stop (max 5 seconds)
    for i in 0..50 {
        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
        if !daemon_client::is_daemon_running() {
            eprintln!("Daemon stopped after {}ms", i * 100);
            return Ok(());
        }
    }

    Err("Daemon did not stop within 5 seconds".to_string())
}

/// Restart the mojovoice daemon with new configuration
#[tauri::command]
pub async fn restart_daemon() -> Result<(), String> {
    // 1. Send shutdown command to daemon
    let shutdown_request = daemon_client::DaemonRequest::Shutdown;
    match daemon_client::send_request(shutdown_request) {
        Ok(_) => {
            eprintln!("Shutdown command sent to daemon");
        }
        Err(e) => {
            eprintln!("Failed to send shutdown (daemon might be down): {}", e);
        }
    }

    // 2. Wait for daemon to fully shut down (max 3 seconds)
    for i in 0..30 {
        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
        if !daemon_client::is_daemon_running() {
            eprintln!("Daemon shut down after {}ms", i * 100);
            break;
        }
    }

    // 3. Detect which binary was actually running, or find it
    let binary = detect_running_binary()
        .or_else(find_mojovoice_binary)
        .unwrap_or_else(|| "mojovoice".to_string());

    eprintln!("Restarting daemon with detected binary: {}", binary);

    std::process::Command::new(&binary)
        .args(["daemon", "up"])
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .spawn()
        .map_err(|e| format!("Failed to start daemon: {}", e))?;

    // 4. Wait for daemon to be ready (max 5 seconds)
    for i in 0..50 {
        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
        if daemon_client::is_daemon_running() {
            eprintln!("Daemon started successfully after {}ms", i * 100);
            return Ok(());
        }
    }

    Err("Daemon failed to start within 5 seconds".to_string())
}

/// Validate if a path exists and return its type
#[tauri::command]
pub async fn validate_path(path: String) -> Result<PathValidation, String> {
    // Expand ~ to home directory
    let expanded_path = if path.starts_with('~') {
        if let Ok(home) = std::env::var("HOME") {
            path.replacen('~', &home, 1)
        } else {
            path.clone()
        }
    } else {
        path.clone()
    };

    let path_obj = std::path::Path::new(&expanded_path);

    if !path_obj.exists() {
        return Ok(PathValidation {
            valid: false,
            exists: false,
            is_file: false,
            is_directory: false,
            expanded_path: expanded_path.clone(),
            message: "Path does not exist".to_string(),
        });
    }

    let is_file = path_obj.is_file();
    let is_directory = path_obj.is_dir();

    Ok(PathValidation {
        valid: true,
        exists: true,
        is_file,
        is_directory,
        expanded_path: expanded_path.clone(),
        message: if is_file {
            "Valid file path".to_string()
        } else if is_directory {
            "Valid directory path".to_string()
        } else {
            "Path exists".to_string()
        },
    })
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PathValidation {
    pub valid: bool,
    pub exists: bool,
    pub is_file: bool,
    pub is_directory: bool,
    pub expanded_path: String,
    pub message: String,
}

/// Find mojovoice binary in common locations
fn find_mojovoice_binary() -> Option<String> {
    let home = std::env::var("HOME").ok()?;
    let path = format!("{}/.local/bin/mojovoice", home);

    if std::path::Path::new(&path).exists() {
        return Some(path);
    }

    // Try PATH as fallback
    if let Ok(output) = std::process::Command::new("which")
        .arg("mojovoice")
        .output()
    {
        if output.status.success() {
            let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if !path.is_empty() {
                return Some(path);
            }
        }
    }

    None
}

/// Detect which mojovoice binary is currently running
fn detect_running_binary() -> Option<String> {
    // Run: ps aux | grep mojovoice | grep daemon
    let output = std::process::Command::new("ps")
        .args(["aux"])
        .output()
        .ok()?;

    let stdout = String::from_utf8_lossy(&output.stdout);

    // Find lines with "mojovoice" and "daemon"
    for line in stdout.lines() {
        if line.contains("mojovoice") && line.contains("daemon") && !line.contains("grep") {
            // Extract the command path (usually in the later columns)
            let parts: Vec<&str> = line.split_whitespace().collect();

            // Find the part that looks like a path to mojovoice
            for part in &parts {
                if part.contains("mojovoice") && (part.starts_with('/') || part.starts_with("./")) {
                    eprintln!("Detected running binary: {}", part);
                    return Some(part.to_string());
                }
            }

            // Fallback: look for just the binary name
            for part in &parts {
                if part.contains("mojovoice") {
                    eprintln!("Detected running binary name: {}", part);
                    return Some(part.to_string());
                }
            }
        }
    }

    None
}

// =============================================================================
// Model Management
// =============================================================================

/// Model info from the registry (available for download)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RegistryModel {
    pub name: String,
    pub filename: String,
    pub size_mb: u32,
    pub family: String,
    pub quantization: String,
    #[serde(skip_serializing)]
    pub url: String,
    #[serde(skip_serializing)]
    pub sha256: String,
}

/// Model that's been downloaded locally
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadedModel {
    pub name: String,
    pub filename: String,
    pub path: String,
    pub size_mb: u32,
    pub is_active: bool,
}

/// Embedded model registry (synced from src/model/registry.rs)
fn get_model_registry() -> Vec<RegistryModel> {
    vec![
        // Large V3 Turbo
        RegistryModel { name: "large-v3-turbo".into(), filename: "ggml-large-v3-turbo.bin".into(), size_mb: 1625, family: "Large V3 Turbo".into(), quantization: "Full".into(), url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo.bin".into(), sha256: "1fc70f774d38eb169993ac391eea357ef47c88757ef72ee5943879b7e8e2bc69".into() },
        RegistryModel { name: "large-v3-turbo-q5_0".into(), filename: "ggml-large-v3-turbo-q5_0.bin".into(), size_mb: 547, family: "Large V3 Turbo".into(), quantization: "Q5_0".into(), url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo-q5_0.bin".into(), sha256: "394221709cd5ad1f40c46e6031ca61bce88931e6e088c188294c6d5a55ffa7e2".into() },
        RegistryModel { name: "large-v3-turbo-q8_0".into(), filename: "ggml-large-v3-turbo-q8_0.bin".into(), size_mb: 834, family: "Large V3 Turbo".into(), quantization: "Q8_0".into(), url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo-q8_0.bin".into(), sha256: "317eb69c11673c9de1e1f0d459b253999804ec71ac4c23c17ecf5fbe24e259a1".into() },
        // Distil-Whisper
        RegistryModel { name: "distil-large-v3.5".into(), filename: "ggml-distil-large-v3.5.bin".into(), size_mb: 1449, family: "Distil".into(), quantization: "Full".into(), url: "https://huggingface.co/distil-whisper/distil-large-v3.5-ggml/resolve/main/ggml-model.bin".into(), sha256: "ec2498919b498c5f6b00041adb45650124b3cd9f26f545fffa8f5d11c28dcf26".into() },
        RegistryModel { name: "distil-large-v3".into(), filename: "ggml-distil-large-v3.bin".into(), size_mb: 1520, family: "Distil".into(), quantization: "Full".into(), url: "https://huggingface.co/distil-whisper/distil-large-v3-ggml/resolve/main/ggml-distil-large-v3.bin".into(), sha256: "2883a11b90fb10ed592d826edeaee7d2929bf1ab985109fe9e1e7b4d2b69a298".into() },
        RegistryModel { name: "distil-large-v2".into(), filename: "ggml-distil-large-v2.bin".into(), size_mb: 1449, family: "Distil".into(), quantization: "Full".into(), url: "https://huggingface.co/distil-whisper/distil-large-v2/resolve/main/ggml-large-32-2.en.bin".into(), sha256: "2ed2bbe6c4138b3757f292b0622981bdb3d02bcac57f77095670dac85fab3cd6".into() },
        RegistryModel { name: "distil-medium.en".into(), filename: "ggml-distil-medium.en.bin".into(), size_mb: 757, family: "Distil".into(), quantization: "Full".into(), url: "https://huggingface.co/distil-whisper/distil-medium.en/resolve/main/ggml-medium-32-2.en.bin".into(), sha256: "ad53ccb618188b210550e98cc32bf5a13188d86635e395bb11115ed275d6e7aa".into() },
        RegistryModel { name: "distil-small.en".into(), filename: "ggml-distil-small.en.bin".into(), size_mb: 321, family: "Distil".into(), quantization: "Full".into(), url: "https://huggingface.co/distil-whisper/distil-small.en/resolve/main/ggml-distil-small.en.bin".into(), sha256: "7691eb11167ab7aaf6b3e05d8266f2fd9ad89c550e433f86ac266ebdee6c970a".into() },
        // Large V3
        RegistryModel { name: "large-v3".into(), filename: "ggml-large-v3.bin".into(), size_mb: 3100, family: "Large V3".into(), quantization: "Full".into(), url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3.bin".into(), sha256: "64d182b440b98d5203c4f9bd541544d84c605196c4f7b845dfa11fb23594d1e2".into() },
        RegistryModel { name: "large-v3-q5_0".into(), filename: "ggml-large-v3-q5_0.bin".into(), size_mb: 1031, family: "Large V3".into(), quantization: "Q5_0".into(), url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-q5_0.bin".into(), sha256: "d75795ecff3f83b5faa89d1900604ad8c780abd5739fae406de19f23ecd98ad1".into() },
        // Large V2
        RegistryModel { name: "large-v2".into(), filename: "ggml-large-v2.bin".into(), size_mb: 2950, family: "Large V2".into(), quantization: "Full".into(), url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v2.bin".into(), sha256: "9a423fe4d40c82774b6af34115b8b935f34152246eb19e80e376071d3f999487".into() },
        RegistryModel { name: "large-v2-q5_0".into(), filename: "ggml-large-v2-q5_0.bin".into(), size_mb: 1031, family: "Large V2".into(), quantization: "Q5_0".into(), url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v2-q5_0.bin".into(), sha256: "3a214837221e4530dbc1fe8d734f302af393eb30bd0ed046042ebf4baf70f6f2".into() },
        // Large V1
        RegistryModel { name: "large-v1".into(), filename: "ggml-large-v1.bin".into(), size_mb: 2950, family: "Large V1".into(), quantization: "Full".into(), url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v1.bin".into(), sha256: "7d99f41a10525d0206bddadd86760181fa920438b6b33237e3118ff6c83bb53d".into() },
        // Medium
        RegistryModel { name: "medium".into(), filename: "ggml-medium.bin".into(), size_mb: 1463, family: "Medium".into(), quantization: "Full".into(), url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.bin".into(), sha256: "6c14d5adee5f86394037b4e4e8b59f1673b6cee10e3cf0b11bbdbee79c156208".into() },
        RegistryModel { name: "medium.en".into(), filename: "ggml-medium.en.bin".into(), size_mb: 1530, family: "Medium".into(), quantization: "Full".into(), url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.en.bin".into(), sha256: "cc37e93478338ec7700281a7ac30a10128929eb8f427dda2e865faa8f6da4356".into() },
        RegistryModel { name: "medium-q5_0".into(), filename: "ggml-medium-q5_0.bin".into(), size_mb: 514, family: "Medium".into(), quantization: "Q5_0".into(), url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium-q5_0.bin".into(), sha256: "19fea4b380c3a618ec4723c3eef2eb785ffba0d0538cf43f8f235e7b3b34220f".into() },
        RegistryModel { name: "medium.en-q5_0".into(), filename: "ggml-medium.en-q5_0.bin".into(), size_mb: 514, family: "Medium".into(), quantization: "Q5_0".into(), url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.en-q5_0.bin".into(), sha256: "76733e26ad8fe1c7a5bf7531a9d41917b2adc0f20f2e4f5531688a8c6cd88eb0".into() },
        // Small
        RegistryModel { name: "small".into(), filename: "ggml-small.bin".into(), size_mb: 488, family: "Small".into(), quantization: "Full".into(), url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin".into(), sha256: "1be3a9b2063867b937e64e2ec7483364a79917e157fa98c5d94b5c1571299571".into() },
        RegistryModel { name: "small.en".into(), filename: "ggml-small.en.bin".into(), size_mb: 488, family: "Small".into(), quantization: "Full".into(), url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.en.bin".into(), sha256: "c6138d6d58ecc8322097e0f987c32f1be8bb0a18532a3f88f734d1bbf9c41e5d".into() },
        RegistryModel { name: "small-q5_1".into(), filename: "ggml-small-q5_1.bin".into(), size_mb: 181, family: "Small".into(), quantization: "Q5_1".into(), url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small-q5_1.bin".into(), sha256: "ae85e4a935d7a567bd102fe55afc16bb595bdb618e11b2fc7591bc08120411bb".into() },
        RegistryModel { name: "small.en-q5_1".into(), filename: "ggml-small.en-q5_1.bin".into(), size_mb: 181, family: "Small".into(), quantization: "Q5_1".into(), url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.en-q5_1.bin".into(), sha256: "bfdff4894dcb76bbf647d56263ea2a96645423f1669176f4844a1bf8e478ad30".into() },
        // Base
        RegistryModel { name: "base".into(), filename: "ggml-base.bin".into(), size_mb: 148, family: "Base".into(), quantization: "Full".into(), url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin".into(), sha256: "60ed5bc3dd14eea856493d334349b405782ddcaf0028d4b5df4088345fba2efe".into() },
        RegistryModel { name: "base.en".into(), filename: "ggml-base.en.bin".into(), size_mb: 148, family: "Base".into(), quantization: "Full".into(), url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin".into(), sha256: "a03779c86df3323075f5e796cb2ce5029f00ec8869eee3fdfb897afe36c6d002".into() },
        RegistryModel { name: "base-q5_1".into(), filename: "ggml-base-q5_1.bin".into(), size_mb: 57, family: "Base".into(), quantization: "Q5_1".into(), url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base-q5_1.bin".into(), sha256: "422f1ae452ade6f30a004d7e5c6a43195e4433bc370bf23fac9cc591f01a8898".into() },
        RegistryModel { name: "base.en-q5_1".into(), filename: "ggml-base.en-q5_1.bin".into(), size_mb: 57, family: "Base".into(), quantization: "Q5_1".into(), url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en-q5_1.bin".into(), sha256: "4baf70dd0d7c4247ba2b81fafd9c01005ac77c2f9ef064e00dcf195d0e2fdd2f".into() },
        // Tiny
        RegistryModel { name: "tiny".into(), filename: "ggml-tiny.bin".into(), size_mb: 78, family: "Tiny".into(), quantization: "Full".into(), url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin".into(), sha256: "be07e048e1e599ad46341c8d2a135645097a538221678b7acdd1b1919c6e1b21".into() },
        RegistryModel { name: "tiny.en".into(), filename: "ggml-tiny.en.bin".into(), size_mb: 78, family: "Tiny".into(), quantization: "Full".into(), url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.en.bin".into(), sha256: "921e4cf8686fdd993dcd081a5da5b6c365bfde1162e72b08d75ac75289920b1f".into() },
        RegistryModel { name: "tiny-q5_1".into(), filename: "ggml-tiny-q5_1.bin".into(), size_mb: 31, family: "Tiny".into(), quantization: "Q5_1".into(), url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny-q5_1.bin".into(), sha256: "818710568da3ca15689e31a743197b520007872ff9576237bda97bd1b469c3d7".into() },
        RegistryModel { name: "tiny.en-q5_1".into(), filename: "ggml-tiny.en-q5_1.bin".into(), size_mb: 31, family: "Tiny".into(), quantization: "Q5_1".into(), url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.en-q5_1.bin".into(), sha256: "c77c5766f1cef09b6b7d47f21b546cbddd4157886b3b5d6d4f709e91e66c7c2b".into() },
    ]
}

/// Get the models directory path
fn get_models_dir() -> Result<std::path::PathBuf, String> {
    let data_dir = dirs::data_local_dir()
        .ok_or("Could not determine data directory")?;
    Ok(data_dir.join("mojovoice").join("models"))
}

/// List all available models from the registry
#[tauri::command]
pub async fn list_available_models() -> Result<Vec<RegistryModel>, String> {
    Ok(get_model_registry())
}

/// List all downloaded models
#[tauri::command]
pub async fn list_downloaded_models() -> Result<Vec<DownloadedModel>, String> {
    let models_dir = get_models_dir()?;
    let config = get_config().await?;
    let active_path = config.model.path;

    let mut downloaded = Vec::new();

    // Scan models directory if it exists
    if models_dir.exists() {
        let registry = get_model_registry();

        if let Ok(entries) = std::fs::read_dir(&models_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_file() {
                    let filename = path.file_name()
                        .and_then(|n| n.to_str())
                        .unwrap_or("")
                        .to_string();

                    // Match against registry to get metadata
                    if let Some(reg_model) = registry.iter().find(|m| m.filename == filename) {
                        let is_active = active_path.contains(&filename);

                        downloaded.push(DownloadedModel {
                            name: reg_model.name.clone(),
                            filename: filename.clone(),
                            path: path.to_string_lossy().to_string(),
                            size_mb: reg_model.size_mb,
                            is_active,
                        });
                    } else {
                        // Unknown model (not in registry) - still show it
                        let size_mb = std::fs::metadata(&path)
                            .map(|m| (m.len() / 1_000_000) as u32)
                            .unwrap_or(0);

                        downloaded.push(DownloadedModel {
                            name: filename.clone(),
                            filename: filename.clone(),
                            path: path.to_string_lossy().to_string(),
                            size_mb,
                            is_active: active_path.contains(&filename),
                        });
                    }
                }
            }
        }
    }

    // Sort by name
    downloaded.sort_by(|a, b| a.name.cmp(&b.name));

    Ok(downloaded)
}

/// Delete a downloaded model
#[tauri::command]
pub async fn delete_model(filename: String) -> Result<(), String> {
    let models_dir = get_models_dir()?;
    let path = models_dir.join(&filename);

    if !path.exists() {
        return Err("Model not found".to_string());
    }

    // Prevent deleting active model
    let config = get_config().await?;
    if config.model.path.contains(&filename) {
        return Err("Cannot delete the currently active model. Switch to a different model first.".to_string());
    }

    std::fs::remove_file(&path)
        .map_err(|e| format!("Failed to delete model: {}", e))?;

    eprintln!("Deleted model: {}", path.display());
    Ok(())
}

/// Switch to a different model (updates config and restarts daemon)
#[tauri::command]
pub async fn switch_model(filename: String) -> Result<(), String> {
    let models_dir = get_models_dir()?;
    let model_path = models_dir.join(&filename);

    if !model_path.exists() {
        return Err("Model not found. Download it first.".to_string());
    }

    // Update config with new model path
    let mut config = get_config().await?;
    config.model.path = model_path.to_string_lossy().to_string();

    // Try to infer model_id from filename
    let model_id = infer_model_id(&filename);
    if let Some(id) = model_id {
        config.model.model_id = id;
    }

    save_config(config).await?;

    // Restart daemon to load new model
    restart_daemon().await?;

    eprintln!("Switched to model: {}", filename);
    Ok(())
}

/// Infer HuggingFace model_id from filename
fn infer_model_id(filename: &str) -> Option<String> {
    // Map common filenames to HuggingFace model IDs
    let name = filename
        .trim_start_matches("ggml-")
        .trim_end_matches(".bin");

    match name {
        "large-v3-turbo" | "large-v3-turbo-q5_0" | "large-v3-turbo-q8_0" => {
            Some("openai/whisper-large-v3-turbo".to_string())
        }
        "large-v3" | "large-v3-q5_0" => Some("openai/whisper-large-v3".to_string()),
        "large-v2" | "large-v2-q5_0" => Some("openai/whisper-large-v2".to_string()),
        "large-v1" => Some("openai/whisper-large".to_string()),
        "medium" | "medium-q5_0" => Some("openai/whisper-medium".to_string()),
        "medium.en" | "medium.en-q5_0" => Some("openai/whisper-medium.en".to_string()),
        "small" | "small-q5_1" => Some("openai/whisper-small".to_string()),
        "small.en" | "small.en-q5_1" => Some("openai/whisper-small.en".to_string()),
        "base" | "base-q5_1" => Some("openai/whisper-base".to_string()),
        "base.en" | "base.en-q5_1" => Some("openai/whisper-base.en".to_string()),
        "tiny" | "tiny-q5_1" => Some("openai/whisper-tiny".to_string()),
        "tiny.en" | "tiny.en-q5_1" => Some("openai/whisper-tiny.en".to_string()),
        s if s.starts_with("distil-") => Some(format!("distil-whisper/{}", s)),
        _ => None,
    }
}
