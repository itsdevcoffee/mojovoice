# mojovoice v0.6.9 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ship mojovoice v0.6.9 — a polished, general-user voice dictation desktop app for macOS (Apple Silicon + Intel Rosetta) and Linux (x86_64 CPU, x86_64 CUDA, aarch64 ARM).

**Architecture:** Three locked phases — Foundation (UI complete + core loop wired), Platform Polish (CUDA/ARM/macOS), Launch Readiness (all real data, wizard, docs, release). No phase bleeds into the next. See `docs/plans/2026-03-07-v069-launch-design.md` for the full design rationale.

**Tech Stack:** Rust (daemon + CLI), Tauri v2 (desktop shell), React + TypeScript + Tailwind CSS v4 (UI), Zustand (state), mojo-audio FFI (audio preprocessing), Candle (Whisper inference), SQLite (vocab store), JSONL (transcription history)

**ARM Test Target:** `visage@visage-spark` (NVIDIA DGX Spark, aarch64 Linux)

---

## Phase 1 — Foundation

---

### Task 1: Merge memrl → main, tag v0.5.6, create v0.6.9 branch

**Files:**
- Modify: `Cargo.toml` (version bump)
- Modify: `ui/src-tauri/Cargo.toml` (version bump)
- Modify: `ui/src-tauri/tauri.conf.json` (version bump)
- Modify: `CHANGELOG.md` (finalize [Unreleased] → [0.5.6])

**Step 1: Switch to memrl and verify clean build**

```bash
git checkout memrl
cargo build
```

Expected: build succeeds (no CUDA needed for this step)

**Step 2: Bump version to 0.5.6 in all three files**

In `Cargo.toml` root:
```toml
version = "0.5.6"
```

In `ui/src-tauri/Cargo.toml`:
```toml
version = "0.5.6"
```

In `ui/src-tauri/tauri.conf.json`:
```json
"version": "0.5.6"
```

**Step 3: Update CHANGELOG.md**

Change `## [Unreleased]` to `## [0.5.6] - 2026-03-07`
Add new empty `## [Unreleased]` section at top.

**Step 4: Commit the version bump**

```bash
git add Cargo.toml ui/src-tauri/Cargo.toml ui/src-tauri/tauri.conf.json CHANGELOG.md
git commit -m "chore: release v0.5.6"
```

**Step 5: Merge to main and tag**

```bash
git checkout main
git merge memrl --no-ff -m "chore: merge memrl into main (v0.5.6)"
git tag -a v0.5.6 -m "Release v0.5.6"
```

**Step 6: Create v0.6.9 branch**

```bash
git checkout -b v0.6.9
```

**Step 7: Push everything**

```bash
git push origin main
git push origin v0.5.6
git push origin v0.6.9
git push origin --tags
```

Expected: all pushes succeed, GitHub shows v0.5.6 tag

---

### Task 2: UI/UX Audit

**Files:**
- Read: all files in `ui/src/components/`
- Read: `docs/context/mojovoice-style-guide.md`
- Create: `docs/plans/2026-03-07-uiux-audit-results.md`

**Step 1: Run the ui-ux-pro-max audit subagent**

Dispatch a ui-ux-pro-max subagent with this prompt:

> Audit the mojovoice desktop app UI for v0.6.9 launch readiness. The app is a local voice dictation tool (speak → text at cursor). Read all files in `ui/src/components/` and `ui/src/stores/appStore.ts`. Check against `docs/context/mojovoice-style-guide.md`.
>
> Audit for:
> 1. Missing features: The old UI had a robust model manager/downloader with download progress bars, cancel, delete, disk usage, speed/quality indicators. Check `ui/src/components/ModelsPanel.tsx` against this spec — document what's missing.
> 2. Design-system compliance: Every component should use the Electric Night palette (deep navy + electric blue + acid green), JetBrains Mono for headings/code, Inter for UI text, neubrutalist thick borders + brutal shadows.
> 3. Empty/stubbed screens: Any tab or panel showing placeholder content.
> 4. First-run wizard: Does it exist? What's missing for a complete new-user onboarding flow (hardware detection → model recommendation → download → test transcription)?
> 5. Accessibility: aria labels, keyboard navigation, screen reader support.
>
> Output a prioritized punch list saved to `docs/plans/2026-03-07-uiux-audit-results.md`. Format: | Priority | Component | Gap | Effort (S/M/L) |

**Step 2: Review audit results**

Read `docs/plans/2026-03-07-uiux-audit-results.md` and confirm the punch list covers known gaps before proceeding.

**Step 3: Commit audit results**

```bash
git add docs/plans/2026-03-07-uiux-audit-results.md
git commit -m "docs: add UI/UX audit results for v0.6.9"
```

---

### Task 3: Restore Model Manager

The old UI had a full-featured model manager. `ModelsPanel.tsx` exists but is missing the download UX. This task restores it.

**Files:**
- Modify: `ui/src/components/ModelsPanel.tsx`
- Modify: `ui/src/hooks/useModelDownload.ts`
- Read first: `ui/src/lib/ipc.ts` (check `download_model` mock shape)

