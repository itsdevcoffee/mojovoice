# mojovoice v0.6.9 — Launch Design

**Status:** Approved
**Date:** 2026-03-07
**Target:** v0.6.9 stable release (macOS + Linux, CPU + CUDA + ARM)

---

## Context

Mac users are leaving whisprflow.ai and similar paid services over privacy concerns and rising AI costs. mojo-audio's recent advances (HuBERT, pitch algo, RVC v2/v3, ARM support) have put mojovoice on the radar as the privacy-first local alternative. The NVIDIA DGX Spark ARM story is a significant differentiator — ARM users currently lack solid AI audio tooling.

This is a "do it right" launch with a marketing lead-up. No rushed corners.

---

## Guiding Principles

- Every phase ships **working software** — no mock-gated features carried forward
- UI/UX audit happens **before** wiring so we're not polishing something that needs rework
- Desktop app (Tauri) is the **primary product** for v0.6.9; CLI/daemon remain for power users
- CUDA is **detected at runtime** if candle supports it; otherwise guided wizard covers the gap
- mojo-audio is the **exclusive audio backbone** — all preprocessing routes through it, ARM included
- Marketing can start **after Phase 1** with real screenshots and a working app

---

## Target Audience

**General users** — developers and technical users fleeing SaaS voice tools. Comfortable installing apps, not necessarily comfortable with terminal setup. Expect: download → works. Primary platforms:

- macOS Apple Silicon (M-series) — primary whisprflow.ai replacement story
- macOS Intel via Rosetta 2
- Linux x86_64 CPU
- Linux x86_64 NVIDIA CUDA
- Linux aarch64 ARM (DGX Spark + other ARM Linux)

---

## Product Scope: A/B (Dictation + Audio Quality)

mojovoice v0.6.9 is a **local voice dictation tool**: speak → text appears at cursor. mojo-audio improvements (HuBERT, pitch, ARM) enhance transcription quality and performance under the hood. Voice cloning / RVC as a user-facing feature is deferred to future versions based on market signal.

---

## Three Phases

### Phase 1 — Foundation

**Goal:** Merge accumulated work, audit and complete UI, wire core dictation loop end-to-end.

**Exit criteria:** A real, working dictation app. Polished enough for "coming soon" screenshots and teaser announcements.

**1.1 Merge & Stabilize**
- Merge `memrl` → `main`, cut `v0.5.6` tag
- Create `v0.6.9` branch as dev target
- CI passes on Linux + macOS before proceeding

**1.2 UI/UX Audit (ui-ux-pro-max subagent)**
Dedicated audit across all current UI components to surface:
- Missing features vs old UI (model manager/downloader explicitly missing)
- Design-system compliance drift
- Stubbed or empty tabs/screens
- First-run experience gaps

Output: prioritized punch list with effort estimates

**1.3 Fill UI Gaps**
Execute against audit punch list. Known gaps:
- **Model Manager tab** — restore robust download/cancel/delete/progress UX
- **First-run wizard skeleton** — hardware detection, model recommendation, download + test screens (mock data this phase, wired Phase 3)
- All other gaps from audit

**1.4 Wire Core Dictation Loop**
Tauri IPC → real daemon, no mocks:
- Dashboard: real daemon/GPU/model status
- Record → transcribe → text at cursor working end-to-end in app
- Listen command wired to UI controls
- History tab: real JSONL data
- Settings: persist and trigger daemon restart when needed

---

### Phase 2 — Platform Polish

**Goal:** Cross-platform story airtight. CUDA resolved, ARM validated on real hardware, mojo-audio fully integrated, CI green everywhere.

**Exit criteria:** App installs and works on every target. CUDA story resolved. ARM benchmarked.

**2.1 CUDA Runtime Detection Spike (time-boxed)**
Determine if candle-core supports `dlopen()`-style runtime CUDA loading:
- **Yes:** Ship one binary with auto-detect + graceful CPU fallback
- **No:** Ship two binaries (CPU + CUDA); guided wizard compensates

