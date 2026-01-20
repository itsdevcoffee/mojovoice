# Transcription History Feature - Testing Guide

**Status:** Testing

## Overview

This guide walks through testing the transcription history feature while explaining the technical implementation at each step.

---

## Prerequisites

```bash
# Build daemon with CUDA
RUSTFLAGS="-L /usr/lib64 -L /usr/local/lib/ollama" cargo build --release --features cuda

# Build UI
cd ui && npm run build && cd ..

# Start daemon
./target/release/mojovoice daemon start
```

---

## Test 1: Basic History Entry Creation

### Steps
1. Open the UI and make a transcription (record → stop)
2. Check the history file exists

```bash
cat ~/.local/share/mojovoice/history.jsonl
```

### Expected Output
```json
{"id":"uuid-here","timestamp":1736000000000,"text":"your transcription","duration_ms":1500,"model":"whisper-large-v3-turbo-q4-gguf"}
```

### Technical Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│ 1. User stops recording                                                 │
│    └─→ server.rs:handle_stop_recording()                               │
│                                                                         │
│ 2. Transcription completes                                              │
│    └─→ Returns text, calculates duration_ms                            │
│                                                                         │
│ 3. Create HistoryEntry                                                  │
│    └─→ storage.rs:HistoryEntry::new()                                  │
│        ├─ Generates UUID v4 via uuid::Uuid::new_v4()                   │
│        ├─ Gets timestamp via chrono::Utc::now().timestamp_millis()     │
│        └─ Stores text, duration, model name, optional audio_path       │
│                                                                         │
│ 4. Append to JSONL file                                                 │
│    └─→ storage.rs:append_entry()                                       │
│        ├─ Acquires EXCLUSIVE lock on .history.jsonl.lock               │
│        ├─ Opens file with O_APPEND flag (atomic append)                │
│        ├─ Serializes entry to JSON, writes line                        │
│        └─ Lock released when function returns                          │
└─────────────────────────────────────────────────────────────────────────┘
```

**Key files:**
- `src/daemon/server.rs:~450` - Integration point
- `src/history/storage.rs:168-189` - append_entry with locking

---

## Test 2: History UI Display

### Steps
1. Click "History" tab in sidebar
2. Verify entries appear (newest first)
3. Check entry shows: timestamp, text preview, duration badge, model badge

### Technical Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│ 1. User clicks History tab                                              │
│    └─→ App.tsx sets activeView = 'history'                             │
│    └─→ Renders <TranscriptionHistory />                                │
│                                                                         │
│ 2. Component mounts, calls loadHistory()                                │
│    └─→ appStore.ts:loadHistory()                                       │
│        └─→ invoke('get_transcription_history', {limit: 100, offset: 0})│
│                                                                         │
│ 3. Tauri command executes                                               │
│    └─→ commands.rs:get_transcription_history()                         │
│        ├─ Calls mojovoice::history::get_unique_models()                │
│        │   └─ Acquires SHARED lock (allows concurrent reads)           │
│        └─ Calls mojovoice::history::load_entries()                     │
│            └─ Acquires SHARED lock                                     │
│                                                                         │
│ 4. load_entries() processes data                                        │
│    └─→ storage.rs:load_entries()                                       │
│        ├─ read_all_entries() - parses JSONL, skips corrupt lines       │
│        ├─ Applies search filter (case-insensitive contains)            │
│        ├─ Applies model filter (exact match)                           │
│        ├─ Sorts by timestamp DESC (newest first)                       │
│        └─ Returns paginated slice with has_more flag                   │
│                                                                         │
│ 5. UI renders entries                                                   │
│    └─→ TranscriptionHistory.tsx maps entries to HistoryCard components │
└─────────────────────────────────────────────────────────────────────────┘
```

**Key files:**
- `ui/src/components/TranscriptionHistory.tsx` - UI component
- `ui/src/stores/appStore.ts` - State management
- `ui/src-tauri/src/commands.rs:~180` - Tauri commands
- `src/history/storage.rs:201-242` - load_entries with locking

---

## Test 3: Search Functionality