**Step 1: Check current ModelsPanel state**

Read `ui/src/components/ModelsPanel.tsx` and `ui/src/hooks/useModelDownload.ts` in full. Note what's missing vs the spec below.

**Step 2: Implement download progress hook if incomplete**

`useModelDownload.ts` should manage:
```typescript
interface DownloadState {
  modelId: string;
  progress: number;       // 0-100
  speedMbps: number;
  etaSecs: number;
  downloaded_mb: number;
  total_mb: number;
  status: 'idle' | 'downloading' | 'cancelled' | 'error' | 'done';
}
```

The hook should:
- Call `invoke('download_model', { modelId })` to start
- Listen to Tauri events `download_progress` for updates
- Call `invoke('cancel_download', { modelId })` on cancel
- Expose `startDownload`, `cancelDownload`, `downloadState`

**Step 3: Model card must render these states**

Each model card in `ModelsPanel.tsx` must show:
- **Not downloaded:** Download button (ghost style) → fills on hover
- **Downloading:** Button morphs into progress bar with `{MB}/{total} MB • {speed} MB/s • ETA {eta}s`
- **Downloaded + Active:** "Active" badge (emerald green), Delete button
- **Downloaded + Inactive:** "Switch" button, Delete button
- Speed indicator: 5-dot visual (●●●○○ = medium speed)
- Quality indicator: 5-dot visual
- Language badge: "Multilingual" (teal) or "EN Only" (amber)
- Disk usage total at top of panel

**Step 4: Verify in browser dev mode**

```bash
cd ui && npm run dev
```

Open http://localhost:1420, navigate to Models tab. Verify all card states render correctly using mock data.

**Step 5: Commit**

```bash
git add ui/src/components/ModelsPanel.tsx ui/src/hooks/useModelDownload.ts
git commit -m "feat: restore full model manager UI with download progress"
```

---

### Task 4: First-Run Wizard Skeleton

A new user opening mojovoice for the first time gets an onboarding wizard. This task builds the UI skeleton (real data wired in Phase 3).

**Files:**
- Create: `ui/src/components/wizard/SetupWizard.tsx`
- Create: `ui/src/components/wizard/WizardStep.tsx`
- Create: `ui/src/components/wizard/steps/HardwareStep.tsx`
- Create: `ui/src/components/wizard/steps/ModelStep.tsx`
- Create: `ui/src/components/wizard/steps/DownloadStep.tsx`
- Create: `ui/src/components/wizard/steps/TestStep.tsx`
- Modify: `ui/src/App.tsx` (show wizard on first run)
- Modify: `ui/src/stores/appStore.ts` (add `wizardComplete` state)

**Step 1: Add wizard state to appStore**

```typescript
// In AppState interface:
wizardComplete: boolean;
setWizardComplete: (v: boolean) => void;

// In initial state:
wizardComplete: false, // TODO: read from localStorage in Phase 3

// In actions:
setWizardComplete: (v) => {
  set({ wizardComplete: v });
  localStorage.setItem('mojovoice_wizard_complete', 'true');
},
```

**Step 2: Create WizardStep base component**

`ui/src/components/wizard/WizardStep.tsx`:
```tsx
interface WizardStepProps {
  stepNumber: number;
  totalSteps: number;
  title: string;
  children: React.ReactNode;
  onNext?: () => void;
  onBack?: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
}
```

Style: full-screen overlay, Electric Night background, step indicator dots at top, title in JetBrains Mono, emerald Next button.

**Step 3: Create step components with mock data**

- `HardwareStep.tsx` — shows mock GPU info: "NVIDIA RTX 4090 • 24 GB VRAM • CUDA Available ✓". In Phase 3 this calls real `get_system_info`.
- `ModelStep.tsx` — shows 2-3 model recommendations based on mock hardware. Highlight recommended with emerald border. User selects one.
- `DownloadStep.tsx` — shows download progress bar for selected model. Mock: auto-advances after 2s.
- `TestStep.tsx` — "Say something!" with RecordingHero component. Mock: shows a fake transcription after 1s.

**Step 4: Wire SetupWizard into App.tsx**

```tsx
// In App.tsx, before rendering main app:
const { wizardComplete } = useAppStore();

if (!wizardComplete) {
  return <SetupWizard onComplete={() => useAppStore.getState().setWizardComplete(true)} />;
}
```

**Step 5: Test wizard flow in browser**

Clear localStorage (`mojovoice_wizard_complete`), reload, verify all 4 steps render and advance.

**Step 6: Commit**

```bash
git add ui/src/components/wizard/
git add ui/src/stores/appStore.ts ui/src/App.tsx
git commit -m "feat: add first-run setup wizard skeleton (mock data)"
```

---

### Task 5: Audit and Complete Tauri Command Implementations

The Tauri commands are registered in `main.rs` but some implementations in `commands.rs` may be incomplete. This task validates each one.

**Files:**
- Read: `ui/src-tauri/src/commands.rs` (full file)
- Read: `ui/src-tauri/src/daemon_client.rs` (full file)

**Step 1: Read commands.rs in full**

