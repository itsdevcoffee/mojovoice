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

/// Get the path to the mojovoice config file
fn get_config_path() -> Result<std::path::PathBuf, String> {
    dirs::config_dir()
        .map(|dir| dir.join("mojovoice").join("config.toml"))
        .ok_or_else(|| "Could not determine config directory".to_string())
}

/// Refresh status bar (execute user-configured refresh_command)
fn refresh_statusbar() {
    // Read config to get refresh_command
    let Ok(config_path) = get_config_path() else {
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
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

impl DownloadProgress {
    #[allow(dead_code)]
    fn new(model_name: &str, status: &str) -> Self {
        Self {
            model_name: model_name.to_string(),
            downloaded_bytes: 0,
            total_bytes: 0,
            speed_bps: 0,
            status: status.to_string(),
            error: None,
        }
    }

    fn downloading(model_name: &str, downloaded: u64, total: u64, speed: u64) -> Self {
        Self {
            model_name: model_name.to_string(),
            downloaded_bytes: downloaded,
            total_bytes: total,
            speed_bps: speed,
            status: "downloading".to_string(),
            error: None,
        }
    }

    fn verifying(model_name: &str, downloaded: u64, total: u64) -> Self {
        Self {
            model_name: model_name.to_string(),
            downloaded_bytes: downloaded,
            total_bytes: total,
            speed_bps: 0,
            status: "verifying".to_string(),
            error: None,
        }
    }

    fn complete(model_name: &str, total: u64) -> Self {
        Self {
            model_name: model_name.to_string(),
            downloaded_bytes: total,
            total_bytes: total,
            speed_bps: 0,
            status: "complete".to_string(),
            error: None,
        }
    }

    fn error(model_name: &str, message: &str) -> Self {
        Self {
            model_name: model_name.to_string(),
            downloaded_bytes: 0,
            total_bytes: 0,
            speed_bps: 0,
            status: "error".to_string(),
            error: Some(message.to_string()),
        }
    }

    fn cancelled(model_name: &str) -> Self {
        Self {
            model_name: model_name.to_string(),
            downloaded_bytes: 0,
            total_bytes: 0,
            speed_bps: 0,
            status: "cancelled".to_string(),
            error: None,
        }
    }
}

// =============================================================================
// Download Cancellation Tracking
// =============================================================================

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

lazy_static::lazy_static! {
    /// Tracks cancellation flags for active downloads
    static ref DOWNLOAD_CANCELLATION: std::sync::Mutex<std::collections::HashMap<String, Arc<AtomicBool>>> =
        std::sync::Mutex::new(std::collections::HashMap::new());
}

/// Check if a download has been cancelled
fn is_download_cancelled(model_name: &str) -> bool {
    if let Ok(map) = DOWNLOAD_CANCELLATION.lock() {
        if let Some(flag) = map.get(model_name) {
            return flag.load(Ordering::Relaxed);
        }
    }
    false
}

/// Register a new download for cancellation tracking
fn register_download(model_name: &str) -> Arc<AtomicBool> {
    let flag = Arc::new(AtomicBool::new(false));
    if let Ok(mut map) = DOWNLOAD_CANCELLATION.lock() {
        map.insert(model_name.to_string(), flag.clone());
    }
    flag
}

/// Unregister a download from cancellation tracking
fn unregister_download(model_name: &str) {
    if let Ok(mut map) = DOWNLOAD_CANCELLATION.lock() {
        map.remove(model_name);
    }
}

/// Cancel a model download
#[tauri::command]
pub async fn cancel_download(model_name: String) -> Result<(), String> {
    if let Ok(map) = DOWNLOAD_CANCELLATION.lock() {
        if let Some(flag) = map.get(&model_name) {
            flag.store(true, Ordering::Relaxed);
            eprintln!("Cancellation requested for download: {}", model_name);
            return Ok(());
        }
    }
    Err(format!("No active download found for '{}'", model_name))
}

/// Download a Whisper model with progress events
#[tauri::command]
pub async fn download_model(model_name: String, window: tauri::Window) -> Result<String, String> {
    use std::io::{Read, Write, BufWriter};

    // Files required for safetensors models
    const REQUIRED_FILES: &[&str] = &["model.safetensors", "config.json", "tokenizer.json"];

    // Find model in registry
    let registry = get_model_registry();
    let model = registry.iter()
        .find(|m| m.name == model_name)
        .ok_or_else(|| format!("Model '{}' not found in registry", model_name))?;

    // Register this download for cancellation tracking
    let _cancel_flag = register_download(&model_name);

    // Ensure we unregister on any exit path
    struct DownloadGuard<'a> {
        model_name: &'a str,
    }
    impl<'a> Drop for DownloadGuard<'a> {
        fn drop(&mut self) {
            unregister_download(self.model_name);
        }
    }
    let _guard = DownloadGuard { model_name: &model_name };

    let models_dir = get_models_dir()?;
    std::fs::create_dir_all(&models_dir)
        .map_err(|e| format!("Failed to create models directory: {}", e))?;

    // For safetensors, we download to a directory
    let dest_dir = models_dir.join(&model.filename);
    let temp_dir = models_dir.join(format!("{}.download", &model.filename));

    // Check if already downloaded and valid (all required files exist)
    if dest_dir.exists() && dest_dir.is_dir() {
        let all_files_exist = REQUIRED_FILES.iter().all(|f| dest_dir.join(f).exists());
        if all_files_exist {
            eprintln!("Model already exists with all required files");
            let _ = window.emit("download-progress", DownloadProgress::complete(&model_name, 0));
            return Ok(dest_dir.to_string_lossy().to_string());
        }
        eprintln!("Model directory exists but missing files, re-downloading...");
    }

    // Clean up any existing temp directory
    if temp_dir.exists() {
        std::fs::remove_dir_all(&temp_dir).ok();
    }
    std::fs::create_dir_all(&temp_dir)
        .map_err(|e| format!("Failed to create temp directory: {}", e))?;

    eprintln!("Downloading {} ({} MB) from HuggingFace: {}", model.name, model.size_mb, model.repo_id);

    // Emit initial progress event with estimated size
    let estimated_bytes = model.size_mb as u64 * 1_000_000;
    let _ = window.emit("download-progress", DownloadProgress::downloading(&model_name, 0, estimated_bytes, 0));

    let start_time = std::time::Instant::now();
    let mut total_downloaded: u64 = 0;

    // Helper to clean up temp directory on error
    let cleanup_on_error = |temp: &std::path::Path| {
        std::fs::remove_dir_all(temp).ok();
    };

    // Download each required file
    for (file_idx, filename) in REQUIRED_FILES.iter().enumerate() {
        // Check for cancellation before starting each file
        if is_download_cancelled(&model_name) {
            eprintln!("Download cancelled: {}", model_name);
            cleanup_on_error(&temp_dir);
            let _ = window.emit("download-progress", DownloadProgress::cancelled(&model_name));
            return Err("Download cancelled".to_string());
        }

        let file_url = format!(
            "https://huggingface.co/{}/resolve/main/{}",
            model.repo_id, filename
        );
        eprintln!("Downloading file {}/{}: {}", file_idx + 1, REQUIRED_FILES.len(), filename);

        let response = ureq::get(&file_url)
            .call()
            .map_err(|e| {
                cleanup_on_error(&temp_dir);
                format!("Failed to download {}: {}", filename, e)
            })?;

        let _file_size = response
            .header("content-length")
            .and_then(|s| s.parse::<u64>().ok())
            .unwrap_or(0);

        let dest_file = temp_dir.join(filename);
        let file = std::fs::File::create(&dest_file)
            .map_err(|e| {
                cleanup_on_error(&temp_dir);
                format!("Failed to create file {}: {}", filename, e)
            })?;
        let mut writer = BufWriter::new(file);

        let mut reader = response.into_reader();
        let mut buffer = [0u8; 65536];
        let mut file_downloaded: u64 = 0;
        let mut last_emit_time = std::time::Instant::now();

        loop {
            // Check for cancellation
            if is_download_cancelled(&model_name) {
                eprintln!("Download cancelled: {}", model_name);
                drop(writer);
                cleanup_on_error(&temp_dir);
                let _ = window.emit("download-progress", DownloadProgress::cancelled(&model_name));
                return Err("Download cancelled".to_string());
            }

            let bytes_read = match reader.read(&mut buffer) {
                Ok(n) => n,
                Err(e) => {
                    drop(writer);
                    cleanup_on_error(&temp_dir);
                    let _ = window.emit("download-progress", DownloadProgress::error(&model_name, &format!("Download error: {}", e)));
                    return Err(format!("Download error: {}", e));
                }
            };

            if bytes_read == 0 {
                break;
            }

            if let Err(e) = writer.write_all(&buffer[..bytes_read]) {
                drop(writer);
                cleanup_on_error(&temp_dir);
                let _ = window.emit("download-progress", DownloadProgress::error(&model_name, &format!("Write error: {}", e)));
                return Err(format!("Write error: {}", e));
            }

            file_downloaded = file_downloaded.saturating_add(bytes_read as u64);
            total_downloaded = total_downloaded.saturating_add(bytes_read as u64);

            // Emit progress every 100ms
            let now = std::time::Instant::now();
            if now.duration_since(last_emit_time).as_millis() >= 100 {
                let elapsed = now.duration_since(start_time).as_secs_f64();
                let speed_bps = if elapsed > 0.0 {
                    (total_downloaded as f64 / elapsed) as u64
                } else {
                    0
                };

                let _ = window.emit(
                    "download-progress",
                    DownloadProgress::downloading(&model_name, total_downloaded, estimated_bytes, speed_bps),
                );

                last_emit_time = now;
            }
        }

        if let Err(e) = writer.flush() {
            drop(writer);
            cleanup_on_error(&temp_dir);
            let _ = window.emit("download-progress", DownloadProgress::error(&model_name, &format!("Flush error: {}", e)));
            return Err(format!("Flush error: {}", e));
        }

        eprintln!("Downloaded {} ({} bytes)", filename, file_downloaded);
    }

    // Verify all files exist
    let _ = window.emit(
        "download-progress",
        DownloadProgress::verifying(&model_name, total_downloaded, estimated_bytes),
    );

    for filename in REQUIRED_FILES {
        if !temp_dir.join(filename).exists() {
            cleanup_on_error(&temp_dir);
            let error_msg = format!("Missing required file after download: {}", filename);
            let _ = window.emit("download-progress", DownloadProgress::error(&model_name, &error_msg));
            return Err(error_msg);
        }
    }

    // Move temp directory to final location
    if dest_dir.exists() {
        std::fs::remove_dir_all(&dest_dir).ok();
    }
    std::fs::rename(&temp_dir, &dest_dir)
        .map_err(|e| format!("Failed to move downloaded files: {}", e))?;

    let _ = window.emit("download-progress", DownloadProgress::complete(&model_name, total_downloaded));

    eprintln!("Model saved to {}", dest_dir.display());
    Ok(dest_dir.to_string_lossy().to_string())
}

/// Verify SHA256 checksum of a file (kept for future use)
#[allow(dead_code)]
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
    /// Directory name where model files are stored
    pub filename: String,
    pub size_mb: u32,
    pub family: String,
    pub quantization: String,
    /// HuggingFace model ID (e.g., "openai/whisper-large-v3-turbo")
    #[serde(skip_serializing)]
    pub repo_id: String,
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

/// Embedded model registry - safetensors format from HuggingFace
fn get_model_registry() -> Vec<RegistryModel> {
    vec![
        // Large V3 Turbo (Recommended - fast and accurate)
        RegistryModel { name: "large-v3-turbo".into(), filename: "whisper-large-v3-turbo".into(), size_mb: 1550, family: "Large V3 Turbo".into(), quantization: "Full".into(), repo_id: "openai/whisper-large-v3-turbo".into() },
        // Distil-Whisper (Faster, English-optimized)
        RegistryModel { name: "distil-large-v3.5".into(), filename: "distil-large-v3.5".into(), size_mb: 1510, family: "Distil".into(), quantization: "Full".into(), repo_id: "distil-whisper/distil-large-v3.5".into() },
        RegistryModel { name: "distil-large-v3".into(), filename: "distil-large-v3".into(), size_mb: 1510, family: "Distil".into(), quantization: "Full".into(), repo_id: "distil-whisper/distil-large-v3".into() },
        RegistryModel { name: "distil-large-v2".into(), filename: "distil-large-v2".into(), size_mb: 1510, family: "Distil".into(), quantization: "Full".into(), repo_id: "distil-whisper/distil-large-v2".into() },
        RegistryModel { name: "distil-small.en".into(), filename: "distil-small-en".into(), size_mb: 332, family: "Distil".into(), quantization: "Full".into(), repo_id: "distil-whisper/distil-small.en".into() },
        // Large V3
        RegistryModel { name: "large-v3".into(), filename: "whisper-large-v3".into(), size_mb: 3094, family: "Large V3".into(), quantization: "Full".into(), repo_id: "openai/whisper-large-v3".into() },
        // Large V2
        RegistryModel { name: "large-v2".into(), filename: "whisper-large-v2".into(), size_mb: 3094, family: "Large V2".into(), quantization: "Full".into(), repo_id: "openai/whisper-large-v2".into() },
        // Large V1
        RegistryModel { name: "large".into(), filename: "whisper-large".into(), size_mb: 3094, family: "Large".into(), quantization: "Full".into(), repo_id: "openai/whisper-large".into() },
        // Medium
        RegistryModel { name: "medium".into(), filename: "whisper-medium".into(), size_mb: 1533, family: "Medium".into(), quantization: "Full".into(), repo_id: "openai/whisper-medium".into() },
        RegistryModel { name: "medium.en".into(), filename: "whisper-medium-en".into(), size_mb: 1533, family: "Medium".into(), quantization: "Full".into(), repo_id: "openai/whisper-medium.en".into() },
        // Small
        RegistryModel { name: "small".into(), filename: "whisper-small".into(), size_mb: 483, family: "Small".into(), quantization: "Full".into(), repo_id: "openai/whisper-small".into() },
        RegistryModel { name: "small.en".into(), filename: "whisper-small-en".into(), size_mb: 483, family: "Small".into(), quantization: "Full".into(), repo_id: "openai/whisper-small.en".into() },
        // Base
        RegistryModel { name: "base".into(), filename: "whisper-base".into(), size_mb: 145, family: "Base".into(), quantization: "Full".into(), repo_id: "openai/whisper-base".into() },
        RegistryModel { name: "base.en".into(), filename: "whisper-base-en".into(), size_mb: 145, family: "Base".into(), quantization: "Full".into(), repo_id: "openai/whisper-base.en".into() },
        // Tiny
        RegistryModel { name: "tiny".into(), filename: "whisper-tiny".into(), size_mb: 77, family: "Tiny".into(), quantization: "Full".into(), repo_id: "openai/whisper-tiny".into() },
        RegistryModel { name: "tiny.en".into(), filename: "whisper-tiny-en".into(), size_mb: 77, family: "Tiny".into(), quantization: "Full".into(), repo_id: "openai/whisper-tiny.en".into() },
    ]
}

/// Get the models directory path from config or use default
fn get_models_dir() -> Result<std::path::PathBuf, String> {
    // Try to get models dir from config file
    if let Ok(config_path) = get_config_path() {
        if let Ok(content) = std::fs::read_to_string(&config_path) {
            if let Ok(config) = content.parse::<toml::Table>() {
                if let Some(model) = config.get("model").and_then(|m| m.as_table()) {
                    if let Some(path) = model.get("path").and_then(|p| p.as_str()) {
                        if let Some(parent) = std::path::Path::new(path).parent() {
                            return Ok(parent.to_path_buf());
                        }
                    }
                }
            }
        }
    }

    // Fallback to default
    let data_dir = dirs::data_local_dir()
        .ok_or("Could not determine data directory")?;
    Ok(data_dir.join("mojovoice").join("models"))
}

/// Validate that a path is within the models directory (prevent path traversal)
/// Works for both existing and non-existing files
fn validate_model_path(models_dir: &std::path::Path, filename: &str) -> Result<std::path::PathBuf, String> {
    // Check for path traversal characters in filename
    if filename.contains("..") || filename.contains('/') || filename.contains('\\') {
        return Err("Invalid filename: path traversal detected".to_string());
    }

    // Check for null bytes (could bypass string checks)
    if filename.contains('\0') {
        return Err("Invalid filename: null byte detected".to_string());
    }

    // Validate filename is not empty and starts with expected prefix
    if filename.is_empty() {
        return Err("Invalid filename: empty".to_string());
    }

    let path = models_dir.join(filename);

    // For existing files, do additional canonicalization check
    if path.exists() {
        let canonical_path = path.canonicalize()
            .map_err(|_| "Invalid model path".to_string())?;

        // Ensure models_dir exists for this check
        if models_dir.exists() {
            let canonical_models_dir = models_dir.canonicalize()
                .map_err(|_| "Invalid models directory".to_string())?;

            if !canonical_path.starts_with(&canonical_models_dir) {
                return Err("Invalid model path: access denied".to_string());
            }
        }

        return Ok(canonical_path);
    }

    // For non-existing files, the character checks above are sufficient
    // Also verify the constructed path stays within models_dir using lexical check
    // (normalize the path without requiring it to exist)
    let normalized = path.components().collect::<std::path::PathBuf>();
    let normalized_models = models_dir.components().collect::<std::path::PathBuf>();

    if !normalized.starts_with(&normalized_models) {
        return Err("Invalid model path: access denied".to_string());
    }

    Ok(path)
}

/// Check if a model directory is the currently active model
fn is_active_model(active_path: &str, dirname: &str) -> bool {
    let active = std::path::Path::new(active_path);
    // Check if the active path ends with the directory name
    // Handle both directory paths and file paths within directories
    if let Some(name) = active.file_name().and_then(|n| n.to_str()) {
        if name == dirname {
            return true;
        }
    }
    // Also check parent directory (in case active_path points to model.safetensors)
    if let Some(parent) = active.parent() {
        if let Some(name) = parent.file_name().and_then(|n| n.to_str()) {
            if name == dirname {
                return true;
            }
        }
    }
    false
}

/// List all available models from the registry
#[tauri::command]
pub async fn list_available_models() -> Result<Vec<RegistryModel>, String> {
    Ok(get_model_registry())
}

/// List all downloaded models (safetensors directories)
#[tauri::command]
pub async fn list_downloaded_models() -> Result<Vec<DownloadedModel>, String> {
    const REQUIRED_FILES: &[&str] = &["model.safetensors", "config.json", "tokenizer.json"];

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
                // Look for directories that contain required model files
                if path.is_dir() {
                    let dirname = path.file_name()
                        .and_then(|n| n.to_str())
                        .unwrap_or("")
                        .to_string();

                    // Skip temp download directories
                    if dirname.ends_with(".download") {
                        continue;
                    }

                    // Check if directory has required files (valid safetensors model)
                    let has_required_files = REQUIRED_FILES.iter()
                        .all(|f| path.join(f).exists());

                    if has_required_files {
                        // Match against registry to get metadata
                        if let Some(reg_model) = registry.iter().find(|m| m.filename == dirname) {
                            downloaded.push(DownloadedModel {
                                name: reg_model.name.clone(),
                                filename: dirname.clone(),
                                path: path.to_string_lossy().to_string(),
                                size_mb: reg_model.size_mb,
                                is_active: is_active_model(&active_path, &dirname),
                            });
                        } else {
                            // Unknown model (not in registry) - calculate size
                            let size_mb = REQUIRED_FILES.iter()
                                .filter_map(|f| std::fs::metadata(path.join(f)).ok())
                                .map(|m| m.len())
                                .sum::<u64>() / 1_000_000;

                            downloaded.push(DownloadedModel {
                                name: dirname.clone(),
                                filename: dirname.clone(),
                                path: path.to_string_lossy().to_string(),
                                size_mb: size_mb as u32,
                                is_active: is_active_model(&active_path, &dirname),
                            });
                        }
                    }
                }
            }
        }
    }

    // Sort by name
    downloaded.sort_by(|a, b| a.name.cmp(&b.name));

    Ok(downloaded)
}

