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
    pub uptime_secs: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TranscriptionEntry {
    pub id: String,
    pub text: String,
    pub timestamp: i64,
    pub duration_ms: u64,
    pub model: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub audio_path: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryResponse {
    pub entries: Vec<TranscriptionEntry>,
    pub total: usize,
    pub has_more: bool,
    pub models: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemInfo {
    pub cpu_cores: usize,
    pub total_ram_gb: f32,
    pub gpu_available: bool,
    pub gpu_name: Option<String>,
    pub gpu_vram_mb: Option<u32>,
    pub platform: String,
}

/// GPU information detected from the system
#[derive(Debug, Default)]
struct GpuInfo {
    available: bool,
    name: Option<String>,
    vram_mb: Option<u32>,
}

/// Detect GPU information (cross-platform)
fn detect_gpu_info() -> GpuInfo {
    #[cfg(target_os = "linux")]
    {
        if let Some(info) = detect_nvidia_gpu() {
            return info;
        }
    }

    #[cfg(target_os = "macos")]
    {
        if let Some(info) = detect_macos_gpu() {
            return info;
        }
    }

    GpuInfo::default()
}

/// Maximum output size to prevent DoS from malformed command output
const MAX_CMD_OUTPUT_SIZE: usize = 10 * 1024; // 10 KB

/// Safely convert command output to string with size limit
fn safe_output_to_string(output: &[u8]) -> String {
    let truncated = if output.len() > MAX_CMD_OUTPUT_SIZE {
        &output[..MAX_CMD_OUTPUT_SIZE]
    } else {
        output
    };
    String::from_utf8_lossy(truncated).to_string()
}

/// Detect NVIDIA GPU using nvidia-smi (Linux)
#[cfg(target_os = "linux")]
fn detect_nvidia_gpu() -> Option<GpuInfo> {
    let output = std::process::Command::new("nvidia-smi")
        .args(["--query-gpu=name,memory.total", "--format=csv,noheader,nounits"])
        .output()
        .ok()?;

    if !output.status.success() {
        return None;
    }

    let stdout = safe_output_to_string(&output.stdout);
    let line = stdout.trim();

    // Parse "NVIDIA GeForce RTX 4090, 24564"
    let parts: Vec<&str> = line.splitn(2, ", ").collect();
    if parts.len() >= 2 {
        let name = parts[0].trim().to_string();
        let vram_mb = parts[1].trim().parse::<u32>().ok();

        Some(GpuInfo {
            available: true,
            name: Some(name),
            vram_mb,
        })
    } else if !line.is_empty() {
        // Got something but couldn't parse fully
        Some(GpuInfo {
            available: true,
            name: Some(line.to_string()),
            vram_mb: None,
        })
    } else {
        None
    }
}

/// Detect GPU using system_profiler (macOS)
#[cfg(target_os = "macos")]
fn detect_macos_gpu() -> Option<GpuInfo> {
    let output = std::process::Command::new("system_profiler")
        .args(["SPDisplaysDataType", "-json"])
        .output()
        .ok()?;

    if !output.status.success() {
        return None;
    }

    let stdout = safe_output_to_string(&output.stdout);
    let json: serde_json::Value = serde_json::from_str(&stdout).ok()?;

    // Navigate to SPDisplaysDataType[0]._items[0]
    let displays = json.get("SPDisplaysDataType")?.as_array()?;
    let first_display = displays.first()?;

    // Get GPU model name
    let name = first_display
        .get("sppci_model")
        .or_else(|| first_display.get("_name"))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    // Try to get VRAM (not available for Apple Silicon unified memory)
    let vram_mb = first_display
        .get("spdisplays_vram")
        .or_else(|| first_display.get("_spdisplays_vram"))
        .and_then(|v| v.as_str())
        .and_then(|s| {
            // Parse strings like "16 GB" or "8192 MB"
            let s = s.trim();
            if let Some(gb_str) = s.strip_suffix(" GB") {
                gb_str.trim().parse::<u32>().ok().map(|gb| gb * 1024)
            } else if let Some(mb_str) = s.strip_suffix(" MB") {
                mb_str.trim().parse::<u32>().ok()
            } else {
                s.parse::<u32>().ok()
            }
        });

    name.map(|n| GpuInfo {
        available: true,
        name: Some(n),
        vram_mb,
    })
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
            uptime_secs: status.uptime_secs,
        }),
        Err(e) => {
            eprintln!("Failed to get daemon status: {}", e);
            // Return offline status on error
            Ok(DaemonStatus {
                running: false,
                model_loaded: false,
                gpu_enabled: false,
                gpu_name: None,
                uptime_secs: None,
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

    // Parse command string using proper shell parsing (handles quotes, escapes, etc.)
    let parts = match shell_words::split(refresh_cmd) {
        Ok(parts) => parts,
        Err(e) => {
            eprintln!("Failed to parse refresh_command '{}': {}", refresh_cmd, e);
            return;
        }
    };

    if parts.is_empty() {
        eprintln!("refresh_command is empty after parsing");
        return;
    }

    let program = &parts[0];
    let args = &parts[1..];

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

/// Convert library HistoryEntry to UI TranscriptionEntry
fn convert_history_entry(entry: mojovoice::history::HistoryEntry) -> TranscriptionEntry {
    TranscriptionEntry {
        id: entry.id,
        text: entry.text,
        timestamp: entry.timestamp,
        duration_ms: entry.duration_ms,
        model: entry.model,
        audio_path: entry.audio_path,
    }
}

/// Get transcription history with pagination and filtering
#[tauri::command]
pub async fn get_transcription_history(
    limit: Option<u32>,
    offset: Option<u32>,
    search: Option<String>,
    model_filter: Option<String>,
) -> Result<HistoryResponse, String> {
    // Get unique models first (before filtering)
    let models = mojovoice::history::get_unique_models()
        .map_err(|e| format!("Failed to get models: {}", e))?;

    // Load entries with pagination and filtering using library function
    let result = mojovoice::history::load_entries(
        limit.unwrap_or(100) as usize,
        offset.unwrap_or(0) as usize,
        search.as_deref(),
        model_filter.as_deref(),
    )
    .map_err(|e| format!("Failed to load history: {}", e))?;

    // Convert library types to UI types
    let entries: Vec<TranscriptionEntry> = result
        .entries
        .into_iter()
        .map(convert_history_entry)
        .collect();

    Ok(HistoryResponse {
        entries,
        total: result.total,
        has_more: result.has_more,
        models,
    })
}

/// Delete a single history entry by ID
#[tauri::command]
pub async fn delete_history_entry(id: String) -> Result<(), String> {
    mojovoice::history::delete_entry(&id)
        .map_err(|e| format!("Failed to delete entry: {}", e))
}

/// Clear all history entries
#[tauri::command]
pub async fn clear_history() -> Result<(), String> {
    mojovoice::history::clear_history()
        .map_err(|e| format!("Failed to clear history: {}", e))
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

    // Find model in registry
    let registry = get_model_registry();
    let model = registry.iter()
        .find(|m| m.name == model_name)
        .ok_or_else(|| format!("Model '{}' not found in registry", model_name))?;

    // Validate repo_id format (should be "org/model" with safe characters)
    if !model.repo_id.chars().all(|c| c.is_alphanumeric() || c == '/' || c == '-' || c == '_' || c == '.') {
        return Err(format!("Invalid repo_id format: {}", model.repo_id));
    }
    if !model.repo_id.contains('/') || model.repo_id.starts_with('/') || model.repo_id.ends_with('/') {
        return Err(format!("Invalid repo_id format (must be org/model): {}", model.repo_id));
    }

    // Determine required files and their source repos based on format
    // For GGUF: model.gguf from repo_id, config/tokenizer from base_model_id
    struct FileSource {
        local_name: &'static str,  // What we save the file as locally
        remote_name: String,        // What the file is called in the HuggingFace repo
        repo_id: String,
    }

    let file_sources: Vec<FileSource> = if model.format == "gguf" {
        let base_repo = model.base_model_id.clone()
            .ok_or_else(|| format!("GGUF model '{}' missing base_model_id for config/tokenizer", model.name))?;
        let gguf_remote = model.gguf_file.clone()
            .ok_or_else(|| format!("GGUF model '{}' missing gguf_file (remote filename)", model.name))?;
        vec![
            FileSource { local_name: "model.gguf", remote_name: gguf_remote, repo_id: model.repo_id.clone() },
            FileSource { local_name: "config.json", remote_name: "config.json".into(), repo_id: base_repo.clone() },
            FileSource { local_name: "tokenizer.json", remote_name: "tokenizer.json".into(), repo_id: base_repo },
        ]
    } else {
        vec![
            FileSource { local_name: "model.safetensors", remote_name: "model.safetensors".into(), repo_id: model.repo_id.clone() },
            FileSource { local_name: "config.json", remote_name: "config.json".into(), repo_id: model.repo_id.clone() },
            FileSource { local_name: "tokenizer.json", remote_name: "tokenizer.json".into(), repo_id: model.repo_id.clone() },
        ]
    };

    let required_files: Vec<&str> = file_sources.iter().map(|f| f.local_name).collect();

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

    // Both formats use a directory for consistency
    let dest_dir = models_dir.join(&model.filename);
    let temp_dir = models_dir.join(format!("{}.download", &model.filename));

    // Check if already downloaded and valid (all required files exist)
    if dest_dir.exists() && dest_dir.is_dir() {
        let all_files_exist = required_files.iter().all(|f| dest_dir.join(f).exists());
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

    eprintln!("Downloading {} [{}] ({} MB) from HuggingFace: {}", model.name, model.format, model.size_mb, model.repo_id);

    // Emit initial progress event with estimated size
    let estimated_bytes = model.size_mb as u64 * 1_000_000;
    let _ = window.emit("download-progress", DownloadProgress::downloading(&model_name, 0, estimated_bytes, 0));

    let start_time = std::time::Instant::now();
    let mut total_downloaded: u64 = 0;

    // Helper to clean up temp directory on error
    let cleanup_on_error = |temp: &std::path::Path| {
        std::fs::remove_dir_all(temp).ok();
    };

    // Download each required file (each may come from a different repo)
    for (file_idx, file_source) in file_sources.iter().enumerate() {
        // Check for cancellation before starting each file
        if is_download_cancelled(&model_name) {
            eprintln!("Download cancelled: {}", model_name);
            cleanup_on_error(&temp_dir);
            let _ = window.emit("download-progress", DownloadProgress::cancelled(&model_name));
            return Err("Download cancelled".to_string());
        }

        let file_url = format!(
            "https://huggingface.co/{}/resolve/main/{}",
            file_source.repo_id, file_source.remote_name
        );
        eprintln!("Downloading file {}/{}: {} -> {} from {}", file_idx + 1, file_sources.len(), file_source.remote_name, file_source.local_name, file_source.repo_id);

        let response = ureq::get(&file_url)
            .call()
            .map_err(|e| {
                cleanup_on_error(&temp_dir);
                format!("Failed to download {}: {}", file_source.remote_name, e)
            })?;

        let _file_size = response
            .header("content-length")
            .and_then(|s| s.parse::<u64>().ok())
            .unwrap_or(0);

        let dest_file = temp_dir.join(file_source.local_name);
        let file = std::fs::File::create(&dest_file)
            .map_err(|e| {
                cleanup_on_error(&temp_dir);
                format!("Failed to create file {}: {}", file_source.local_name, e)
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

        eprintln!("Downloaded {} as {} ({} bytes)", file_source.remote_name, file_source.local_name, file_downloaded);
    }

    // Verify all files exist
    let _ = window.emit(
        "download-progress",
        DownloadProgress::verifying(&model_name, total_downloaded, estimated_bytes),
    );

    for filename in &required_files {
        if !temp_dir.join(filename).exists() {
            cleanup_on_error(&temp_dir);
            let error_msg = format!("Missing required file after download: {}", filename);
            let _ = window.emit("download-progress", DownloadProgress::error(&model_name, &error_msg));
            return Err(error_msg);
        }
    }

    // Validate GGUF format if applicable
    if model.format == "gguf" {
        let gguf_file = temp_dir.join("model.gguf");
        if !is_valid_gguf(&gguf_file) {
            cleanup_on_error(&temp_dir);
            let error_msg = "Downloaded GGUF file is invalid or corrupted".to_string();
            let _ = window.emit("download-progress", DownloadProgress::error(&model_name, &error_msg));
            return Err(error_msg);
        }
        eprintln!("GGUF file validated successfully");
    }

    // Move temp directory to final location
    if dest_dir.exists() {
        std::fs::remove_dir_all(&dest_dir).map_err(|e| {
            cleanup_on_error(&temp_dir);
            format!("Failed to remove existing model directory: {}", e)
        })?;
    }
    std::fs::rename(&temp_dir, &dest_dir).map_err(|e| {
        cleanup_on_error(&temp_dir);
        format!("Failed to move downloaded files: {}", e)
    })?;

    let _ = window.emit("download-progress", DownloadProgress::complete(&model_name, total_downloaded));

    eprintln!("Model saved to {}", dest_dir.display());
    Ok(dest_dir.to_string_lossy().to_string())
}

/// Validate that a file is a valid GGUF format by checking the magic bytes
fn is_valid_gguf(path: &std::path::Path) -> bool {
    use std::io::Read;
    // GGUF files start with magic number "GGUF" (0x46554747 in little-endian)
    if let Ok(mut file) = std::fs::File::open(path) {
        let mut magic = [0u8; 4];
        if file.read_exact(&mut magic).is_ok() {
            // GGUF magic: "GGUF" = [0x47, 0x47, 0x55, 0x46]
            return &magic == b"GGUF";
        }
    }
    false
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
    use sysinfo::System;

    // Get RAM info
    let mut sys = System::new_all();
    sys.refresh_memory();
    let total_ram_bytes = sys.total_memory();
    let total_ram_gb = (total_ram_bytes as f64 / 1_073_741_824.0) as f32; // bytes to GB

    // Get GPU info
    let gpu_info = detect_gpu_info();

    // Get platform with more detail
    let platform = format_platform();

    Ok(SystemInfo {
        cpu_cores: num_cpus::get(),
        total_ram_gb,
        gpu_available: gpu_info.available,
        gpu_name: gpu_info.name,
        gpu_vram_mb: gpu_info.vram_mb,
        platform,
    })
}

/// Format platform string with OS name and version
fn format_platform() -> String {
    #[cfg(target_os = "linux")]
    {
        // Try to get distro info from /etc/os-release
        if let Ok(content) = std::fs::read_to_string("/etc/os-release") {
            let mut name: Option<String> = None;
            let mut version: Option<String> = None;

            for line in content.lines() {
                if let Some(val) = line.strip_prefix("NAME=") {
                    name = Some(val.trim_matches('"').to_string());
                } else if let Some(val) = line.strip_prefix("VERSION_ID=") {
                    version = Some(val.trim_matches('"').to_string());
                }
            }

            match (&name, &version) {
                (Some(n), Some(v)) => return format!("Linux ({} {})", n, v),
                (Some(n), None) => return format!("Linux ({})", n),
                _ => {}
            }
        }
        return "Linux".to_string();
    }

    #[cfg(target_os = "macos")]
    {
        // Get macOS version from sw_vers
        if let Ok(output) = std::process::Command::new("sw_vers")
            .arg("-productVersion")
            .output()
        {
            if output.status.success() {
                let version = safe_output_to_string(&output.stdout);
                let version = version.trim();
                if !version.is_empty() {
                    return format!("macOS {}", version);
                }
            }
        }
        return "macOS".to_string();
    }

    #[cfg(not(any(target_os = "linux", target_os = "macos")))]
    {
        std::env::consts::OS.to_string()
    }
}

/// Configuration structure matching config.toml
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AppConfig {
    pub model: ModelConfig,
    pub audio: AudioConfig,
    pub output: OutputConfig,
    #[serde(default)]
    pub ui: UiConfig,
    #[serde(default)]
    pub history: HistoryConfig,
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

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct HistoryConfig {
    pub max_entries: Option<u32>,
}

impl Default for HistoryConfig {
    fn default() -> Self {
        Self {
            max_entries: Some(500),
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
        std::env::var("HOME")
            .map(|home| path.replacen('~', &home, 1))
            .unwrap_or_else(|_| path.clone())
    } else {
        path
    };

    let path_obj = std::path::Path::new(&expanded_path);

    if !path_obj.exists() {
        return Ok(PathValidation {
            valid: false,
            exists: false,
            is_file: false,
            is_directory: false,
            expanded_path,
            message: "Path does not exist".to_string(),
        });
    }

    let is_file = path_obj.is_file();
    let is_directory = path_obj.is_dir();

    let message = if is_file {
        "Valid file path"
    } else if is_directory {
        "Valid directory path"
    } else {
        "Path exists"
    };

    Ok(PathValidation {
        valid: true,
        exists: true,
        is_file,
        is_directory,
        expanded_path,
        message: message.to_string(),
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
    /// Model format: "safetensors" or "gguf"
    pub format: String,
    /// HuggingFace model ID (e.g., "openai/whisper-large-v3-turbo")
    #[serde(skip_serializing)]
    pub repo_id: String,
    /// For GGUF models: HuggingFace model ID to fetch config/tokenizer from
    #[serde(skip_serializing)]
    pub base_model_id: Option<String>,
    /// For GGUF models: actual filename in the HuggingFace repo (e.g., "whisper-large-v3-q8_0.gguf")
    #[serde(skip_serializing)]
    pub gguf_file: Option<String>,
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

/// Embedded model registry - safetensors and GGUF formats from HuggingFace
fn get_model_registry() -> Vec<RegistryModel> {
    vec![
        // ===========================================
        // SAFETENSORS MODELS (Full precision)
        // ===========================================

        // Large V3 Turbo (Recommended - fast and accurate)
        RegistryModel { name: "large-v3-turbo".into(), filename: "whisper-large-v3-turbo".into(), size_mb: 1550, family: "Large V3 Turbo".into(), quantization: "Full".into(), format: "safetensors".into(), repo_id: "openai/whisper-large-v3-turbo".into(), base_model_id: None, gguf_file: None },
        // Distil-Whisper (Faster, English-optimized)
        RegistryModel { name: "distil-large-v3.5".into(), filename: "distil-large-v3.5".into(), size_mb: 1510, family: "Distil".into(), quantization: "Full".into(), format: "safetensors".into(), repo_id: "distil-whisper/distil-large-v3.5".into(), base_model_id: None, gguf_file: None },
        RegistryModel { name: "distil-large-v3".into(), filename: "distil-large-v3".into(), size_mb: 1510, family: "Distil".into(), quantization: "Full".into(), format: "safetensors".into(), repo_id: "distil-whisper/distil-large-v3".into(), base_model_id: None, gguf_file: None },
        RegistryModel { name: "distil-large-v2".into(), filename: "distil-large-v2".into(), size_mb: 1510, family: "Distil".into(), quantization: "Full".into(), format: "safetensors".into(), repo_id: "distil-whisper/distil-large-v2".into(), base_model_id: None, gguf_file: None },
        RegistryModel { name: "distil-small.en".into(), filename: "distil-small-en".into(), size_mb: 332, family: "Distil".into(), quantization: "Full".into(), format: "safetensors".into(), repo_id: "distil-whisper/distil-small.en".into(), base_model_id: None, gguf_file: None },
        // Large V3
        RegistryModel { name: "large-v3".into(), filename: "whisper-large-v3".into(), size_mb: 3094, family: "Large V3".into(), quantization: "Full".into(), format: "safetensors".into(), repo_id: "openai/whisper-large-v3".into(), base_model_id: None, gguf_file: None },
        // Large V2
        RegistryModel { name: "large-v2".into(), filename: "whisper-large-v2".into(), size_mb: 3094, family: "Large V2".into(), quantization: "Full".into(), format: "safetensors".into(), repo_id: "openai/whisper-large-v2".into(), base_model_id: None, gguf_file: None },
        // Large V1
        RegistryModel { name: "large".into(), filename: "whisper-large".into(), size_mb: 3094, family: "Large".into(), quantization: "Full".into(), format: "safetensors".into(), repo_id: "openai/whisper-large".into(), base_model_id: None, gguf_file: None },
        // Medium
        RegistryModel { name: "medium".into(), filename: "whisper-medium".into(), size_mb: 3090, family: "Medium".into(), quantization: "Full".into(), format: "safetensors".into(), repo_id: "openai/whisper-medium".into(), base_model_id: None, gguf_file: None },
        RegistryModel { name: "medium.en".into(), filename: "whisper-medium-en".into(), size_mb: 3090, family: "Medium".into(), quantization: "Full".into(), format: "safetensors".into(), repo_id: "openai/whisper-medium.en".into(), base_model_id: None, gguf_file: None },
        // Small
        RegistryModel { name: "small".into(), filename: "whisper-small".into(), size_mb: 970, family: "Small".into(), quantization: "Full".into(), format: "safetensors".into(), repo_id: "openai/whisper-small".into(), base_model_id: None, gguf_file: None },
        RegistryModel { name: "small.en".into(), filename: "whisper-small-en".into(), size_mb: 970, family: "Small".into(), quantization: "Full".into(), format: "safetensors".into(), repo_id: "openai/whisper-small.en".into(), base_model_id: None, gguf_file: None },
        // Base
        RegistryModel { name: "base".into(), filename: "whisper-base".into(), size_mb: 293, family: "Base".into(), quantization: "Full".into(), format: "safetensors".into(), repo_id: "openai/whisper-base".into(), base_model_id: None, gguf_file: None },
        RegistryModel { name: "base.en".into(), filename: "whisper-base-en".into(), size_mb: 293, family: "Base".into(), quantization: "Full".into(), format: "safetensors".into(), repo_id: "openai/whisper-base.en".into(), base_model_id: None, gguf_file: None },
        // Tiny
        RegistryModel { name: "tiny".into(), filename: "whisper-tiny".into(), size_mb: 154, family: "Tiny".into(), quantization: "Full".into(), format: "safetensors".into(), repo_id: "openai/whisper-tiny".into(), base_model_id: None, gguf_file: None },
        RegistryModel { name: "tiny.en".into(), filename: "whisper-tiny-en".into(), size_mb: 154, family: "Tiny".into(), quantization: "Full".into(), format: "safetensors".into(), repo_id: "openai/whisper-tiny.en".into(), base_model_id: None, gguf_file: None },

        // ===========================================
        // GGUF MODELS (Quantized - smaller & faster)
        // ===========================================
        // Note: These may or may not work with Candle's from_gguf() loader.
        // The Demonthos model is confirmed to work; others are experimental.

        // Large V3 Turbo GGUF variants
        RegistryModel { name: "large-v3-turbo-q8".into(), filename: "whisper-large-v3-turbo-q8-gguf".into(), size_mb: 478, family: "Large V3 Turbo".into(), quantization: "Q8_0".into(), format: "gguf".into(), repo_id: "Demonthos/candle-quantized-whisper-large-v3-turbo".into(), base_model_id: Some("openai/whisper-large-v3-turbo".into()), gguf_file: Some("model.gguf".into()) },
        RegistryModel { name: "large-v3-turbo-q4".into(), filename: "whisper-large-v3-turbo-q4-gguf".into(), size_mb: 528, family: "Large V3 Turbo".into(), quantization: "Q4_1".into(), format: "gguf".into(), repo_id: "xkeyC/whisper-large-v3-turbo-gguf".into(), base_model_id: Some("openai/whisper-large-v3-turbo".into()), gguf_file: Some("model_q4_1.gguf".into()) },
        RegistryModel { name: "large-v3-turbo-q4k".into(), filename: "whisper-large-v3-turbo-q4k-gguf".into(), size_mb: 478, family: "Large V3 Turbo".into(), quantization: "Q4_K".into(), format: "gguf".into(), repo_id: "xkeyC/whisper-large-v3-turbo-gguf".into(), base_model_id: Some("openai/whisper-large-v3-turbo".into()), gguf_file: Some("model_q4_k.gguf".into()) },

        // Large V3 GGUF variants
        RegistryModel { name: "large-v3-q8".into(), filename: "whisper-large-v3-q8-gguf".into(), size_mb: 1660, family: "Large V3".into(), quantization: "Q8_0".into(), format: "gguf".into(), repo_id: "vonjack/whisper-large-v3-gguf".into(), base_model_id: Some("openai/whisper-large-v3".into()), gguf_file: Some("whisper-large-v3-q8_0.gguf".into()) },
        RegistryModel { name: "large-v3-f16".into(), filename: "whisper-large-v3-f16-gguf".into(), size_mb: 3100, family: "Large V3".into(), quantization: "F16".into(), format: "gguf".into(), repo_id: "vonjack/whisper-large-v3-gguf".into(), base_model_id: Some("openai/whisper-large-v3".into()), gguf_file: Some("whisper-large-v3-f16.gguf".into()) },

        // Medium GGUF variants
        RegistryModel { name: "medium-q4k".into(), filename: "whisper-medium-q4k-gguf".into(), size_mb: 446, family: "Medium".into(), quantization: "Q4_K".into(), format: "gguf".into(), repo_id: "OllmOne/whisper-medium-GGUF".into(), base_model_id: Some("openai/whisper-medium".into()), gguf_file: Some("model-q4k.gguf".into()) },
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

    // Try to canonicalize for accurate comparison (handles symlinks, ~, etc.)
    let active = if active.exists() {
        active.canonicalize().unwrap_or_else(|_| active.to_path_buf())
    } else {
        active.to_path_buf()
    };

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

                    // Check if directory has required files for either format
                    // Safetensors: model.safetensors + config.json + tokenizer.json
                    // GGUF: model.gguf + config.json + tokenizer.json
                    let is_safetensors = path.join("model.safetensors").exists()
                        && path.join("config.json").exists()
                        && path.join("tokenizer.json").exists();
                    let is_gguf = path.join("model.gguf").exists()
                        && path.join("config.json").exists()
                        && path.join("tokenizer.json").exists();

                    if is_safetensors || is_gguf {
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
                            let model_files: Vec<&str> = if is_gguf {
                                vec!["model.gguf", "config.json", "tokenizer.json"]
                            } else {
                                vec!["model.safetensors", "config.json", "tokenizer.json"]
                            };

                            let size_result: Result<u64, _> = model_files.iter()
                                .map(|f| std::fs::metadata(path.join(f)).map(|m| m.len()))
                                .collect::<Result<Vec<_>, _>>()
                                .map(|sizes| sizes.iter().sum());

                            let size_mb = match size_result {
                                Ok(size) => (size / 1_000_000) as u32,
                                Err(e) => {
                                    eprintln!("Warning: Could not calculate size for model {}: {}", dirname, e);
                                    0 // Show as 0 MB if we can't read metadata
                                }
                            };

                            downloaded.push(DownloadedModel {
                                name: dirname.clone(),
                                filename: dirname.clone(),
                                path: path.to_string_lossy().to_string(),
                                size_mb,
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
