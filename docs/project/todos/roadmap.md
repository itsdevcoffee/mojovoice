# mojovoice Project Roadmap

**Status:** Active Development | **Last Updated:** 2026-10-03

Project roadmap and feature planning.

---

## Version Roadmap

### Known Bugs (next patch)

- **Duplicated text at chunk boundaries** (High) — audio over 30s is split into 30s chunks with 5s overlap (`candle_engine.rs` `CHUNK_OVERLAP_SECS`), but overlapping words aren't deduplicated when chunks are joined. Benchmark: `harvard-list57-male.wav` repeats "Footprints showed the path he took up the beach."
- **`mojovoice download` can't fetch the default model** (Medium) — the default config points at `whisper-large-v3-turbo-safetensors/`, but `download` only knows GGML models, and its error suggests a nonexistent model name.
- **Benchmark WER doesn't normalize text** (Low) — "one two three" vs "1, 2, 3" and "all right" vs "Alright" count as errors; apply Whisper's English text normalizer before scoring.
- **Rustfmt and Clippy CI jobs failing** (Low) — failing since v0.5.6.

### v0.6.0 - UI/UX Overhaul & Platform Maturity

**Theme:** Production-ready design and best-in-class user experience

**Priority Order:**

1. **UI/UX Overhaul** (Critical - Comprehensive redesign)

   **Settings Reorganization:**
   - Collapse advanced options (4 primary settings visible vs current 12)
   - Voice Recognition section (model + language dropdown)
   - Recording section (duration + audio device selection)
   - Behavior section (text options)
   - Appearance section (UI scale)
   - Advanced section (collapsed by default for power users)
   - Smart restart notifications (only show when daemon settings change)

   **Models Tab (New Navigation Item):**
   - Separate model management from Settings
   - Model library browser with download/cancel/delete
   - Visual download progress with real-time stats
   - Model cards with speed/quality indicators

   **Dev Coffee Brand Consistency:**
   - Apply bracket frames, subtle glows, technical grids across all components
   - Typography hierarchy using JetBrains Mono for headings
   - Purposeful emerald green accents (not decorative)
   - Near-black backgrounds with glass layers
   - Scanlines and retro-tech aesthetic refinements

   **Dashboard Improvements:**
   - Better visual hierarchy and information density
   - Enhanced status visualization
   - Recording feedback with waveform visualization
   - Clearer daemon/GPU/model status display

   **Model Setup Wizard (First-Run Experience):**
   - Hardware detection (GPU type, VRAM, disk space)
   - Model recommendation based on capabilities
   - Guided download with progress feedback
   - Test recording/transcription in wizard
   - Auto-configure environment

   **Reference Documents:**
   - `docs/project/2026-01-14-settings-ui-redesign.md`
   - `docs/context/dev-coffee-brand-style-guide.md`

2. **Linux Automated Testing** (Critical - Reliability)
   - CI testing on Ubuntu, Fedora, Arch
   - Validate CUDA installation across distros
   - Test audio capture on different audio servers (PipeWire, PulseAudio, ALSA)
   - Integration tests for Waybar/systemd
   - Distro-specific packaging validation

3. **Cross-Platform Dictation Indicator** (High - Consistency)
   - System tray icon with recording state (all platforms)
   - Visual feedback during recording (waveform/pulsing indicator)
   - Status overlay (OSD) support
   - Consistent behavior on Linux/macOS/Windows

4. **CUDA Multi-Distro Support** (High - Remove friction)
   - Automated CUDA detection and fallback
   - Distro-specific CUDA path handling
   - Better error messages for missing CUDA
   - Documentation for each major distro

5. **macOS Unsigned .dmg** (Medium - Good enough for v0.6.0)
   - Improve .dmg with better first-run experience
   - Handle permission prompts gracefully
   - Clear instructions for Accessibility/Microphone permissions

**Deferred to v0.6.1+:**
- macOS signed installer with code signing/notarization (requires $99/year Apple Developer account)

---

### v0.7.0 - Platform Expansion

**Theme:** AMD and Windows support

**Features:**
- **AMD ROCm Support** (Critical)
  - ROCm GPU acceleration for AMD graphics cards
  - Automated ROCm detection and fallback
  - Testing on popular AMD GPUs

- **Windows Support** (Critical)
  - Scoped 2026-10-03: see `docs/research/2026-10-03-windows-port-scoping.md` (~5–8 days; mel blocker removed in v0.5.8)
  - Full Windows 10/11 support
  - Audio capture validation
  - Text injection via Windows APIs
  - Installer with proper permissions

- **Polybar Integration** (High)
  - Status module for X11/i3/bspwm users
  - Mirrors Waybar integration pattern

---

### v0.8.0 - Intelligence & Performance

**Theme:** Smarter transcription and quality-of-life improvements

**Features:**
- **Context-Aware Vocabulary**
  - Detect active file type (.rs, .py, .ts, .md)
  - Auto-bias toward relevant technical terms
  - Project-specific vocabulary learning

