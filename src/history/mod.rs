mod storage;

// Re-exports for Tauri UI - used by ui/src-tauri/src/commands.rs
#[allow(unused_imports)]
pub use storage::{
    append_entry, clear_history, delete_entry, enforce_max_entries, get_unique_models,
    load_entries, HistoryEntry, HistoryResponse,
};