**2.2 Guided CUDA Installer Wizard**
Built regardless of spike outcome. In-app flow:
- GPU detection (`nvidia-smi` / `lspci` / `/proc`)
- Distro detection (apt/dnf/pacman) → exact install commands generated
- Step-by-step UI with one-click copy buttons
- "Check again" → re-runs detection, restarts daemon with CUDA if found
- Handles: already installed wrong path, driver/toolkit mismatch

**2.3 macOS Apple Silicon First-Class**
- Metal acceleration validated
- `.dylib` mojo-audio loading confirmed on arm64
- Unsigned DMG documented with clear install instructions
- Tested on real M-series hardware (CI runner)

**2.4 ARM Linux Validation — DGX Spark**
- SSH access: `visage@visage-spark`
- Build + test on aarch64 Linux
- Full dictation pipeline validated (mojo-audio → whisper → text injection)
- Performance benchmarks captured for marketing

**2.5 mojo-audio v0.2.x Full Integration**
- HuBERT preprocessing pipeline wired
- Pitch algo integrated if stable
- All audio preprocessing through mojo-audio (no Candle mel fallback)
- Benchmarks: latency + real-time factor on all platforms

**2.6 CI Targets**
- Linux x86_64 CPU
- Linux x86_64 CUDA
- Linux aarch64
- macOS arm64
- macOS x86_64 (Rosetta, no dedicated build needed)

---

### Phase 3 — Launch Readiness

**Goal:** Everything real data, everything polished, everything documented. Cut the tag.

**Exit criteria = launch.**

**3.1 All Features on Real Data**
- Every tab, every component wired — zero mocks
- Vocab tab → SQLite store → Whisper initial prompt
- Transcription card metadata: real latency, confidence, model name
- Settings propagate correctly with smart daemon restart

**3.2 First-Run Wizard Complete**
Full new-user flow:
- Hardware detection (GPU model, VRAM, disk space)
- Model recommendation with rationale
- Download with real progress, speed, ETA
- Test recording + transcription inside wizard
- Exit → working app, daemon running

**3.3 Model Manager Fully Wired**
- All models browseable
- Download / cancel / delete with real progress
- Active model badge, speed/quality indicators, disk usage

**3.4 Performance Pass**
Benchmark all targets, publish numbers:
- macOS arm64
- Linux x86 CPU
- Linux x86 CUDA
- Linux aarch64 (DGX Spark — the headline ARM number)

**3.5 Documentation**
- README rewrite for v0.6.9
- CUDA guided installer reference doc
- ARM / DGX Spark setup guide
- CHANGELOG finalized

**3.6 Marketing Assets**
- Screenshots of every major screen (real data)
- Demo video: open app → wizard → first transcription
- DGX Spark ARM benchmark numbers
- "v0.6.9 dropping soon" teaser content

**3.7 Release**
- Version bumped: `Cargo.toml`, `ui/src-tauri/Cargo.toml`, `tauri.conf.json`, `CHANGELOG.md`
- CI green all targets
- GitHub Release: all binary assets (CPU, CUDA, arm64, macOS dmg, AppImage, .deb)
- `v0.6.9` tag pushed

---

## Future Scope (Not v0.6.9)

- Voice cloning / RVC user-facing features — defer, evaluate based on market signal
- Historical dictation .wav clips for voice training — personal project idea, later consideration
- AMD ROCm support — v0.7.x
- Windows support — v0.7.x
- TTS integration — under consideration
- Speaker diarization — under consideration

---

## Infrastructure

- **DGX Spark:** `visage@visage-spark` — ARM aarch64 validation target
- **CUDA Build:** `RUSTFLAGS="-L /usr/lib64 -L /usr/local/lib/ollama" cargo build --release --features cuda`
- **mojo-audio rebuild:** `cd ../mojo-audio && pixi run mojo build src/ffi/audio_ffi.mojo -o libmojo_audio.so --emit shared-lib`
