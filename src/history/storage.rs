use anyhow::{Context, Result};
use fs2::FileExt;
use serde::{Deserialize, Serialize};
use std::fs::{File, OpenOptions};
use std::io::{BufRead, BufReader, BufWriter, Write};
use std::path::{Path, PathBuf};
use tracing::{info, warn};
use uuid::Uuid;

use crate::state::paths::get_history_file;

/// Get the lock file path for the history file
fn get_lock_file_path(history_path: &Path) -> PathBuf {
    let parent = history_path.parent().unwrap_or(Path::new("."));
    parent.join(".history.jsonl.lock")
}

/// Acquire an exclusive lock for write operations
fn acquire_exclusive_lock(history_path: &Path) -> Result<File> {
    let lock_path = get_lock_file_path(history_path);
    let lock_file = OpenOptions::new()
        .create(true)
        .write(true)
        .truncate(true)
        .open(&lock_path)
        .context("Failed to open lock file")?;
    lock_file
        .lock_exclusive()
        .context("Failed to acquire exclusive lock")?;
    Ok(lock_file)
}

/// Acquire a shared lock for read operations
#[allow(dead_code)] // Used by load_entries/get_unique_models (called from Tauri UI)
fn acquire_shared_lock(history_path: &Path) -> Result<File> {
    let lock_path = get_lock_file_path(history_path);
    let lock_file = OpenOptions::new()
        .create(true)
        .write(true)
        .truncate(true)
        .open(&lock_path)
        .context("Failed to open lock file")?;
    lock_file
        .lock_shared()
        .context("Failed to acquire shared lock")?;
    Ok(lock_file)
}

/// Read all entries from a history file, skipping corrupted lines
fn read_all_entries(path: &Path) -> Result<Vec<HistoryEntry>> {
    if !path.exists() {
        return Ok(vec![]);
    }

    let file = File::open(path).context("Failed to open history file for reading")?;
    let reader = BufReader::new(file);

    let entries: Vec<HistoryEntry> = reader
        .lines()
        .filter_map(|line| {
            let line = line.ok()?;
            if line.trim().is_empty() {
                return None;
            }
            match serde_json::from_str::<HistoryEntry>(&line) {
                Ok(entry) => Some(entry),
                Err(e) => {
                    warn!("Skipping corrupted history line: {}", e);
                    None
                }
            }
        })
        .collect();

    Ok(entries)
}

/// Atomically write entries to the history file using a temp file + rename
fn write_entries_atomic(path: &Path, entries: &[HistoryEntry]) -> Result<()> {
    // Create temp file in the same directory for atomic rename
    let parent = path.parent().unwrap_or(Path::new("."));
    let temp_path = parent.join(".history.jsonl.tmp");

    // Helper to clean up temp file on error
    let cleanup_temp = |temp: &Path| {
        if temp.exists() {
            if let Err(e) = std::fs::remove_file(temp) {
                warn!("Failed to clean up temp file {}: {}", temp.display(), e);
            }
        }
    };

    // Write to temp file
    let write_result: Result<()> = (|| {
        let file = File::create(&temp_path).context("Failed to create temp history file")?;
        let mut writer = BufWriter::new(file);

        for entry in entries {
            let line = serde_json::to_string(entry).context("Failed to serialize entry")?;
            writeln!(writer, "{}", line).context("Failed to write entry")?;
        }

        writer.flush().context("Failed to flush temp history file")?;
        // Ensure data is synced to disk before rename
        writer
            .into_inner()
            .map_err(|e| anyhow::anyhow!("Failed to get inner file: {}", e))?
            .sync_all()
            .context("Failed to sync temp history file")?;

        Ok(())
    })();

    // If write failed, clean up temp file and return error
    if let Err(e) = write_result {
        cleanup_temp(&temp_path);
        return Err(e);
    }

    // Atomically rename temp file to actual file
    if let Err(e) = std::fs::rename(&temp_path, path) {
        cleanup_temp(&temp_path);
        return Err(e).context("Failed to rename temp history file");
    }

    Ok(())
}

/// A single transcription history entry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HistoryEntry {
    /// Unique identifier (UUID v4)
    pub id: String,
    /// Unix timestamp in milliseconds
    pub timestamp: i64,
    /// Transcribed text
    pub text: String,
    /// Recording duration in milliseconds
    pub duration_ms: u64,
    /// Model name used for transcription
    pub model: String,
    /// Path to saved audio file (if save_audio_clips is enabled)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub audio_path: Option<String>,
}

impl HistoryEntry {
    /// Create a new history entry with a generated UUID and current timestamp
    pub fn new(text: String, duration_ms: u64, model: String, audio_path: Option<String>) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            timestamp: chrono::Utc::now().timestamp_millis(),
            text,
            duration_ms,
            model,
            audio_path,
        }
    }
}

/// Response containing history entries with pagination info
#[allow(dead_code)] // Constructed by load_entries, used via Tauri UI
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HistoryResponse {
    pub entries: Vec<HistoryEntry>,
    pub total: usize,
    pub has_more: bool,
}