- **Speculative Decoding**
  - Draft model integration for 30-50% speedup
  - Research correct Whisper API implementation

- **Mojo-Audio 0.1.2**
  - Performance improvements
  - Better audio preprocessing

- **Dynamic Prompt Biasing**
  - UI for adjusting biasing prompts
  - Preset vocabularies (Rust dev, Python dev, DevOps, etc.)
  - Learn from correction history

- **General QoL Improvements**
  - Voice commands ("undo last", "new line", "format code")
  - Better error recovery
  - Performance optimizations

---

## Completed Features (v0.5.x)

- ✅ **Desktop App CI Builds** - Automated Tauri builds for Linux/macOS
- ✅ **Documentation Overhaul** - Complete README rewrite
- ✅ **Performance Benchmarking** - `mojovoice benchmark` command
- ✅ **Community Infrastructure** - LICENSE, CONTRIBUTING.md
- ✅ **Model Management UI** - Download, switch, delete with visual meters
- ✅ **Transcription History** - Searchable persistent history
- ✅ **Audio Device Selection** - UI-based device picker
- ✅ **Daemon Subcommands** - up, down, restart, status, logs
- ✅ **Pure-Rust Mel Spectrogram** - Matches OpenAI's reference; removes mojo-audio runtime dependency (v0.5.8)
- ✅ **Release Transcription Smoke Test** - CI transcribes a sample with whisper-tiny before shipping (v0.5.8)

---

## Future Features Under Consideration

Features requiring further research, evaluation, or design decisions before commitment.

### Speaker Diarization Integration
**Status:** Under Review
**Research Date:** 2026-01-23

**Overview:**
Microsoft's VibeVoice-ASR offers unified ASR + speaker diarization + timestamps, but has significant integration barriers:

**VibeVoice-ASR Analysis:**
- ✅ Unified pipeline (ASR + diarization + timestamps in one pass)
- ✅ Long-form support (up to 60 minutes continuous)
- ✅ Hotword support for domain-specific vocabulary
- ❌ 9B parameters (vs Whisper Large-v3 Turbo ~1.5B) - significantly higher resource requirements
- ❌ Python-only implementation (no Rust bindings)
- ❌ Incompatible architecture (Qwen2.5-based vs Whisper encoder-decoder)
- ❌ Uses 7.5 Hz speech tokenizers (incompatible with mojo-audio mel spectrogram pipeline)
- ❌ Limited language support (English/Chinese only vs Whisper's 99 languages)

**Alternative Approaches:**
- pyannote-audio (Rust-friendly via ONNX export)
- WhisperX (adds diarization to Whisper, similar integration pattern)
- Keep Whisper for ASR, add separate lightweight diarization module

**Decision Needed:**
- Is speaker diarization a core use case for dev-voice?
- What performance/resource trade-offs are acceptable?
- Should this wait for better Rust-native solutions?

**Reference:** https://huggingface.co/microsoft/VibeVoice-ASR

---

### Text-to-Speech Integration (Qwen3 TTS)
**Status:** Under Review
**Research Date:** 2026-01-23

**Overview:**
Qwen's newly released Qwen3-TTS models offer text-to-speech capabilities that could enable voice feedback and accessibility features in mojovoice.

**Qwen3-TTS Model Family:**
- ✅ Multiple model sizes (0.6B, 1.7B parameters)
- ✅ Custom voice support (CustomVoice variants)
- ✅ Voice design capabilities (VoiceDesign variants)
- ✅ 12Hz sampling rate
- ✅ Natural-sounding speech synthesis
- ⚠️ Very new release (hours old - maturity unknown)
- ⚠️ Python-first implementation (Rust integration TBD)
- ⚠️ Resource requirements unclear for real-time use

**Potential Use Cases:**
- Audio feedback (read back transcriptions for verification)
- Accessibility features (voice confirmation of commands)
- Testing infrastructure (generate synthetic audio for STT pipeline testing)
- Future voice assistant features (bidirectional voice interaction)

**Decision Needed:**
- Is TTS a core feature for dev-voice or scope creep?
- What's the priority vs existing STT improvements?
- Should we wait for more mature Rust bindings?
- Which variant/size is optimal for developer workflow use?

**Reference:** https://huggingface.co/collections/Qwen/qwen3-tts

---

## Ideas & Future Exploration

### Advanced Features (Post v0.8.0)
- Custom wake word for hands-free mode
- Multi-language support testing (Spanish, French, German, etc.)
- Noise cancellation preprocessing (DeepFilterNet)
- IDE plugins (VSCode, Neovim, JetBrains)
- Mobile companion app (trigger from phone)

### Community Infrastructure (Ongoing)
- [x] LICENSE file (MIT) ✅
- [x] CONTRIBUTING.md ✅
- [ ] CODE_OF_CONDUCT.md
- [ ] Issue templates (bug report, feature request)
- [ ] PR template with checklist
- [ ] Discord/Matrix community channel

🤖 Generated with [Claude Code](https://claude.com/claude-code)
