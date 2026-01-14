# Model Management UI Implementation

**Date:** 2026-01-14
**Status:** Planning
**Priority:** Medium

---

## Overview

Add a model management interface to the Settings UI for browsing, downloading, and managing Whisper models from the registry.

| Aspect | Details |
|--------|---------|
| **Current State** | Manual path config only |
| **Goal** | One-click model download and switching |
| **Backend** | `download_model` stub exists in Tauri |
| **Registry** | 31 models in `src/model/registry.rs` |

### Backend Commands Required

| Command | Purpose |
|---------|---------|
| `list_available_models` | Get all 31 registry models |
| `list_downloaded_models` | Scan local models directory |
| `download_model` | Download with progress events |
| `delete_model` | Remove model from disk (prevent if active) |
| `switch_model` | Update config + restart daemon |

---

## UI Design

### Tab Structure

```
┌─────────────────┬─────────────────┬─────────────────┐
│  Model Library  │   My Models     │   Downloads     │
└─────────────────┴─────────────────┴─────────────────┘
```

### Tab 1: Model Library

Card grid showing all registry models:

```
┌─────────────────────────────────────┐
│ large-v3-turbo                      │
│ ─────────────────────────────────── │
│ Size: 1.6 GB  │  Family: Large V3   │
│ Quantization: Full                  │
│                                     │
│              [Download]             │
└─────────────────────────────────────┘
```

**Features:**
- Search bar (filter by name)
- Family filter dropdown (Tiny, Base, Small, Medium, Large, Distil)
- Quantization filter (Full, Q5_0, Q5_1, Q8_0)
- Sort by: Name, Size, Recommended

### Tab 2: My Models

List of downloaded models:

```
┌─────────────────────────────────────────────────────┐
│ ● large-v3-turbo          1.6 GB    [Use] [Delete] │
│   base.en                 148 MB    [Use] [Delete] │
│   tiny-q5_1               31 MB     [Use] [Delete] │
└─────────────────────────────────────────────────────┘
```

**Features:**
- Active model indicator (●)
- One-click switch with daemon restart
- Delete with confirmation dialog
- Show model path on hover

### Tab 3: Downloads

Active and recent downloads:

```
┌─────────────────────────────────────────────────────┐
│ distil-large-v3.5                                   │
│ ████████████░░░░░░░░  547 MB / 1.4 GB               │
│ 12.3 MB/s  ~1:12 remaining           [Cancel]       │
└─────────────────────────────────────────────────────┘
```

**Features:**
- Progress bar with percentage
- Speed and ETA
- Cancel button
- History of completed downloads

---

## Data Flow

```
┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│   React UI   │ ──→  │  Tauri IPC   │ ──→  │  Rust Core   │
└──────────────┘      └──────────────┘      └──────────────┘
                                                   │
                                                   ▼
                                            ┌──────────────┐
                                            │   Registry   │
                                            │  (31 models) │
                                            └──────────────┘
```

---

## Implementation Steps

### Step 1: Expose Registry to Frontend

Create Tauri commands to list and manage models:

```rust
// src-tauri/src/commands/models.rs

#[tauri::command]
pub fn list_available_models() -> Vec<ModelInfo> {
    mojovoice::model::ModelInfo::available_models()
        .iter()
        .filter_map(|name| mojovoice::model::ModelInfo::find(name))
        .map(|m| ModelInfo {
            name: m.name.to_string(),
            size_mb: m.size_mb,
            filename: m.filename.to_string(),
        })
        .collect()
}

#[tauri::command]
pub fn list_downloaded_models() -> Result<Vec<DownloadedModel>, String> {
    let models_dir = get_models_dir()?;
    // Scan for .bin/.safetensors files and match against registry
    // ...
}

#[tauri::command]
pub async fn delete_model(name: String) -> Result<(), String> {
    let models_dir = get_models_dir()?;
    let path = models_dir.join(&name);

    if !path.exists() {
        return Err("Model not found".to_string());
    }

    // Prevent deleting active model
    let config = get_config().await?;
    if config.model.path.ends_with(&name) {
        return Err("Cannot delete the currently active model".to_string());
    }

    std::fs::remove_file(&path)
        .map_err(|e| format!("Failed to delete model: {}", e))?;

    Ok(())
}
```

