# Claude Code Instructions - dev-voice

## Build Commands

**Preferred local build (CUDA enabled):**

```bash
RUSTFLAGS="-L /usr/lib64 -L /usr/local/lib/ollama" cargo build --release --features cuda
```

**Quick dev build (no CUDA):**

```bash
cargo build
```

## Documentation

Files go in `docs/` except for obvious exceptions: README.md, CLAUDE.md, LICENSE.md, CONTRIBUTING.md, AGENT.md, ... (root only).

**Subdirectories:**

- `context/` - Architecture, domain knowledge, static reference
- `decisions/` - Architecture Decision Records (ADRs)
- `handoff/` - Session state for development continuity
- `project/` - Planning: todos, features, roadmap
- `research/` - Explorations, comparisons, technical analysis
- `tmp/` - Scratch files (safe to delete)

**Naming:** `YYYY-MM-DD-descriptive-name.md` (lowercase, hyphens)

**Rules:**

- Update existing docs before creating new ones
- Use `tmp/` when uncertain, flag for review

## Project-Specific Notes

**Mojo-Audio FFI Integration:**

- `lib/libmojo_audio.so` - Pre-built mojo-audio shared library
- Replaces Candle's buggy `pcm_to_mel` (which produced 4500 frames instead of ~3000)
- FFI bindings in `src/transcribe/mojo_ffi.rs`
- Config uses `NORM_WHISPER` for Whisper-compatible output
- Rebuild mojo-audio: `cd ../mojo-audio && pixi run mojo build src/ffi/audio_ffi.mojo -o libmojo_audio.so --emit shared-lib`

**Whisper Model Compatibility:**

- Large V3 Turbo: 128 mel bins, max_source_positions=1500 (3000 frames after downsampling)
- Older models (tiny, base, small, medium, large-v2): 80 mel bins
- mojo-audio produces correct frame count (~2998 for 30s audio)