/// Append a new entry to the history file (JSONL format)
pub fn append_entry(entry: &HistoryEntry) -> Result<()> {
    let history_file = get_history_file()?;

    // Acquire exclusive lock for write
    let _lock = acquire_exclusive_lock(&history_file)?;

    let file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&history_file)
        .context("Failed to open history file for append")?;

    let mut writer = BufWriter::new(file);
    let line = serde_json::to_string(entry).context("Failed to serialize history entry")?;

    writeln!(writer, "{}", line).context("Failed to write history entry")?;
    writer.flush().context("Failed to flush history file")?;

    info!("Appended history entry: {}", entry.id);
    Ok(())
    // Lock released when _lock goes out of scope
}

/// Load history entries with pagination and optional search filter
///
/// # Arguments
/// * `limit` - Maximum number of entries to return
/// * `offset` - Number of entries to skip from the beginning
/// * `search` - Optional search query to filter entries
/// * `model_filter` - Optional model name to filter by
///
/// Entries are returned in reverse chronological order (newest first)
#[allow(dead_code)] // Public API - called from Tauri UI
pub fn load_entries(
    limit: usize,
    offset: usize,
    search: Option<&str>,
    model_filter: Option<&str>,
) -> Result<HistoryResponse> {
    let history_file = get_history_file()?;

    // Acquire shared lock for read
    let _lock = acquire_shared_lock(&history_file)?;

    let mut all_entries = read_all_entries(&history_file)?;

    // Apply search filter
    if let Some(query) = search {
        let query_lower = query.to_lowercase();
        all_entries.retain(|e| e.text.to_lowercase().contains(&query_lower));
    }

    // Apply model filter
    if let Some(model) = model_filter {
        if !model.is_empty() {
            all_entries.retain(|e| e.model == model);
        }
    }

    let total = all_entries.len();

    // Sort by timestamp descending (newest first)
    all_entries.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));

    // Apply pagination
    let entries: Vec<HistoryEntry> = all_entries.into_iter().skip(offset).take(limit).collect();

    let has_more = offset + entries.len() < total;

    Ok(HistoryResponse {
        entries,
        total,
        has_more,
    })
}

/// Delete a single entry by ID (uses atomic write to prevent data loss)
#[allow(dead_code)] // Public API - called from Tauri UI
pub fn delete_entry(id: &str) -> Result<()> {
    let history_file = get_history_file()?;

    // Acquire exclusive lock for write
    let _lock = acquire_exclusive_lock(&history_file)?;

    // Read all entries except the one to delete
    let entries: Vec<HistoryEntry> = read_all_entries(&history_file)?
        .into_iter()
        .filter(|e| e.id != id)
        .collect();

    // Atomically write back
    write_entries_atomic(&history_file, &entries)?;

    info!("Deleted history entry: {}", id);
    Ok(())
    // Lock released when _lock goes out of scope
}

/// Clear all history entries (uses atomic write to prevent partial state)
#[allow(dead_code)] // Public API - called from Tauri UI
pub fn clear_history() -> Result<()> {
    let history_file = get_history_file()?;

    // Acquire exclusive lock for write
    let _lock = acquire_exclusive_lock(&history_file)?;

    // Atomically write empty file
    write_entries_atomic(&history_file, &[])?;

    info!("Cleared all history entries");
    Ok(())
    // Lock released when _lock goes out of scope
}

/// Enforce max_entries limit by removing oldest entries (uses atomic write)
pub fn enforce_max_entries(max_entries: usize) -> Result<()> {
    let history_file = get_history_file()?;

    // Acquire exclusive lock for write
    let _lock = acquire_exclusive_lock(&history_file)?;

    let mut entries = read_all_entries(&history_file)?;

    // If within limit, nothing to do
    if entries.len() <= max_entries {
        return Ok(());
    }

    let removed_count = entries.len() - max_entries;

    // Sort by timestamp descending (keep newest)
    entries.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));

    // Keep only the newest max_entries
    entries.truncate(max_entries);

    // Sort back to chronological order for file storage
    entries.sort_by(|a, b| a.timestamp.cmp(&b.timestamp));

    // Atomically write back
    write_entries_atomic(&history_file, &entries)?;

    info!(
        "Enforced max_entries limit: removed {} old entries",
        removed_count
    );
    Ok(())
}

/// Get list of unique model names from history
#[allow(dead_code)] // Public API - called from Tauri UI
pub fn get_unique_models() -> Result<Vec<String>> {
    let history_file = get_history_file()?;

    // Acquire shared lock for read
    let _lock = acquire_shared_lock(&history_file)?;

    let entries = read_all_entries(&history_file)?;

    let model_set: std::collections::HashSet<String> = entries
        .into_iter()
        .map(|e| e.model)
        .collect();

    let mut models: Vec<String> = model_set.into_iter().collect();
    models.sort();
    Ok(models)
    // Lock released when _lock goes out of scope
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    // Helper to create a temp history file for testing
    #[allow(dead_code)] // Test utility for future tests
    fn setup_temp_history() -> (TempDir, std::path::PathBuf) {
        let temp_dir = TempDir::new().unwrap();
        let history_path = temp_dir.path().join("history.jsonl");
        (temp_dir, history_path)
    }

    #[test]
    fn test_history_entry_creation() {
        let entry = HistoryEntry::new(
            "Hello world".to_string(),
            1500,
            "whisper-large".to_string(),
            None,
        );

        assert!(!entry.id.is_empty());
        assert_eq!(entry.text, "Hello world");
        assert_eq!(entry.duration_ms, 1500);
        assert_eq!(entry.model, "whisper-large");
        assert!(entry.audio_path.is_none());
    }
}