### Step 2: Implement Download Command

Complete the existing `download_model` stub:

```rust
#[tauri::command]
pub async fn download_model(
    name: String,
    window: tauri::Window,
) -> Result<String, String> {
    let info = ModelInfo::find(&name)
        .ok_or("Model not found")?;

    let models_dir = get_models_dir()?;
    let dest = models_dir.join(info.filename);

    // Stream download with progress events
    download_with_progress(info.url, &dest, |progress| {
        window.emit("download-progress", DownloadProgress {
            model: name.clone(),
            downloaded: progress.downloaded,
            total: progress.total,
            speed: progress.speed,
        }).ok();
    }).await?;

    // Verify SHA256
    verify_checksum(&dest, info.sha256)?;

    Ok(dest.to_string_lossy().to_string())
}
```

### Step 3: Create React Components

```
src-tauri/ui/src/components/models/
├── ModelLibrary.tsx      # Available models grid
├── ModelCard.tsx         # Individual model card
├── MyModels.tsx          # Downloaded models list
├── DownloadQueue.tsx     # Active downloads
├── ModelTabs.tsx         # Tab container
└── useModelDownload.ts   # Download hook with progress
```

### Step 4: Add Download Progress Hook

```typescript
// useModelDownload.ts
export function useModelDownload() {
  const [downloads, setDownloads] = useState<DownloadState[]>([]);

  useEffect(() => {
    const unlisten = listen<DownloadProgress>('download-progress', (event) => {
      setDownloads(prev => updateProgress(prev, event.payload));
    });
    return () => { unlisten.then(fn => fn()); };
  }, []);

  const startDownload = async (modelName: string) => {
    setDownloads(prev => [...prev, { name: modelName, status: 'pending' }]);
    await invoke('download_model', { name: modelName });
  };

  return { downloads, startDownload };
}
```

### Step 5: Wire Up Model Switching

```rust
#[tauri::command]
pub async fn switch_model(name: String) -> Result<(), String> {
    // Update config
    let mut config = load_config()?;
    config.model.path = get_model_path(&name)?;
    save_config(&config)?;

    // Restart daemon with new model
    daemon_restart().await?;

    Ok(())
}
```

---

## File Checklist

**Rust (src-tauri/):**
- [ ] `src/commands.rs` - Add model commands:
  - [ ] `list_available_models` - Get all registry models
  - [ ] `list_downloaded_models` - Scan local models
  - [ ] `download_model` - Complete stub with progress events
  - [ ] `delete_model` - Remove model from disk (prevent if active)
  - [ ] `switch_model` - Update config + restart daemon
- [ ] `src/main.rs` - Register new commands

**Frontend (src-tauri/ui/src/):**
- [ ] `components/models/ModelLibrary.tsx`
- [ ] `components/models/ModelCard.tsx`
- [ ] `components/models/MyModels.tsx`
- [ ] `components/models/DownloadQueue.tsx`
- [ ] `components/models/ModelTabs.tsx`
- [ ] `hooks/useModelDownload.ts`
- [ ] `pages/Settings.tsx` - Add Models section

---

## UI Inspiration

| App | Pattern | Takeaway |
|-----|---------|----------|
| LM Studio | Model discovery + chat | Card grid with metadata |
| OllaMan | Local/Online tabs | Clear separation of states |
| Ollama CLI | `ollama pull` | Simple one-command download |

---

## Notes

- Download location: `~/.local/share/dev-voice/models/`
- SHA256 verification required before using model
- Consider background downloads (don't block UI)
- Daemon restart needed after model switch
