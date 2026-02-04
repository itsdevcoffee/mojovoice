# mojovoice Project Roadmap

**Status:** Active Development | **Last Updated:** 2026-02-04

Project roadmap and feature planning.

---

## Version Roadmap

### v0.6.0 - Platform Maturity & Polish

**Theme:** Production-ready platform support with best-in-class onboarding

**Priority Order:**

1. **Model Setup Wizard** (Critical - Biggest UX improvement)
   - Detect hardware (GPU type, VRAM, available disk space)
   - Recommend optimal model based on capabilities
   - Guide through first download with progress feedback
   - Test recording/transcription in wizard
   - Auto-configure based on detected environment

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

6. **UI/UX Polish** (Medium - Incremental improvements)
   - Recording feedback improvements (waveform visualization?)
   - Dashboard layout refinements
   - Settings organization improvements
   - Better error states and messaging

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