For each registered command, check: does it actually call the daemon or return stub data? Document any that return hardcoded/empty responses.

**Step 2: Commands that must be real for Phase 1**

Priority list — these MUST work end-to-end before Phase 1 exits:

| Command | What it must do |
|---------|----------------|
| `get_daemon_status` | Connect to daemon socket, return real running/gpu/model state |
| `start_recording` | Send start cmd to daemon, return ok |
| `stop_recording` | Send stop cmd to daemon, trigger transcription |
| `cancel_recording` | Send cancel sentinel, discard audio |
| `get_transcription_history` | Read real JSONL file, support search/filter/pagination |
| `get_config` | Load real config via `mojovoice::config::load()` |
| `save_config` | Save config, return which fields require daemon restart |
| `start_daemon` / `stop_daemon` / `restart_daemon` | Shell out to `mojovoice daemon up/down/restart` |
| `list_available_models` | Return model registry from `mojovoice::model` |
| `list_downloaded_models` | Check which models exist on disk |
| `download_model` | Stream download with Tauri event progress emissions |
| `delete_model` | Remove model file from disk |
| `vocab_list/add/remove/correct` | CRUD against SQLite vocab store |

**Step 3: Fix any incomplete implementations**

For each stubbed command found, implement it. Follow the pattern in `daemon_client.rs` for daemon socket communication. Use `app.emit("download_progress", payload)` for streaming events.

**Step 4: Manual integration test**

With the daemon running (`mojovoice daemon up`), build and run the desktop app:

```bash
cd ui && npm run tauri dev
```

Open each tab and verify no mock data appears (all data comes from daemon/disk).

**Step 5: Commit**

```bash
git add ui/src-tauri/src/commands.rs ui/src-tauri/src/daemon_client.rs
git commit -m "fix: complete all Tauri command implementations with real backend"
```

---

### Task 6: Wire Dashboard — Real Daemon Status

**Files:**
- Modify: `ui/src/components/MissionControl.tsx`
- Modify: `ui/src/components/ui/StatusMicroIndicators.tsx`
- Modify: `ui/src/components/ui/SystemStatus.tsx`
- Modify: `ui/src/stores/appStore.ts`

**Step 1: Add polling to appStore**

Add a `startPolling` / `stopPolling` action that calls `refreshDaemonStatus` every 2 seconds:

```typescript
pollingInterval: null as ReturnType<typeof setInterval> | null,

startPolling: () => {
  const existing = get().pollingInterval;
  if (existing) return;
  const id = setInterval(() => get().refreshDaemonStatus(), 2000);
  set({ pollingInterval: id });
},

stopPolling: () => {
  const id = get().pollingInterval;
  if (id) clearInterval(id);
  set({ pollingInterval: null });
},
```

**Step 2: Start polling on app mount**

In `App.tsx` (or `MissionControl.tsx`) `useEffect`:
```typescript
useEffect(() => {
  store.startPolling();
  return () => store.stopPolling();
}, []);
```

**Step 3: StatusMicroIndicators shows real data**

The SYS pip shows daemon running/stopped. The GPU pip shows CUDA/Metal/CPU. Both pull from `daemonStatus` in the store, no hardcoded values.

**Step 4: RecordingHero connects to real recording state**

The RecordingHero button calls `invoke('start_recording')` on click, `invoke('stop_recording')` on second click. `isRecording` state in store reflects reality.

**Step 5: Test with daemon running and stopped**

Run `mojovoice daemon up`, open app — verify SYS pip goes green. Run `mojovoice daemon down` — verify pip goes red within 2s polling cycle.

**Step 6: Commit**

```bash
git add ui/src/components/ ui/src/stores/appStore.ts ui/src/App.tsx
git commit -m "feat: wire dashboard to real daemon status with polling"
```

---

### Task 7: Wire Settings — Real Config Read/Write

**Files:**
- Modify: `ui/src/components/SettingsPanel.tsx`
- Modify: `ui/src/components/settings/SettingsConfigTab.tsx`
- Modify: `ui/src/components/settings/VocabTab.tsx`

**Step 1: Load real config on Settings tab mount**

`SettingsConfigTab.tsx` must call `invoke('get_config')` on mount and populate form fields with real values. No hardcoded defaults beyond initial load.

**Step 2: Save config with smart restart notification**

On save, call `invoke('save_config', { config })`. The response must indicate which fields changed that require daemon restart. Show a banner: "Settings saved. Daemon restart required for: model, audio device." with a Restart button that calls `invoke('restart_daemon')`.

**Step 3: Wire audio device selector**

The device selector calls `invoke('list_audio_devices')` on mount. Selected device saves to config. On daemon restart, new device takes effect.

**Step 4: Wire VocabTab to real SQLite store**

`VocabTab.tsx` must:
- Load terms via `invoke('vocab_list')`
- Add via `invoke('vocab_add', { term, context })`
- Remove via `invoke('vocab_remove', { term })`
- Correct via `invoke('vocab_correct', { original, correction })`

**Step 5: Test settings round-trip**

Change the model in Settings, save, restart daemon. Verify daemon loads the new model (check `mojovoice daemon status`).

**Step 6: Commit**

