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

## Documentation Organization

All markdown files go in `docs/` (except README.md, CLAUDE.md, LICENSE.md, CONTRIBUTING.md).

**Subdirectories:**
- `docs/prompts/` - Prompts for copying into new agent sessions
- `docs/context/` - Context documents for future reference
- `docs/research/` - Research, comparisons, explorations
- `docs/project/` - High-level planning (todos, features, roadmap)
- `docs/architecture/` - System design, architectural patterns
- `docs/decisions/` - Design decisions, technical rationale (ADRs)
- `docs/guides/` - User-facing documentation and tutorials
- `docs/writeups/` - Technical writeups, analysis, deep-dives
- `docs/handoff/` - Handoff documents between development sessions
- `docs/historical/` - Archived documentation from previous phases
- `docs/tmp/` - Temporary files (safe to delete anytime)

**File naming:** `[MM-DD-YYYY]-[short-name-with-hyphens].md`
- Example: `01-11-2026-candle-replacement-plan.md`
- Lowercase, hyphens for spaces
- Date prefix for chronological sorting

**Never create all-caps markdown files at project root** (except the special cases listed above).

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
