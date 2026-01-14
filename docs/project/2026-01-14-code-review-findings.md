# Code Review Findings

**Date:** 2026-01-14
**Status:** In Progress
**Reviewer:** code-reviewer agent (Opus)

---

## Critical

- [ ] **Mutex panic in audio callback** `src/audio/mod.rs:59`
  - `.unwrap()` on mutex lock in CPAL callback crashes if mutex poisoned
  - Fix: Use `.lock().ok()` with fallback or log dropped samples

- [ ] **Memory leak in FFI loading** `src/transcribe/mojo_ffi.rs:119`
  - Library loaded twice: `Box::leak()` then redundant `Library::new()`
  - Fix: Remove `_lib` field or don't leak the original handle

---

## High

- [x] **Unverified Send/Sync impl** `src/transcribe/mojo_ffi.rs:102-108`
  - Manual `unsafe impl Send/Sync` assumes mojo-audio is thread-safe
  - Resolution: Library author verified thread-safety; improved safety comment documenting guarantees

- [ ] **WAV parsing panic** `src/main.rs:621-625`
  - `.unwrap()` on sample iteration panics on malformed WAV files
  - Fix: Use `.filter_map(|s| s.ok())` or `collect::<Result<_>>()?`

- [ ] **Unchecked parent path** `src/main.rs:487`
  - `.unwrap()` on `.parent()` can panic on root paths
  - Fix: Use `.ok_or_else()` with proper error

---

## Medium

- [ ] **Race condition in stop/cancel** `src/daemon/server.rs:241-250, 291-301`
  - Global `STOP_RECORDING` AtomicBool can race with multiple requests
  - Fix: Use per-recording cancellation token (`Arc<AtomicBool>`)

- [ ] **Response type mismatch** `src/daemon/client.rs:61-62`
  - `daemon_stop_recording` expects `Ok` but server returns `Success`
  - Fix: Update `expect_ok_response` to accept `Success` variant

- [ ] **Deprecated signal API** `src/state/toggle.rs:159-166`
  - Uses `signal::signal()` instead of `sigaction()`
  - Fix: Use `sigaction()` or signal-handling crate

- [ ] **Download progress overflow** `src/model/download.rs:62`
  - Large files (>4GB) may have precision issues in progress calc
  - Fix: Use saturating operations

---

## Low

- [ ] **Unused error types** `src/error.rs`
  - Custom `DevVoiceError` types are `#[allow(dead_code)]`
  - Fix: Either use them or remove the module

- [ ] **Trivial unit tests** `src/transcribe/candle_engine.rs:608-621`
  - Tests don't test actual behavior (e.g., `assert_eq!(empty.len(), 0)`)
  - Fix: Add meaningful tests or remove placeholders

---

## Notes

- Overall architecture is well-organized
- Good use of `tracing` for logging
- Daemon protocol is well-defined and tested
- FFI layer needs thread-safety verification
