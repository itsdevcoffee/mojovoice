# Claude Code Instructions - dev-voice

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

**Rust/Candle Issues:**
- Candle's `pcm_to_mel` generates incorrect frame count (4500 instead of ~3000)
- Workaround exists in `src/transcribe/candle_engine.rs:706-715` (truncation)
- **Solution:** Replace with mojo-audio FFI (correct output, faster)

**Dependencies:**
- Whisper Large V3 Turbo: max_source_positions = 1500 (× 2 after downsampling = 3000 frames max)
- mojo-audio FFI: Produces (80, 2998) frames for 30s audio - Whisper compatible
