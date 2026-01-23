# Changelog

All notable changes to mojovoice will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.5.4] - 2026-01-23

### Fixed
- **Icon format:** Convert icons to RGBA format for Tauri bundling

## [0.5.3] - 2026-01-23

### Fixed
- **Tauri CI builds:** Add icon paths for AppImage bundling
- **macOS CI runners:** Update from retired macos-13 to macos-15
- **Release asset paths:** Fix version format in bundle filenames

## [0.5.2] - 2026-01-23

### Added
- **Desktop App CI builds:** Automated AppImage, .deb (Linux) and .dmg (macOS) builds in release workflow
- **Desktop App download links:** README now has direct download links for all platforms

### Fixed
- **Audio device validation:** Daemon validates configured device exists at startup
- **Stale device cleanup:** Auto-clears device_name from config if device no longer available
- **PipeWire default source:** Better handling of PipeWire's actual default audio source

### Documentation
- **LICENSE file:** Added MIT license file
- **CONTRIBUTING.md:** Added contribution guidelines
- **README overhaul:** Complete rewrite with accurate v0.5.x information

## [0.5.1] - 2026-01-23

### Added
- **Model card visual meters:** Replaced text labels (Slower/Fast/Best Quality) with 5-dot visual indicators for Speed and Quality
- **Language badges:** Color-coded pills for Multilingual (teal) vs English-only (amber) models
- **Ghost download button:** Transparent button style that fills with color on hover
- **Download progress transformation:** Download button morphs into progress bar with real-time stats (size, speed, ETA)
- **Model Manager UI polish:** Enhanced spacing, discoverability, and visual hierarchy across model cards

### Fixed
- **Active badge overflow:** Prevented badge from overflowing in installed model cards
- **Audio device enumeration:** Improved Linux audio device detection with better PipeWire support
- **JSX syntax error:** Fixed spacer div and comment syntax in Model Manager
- **CUDA CI build:** Made CUDA build non-blocking and fixed verification step
- **CI linting:** Resolved rustfmt and clippy failures

## [0.5.0] - 2026-01-22

### Added
- **Daemon subcommands:** New CLI structure with `daemon up`, `down`, `restart`, `status`, `logs`, `pid`
- **Daemon control UI:** Start/Stop/Restart buttons in Dashboard for managing daemon from UI
- **Real daemon status:** UI dashboard now shows actual GPU (CUDA/Metal/CPU) and model info from daemon
- **Expanded model registry:** 31 Whisper model variants including distil-whisper-v2 and distil-medium.en
- **Waybar offline state:** Status indicator now shows distinct state when daemon isn't running
- **Mojo-audio FFI:** Replaced Candle's buggy mel spectrogram with mojo-audio library for accurate frame counts
- **Dynamic mel bins:** Automatic detection of 80 vs 128 mel bins based on model architecture
- **Audio test samples:** Organized test samples with manifest and Harvard sentences
- **justfile:** Build automation with commands for build, install, daemon management
- **Transcription history:** Persistent JSONL storage with search, filter, copy, and delete functionality
- **Audio device selection:** Choose input device from Settings UI (requires daemon restart)
- **Export Diagnostics:** DevTools button to save system/daemon info as JSON file
- **Real system diagnostics:** DevTools shows CPU cores, RAM, GPU name and VRAM from actual hardware
- **Benchmark CLI:** `mojovoice benchmark` command with HTML report generation
- **Model management UI:** Download, cancel, and delete models from Settings
- **GGUF quantized models:** 7 new quantized model variants for lower memory usage
- **English-only models:** Support for .en Whisper variants (tiny.en, base.en, etc.)
- **Config commands:** `--check` and `--migrate` now validate all current config fields

### Changed
- **Settings UI redesign:** Cleaner layout with recording timeout now configurable from UI
- **Recording timeout:** Now uses config value (default 180s) instead of hardcoded 5-minute limit
- **Model registry:** Switched from GGUF to safetensors format for Candle engine compatibility
- **Config validation:** Uses ℹ (info) vs ⚠ (warning) to distinguish optional vs migratable fields

### Fixed
- **Daemon shutdown:** Fixed blocking listener that prevented graceful shutdown
- **Stale state files:** Daemon now cleans up processing/recording files on startup
- **Stale processing indicator:** Waybar no longer shows "processing" after daemon restart
- **Mojo-audio RFFT:** Fixed audio library to produce correct ~3000 frames for 30s audio
- **Daemon restart:** Now properly waits for daemon to stop before restarting (was using fixed 500ms sleep)
- **Daemon start:** Now checks if daemon is already running before attempting to start
- **Settings async loading:** Prevented UI freeze when loading config on Settings tab
- **Model registry sizes:** Now shows accurate download sizes matching actual files
- **Config migrate:** No longer creates backup when no changes needed
- **Export Diagnostics permissions:** Added missing Tauri fs write permissions

