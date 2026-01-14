# Model Management UI - Handoff Document

**Date:** 2026-01-14
**Status:** Backend Complete, Frontend Pending
**Branch:** v0.5.0

---

## Summary

Implementing a model management UI for browsing, downloading, and managing Whisper models. The backend (Tauri/Rust) is complete. The frontend (React) needs to be built.

---

## What Was Completed

### Backend Commands (all in `ui/src-tauri/src/commands.rs`)

| Command | Purpose | Status |
|---------|---------|--------|
| `list_available_models` | Returns 29 models from embedded registry | ✓ |
| `list_downloaded_models` | Scans `~/.local/share/mojovoice/models/` | ✓ |
| `download_model` | Downloads with progress events + SHA256 verification | ✓ |
| `delete_model` | Removes model (prevents deleting active) | ✓ |
| `switch_model` | Updates config + restarts daemon | ✓ |

### Key Structs

```rust
// Model from registry (for Model Library tab)
pub struct RegistryModel {
    pub name: String,
    pub filename: String,
    pub size_mb: u32,
    pub family: String,      // "Large V3 Turbo", "Distil", "Base", etc.
    pub quantization: String, // "Full", "Q5_0", "Q5_1", "Q8_0"
    pub url: String,         // HuggingFace URL (skip_serializing)
    pub sha256: String,      // Checksum (skip_serializing)
}

// Downloaded model (for My Models tab)
pub struct DownloadedModel {
    pub name: String,
    pub filename: String,
    pub path: String,
    pub size_mb: u32,
    pub is_active: bool,
}

// Progress event payload
pub struct DownloadProgress {
    pub model_name: String,
    pub downloaded_bytes: u64,
    pub total_bytes: u64,
    pub speed_bps: u64,
    pub status: String, // "downloading", "verifying", "complete", "error"
}
```

### Commands Registered

Already registered in `ui/src-tauri/src/main.rs`:
- `list_available_models`
- `list_downloaded_models`
- `download_model`
- `delete_model`
- `switch_model`

---

## What Remains (Frontend)

### Reference Document

Full UI design spec: `docs/project/2026-01-14-model-management-ui.md`

### Components to Create

```
ui/src/components/models/
├── ModelTabs.tsx         # Tab container (Library | My Models | Downloads)
├── ModelLibrary.tsx      # Browse available models with filters
├── ModelCard.tsx         # Individual model card with download button
├── MyModels.tsx          # List downloaded models with Use/Delete buttons
└── DownloadQueue.tsx     # Active downloads with progress bars
```

### Hook to Create

```typescript
// ui/src/hooks/useModelDownload.ts
import { listen } from '@tauri-apps/api/event';
import { invoke } from '../lib/ipc';

export function useModelDownload() {
  const [downloads, setDownloads] = useState<Map<string, DownloadProgress>>(new Map());

  useEffect(() => {
    const unlisten = listen<DownloadProgress>('download-progress', (event) => {
      setDownloads(prev => {
        const next = new Map(prev);
        next.set(event.payload.modelName, event.payload);
        return next;
      });
    });
    return () => { unlisten.then(fn => fn()); };
  }, []);

  const startDownload = async (modelName: string) => {
    await invoke('download_model', { modelName });
  };

  return { downloads, startDownload };
}
```

### Integration Point

Add Models section/tab to Settings page or create new Models page accessible from sidebar.

---

## Key Technical Details

### Models Directory
- Location: `~/.local/share/mojovoice/models/`
- Files: `ggml-*.bin` format

### Event Listening (Tauri v2)
```typescript
import { listen } from '@tauri-apps/api/event';

// Listen for download progress
const unlisten = await listen('download-progress', (event) => {
  console.log(event.payload);
});
```

### IPC Calls
```typescript
import { invoke } from '../lib/ipc'; // Project's wrapper

// List models
const available = await invoke('list_available_models');
const downloaded = await invoke('list_downloaded_models');

// Download (triggers progress events)
await invoke('download_model', { modelName: 'base.en' });

// Delete
await invoke('delete_model', { filename: 'ggml-base.en.bin' });

// Switch active model (restarts daemon)
await invoke('switch_model', { filename: 'ggml-base.en.bin' });
```

### Existing UI Patterns

Check these files for styling patterns:
- `ui/src/components/Dashboard.tsx` - Glass cards, status indicators
- `ui/src/components/Settings.tsx` - Form inputs, sections
- `ui/src/stores/appStore.ts` - Zustand state management

---

## Recent Commits

```
861b56d feat: implement model download with progress events
ec467eb feat: add model management backend commands
ffb8ef7 docs: update model management plan with delete_model command
2b3dfda feat: add 'just ui' command for Tauri dev mode
e42ebfb fix: handle "Text file busy" error during install
8cb399d feat: add daemon control UI and improve daemon lifecycle management
```

---

## Build & Run

```bash
# Run UI in dev mode
just ui

# Or manually
cd ui && npm run tauri:dev
```

---

## Notes

- The embedded registry in `commands.rs` has 29 models with URLs and SHA256 hashes
- `download_model` emits progress every 100ms
- Active model check prevents deletion of in-use model
- `switch_model` automatically restarts daemon after config update