/// Delete a downloaded model (directory)
#[tauri::command]
pub async fn delete_model(filename: String) -> Result<(), String> {
    let models_dir = get_models_dir()?;

    // Validate path is within models directory (prevent path traversal)
    let path = validate_model_path(&models_dir, &filename)?;

    if !path.exists() {
        return Err("Model not found".to_string());
    }

    // Prevent deleting active model
    let config = get_config().await?;
    if is_active_model(&config.model.path, &filename) {
        return Err("Cannot delete the currently active model. Switch to a different model first.".to_string());
    }

    // Delete directory (safetensors models are directories)
    if path.is_dir() {
        std::fs::remove_dir_all(&path)
            .map_err(|e| format!("Failed to delete model directory: {}", e))?;
    } else {
        std::fs::remove_file(&path)
            .map_err(|e| format!("Failed to delete model: {}", e))?;
    }

    eprintln!("Deleted model: {}", path.display());
    Ok(())
}

/// Switch to a different model (updates config and restarts daemon)
#[tauri::command]
pub async fn switch_model(filename: String) -> Result<(), String> {
    let models_dir = get_models_dir()?;

    // Validate path is within models directory (prevent path traversal)
    let model_path = validate_model_path(&models_dir, &filename)?;

    if !model_path.exists() {
        return Err("Model not found. Download it first.".to_string());
    }

    // Update config with new model path (directory path for safetensors)
    let mut config = get_config().await?;
    config.model.path = model_path.to_string_lossy().to_string();

    // Look up repo_id from registry
    let registry = get_model_registry();
    if let Some(reg_model) = registry.iter().find(|m| m.filename == filename) {
        config.model.model_id = reg_model.repo_id.clone();
    }

    save_config(config).await?;

    // Restart daemon to load new model
    restart_daemon().await?;

    eprintln!("Switched to model: {}", filename);
    Ok(())
}
