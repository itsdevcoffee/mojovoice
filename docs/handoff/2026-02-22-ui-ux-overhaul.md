# UI/UX Overhaul Handoff — 2026-02-22

## Context

This document is a handoff for a separate Claude Code session to plan and execute the MojoVoice Tauri desktop app UI/UX overhaul. A full analysis of the current state was performed by two parallel agents (feature-dev:code-explorer + Explore) on 2026-02-22. All findings are synthesized here.

**Your job:** Read this document, explore the codebase as needed, use `maximus-plan` to create a task plan, and execute it.

**Coordination:** This session is being managed separately from the main dev-voice session. When done, update `.maximus/progress.md` with a summary and flag any decisions that need the main session's input.

---

## Project Overview

- **mojovoice** — Voice dictation CLI for Linux developers, with a Tauri desktop app in `ui/`
- **Tech stack:** React 18 + TypeScript + Vite + Tailwind CSS v3.4 + Zustand + Tauri 2.0
- **Style system:** Neubrutalist design — thick borders, brutal shadows, sharp corners, JetBrains Mono for code, Inter for UI. See `docs/context/mojovoice-style-guide.md` if it exists.
- **Dev server:** `cd ui && npm run dev` — runs at http://localhost:1420 with full mock data (no Rust backend needed)
- **Build:** `cd ui && npm run build` then `cd ui && npm run tauri build`

## Key Files to Read First

| File | Why |
|------|-----|
| `ui/src/lib/ipc.ts` | The mock/real IPC switch — every command the UI makes |
| `ui/src-tauri/src/main.rs` | All 23 registered Tauri commands |
| `ui/src-tauri/src/commands.rs` | Full Rust implementations of every command |
| `ui/src/stores/appStore.ts` | Central Zustand state |
| `ui/src/components/MissionControl.tsx` | Root component and page layout |
| `ui/src/components/SettingsPanel.tsx` | Largest component — config read/write |
| `ui/src/hooks/useModelDownload.ts` | Ready-to-use download hook (never mounted) |
| `src/vocab/store.rs` | The vocab SQLite system (needs Tauri exposure) |

---

## Current State Assessment

### What Actually Works
- Daemon start/stop/restart controls
- Model switching between already-downloaded models
- Settings (language, timeout, audio device, append_space, refresh command, save clips)
- History modal (real data, search, delete, clear, export to JSON)
- Command palette (model switch, history actions)
- Copy/delete on transcription cards with undo toast
- 5-second test recording button (if daemon is running)
- UI scale system

### Architecture
Single-page app, no router. Overlays (drawer, modal, command palette) sit on top of a single `MissionControl` page. State lives entirely in one Zustand store.

```
App.tsx
  └── MissionControl.tsx
        ├── StatusMicroIndicators  (SYS/GPU pips)
        ├── RecordingHero          (test mic button)
        ├── StatusBar              (daemon status, model dropdown)
        ├── TranscriptionCard[]    (recent 5 entries)
        ├── SystemStatus           (collapsible hardware readout + daemon controls)
        ├── [Lazy] Drawer > SettingsPanel
        ├── [Lazy] HistoryModal
        └── [Lazy] CommandPalette
```

---

## Critical Bugs (Fix First)

### Bug 1: Technical Vocabulary silently broken
**File:** `ui/src/components/SettingsPanel.tsx`
**Problem:** SettingsPanel saves `model.prompt_biasing` but the real Rust `AppConfig` field is `model.prompt`. Serde discards the unknown field on `save_config` — whatever a user types in the vocabulary textarea is silently never saved.
**Fix:** Rename all references from `prompt_biasing` to `prompt` in the SettingsPanel's local Config interface and form state. This is a trivial field rename.

### Bug 2: RAM display always shows 0
**File:** `ui/src/components/ui/SystemStatus.tsx` line 98
**Code:** `const ramUsedGb = 0; // TODO: wire to real usage when available`
**Problem:** The RAM bar always shows 0/X GB. The `get_system_info` command returns `total_ram_gb` but not current usage. The daemon process memory could be tracked via `get_daemon_status` or a new field.
**Fix options:** Either (a) add a `ram_used_gb` field to the `get_system_info` Rust response using the `sysinfo` crate (already a dependency in commands.rs), or (b) hide the RAM usage bar until real data is available.

### Bug 3: Space key hint misleads users
**File:** `ui/src/components/ui/RecordingHero.tsx` (or MissionControl footer)
**Problem:** Footer says "Press hotkey to start recording" but there is no global Space/hotkey listener anywhere.
**Fix:** Either add a global Space key listener that triggers recording, or remove the hint text.