```bash
git add ui/src/components/settings/ ui/src/components/SettingsPanel.tsx
git commit -m "feat: wire settings panel to real config and vocab store"
```

---

### Task 8: Wire History Tab

**Files:**
- Modify: `ui/src/components/HistoryView.tsx`
- Read: `ui/src/stores/appStore.ts` (history actions already exist)

**Step 1: Verify HistoryView uses store actions**

`HistoryView.tsx` should call `loadHistory()` on mount, display `historyEntries` from store, support search via `setSearchQuery()`, model filter via `setModelFilter()`, delete via `deleteHistoryEntry()`.

**Step 2: Ensure TranscriptionCard shows real metadata**

Each card footer must show: `latencyMs` (from history entry), `confidenceScore`, `model`. These come from the JSONL history file — check that `get_transcription_history` command returns these fields.

**Step 3: Test with real history**

Make 2-3 real transcriptions, open History tab, verify entries appear with accurate metadata. Test search and delete.

**Step 4: Commit**

```bash
git add ui/src/components/HistoryView.tsx
git commit -m "feat: wire history tab to real transcription store"
```

---

### Task 9: Phase 1 Integration Test + Screenshot Session

**Step 1: Full smoke test**

Start daemon, open app. Run through every tab. Verify:
- [ ] Dashboard: daemon status green, GPU pip shows real GPU
- [ ] Record button: starts/stops recording, transcription appears in history
- [ ] Settings: loads real config, saves and triggers smart restart notification
- [ ] Vocab: add a term, verify it appears in list
- [ ] History: real entries with metadata, search works, delete works
- [ ] Models: shows downloaded models, switch works

**Step 2: First-run wizard test**

Clear wizard flag, reopen app, run through wizard to completion.

**Step 3: Take screenshots for marketing**

Save to `docs/tmp/` (gitignored). These are the "coming soon" assets.

**Step 4: Commit any fixes found during smoke test**

```bash
git commit -m "fix: Phase 1 smoke test fixes"
```

**Phase 1 complete. Marketing teaser can go out.**

---

## Phase 2 — Platform Polish

---

### Task 10: CUDA Runtime Detection Spike

**Goal:** Determine if we can ship one binary that auto-detects CUDA at runtime, or if we need two binaries.

**Files:**
- Read: `Cargo.toml` (check `candle-core` features)
- Create: `docs/research/2026-03-07-cuda-runtime-detection.md`

**Step 1: Research candle-core CUDA feature flags**

```bash
cargo metadata --format-version 1 | jq '.packages[] | select(.name == "candle-core") | .features'
```

Check if `candle-core` has a `cuda` feature that requires compile-time linking, or if there's a dynamic/runtime path.

**Step 2: Check if libcuda is dlopen-able**

Look at candle-core source for how CUDA is initialized. If it calls `cublas::*` directly (static), runtime detection is not possible with the current dep. If it uses `libloading`, runtime detection may be feasible.

```bash
# Check what CUDA symbols our binary requires at link time
readelf -d target/release/mojovoice | grep NEEDED | grep -i cuda
```

**Step 3: Document findings**

Save to `docs/research/2026-03-07-cuda-runtime-detection.md`:

- **If runtime detection feasible:** Document the approach and proceed to implement in Task 11 variant A.
- **If compile-time only:** Document the two-binary approach as accepted constraint. Guided wizard (Task 12) compensates.

**Step 4: Commit**

```bash
git add docs/research/2026-03-07-cuda-runtime-detection.md
git commit -m "research: document CUDA runtime detection feasibility findings"
```

---

### Task 11A: Single Binary with Runtime CUDA Detection (if spike says feasible)

**Files:**
- Modify: `src/transcribe/candle_engine.rs`
- Modify: `src/daemon/server.rs`

**Step 1: Write failing test for graceful CPU fallback**

In `src/transcribe/candle_engine.rs` `#[cfg(test)]`:
```rust
#[test]
fn test_cuda_fallback_to_cpu_when_unavailable() {
    // Simulate no CUDA: attempt CUDA device, expect CPU device returned
    let device = select_device(false); // force_cpu = true
    assert!(matches!(device, Device::Cpu));
}
```

Run: `cargo test test_cuda_fallback_to_cpu_when_unavailable`
Expected: FAIL (function signature may not exist yet)

**Step 2: Implement `select_device()` with runtime detection**

```rust
pub fn select_device(force_cpu: bool) -> candle_core::Device {
    if force_cpu {
        return candle_core::Device::Cpu;
    }
    // Try CUDA
    match candle_core::Device::new_cuda(0) {
        Ok(device) => {
            log::info!("CUDA device 0 available");
            device
        }
        Err(e) => {
            log::info!("CUDA not available ({}), falling back to CPU", e);
            candle_core::Device::Cpu
        }
    }
}
```

**Step 3: Run test — verify passes**

```bash
cargo test test_cuda_fallback_to_cpu_when_unavailable
```

**Step 4: Wire into daemon startup**

In `src/daemon/server.rs`, replace compile-time `#[cfg(feature = "cuda")]` device selection with `select_device(force_cpu)` call.