### Refactored
- Simplified main.rs CLI entry point
- Removed dead whisper module and privatized mojo_ffi
- Simplified audio capture, output, daemon client, and transcription modules
- Cleaned up legacy binary name checks (mojovoice-gpu/mojovoice-cuda)
- Simplified audio device selection code
- Simplified diagnostics code in DevTools
- Simplified config check/migrate command code

## [0.4.1] - 2025-01-01

### Added
- **Premium Settings Panel:** Redesigned settings with smart daemon restart
- **UI scaling:** Small/medium/large presets for different display densities
- **Cancel recording:** New cancel command to discard recording without transcribing
- **GitHub Release workflow:** Automated release builds

### Fixed
- CUDA_COMPUTE_CAP detection in CI builds
- Added libssl-dev to CUDA build dependencies

## [0.4.0] - 2024-12-31

### Added
- **Tauri UI:** Native desktop application with glassmorphic design
- **Dev Tools:** Built-in developer panel for debugging
- **Dashboard:** Real-time status display for daemon, GPU, and model

## [0.3.0] - 2024-12-30

### Changed
- **BREAKING:** Renamed project from dev-voice to mojovoice
- Polished README for production readiness

## [0.2.0] - 2025-12-16 (Phase 4)

### Added
- **Cross-platform support:** macOS, Windows, and X11 in addition to Wayland
- **Clipboard mode flag:** `mojovoice start -c` to copy text to clipboard instead of typing
- **Native HTTP downloads:** Replaced `curl` subprocess with `ureq` library for model downloads
- **Checksum verification:** SHA256 verification for downloaded Whisper models
- **Better resampling:** Migrated from linear interpolation to `rubato` library
- **enigo-test command:** Quick validation tool for testing text injection without full voice recording
- **Cross-platform audio:** Migrated from PipeWire to CPAL for Linux/macOS/Windows support

### Changed
- **BREAKING:** Type mode no longer preserves clipboard contents
  - Previous versions used paste shortcuts (Ctrl+V) which required saving/restoring clipboard
  - Current version types text directly at cursor using `enigo.text()` - more reliable but doesn't interact with clipboard
  - Migration: Use `mojovoice start -c` for clipboard-based workflow
- **BREAKING:** Migrated from Linux-only tools (wtype/xdotool) to cross-platform enigo library
- **BREAKING:** Audio capture migrated from PipeWire to CPAL (cross-platform)
- Simplified output module from 330+ lines to ~120 lines (-63% code reduction)
- Improved error messages with installation instructions for missing dependencies
- Better display server detection (XDG_SESSION_TYPE environment variable)

### Removed
- Terminal detection logic (~100 lines)
- Clipboard preservation in type mode (~200 lines)
- Paste keyboard shortcut simulation (Ctrl+V, Ctrl+Shift+V)
- PipeWire-specific audio capture code
- Direct dependencies on wtype/xdotool (now optional runtime dependencies for legacy support)

### Technical Details
- enigo v0.6.1 for cross-platform text injection
- arboard v3.6.1 for clipboard (macOS/Windows only)
- cpal v0.16.0 for cross-platform audio capture
- rubato v0.16.2 for high-quality audio resampling
- ureq v2.9 for HTTP downloads
- sha2 v0.10 for checksum verification

### Platform-Specific Notes
- **Linux Wayland:** Default configuration, uses `wl-clipboard` for clipboard mode
- **Linux X11:** Requires manual edit of `Cargo.toml` line 80, uses `xclip` for clipboard mode
- **macOS:** Uses native CoreGraphics for typing, native clipboard API
- **Windows:** Uses native SendInput API for typing, native clipboard API

## [0.1.0] - 2025-12-10 (Phase 3)

### Added
- Initial release with Linux Wayland support
- Voice recording with PipeWire audio capture
- Whisper model integration for speech recognition
- Daemon mode for fast response times
- Model download and management
- wtype/xdotool integration for text injection
- Configuration system
- Hyprland integration examples

### Features
- Record voice input with configurable duration
- Transcribe speech to text using Whisper models
- Automatic text injection at cursor position
- Clipboard preservation during paste operations
- Support for GPU acceleration (CUDA, ROCm, Vulkan)
- Daemon mode for sub-second response times

---

## Version History

- **v0.5.0:** Daemon subcommands, transcription history, audio device selection, model management UI, benchmark CLI, export diagnostics
- **v0.4.1:** Premium Settings Panel, UI scaling, cancel recording
- **v0.4.0:** Tauri UI with glassmorphic design
- **v0.3.0:** Renamed to mojovoice
- **v0.2.0 (Phase 4):** Cross-platform support, simplified architecture
- **v0.1.0 (Phase 3):** Initial Linux Wayland release
