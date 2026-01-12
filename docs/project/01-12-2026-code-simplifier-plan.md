# Code Simplifier Plan

**Status:** In Progress
**Created:** 2026-01-12
**Context:** Post mojo-audio FFI integration cleanup

## Goal

Incrementally simplify and clean up the codebase after the mojo-audio FFI integration. Focus on removing dead code, consolidating patterns, and improving maintainability.

## Current Warnings

| File | Warning | Type |
|------|---------|------|
| `settings.rs:7` | `DEFAULT_PROMPT` never used | dead_code |
| `mojo_ffi.rs:41-44` | `MojoNormalization` variants `None`, `MinMax`, `ZScore` never constructed | dead_code |
| `mojo_ffi.rs:286` | `compute_mel_spectrogram` never used | dead_code |

## Execution Order

### Phase 1: Recently Modified (High Priority)

| # | Module | Lines | Scope | Notes |
|---|--------|-------|-------|-------|
| 1 | `src/transcribe/mojo_ffi.rs` | ~315 | FFI bindings | 4 warnings, self-contained, new code |
| 2 | `src/transcribe/candle_engine.rs` | ~800 | Transcription engine | Removed Candle mel code, check for cruft |
| 3 | `src/config/settings.rs` | ~100 | Configuration | Unused DEFAULT_PROMPT |

### Phase 2: Daemon Changes

| # | Module | Lines | Scope | Notes |
|---|--------|-------|-------|-------|
| 4 | `src/daemon/client.rs` | ~85 | Client requests | Added TranscribeAudio logging |
| 5 | `src/daemon/server.rs` | ~400 | Request handling | Added handle_transcribe_audio |
| 6 | `src/daemon/protocol.rs` | ~50 | Message types | Added TranscribeAudio variant |

### Phase 3: Commands

| # | Module | Lines | Scope | Notes |
|---|--------|-------|-------|-------|
| 7 | `src/main.rs` | ~800 | CLI commands | Added transcribe-file, check duplication |

### Phase 4: Supporting Modules (Lower Priority)

| # | Module | Scope | Notes |
|---|--------|-------|-------|
| 8 | `src/transcribe/mod.rs` | Module exports | Align after engine/ffi cleanup |
| 9 | `src/audio/` | Audio capture | Not recently changed |
| 10 | `src/model/` | Model management | Not recently changed |
| 11 | `src/output/` | Output handling | Not recently changed |
| 12 | `src/state/` | State management | Not recently changed |

## Per-Module Checklist

For each module, code-simplifier should:

- [ ] Remove dead code (unused functions, variants, constants)
- [ ] Consolidate duplicate patterns
- [ ] Simplify overly complex logic
- [ ] Ensure consistent error handling
- [ ] Remove unnecessary comments
- [ ] Verify all functionality preserved

## Progress Tracking

| Module | Status | Date | Notes |
|--------|--------|------|-------|
| mojo_ffi.rs | Pending | | |
| candle_engine.rs | Pending | | |
| settings.rs | Pending | | |
| daemon/client.rs | Pending | | |
| daemon/server.rs | Pending | | |
| daemon/protocol.rs | Pending | | |
| main.rs | Pending | | |
| transcribe/mod.rs | Pending | | |
| audio/ | Pending | | |
| model/ | Pending | | |
| output/ | Pending | | |
| state/ | Pending | | |

## Commands

```bash
# Run after each module cleanup
cargo test
cargo build --release

# Run local transcription tests (requires daemon)
cargo test --test transcription -- --ignored
```