**Step 5: Remove dual-binary requirement from CI**

Update `.github/workflows/release.yml` to build one binary (no separate CUDA binary).

**Step 6: Verify CUDA auto-detected on local machine**

```bash
RUSTFLAGS="-L /usr/lib64 -L /usr/local/lib/ollama" cargo build --release
./target/release/mojovoice daemon up
# Check logs for "CUDA device 0 available"
```

**Step 7: Commit**

```bash
git add src/transcribe/candle_engine.rs src/daemon/server.rs .github/workflows/
git commit -m "feat: runtime CUDA detection with graceful CPU fallback"
```

---

### Task 11B: Two-Binary Strategy (if spike says compile-time only)

**Files:**
- Modify: `.github/workflows/release.yml`
- Create: `docs/context/cuda-install-guide.md`

**Step 1: Verify CI builds both CPU and CUDA binaries**

CPU binary: standard `cargo build --release`
CUDA binary: `RUSTFLAGS="-L /usr/lib64 -L /usr/local/lib/ollama" cargo build --release --features cuda`

Both named clearly in release assets:
- `mojovoice-linux-x64.tar.gz` (CPU)
- `mojovoice-linux-x64-cuda.tar.gz` (CUDA)

**Step 2: Desktop app ships with binary detection**

The AppImage/deb bundles the CPU binary by default. At first launch, `get_system_info` detects NVIDIA GPU. If found, show "CUDA version available" notice pointing to download page.

**Step 3: Document and commit**

```bash
git add .github/ docs/context/cuda-install-guide.md
git commit -m "feat: two-binary release strategy with CUDA/CPU variants"
```

---

### Task 12: Guided CUDA Installer Wizard

Whether we ship one or two binaries, this wizard guides Linux users to set up CUDA properly.

**Files:**
- Create: `ui/src/components/wizard/CudaSetupWizard.tsx`
- Modify: `ui/src-tauri/src/commands.rs` (add `detect_cuda_status`, `get_distro_info`)

**Step 1: Add Tauri commands for CUDA detection**

```rust
#[tauri::command]
pub fn detect_cuda_status() -> CudaStatus {
    CudaStatus {
        nvidia_gpu_found: check_nvidia_gpu(),
        driver_version: get_driver_version(),
        cuda_available: check_cuda_libs(),
        cuda_version: get_cuda_version(),
        recommended_install_cmd: None, // populated by get_distro_info
    }
}

#[tauri::command]
pub fn get_distro_info() -> DistroInfo {
    // Read /etc/os-release, detect package manager
    DistroInfo {
        name: detect_distro_name(),
        package_manager: detect_package_manager(), // apt | dnf | pacman
        cuda_install_commands: generate_cuda_commands(),
    }
}
```

**Step 2: Write test for distro detection**

```rust
#[test]
fn test_detect_package_manager_returns_known_variant() {
    let info = get_distro_info();
    // Should return apt, dnf, or pacman — not panic
    assert!(["apt", "dnf", "pacman", "unknown"].contains(&info.package_manager.as_str()));
}
```

Run: `cargo test test_detect_package_manager`

**Step 3: Build CudaSetupWizard UI**

States:
1. **Checking** — spinner: "Detecting your GPU..."
2. **No NVIDIA GPU** — "No NVIDIA GPU detected. CPU mode is ready to go." Exit wizard.
3. **NVIDIA found, CUDA missing** — show GPU model, then:
   - Step-by-step list with copy buttons for distro-specific commands
   - "I've installed CUDA" button → re-runs detection
4. **CUDA found** — "CUDA ready! Restarting daemon with GPU acceleration..." → calls `restart_daemon`

**Step 4: Trigger wizard from Settings**

In Settings > Advanced panel, add "GPU Setup" button that opens `CudaSetupWizard` in a drawer.
Also trigger automatically in first-run wizard `HardwareStep` if NVIDIA GPU found but CUDA missing.

**Step 5: Test on local machine**

Verify detection correctly identifies your GPU and CUDA setup.

**Step 6: Commit**

```bash
git add ui/src/components/wizard/CudaSetupWizard.tsx ui/src-tauri/src/commands.rs
git commit -m "feat: guided CUDA installer wizard with distro-specific commands"
```

---

### Task 13: macOS Apple Silicon Validation

**Files:**
- Read: `src/transcribe/mojo_ffi.rs` (check .dylib path logic)
- Read: `src/daemon/server.rs` (check Metal device selection)

**Step 1: Verify .dylib loading on macOS**

The `lib/libmojo_audio.so` path is Linux-only. macOS needs `lib/libmojo_audio.dylib`.

Check `mojo_ffi.rs` for platform-conditional loading:
```rust
#[cfg(target_os = "macos")]
const LIB_NAME: &str = "lib/libmojo_audio.dylib";
#[cfg(not(target_os = "macos"))]
const LIB_NAME: &str = "lib/libmojo_audio.so";
```

If missing, add it.

**Step 2: Verify Metal device selection**

In daemon startup, on macOS the device should use Metal, not CUDA:
```rust
#[cfg(target_os = "macos")]
let device = candle_core::Device::new_metal(0).unwrap_or(candle_core::Device::Cpu);
```