### Steps
1. Type a word from one of your transcriptions in the search box
2. Verify list filters to matching entries
3. Clear search, verify all entries return

### Technical Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│ 1. User types in search input                                           │
│    └─→ Debounced (300ms) to avoid excessive API calls                  │
│                                                                         │
│ 2. setSearchQuery() updates store                                       │
│    └─→ Triggers loadHistory() with search param                        │
│                                                                         │
│ 3. Backend filtering                                                    │
│    └─→ storage.rs:load_entries()                                       │
│        └─ if search.is_some():                                         │
│            query_lower = query.to_lowercase()                          │
│            entries.retain(|e| e.text.to_lowercase().contains(&query))  │
│                                                                         │
│ Note: Filtering happens server-side, not in browser                     │
│       This scales better for large history files                        │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Test 4: Model Filter

### Steps
1. Make transcriptions with different models (if available)
2. Select a model from the dropdown filter
3. Verify only entries from that model appear

### Technical Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│ 1. Dropdown populated from get_unique_models()                          │
│    └─→ Reads all entries, extracts unique model names into HashSet     │
│    └─→ Returns sorted Vec<String>                                      │
│                                                                         │
│ 2. User selects model                                                   │
│    └─→ setModelFilter() → loadHistory()                                │
│                                                                         │
│ 3. Backend filtering                                                    │
│    └─→ storage.rs:load_entries()                                       │
│        └─ if model_filter.is_some() && !model.is_empty():              │
│            entries.retain(|e| e.model == model)  // Exact match        │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Test 5: Delete Single Entry

### Steps
1. Expand a history entry (click to expand)
2. Click the trash/delete button
3. Confirm deletion
4. Verify entry removed from list

```bash
# Verify file updated
cat ~/.local/share/mojovoice/history.jsonl | wc -l
```

