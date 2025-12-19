# Model Revamp & Optimization Roadmap

**Status:** Planning | **Priority:** High | **Goal:** Transition `dev-voice` to a "Bleeding Edge" STT experience.

This document serves as the source of truth for the model migration from standard Whisper models to optimized Turbo and Distilled variants, alongside performance optimizations like Speculative Decoding.

## Phase 1: Registry Expansion & Quality Defaults (COMPLETED)
The goal was to move from 2023-era Whisper weights to 2024-2025 optimized weights.

- [x] **Step 1.1: Map GGUF/Quantized Paths**
- [x] **Step 1.2: Update `src/model/registry.rs`**
    - Added `large-v3-turbo` (New recommended High-End).
    - Added `distil-large-v3` (New recommended Mid-Range).
- [x] **Step 1.3: Update CLI/Installer Logic**
    - Updated `dev-voice download` default to `large-v3-turbo`.
    - Improved help text to reflect new model options.

## Phase 2: Inference Optimization (Speculative Decoding)
Use a draft model to speed up the main transcription.

- [ ] **Step 2.1: Implement Draft Model Support**
    - Modify `Transcriber` struct to optionally hold a "draft" model (usually `tiny.en`).
- [ ] **Step 2.2: Update Transcription Logic**
    - Configure `whisper_full_params` to use speculative decoding features.
- [ ] **Step 2.3: Performance Benchmarking**
    - Compare transcription time with and without draft models on local hardware.

## Phase 3: Developer experience (Technical Vocabulary)
Ensure technical terms are transcribed correctly for "Vibe Coding."

- [ ] **Step 3.1: Technical Grammar/Token Bias**
    - Compile a list of common coding keywords (`async`, `struct`, `generic`, etc.).
    - Pass these as an initial prompt or use `token_bias` in the whisper-rs layer.
- [ ] **Step 3.2: Context-Awareness**
    - (Future) Explore reading the current file's extension to bias toward specific language keywords (Rust, TS, Python).

## Phase 4: UI & Feedback Sync
Improve the perception of speed.

- [ ] **Step 4.1: Sub-Second Waybar Transitions**
    - Fine-tune the SIGRTMIN signal timing.
- [ ] **Step 4.2: Processing Indicators**
    - Use the Waybar module to show "Transcribing..." differently than "Recording..." (already partially implemented with file markers).

## Success Metrics
1. **Cold Start Time:** < 500ms for model loading (DAEMON).
2. **Post-Speech Latency:** < 500ms for transcription to appear at cursor.
3. **Accuracy:** Human-level for technical coding discussions.

---

## Technical Notes & Reference URIs
- **Turbo Weights:** `huggingface.co/ggerganov/whisper.cpp`
- **Distil Weights:** `huggingface.co/distil-whisper/distil-large-v3`
- **Inference Library:** `whisper-rs` (current)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