Confirm this is in place.

**Step 3: Build for macOS in CI**

Check `.github/workflows/release.yml` — macOS arm64 build must succeed. Verify no Linux-only deps sneak in.

**Step 4: Test on macOS arm64 (CI runner or local)**

```bash
# macOS only
cargo build --release
./target/release/mojovoice daemon up
# Check logs for "Metal device" or "CPU"
```

**Step 5: Unsigned DMG install test**

Build the DMG via Tauri, install on a clean macOS system (or VM), verify:
- GateKeeper bypass instructions clear (right-click → Open)
- Microphone permission prompt appears correctly
- Accessibility permission prompt appears for text injection

Document any friction in `docs/context/macos-install-notes.md`.

**Step 6: Commit any fixes**

```bash
git commit -m "fix: macOS arm64 dylib loading and Metal device selection"
```

---

### Task 14: ARM Linux Validation on DGX Spark

**Files:**
- Modify: `.github/workflows/release.yml` (add aarch64 Linux target)

**Step 1: Build for aarch64 on the DGX Spark**

SSH into the Spark:
```bash
ssh visage@visage-spark
```

Clone the repo and build:
```bash
git clone <repo-url> mojovoice && cd mojovoice
cargo build --release
```

Note: DGX Spark has NVIDIA GPU on ARM. Check if CUDA feature builds on aarch64:
```bash
RUSTFLAGS="-L /usr/lib64" cargo build --release --features cuda
```

**Step 2: Test the full dictation pipeline**

```bash
./target/release/mojovoice daemon up
./target/release/mojovoice start
# Speak something, verify text appears
./target/release/mojovoice stop
```

**Step 3: Run benchmarks**

```bash
./target/release/mojovoice benchmark
```

Save the output — these are the DGX Spark ARM numbers for marketing.

**Step 4: Verify mojo-audio FFI on ARM**

The `.so` file in `lib/` must be compiled for aarch64. Check:
```bash
file lib/libmojo_audio.so
```

If it's x86_64, rebuild mojo-audio on the Spark:
```bash
cd ../mojo-audio
pixi run mojo build src/ffi/audio_ffi.mojo -o libmojo_audio.so --emit shared-lib
cp libmojo_audio.so ../mojovoice/lib/libmojo_audio_aarch64.so
```

Then in `mojo_ffi.rs`, load the correct arch-specific library.

**Step 5: Add aarch64 to CI matrix**

In `.github/workflows/release.yml`:
```yaml
- os: ubuntu-latest
  target: aarch64-unknown-linux-gnu
  artifact: mojovoice-linux-aarch64
```

Use `cross` crate for cross-compilation if native ARM runner unavailable.

**Step 6: Document benchmark results**

Create `docs/research/2026-03-07-dgx-spark-benchmarks.md` with real numbers.

**Step 7: Commit**

```bash
git add .github/workflows/ docs/research/ lib/
git commit -m "feat: aarch64 ARM Linux support validated on DGX Spark"
```

---

### Task 15: mojo-audio v0.2.x Integration Audit

**Files:**
- Read: `src/transcribe/mojo_ffi.rs`
- Read: `../mojo-audio/` (check current API surface)

**Step 1: Check current mojo-audio API vs what we call**

On the DGX Spark or local:
```bash
cd ../mojo-audio
git log --oneline -10  # what's changed?
```

Compare what `mojo_ffi.rs` calls vs what's available in v0.2.x.

**Step 2: Update FFI bindings if API changed**

If HuBERT preprocessing or pitch algo is available and stable, update `mojo_ffi.rs` to call through to it before the mel spectrogram step.

**Step 3: Rebuild the .so**

```bash
cd ../mojo-audio
pixi run mojo build src/ffi/audio_ffi.mojo -o libmojo_audio.so --emit shared-lib
cp libmojo_audio.so ../mojovoice/lib/
```

**Step 4: Run transcription tests**

```bash
cargo test --features cuda  # or without cuda for CPU
```

Verify existing tests in `src/transcribe/candle_engine.rs` still pass.

**Step 5: Commit updated library**

```bash
git add lib/libmojo_audio.so src/transcribe/mojo_ffi.rs
git commit -m "feat: update mojo-audio to v0.2.x with HuBERT preprocessing"
```

---

### Task 16: CI Green on All Targets

**Files:**
- Modify: `.github/workflows/release.yml`

**Step 1: Verify CI matrix covers all targets**

```yaml
matrix:
  include:
    - os: ubuntu-latest
      target: x86_64-unknown-linux-gnu
      artifact_suffix: linux-x64
    - os: ubuntu-latest
      target: x86_64-unknown-linux-gnu
      features: cuda
      artifact_suffix: linux-x64-cuda
    - os: ubuntu-latest
      target: aarch64-unknown-linux-gnu
      artifact_suffix: linux-aarch64
    - os: macos-latest
      target: aarch64-apple-darwin
      artifact_suffix: macos-arm64
```

**Step 2: Push and verify GitHub Actions green**