### Technical Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│ 1. User clicks delete                                                   │
│    └─→ deleteHistoryEntry(id) in appStore                              │
│    └─→ invoke('delete_history_entry', {id})                            │
│                                                                         │
│ 2. Tauri command executes                                               │
│    └─→ commands.rs:delete_history_entry()                              │
│    └─→ mojovoice::history::delete_entry(&id)                           │
│                                                                         │
│ 3. Atomic delete operation                                              │
│    └─→ storage.rs:delete_entry()                                       │
│        ├─ Acquires EXCLUSIVE lock                                      │
│        ├─ read_all_entries() - loads entire file                       │
│        ├─ .filter(|e| e.id != id) - removes target entry               │
│        └─ write_entries_atomic() - safe rewrite                        │
│                                                                         │
│ 4. Atomic write process                                                 │
│    └─→ storage.rs:write_entries_atomic()                               │
│        ├─ Creates .history.jsonl.tmp in same directory                 │
│        ├─ Writes all entries to temp file                              │
│        ├─ Calls sync_all() - ensures data on disk                      │
│        ├─ Renames temp → history.jsonl (atomic on same filesystem)     │
│        └─ On ANY error: cleanup_temp() removes temp file               │
└─────────────────────────────────────────────────────────────────────────┘
```

**Why atomic writes matter:**
- `File::create()` truncates immediately - if write fails mid-way, data is lost
- Temp file + rename ensures either old or new data exists, never partial
- `sync_all()` ensures data is on disk before rename (survives power loss)

---

## Test 6: Clear All History

### Steps
1. Click "Clear History" button (in header)
2. Confirm the action
3. Verify empty state appears

```bash
# Verify file is empty
cat ~/.local/share/mojovoice/history.jsonl
# Should be empty or not exist
```

### Technical Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│ 1. User confirms clear                                                  │
│    └─→ clearHistory() in appStore                                      │
│    └─→ invoke('clear_history')                                         │
│                                                                         │
│ 2. Backend clears file                                                  │
│    └─→ storage.rs:clear_history()                                      │
│        ├─ Acquires EXCLUSIVE lock                                      │
│        └─ write_entries_atomic(&history_file, &[])  // Empty slice     │
│                                                                         │
│ Result: File exists but is empty (0 bytes)                              │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Test 7: Pagination (Load More)

### Steps
1. Create 100+ history entries (or manually add to file)
2. Scroll to bottom of history list
3. Click "Load More" or observe infinite scroll trigger
4. Verify more entries load

### Technical Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│ 1. Initial load                                                         │
│    └─→ loadHistory(limit=100, offset=0)                                │
│    └─→ Response: {entries: [...], total: 150, has_more: true}          │
│                                                                         │
│ 2. User triggers load more                                              │
│    └─→ loadMoreHistory()                                               │
│    └─→ loadHistory(limit=100, offset=100)                              │
│                                                                         │
│ 3. Backend pagination                                                   │
│    └─→ load_entries() always loads full file, then:                    │
│        entries.into_iter().skip(offset).take(limit).collect()          │
│                                                                         │
│ Note: Current implementation loads full file each time                  │
│       Fine for <10K entries, would need optimization for larger        │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Test 8: Corrupt Line Recovery

### Steps
1. Manually corrupt a line in the history file:

```bash
echo "this is not valid json" >> ~/.local/share/mojovoice/history.jsonl
```

2. Reload history in UI
3. Verify other entries still load (corrupt line skipped)

### Technical Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│ read_all_entries() handles corruption gracefully:                       │
│                                                                         │
│ reader.lines()                                                          │
│     .filter_map(|line| {                                               │
│         let line = line.ok()?;           // Skip IO errors             │
│         if line.trim().is_empty() {                                    │
│             return None;                  // Skip blank lines          │
│         }                                                               │
│         match serde_json::from_str(&line) {                            │
│             Ok(entry) => Some(entry),     // Valid entry               │
│             Err(e) => {                                                │
│                 warn!("Skipping corrupted: {}", e);  // Log + skip     │
│                 None                                                    │
│             }                                                           │
│         }                                                               │
│     })                                                                  │
│                                                                         │
│ Result: Valid entries load, corrupt lines logged and skipped            │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Test 9: File Locking (Concurrent Access)

### Steps
1. Open two terminal windows
2. In terminal 1, simulate a slow write:

```bash
# Hold exclusive lock for 5 seconds
flock -x ~/.local/share/mojovoice/.history.jsonl.lock -c "echo 'holding lock'; sleep 5; echo 'released'"
```

3. In terminal 2, try to read history in UI during lock hold
4. Observe: UI should wait, then succeed after lock released

### Technical Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│ File Locking Implementation (fs2 crate)                                 │
│                                                                         │
│ Lock file: ~/.local/share/mojovoice/.history.jsonl.lock                │
│                                                                         │
│ Write operations (exclusive lock):                                      │
│   acquire_exclusive_lock()                                              │
│   └─→ lock_file.lock_exclusive()  // Blocks until acquired            │
│   └─→ Only ONE writer at a time                                        │
│                                                                         │
│ Read operations (shared lock):                                          │
│   acquire_shared_lock()                                                 │
│   └─→ lock_file.lock_shared()  // Multiple readers OK                  │
│   └─→ Blocked if exclusive lock held                                   │
│                                                                         │
│ Lock matrix:                                                            │
│ ┌──────────┬──────────┬──────────┐                                     │
│ │ Holder   │ Shared   │ Exclusive│                                     │
│ ├──────────┼──────────┼──────────┤                                     │
│ │ Shared   │ ✓ OK     │ ✗ Block  │                                     │
│ │ Exclusive│ ✗ Block  │ ✗ Block  │                                     │
│ └──────────┴──────────┴──────────┘                                     │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Test 10: Max Entries Enforcement

### Steps
1. Set max_entries to a small number for testing:

```bash
# Edit config
nano ~/.config/mojovoice/config.toml
# Add/modify:
# [history]
# max_entries = 5
```

2. Create more than 5 transcriptions
3. Verify only newest 5 remain in file

```bash
cat ~/.local/share/mojovoice/history.jsonl | wc -l
# Should be 5
```

### Technical Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│ enforce_max_entries() - called after each append                        │
│                                                                         │
│ 1. Acquire exclusive lock                                               │
│ 2. Read all entries                                                     │
│ 3. If entries.len() <= max_entries: return early                       │
│ 4. Sort by timestamp DESC (newest first)                                │
│ 5. Truncate to max_entries                                              │
│ 6. Sort back to chronological order                                     │
│ 7. Atomic write back                                                    │
│                                                                         │
│ Validation bounds (settings.rs):                                        │
│   min: 5 entries                                                        │
│   max: 100,000 entries                                                  │
│   None = unlimited                                                      │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Test 11: Temp File Cleanup on Error

### Steps
1. Simulate disk full or permission error (advanced):

```bash
# Create read-only directory to force rename failure
chmod 444 ~/.local/share/mojovoice/
```

2. Try to delete an entry
3. Check that temp file doesn't remain:

```bash
ls -la ~/.local/share/mojovoice/.history.jsonl.tmp
# Should not exist
```

4. Restore permissions:

```bash
chmod 755 ~/.local/share/mojovoice/
```

### Technical Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│ write_entries_atomic() error handling:                                  │
│                                                                         │
│ let cleanup_temp = |temp: &Path| {                                     │
│     if temp.exists() {                                                  │
│         if let Err(e) = std::fs::remove_file(temp) {                   │
│             warn!("Failed to clean up temp file: {}", e);              │
│         }                                                               │
│     }                                                                   │
│ };                                                                      │
│                                                                         │
│ // On write failure:                                                    │
│ if let Err(e) = write_result {                                         │
│     cleanup_temp(&temp_path);  // ← Clean up                           │
│     return Err(e);                                                      │
│ }                                                                       │
│                                                                         │
│ // On rename failure:                                                   │
│ if let Err(e) = std::fs::rename(&temp_path, path) {                    │
│     cleanup_temp(&temp_path);  // ← Clean up                           │
│     return Err(e);                                                      │
│ }                                                                       │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Test 12: Audio Path Association

### Steps
1. Enable audio clip saving in settings
2. Make a transcription
3. Check history entry has audio_path field:

```bash
cat ~/.local/share/mojovoice/history.jsonl | jq -r '.audio_path'
```

4. Verify the audio file exists at that path
5. In UI, verify play button appears for that entry

### Technical Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Audio path flow (fixed in recent update):                               │
│                                                                         │
│ 1. save_audio_recording() now returns Result<PathBuf>                  │
│    └─→ Returns ACTUAL path where file was saved                        │
│                                                                         │
│ 2. handle_stop_recording() captures the returned path:                  │
│    let saved_audio_path = if config.audio.save_audio_clips {           │
│        match Self::save_audio_recording(...) {                         │
│            Ok(path) => Some(path),  // ← Use returned path             │
│            Err(e) => None                                               │
│        }                                                                │
│    };                                                                   │
│                                                                         │
│ 3. HistoryEntry created with actual path:                               │
│    let audio_path = saved_audio_path.map(|p| p.to_string_lossy());    │
│                                                                         │
│ Previous bug: Timestamp mismatch between save and history entry         │
│ Fix: Use the path returned by save_audio_recording()                   │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Test 13: Settings UI for max_entries

### Steps
1. Open Settings → History section
2. Change max_entries value
3. Toggle "No limit" checkbox
4. Save and verify config updated:

```bash
cat ~/.config/mojovoice/config.toml | grep -A2 "\[history\]"
```

### Expected Behavior
- Number input: 5-100,000 range enforced
- "No limit" checkbox: Sets `max_entries = None` in config
- Values < 5 auto-corrected to 5
- Values > 100,000 auto-corrected to 100,000

---

## File Locations Reference

| File | Path |
|------|------|
| History data | `~/.local/share/mojovoice/history.jsonl` |
| Lock file | `~/.local/share/mojovoice/.history.jsonl.lock` |
| Config | `~/.config/mojovoice/config.toml` |
| Audio clips | Configured in `config.toml` → `[audio].audio_clips_path` |

---

## Troubleshooting

| Issue | Check |
|-------|-------|
| History not loading | `cat ~/.local/share/mojovoice/history.jsonl` - valid JSON? |
| Entries not persisting | Daemon running? Check `mojovoice daemon status` |
| Lock timeout | Check for stale `.history.jsonl.lock` file |
| UI shows old data | Refresh with search clear, or restart UI |