---

## Major Missing Features

### Feature 1: Model Manager (highest priority)

**Backend status:** Fully ready.
- `list_available_models` — 23 models in embedded registry (safetensors + GGUF variants)
- `download_model` — streams from HuggingFace with real-time `download-progress` Tauri events
- `cancel_download` — atomic cancellation flag
- `delete_model` — path-validated directory removal
- `get_storage_info` — returns `{ available_gb, total_gb, models_size_gb }`

**Frontend hook:** `ui/src/hooks/useModelDownload.ts` — fully built, listens to `download-progress` events, tracks per-model state, exposes `startDownload`, `cancelDownload`, `isDownloading`, `getProgress`. **Never mounted by any component.**

**Store:** `activeView: 'dashboard' | 'settings' | 'history' | 'devtools' | 'models'` is declared in `appStore.ts` but nothing ever reads or renders based on it.

**Gap:** No Models screen/panel/component exists. Users cannot discover, download, or delete models from the UI.

**What to build:**
- A Models panel/view that shows available models with download buttons and progress bars
- Use `useModelDownload` hook — don't rewrite it
- Show storage info (available space, models dir size)
- Add delete button for downloaded models
- Wire `activeView: 'models'` to actually render this panel
- Add "Models" nav trigger (button in StatusBar or SystemStatus or CommandPalette)

**Mock data to update in ipc.ts:**
```javascript
// list_available_models currently returns 2 fake models
// Should return realistic model list matching the Rust registry shape
```

---

### Feature 2: Vocabulary Management UI (high priority)

**Backend status:** Fully implemented in main CLI.
- SQLite at `~/.local/share/mojovoice/vocab.db`
- `VocabStore::add_term(term, source)`, `remove_term(term)` → `Result<bool>`, `list_terms()`, `get_prompt_string(224)`
- CLI: `mojovoice vocab add/list/remove/correct`
- Vocab is loaded at transcription time and injected as `initial_prompt` into Whisper
- The old `model.prompt` config field is deprecated (logs a warn) in favor of the SQLite system

**Tauri layer gap:** ZERO vocab Tauri commands exist. None are registered in `ui/src-tauri/src/main.rs`.

**What to build:**

1. **Add Tauri commands** in `ui/src-tauri/src/commands.rs`:
   ```rust
   #[tauri::command]
   pub fn vocab_list() -> Result<Vec<VocabEntry>, String>

   #[tauri::command]
   pub fn vocab_add(term: String, source: String) -> Result<(), String>

   #[tauri::command]
   pub fn vocab_remove(term: String) -> Result<bool, String>

   #[tauri::command]
   pub fn vocab_correct(wrong: String, right: String) -> Result<(), String>
   ```
   These should call into `mojovoice::vocab::VocabStore` — the library is already linked via `Cargo.toml` in `ui/src-tauri/`.

2. **Register commands** in `ui/src-tauri/src/main.rs` invoke handler.

3. **Add mock data** in `ui/src/lib/ipc.ts` for browser dev mode:
   ```javascript
   case 'vocab_list': return [
     { id: 1, term: 'Claude', use_count: 5, source: 'manual', added_at: Date.now() },
     { id: 2, term: 'Maximus Loop', use_count: 3, source: 'manual', added_at: Date.now() },
   ];
   case 'vocab_add': return { success: true };
   case 'vocab_remove': return true; // bool: was it found?
   case 'vocab_correct': return { success: true };
   ```

4. **Replace the SettingsPanel textarea** with a proper vocab management UI:
   - List of terms with use_count and source badge
   - Inline add field (term input + Add button)
   - Delete button per term (with undo toast using existing Toast system)
   - "Record correction" flow: wrong → right input pair

---

### Feature 3: Cancel Recording

**Backend:** `cancel_recording` Tauri command is registered but never called.
**UI:** Add a Cancel button during active recording state. `RecordingHero.tsx` has `isRecording` state — show a cancel button when recording is in progress.

---

## Minor Items / Cleanup