```bash
git push origin v0.6.9
```

Watch the Actions tab. All matrix jobs must pass.

**Step 3: Commit any CI fixes**

```bash
git commit -m "ci: green on all v0.6.9 target platforms"
```

**Phase 2 complete. Platform story is solid.**

---

## Phase 3 — Launch Readiness

---

### Task 17: Complete First-Run Wizard with Real Data

Replace all mock data in the wizard skeleton from Task 4 with real backend calls.

**Files:**
- Modify: `ui/src/components/wizard/steps/HardwareStep.tsx`
- Modify: `ui/src/components/wizard/steps/ModelStep.tsx`
- Modify: `ui/src/components/wizard/steps/DownloadStep.tsx`
- Modify: `ui/src/components/wizard/steps/TestStep.tsx`
- Modify: `ui/src/stores/appStore.ts` (read wizard flag from real config)

**Step 1: HardwareStep — real `get_system_info`**

Call `invoke('get_system_info')` on mount. Display:
- GPU model + VRAM (or "CPU only")
- CUDA/Metal status
- Available disk space
- If NVIDIA GPU but no CUDA: show inline CudaSetupWizard prompt

**Step 2: ModelStep — real model recommendations**

Use actual `systemInfo` to recommend:
- `>=24 GB VRAM` → Large V3 Turbo (best quality)
- `>=8 GB VRAM` → Medium or Small V3
- CPU only → Tiny or Base (speed matters)

Fetch available models via `invoke('list_available_models')`.

**Step 3: DownloadStep — real download progress**

Wire to `useModelDownload` hook. Show real progress, speed, ETA. Wait for download to complete before enabling Next.

**Step 4: TestStep — real transcription**

Call `invoke('start_daemon')` if not running, then `invoke('start_recording')`. After user speaks and clicks stop, `invoke('stop_recording')` and display the transcription. If transcription comes back empty, show a help tip.

**Step 5: Persist wizard completion to config**

Instead of just localStorage, also write to mojovoice config:
```rust
#[tauri::command]
pub fn set_wizard_complete() -> Result<(), String> {
    let mut config = mojovoice::config::load()?;
    config.ui.wizard_complete = true;
    mojovoice::config::save(&config)?;
    Ok(())
}
```

**Step 6: Test full wizard flow end-to-end**

Fresh config (or reset `wizard_complete = false`), open app, run wizard start to finish. Verify real transcription works in TestStep.

**Step 7: Commit**

```bash
git commit -m "feat: first-run wizard wired to real hardware detection and transcription"
```

---

### Task 18: Model Manager Fully Wired

Complete the model manager wiring — all operations hitting real backend.

**Files:**
- Modify: `ui/src/components/ModelsPanel.tsx`
- Modify: `ui/src/hooks/useModelDownload.ts`

**Step 1: Wire model list to real registry**

`list_available_models` returns all models. `list_downloaded_models` returns what's on disk. Combine to show: downloaded (with active badge) + available to download.

**Step 2: Download with real events**

`download_model` emits `download_progress` Tauri events. `useModelDownload` subscribes via `listen('download_progress', ...)`. Progress bar updates in real-time.

**Step 3: Delete model**

`delete_model` removes the file. Refreshes model list after.

**Step 4: Switch model**

`switch_model` updates config + restarts daemon. Show "Switching model..." loading state.

**Step 5: Disk usage display**

`get_storage_info` returns total downloaded size. Show at top of panel: "3.2 GB used • 120 GB available"

**Step 6: End-to-end test**

Download a model, verify progress bar works. Switch to it, verify daemon loads it. Delete a model, verify it disappears from list.

**Step 7: Commit**

```bash
git commit -m "feat: model manager fully wired with real download, switch, delete"
```

---

### Task 19: Performance Pass and Benchmarks

**Step 1: Benchmark all platforms**

Run on each target:
```bash
./target/release/mojovoice benchmark
```

Capture: latency (ms), real-time factor, model load time.

Platforms:
- Local Linux x86_64 CUDA (your machine)
- DGX Spark aarch64 (`visage@visage-spark`)
- macOS arm64 (CI or local Mac)
- Linux x86_64 CPU (your machine without CUDA flag)

**Step 2: Identify bottlenecks**

If any target is significantly slower than expected, profile before calling it done. Common issues:
- CPU fallback where GPU expected → check device selection logs
- Slow model load → check if model is being re-parsed each time
- Audio preprocessing overhead → check mojo-audio timing

**Step 3: Document numbers**

Update `docs/research/2026-03-07-dgx-spark-benchmarks.md` with all platform numbers in one table:

| Platform | Model | Latency | RTF |
|----------|-------|---------|-----|
| Linux x86 CUDA (RTX 4090) | Large V3 Turbo | Xms | X.Xx |
| DGX Spark ARM (NVIDIA) | Large V3 Turbo | Xms | X.Xx |
| macOS M-series | Large V3 Turbo | Xms | X.Xx |
| Linux x86 CPU | Tiny | Xms | X.Xx |

**Step 4: Commit**

```bash
git add docs/research/
git commit -m "docs: add v0.6.9 performance benchmarks across all platforms"
```

