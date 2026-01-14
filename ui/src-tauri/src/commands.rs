use serde::{Deserialize, Serialize};
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

/// Download a Whisper model
#[tauri::command]
pub async fn download_model(model_name: String) -> Result<(), String> {
    // TODO: Call mojovoice download command
    println!("Downloading model: {}", model_name);
    Ok(())
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
        RegistryModel { name: "large-v3-turbo".into(), filename: "ggml-large-v3-turbo.bin".into(), size_mb: 1625, family: "Large V3 Turbo".into(), quantization: "Full".into() },
        RegistryModel { name: "large-v3-turbo-q5_0".into(), filename: "ggml-large-v3-turbo-q5_0.bin".into(), size_mb: 547, family: "Large V3 Turbo".into(), quantization: "Q5_0".into() },
        RegistryModel { name: "large-v3-turbo-q8_0".into(), filename: "ggml-large-v3-turbo-q8_0.bin".into(), size_mb: 834, family: "Large V3 Turbo".into(), quantization: "Q8_0".into() },
        // Distil-Whisper
        RegistryModel { name: "distil-large-v3.5".into(), filename: "ggml-distil-large-v3.5.bin".into(), size_mb: 1449, family: "Distil".into(), quantization: "Full".into() },
        RegistryModel { name: "distil-large-v3".into(), filename: "ggml-distil-large-v3.bin".into(), size_mb: 1520, family: "Distil".into(), quantization: "Full".into() },
        RegistryModel { name: "distil-large-v2".into(), filename: "ggml-distil-large-v2.bin".into(), size_mb: 1449, family: "Distil".into(), quantization: "Full".into() },
        RegistryModel { name: "distil-medium.en".into(), filename: "ggml-distil-medium.en.bin".into(), size_mb: 757, family: "Distil".into(), quantization: "Full".into() },
        RegistryModel { name: "distil-small.en".into(), filename: "ggml-distil-small.en.bin".into(), size_mb: 321, family: "Distil".into(), quantization: "Full".into() },
        // Large V3
        RegistryModel { name: "large-v3".into(), filename: "ggml-large-v3.bin".into(), size_mb: 3100, family: "Large V3".into(), quantization: "Full".into() },
        RegistryModel { name: "large-v3-q5_0".into(), filename: "ggml-large-v3-q5_0.bin".into(), size_mb: 1031, family: "Large V3".into(), quantization: "Q5_0".into() },
        // Large V2
        RegistryModel { name: "large-v2".into(), filename: "ggml-large-v2.bin".into(), size_mb: 2950, family: "Large V2".into(), quantization: "Full".into() },
        RegistryModel { name: "large-v2-q5_0".into(), filename: "ggml-large-v2-q5_0.bin".into(), size_mb: 1031, family: "Large V2".into(), quantization: "Q5_0".into() },
        // Large V1
        RegistryModel { name: "large-v1".into(), filename: "ggml-large-v1.bin".into(), size_mb: 2950, family: "Large V1".into(), quantization: "Full".into() },
        // Medium
        RegistryModel { name: "medium".into(), filename: "ggml-medium.bin".into(), size_mb: 1463, family: "Medium".into(), quantization: "Full".into() },
        RegistryModel { name: "medium.en".into(), filename: "ggml-medium.en.bin".into(), size_mb: 1530, family: "Medium".into(), quantization: "Full".into() },
        RegistryModel { name: "medium-q5_0".into(), filename: "ggml-medium-q5_0.bin".into(), size_mb: 514, family: "Medium".into(), quantization: "Q5_0".into() },
        RegistryModel { name: "medium.en-q5_0".into(), filename: "ggml-medium.en-q5_0.bin".into(), size_mb: 514, family: "Medium".into(), quantization: "Q5_0".into() },
        // Small
        RegistryModel { name: "small".into(), filename: "ggml-small.bin".into(), size_mb: 488, family: "Small".into(), quantization: "Full".into() },
        RegistryModel { name: "small.en".into(), filename: "ggml-small.en.bin".into(), size_mb: 488, family: "Small".into(), quantization: "Full".into() },
        RegistryModel { name: "small-q5_1".into(), filename: "ggml-small-q5_1.bin".into(), size_mb: 181, family: "Small".into(), quantization: "Q5_1".into() },
        RegistryModel { name: "small.en-q5_1".into(), filename: "ggml-small.en-q5_1.bin".into(), size_mb: 181, family: "Small".into(), quantization: "Q5_1".into() },
        // Base
        RegistryModel { name: "base".into(), filename: "ggml-base.bin".into(), size_mb: 148, family: "Base".into(), quantization: "Full".into() },
        RegistryModel { name: "base.en".into(), filename: "ggml-base.en.bin".into(), size_mb: 148, family: "Base".into(), quantization: "Full".into() },
        RegistryModel { name: "base-q5_1".into(), filename: "ggml-base-q5_1.bin".into(), size_mb: 57, family: "Base".into(), quantization: "Q5_1".into() },
        RegistryModel { name: "base.en-q5_1".into(), filename: "ggml-base.en-q5_1.bin".into(), size_mb: 57, family: "Base".into(), quantization: "Q5_1".into() },
        // Tiny
        RegistryModel { name: "tiny".into(), filename: "ggml-tiny.bin".into(), size_mb: 78, family: "Tiny".into(), quantization: "Full".into() },
        RegistryModel { name: "tiny.en".into(), filename: "ggml-tiny.en.bin".into(), size_mb: 78, family: "Tiny".into(), quantization: "Full".into() },
        RegistryModel { name: "tiny-q5_1".into(), filename: "ggml-tiny-q5_1.bin".into(), size_mb: 31, family: "Tiny".into(), quantization: "Q5_1".into() },
        RegistryModel { name: "tiny.en-q5_1".into(), filename: "ggml-tiny.en-q5_1.bin".into(), size_mb: 31, family: "Tiny".into(), quantization: "Q5_1".into() },
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