| Item | File | Action |
|------|------|--------|
| `framer-motion` + `recharts` unused | `package.json` | Remove both deps — wasted bundle weight |
| `LoadingScanner` component | `ui/src/components/ui/LoadingScanner.tsx` | Use it (loading model state?) or delete it |
| `transcriptions` store array | `appStore.ts` | `addTranscription()` is never called — dead code, remove or wire up |
| History filters client-side only | `HistoryModal.tsx` | Server-side date/word filter would require Rust changes to `load_entries` — defer |
| `validate_path` unused | `ipc.ts` + `commands.rs` | Call it from SettingsPanel path inputs for real-time validation |
| Confidence/latency in TranscriptionCard | `TranscriptionCard.tsx` | These fields are mock-only. Either remove them from the card UI or add them to the Rust `TranscriptionEntry` struct |

---

## IPC Commands Reference

### 23 Registered Commands (from main.rs)

| Command | Used in UI | Notes |
|---------|-----------|-------|
| `get_daemon_status` | ✅ Yes | 5s polling |
| `get_config` | ✅ Yes | |
| `save_config` | ✅ Yes | |
| `get_system_info` | ✅ Yes | |
| `list_downloaded_models` | ✅ Yes | |
| `list_available_models` | ❌ No | Needs Models screen |
| `switch_model` | ✅ Yes | |
| `download_model` | ⚠️ Hook only | Hook built, not mounted |
| `cancel_download` | ⚠️ Hook only | Hook built, not mounted |
| `delete_model` | ❌ No | Needs Models screen |
| `get_storage_info` | ❌ No | Needs Models screen |
| `start_recording` | ✅ Yes | |
| `stop_recording` | ✅ Yes | |
| `cancel_recording` | ❌ No | Needs cancel button |
| `get_transcription_history` | ✅ Yes | |
| `delete_history_entry` | ✅ Yes | |
| `clear_history` | ✅ Yes | |
| `list_audio_devices` | ✅ Yes | |
| `validate_path` | ❌ No | Useful for path inputs |
| `start_daemon` | ✅ Yes | |
| `stop_daemon` | ✅ Yes | |
| `restart_daemon` | ✅ Yes | |
| `vocab_list` | ❌ Missing | Needs to be created |
| `vocab_add` | ❌ Missing | Needs to be created |
| `vocab_remove` | ❌ Missing | Needs to be created |
| `vocab_correct` | ❌ Missing | Needs to be created |

---

## Suggested Phase Plan for Maximus

### Phase 1 — Bug Fixes (3 tasks, simple/medium)
1. Fix `prompt_biasing` → `prompt` field rename in SettingsPanel
2. Fix RAM display — add `ram_used_gb` to `get_system_info` Rust response and wire to UI
3. Fix Space key hint — add global listener or remove misleading text

### Phase 2 — Vocab Tauri Layer (2 tasks, medium)
4. Add `vocab_list`, `vocab_add`, `vocab_remove`, `vocab_correct` Tauri commands in `ui/src-tauri/src/commands.rs` + register in `main.rs` + add mocks to `ipc.ts`
5. Replace SettingsPanel vocabulary textarea with full vocab management UI (list + add + delete + correct)

### Phase 3 — Model Manager (3 tasks, medium/complex)
6. Add Models panel component with `list_available_models` + `useModelDownload` hook integration + storage info
7. Add download progress UI and cancel button per model
8. Add delete model button for downloaded models

### Phase 4 — Polish (2 tasks, simple)
9. Add cancel recording button in RecordingHero
10. Remove unused deps (framer-motion, recharts), dead code cleanup (LoadingScanner, transcriptions array)

**Estimated total: 10 tasks | ~$30 | ~60 min**

---

## Important Notes for New Session

1. **Browser dev mode works** — `cd ui && npm run dev` gives you a fully functional UI with mock data. Use Playwright MCP for visual verification. Save screenshots to `docs/tmp/`.

2. **The Tauri commands layer** (`ui/src-tauri/`) is a separate Cargo crate that depends on the main `mojovoice` library. When adding vocab commands, import from `mojovoice::vocab::VocabStore` — the dep is already there.

3. **Style guide** — neubrutalist. Match existing component patterns. Look at `Button.tsx`, `Card.tsx`, `SystemStatus.tsx` for reference.

4. **Don't touch** `.maximus/plan.json` task status fields — the engine manages those. Add new tasks with new IDs starting from 7.

5. **Screenshot protocol** — always save Playwright screenshots to `docs/tmp/<component>-<state>.png`. This directory is gitignored.

6. **Confidence/latency fields** in `TranscriptionCard` — these come from mock data only. The Rust backend never provides them. You can either remove them from the card (simplest) or add them to the Rust `TranscriptionEntry` struct (more work, probably worth it). Flag this for the main session if unsure.