---

### Task 20: Documentation

**Files:**
- Modify: `README.md`
- Create: `docs/context/cuda-setup-guide.md`
- Create: `docs/context/arm-dgx-spark-setup.md`
- Modify: `CHANGELOG.md` (finalize [Unreleased] → [0.6.9])

**Step 1: README rewrite for v0.6.9**

Update README to reflect:
- Platform support table (macOS arm64/x86, Linux x86 CPU/CUDA, Linux aarch64)
- Download links for all binaries
- First-run experience description (wizard, no terminal required for basic use)
- Privacy section (100% local, no data leaves device — this is the hook for whisprflow.ai refugees)
- DGX Spark / ARM callout in platform section

**Step 2: CUDA setup guide**

For users who want to follow the wizard steps manually. Distro-specific sections: Ubuntu/Debian, Fedora/RHEL, Arch.

**Step 3: ARM / DGX Spark setup guide**

How to build from source on aarch64 if needed. Benchmark numbers. Link to mojo-audio ARM story.

**Step 4: Finalize CHANGELOG**

Move all items from `## [Unreleased]` to `## [0.6.9] - YYYY-MM-DD`.

**Step 5: Commit**

```bash
git add README.md docs/context/ CHANGELOG.md
git commit -m "docs: v0.6.9 documentation complete"
```

---

### Task 21: Marketing Assets

**Step 1: Screenshots**

With the app running on real data, take screenshots of each major screen. Save to `docs/tmp/screenshots/`:
- Dashboard (recording in progress)
- History tab (real transcriptions)
- Model Manager (with a download in progress)
- Settings (config tab + vocab tab)
- First-run wizard (each step)
- CUDA setup wizard

**Step 2: Demo recording**

Record a short demo: open app → wizard → first transcription → text appears at cursor. Export as GIF or short video.

**Step 3: Benchmark card**

Create a comparison card showing mojovoice vs cloud services (latency, privacy, cost). Use the benchmark numbers from Task 19.

**Step 4: Announcement copy**

Draft the "v0.6.9 dropping soon" teaser. Key points:
- 100% local, zero subscription, zero data leaving your machine
- macOS + Linux + ARM (DGX Spark)
- Privacy-first alternative to whisprflow.ai et al.
- Powered by mojo-audio (link to mojo-audio)

---

### Task 22: Release

**Files:**
- Modify: `Cargo.toml`, `ui/src-tauri/Cargo.toml`, `ui/src-tauri/tauri.conf.json` (version → 0.6.9)
- Modify: `CHANGELOG.md` (date)

**Step 1: Final version bump**

Set version to `0.6.9` in all three files.

**Step 2: Final cargo check**

```bash
cargo check
```

Ensures `Cargo.lock` is updated.

**Step 3: Commit and tag**

```bash
git add Cargo.toml ui/src-tauri/Cargo.toml ui/src-tauri/tauri.conf.json CHANGELOG.md Cargo.lock
git commit -m "chore: release v0.6.9"
git tag -a v0.6.9 -m "Release v0.6.9 — macOS + Linux + ARM, privacy-first dictation"
git push origin v0.6.9
git push origin --tags
```

**Step 4: Build and upload CUDA binary manually**

```bash
RUSTFLAGS="-L /usr/lib64 -L /usr/local/lib/ollama" cargo build --release --features cuda
cp target/release/mojovoice /tmp/mojovoice
cd /tmp && tar -czvf mojovoice-linux-x64-cuda.tar.gz mojovoice
gh release upload v0.6.9 /tmp/mojovoice-linux-x64-cuda.tar.gz --clobber
```

**Step 5: Verify release assets**

```bash
gh release view v0.6.9 --json assets --jq '.assets[].name'
```

Expected:
- `mojovoice-linux-x64.tar.gz`
- `mojovoice-linux-x64-cuda.tar.gz`
- `mojovoice-linux-aarch64.tar.gz`
- `mojovoice-macos-arm64.tar.gz`
- `MojoVoice-linux-x64.AppImage`
- `MojoVoice-linux-x64.deb`
- `MojoVoice-macos-arm64.dmg`

**Step 6: Ship it.**

Post the announcement. Drop the benchmark card. Tag mojo-audio in the announcement.

---

## Quick Reference

| Phase | Tasks | Exit Signal |
|-------|-------|-------------|
| 1 — Foundation | 1–9 | Working app, real data, "coming soon" screenshots ready |
| 2 — Platform Polish | 10–16 | CI green all targets, CUDA resolved, ARM benchmarked |
| 3 — Launch Readiness | 17–22 | Full wizard, all wired, v0.6.9 tag pushed |

**Build commands:**
```bash
# Standard build
cargo build

# CUDA build (required for GPU)
RUSTFLAGS="-L /usr/lib64 -L /usr/local/lib/ollama" cargo build --release --features cuda

# Verify CUDA in binary
readelf -d target/release/mojovoice | grep NEEDED | grep cuda

# UI dev server
cd ui && npm run dev

# Desktop app dev
cd ui && npm run tauri dev
```

**ARM test target:** `visage@visage-spark`
