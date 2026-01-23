# mojovoice Project Roadmap

**Status:** Active Development | **Last Updated:** 2026-01-23

Project roadmap and feature planning.

## Agreed Upon Future Features

### Polybar Integration
**Priority:** High
**Effort:** Small (2-4 hours)

- [ ] Create integrations/polybar/ directory structure
- [ ] Write polybar-compatible status script (IPC or tail -f approach)
- [ ] Create module.ini config snippet
- [ ] Write install.sh for Polybar users
- [ ] Create README.md with Polybar-specific instructions
- [ ] Test on i3/bspwm environment
- [ ] Update integrations/README.md with Polybar entry

**Rationale:** Expands reach to X11/i3 users (large community). Natural extension of existing Waybar integration pattern.

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

## Need to Review

Items from previous roadmap (2025-12-20) that require status review and re-prioritization.

### 1. Fix Speculative Decoding API
**Previous Status:** Blocked - API Research Needed
**Previous Priority:** Critical
**Effort:** Medium (4-8 hours)

- [ ] Research correct whisper-rs API for draft model integration
- [ ] Replace commented `set_encoder_begin_callback` with working implementation
- [ ] Test performance improvements (target: 30-50% speedup)
- [ ] Document actual vs theoretical performance gains
- [ ] Update model-revamp-tasklist.md with final benchmarks

**Previous Rationale:** Core performance feature that unlocks the full speed potential.

### 2. Documentation Overhaul
**Previous Status:** Not Started
**Previous Priority:** Critical
**Effort:** Large (8-12 hours)

- [ ] Update main README.md with new features (Turbo models, technical vocab)
- [ ] Create QUICKSTART.md for new users
- [ ] Document integrations/ pattern for contributors
- [ ] Add screenshots/GIFs of Waybar integration in action
- [ ] Create ARCHITECTURE.md explaining daemon/client model
- [ ] Document GPU vs CPU fallback behavior

**Previous Rationale:** Essential for onboarding new users and contributors.

### 3. Performance Benchmarking
**Previous Status:** Not Started
**Previous Priority:** Medium
**Effort:** Medium (4-6 hours)

- [ ] Create benchmarking test suite (cargo bench)
- [ ] Compare old models (medium.en) vs new (large-v3-turbo)
- [ ] Measure with/without draft models
- [ ] Test across different audio lengths (5s, 30s, 60s)
- [ ] Document results in docs/research/benchmarks.md
- [ ] Add performance regression tests to CI

**Previous Rationale:** Validate the "bleeding edge" claims with data.

### 4. Better First-Run Experience
**Previous Status:** Not Started
**Previous Priority:** Medium
**Effort:** Medium (6-8 hours)

- [ ] Auto-download large-v3-turbo + tiny.en on first run
- [ ] Interactive setup wizard (mojovoice setup)
- [ ] Auto-detect desktop environment (Waybar/Polybar/none)
- [ ] Offer integration installation during setup
- [ ] Show welcome message with keybind instructions
- [ ] Create getting-started tutorial

**Previous Rationale:** Reduce friction for new users.

### 5. CI/CD for New Models
**Previous Status:** Not Started
**Previous Priority:** Medium
**Effort:** Medium (4-6 hours)

- [ ] Update .github/workflows/ci.yml for new model registry
- [ ] Add model checksum verification to CI
- [ ] Build artifacts with new default models
- [ ] Automated release workflow (tags → GitHub Releases)
- [ ] Generate checksums for all binaries
- [ ] AUR package automation

**Previous Rationale:** Streamlines releases and builds trust.

### 6. Advanced Features
**Previous Status:** Ideas Stage
**Previous Priority:** Low
**Effort:** Large (12+ hours each)

- [ ] Project-aware vocabulary (detect .rs/.py/.ts, bias accordingly)
- [ ] Custom wake word for hands-free mode
- [ ] Multi-language support testing (Spanish, French, etc.)
- [ ] Noise cancellation preprocessing
- [ ] Voice commands (e.g., "undo last", "clear line")
- [ ] Integration with IDE plugins (VSCode, Neovim)

**Previous Rationale:** Differentiate from other voice tools.

### 7. Community Infrastructure
**Previous Status:** Partially Done
**Previous Priority:** Medium (for open source)
**Effort:** Small (2-3 hours)

- [x] LICENSE file (MIT)
- [ ] CODE_OF_CONDUCT.md
- [ ] CONTRIBUTING.md with development setup
- [ ] Issue templates (bug report, feature request)
- [ ] PR template with checklist
- [ ] Discord/Matrix community channel

**Previous Rationale:** Prepare for community contributions.

### 8. Cross-Platform Testing
**Previous Status:** Not Started
**Previous Priority:** Low
**Effort:** Large (platform-dependent)

- [ ] Test macOS Metal backend with new models
- [ ] Verify Windows compatibility (if supporting)
- [ ] Test on various Linux distros (Arch, Ubuntu, Fedora)
- [ ] Validate all GPU backends (CUDA, ROCm, Vulkan)
- [ ] Document platform-specific quirks

**Previous Rationale:** Ensure reliability across environments.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
