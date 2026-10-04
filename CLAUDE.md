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

## Feature Tracking Workflow

All future feature proposals and ideas under consideration must be tracked in `docs/project/todos/roadmap.md` using the appropriate section:

**Roadmap Sections:**

1. **Agreed Upon Future Features** - Features confirmed for implementation when time/resources permit
   - Requires: Clear scope, understood effort, aligned with project goals
   - Action: Ready to implement

2. **Future Features Under Consideration** - Features requiring research, evaluation, or design decisions
   - Requires: Analysis of pros/cons, alternative approaches, open questions, references
   - Action: Further thought and discussion needed before commitment
   - Format: Include overview, technical analysis, decision points, and references

3. **Need to Review** - Previously planned items requiring status reassessment
   - Use when: Roadmap items become outdated or priorities shift
   - Action: Re-evaluate priority and move to appropriate section

**Adding New Feature Proposals:**

When researching or discussing potential features:
1. Document technical analysis (capabilities, limitations, integration barriers)
2. Add to "Future Features Under Consideration" section with decision points
3. Include references to source material (GitHub repos, HuggingFace models, etc.)
4. Flag open questions that need resolution

**Example:** VibeVoice-ASR speaker diarization analysis (see roadmap.md)

## Release Workflow

When creating a new release:

**1. Update version numbers:**
- `Cargo.toml` (root)
- `ui/src-tauri/Cargo.toml`
- `ui/src-tauri/tauri.conf.json`
- `CHANGELOG.md` (change `[Unreleased]` to `[X.Y.Z] - YYYY-MM-DD`)

**2. Commit and tag:**
```bash
cargo check  # updates Cargo.lock
git add -A && git commit -m "chore: release vX.Y.Z"
git tag -a vX.Y.Z -m "Release vX.Y.Z"
git push && git push origin vX.Y.Z
```

**3. Manually build and upload CUDA binary:**

GitHub Actions builds CPU-only binaries. CUDA builds require local machine with CUDA toolkit.

```bash
# Build CUDA release
RUSTFLAGS="-L /usr/lib64 -L /usr/local/lib/ollama" cargo build --release --features cuda

# Package and upload to release
cp target/release/mojovoice /tmp/mojovoice
cd /tmp && tar -czvf mojovoice-linux-x64-cuda.tar.gz mojovoice
gh release upload vX.Y.Z /tmp/mojovoice-linux-x64-cuda.tar.gz --clobber
```

**4. Verify release assets:**
```bash
gh release view vX.Y.Z --json assets --jq '.assets[].name'
```

Expected assets:

**CLI (from CI):**
- `mojovoice-linux-x64.tar.gz` (CPU)
- `mojovoice-macos-arm64.tar.gz` (works on Intel Macs via Rosetta 2)
- `mojovoice-windows-x64.zip` (CPU)

**CLI (manual upload):**
- `mojovoice-linux-x64-cuda.tar.gz` (CUDA) — See step 3 above

**Desktop App (from CI):**
- `MojoVoice-linux-x64.AppImage`
- `MojoVoice-linux-x64.deb`
- `MojoVoice-macos-arm64.dmg` (works on Intel Macs via Rosetta 2)
- `MojoVoice-windows-x64-setup.exe` (NSIS, unsigned; bundles the CLI as a sidecar)

**Note:** Intel macOS builds removed from CI (macos-12/13 runners deprecated). ARM binaries run on Intel Macs via Rosetta 2.

## UI Development (Browser Mode)

**Dev server:** `cd ui && npm run dev` (runs at http://localhost:1420)

The UI supports browser-only development with mock data (`ui/src/lib/ipc.ts`). When `window.__TAURI__` is absent, all Tauri API calls return mock data. This allows:
- Rapid UI iteration with Vite HMR
- Playwright MCP testing without the Rust backend
- Visual validation of all components

**Playwright MCP Screenshots:**
- **Always** save screenshots to `docs/tmp/` (e.g., `docs/tmp/settings-debug.png`)
- **Never** save screenshots to the repo root or any tracked directory
- Use descriptive filenames: `docs/tmp/<component>-<state>.png`
- `docs/tmp/` is gitignored, so screenshots won't pollute the repo

**Playwright MCP Artifacts:**
- The `.playwright-mcp/` directory is gitignored
- Console logs and network traces are ephemeral - don't commit them

## Project-Specific Notes

**Mel Spectrogram:**

- Pure Rust in `src/transcribe/mel.rs`, matching OpenAI's `whisper.audio.log_mel_spectrogram` exactly (reflect pad, 400-point FFT, Slaney filters from `assets/melfilters{80,128}.bytes`)
- Tests compare against OpenAI reference output in `tests/fixtures/mel/`; regenerate with `uv run scripts/gen-mel-fixtures.py` (needs ffmpeg)
- Replaced the mojo-audio FFI in v0.5.8: the `.so` needed Mojo runtime libs that releases never shipped, and its FFT size/mel scale didn't match Whisper's training features

**Whisper Model Compatibility:**

- Large V3 Turbo: 128 mel bins, max_source_positions=1500 (3000 frames after downsampling)
- Older models (tiny, base, small, medium, large-v2): 80 mel bins
- A 30s chunk (480000 samples) produces exactly 3000 mel frames

**CUDA Builds:**

- Build in a container: `./scripts/build-cuda-container.sh` (CUDA 12.8, Ubuntu 22.04) → `target/container/release/mojovoice`
- Avoids nvcc/glibc header conflicts on Fedora 43 and links against an older glibc for portability
- Targets compute capability 8.0 by default (`CUDA_COMPUTE_CAP` to override)

## Ralph Loop Workflow (Autonomous Development)

When running in autonomous Ralph Loop mode (`claude -p`), follow these critical rules:

**Task Management:**
- Read `plan.md` (JSON task list) and `claude-progress.txt` (progress log)
- Pick the SINGLE next task where `"passes": false`
- Implement ONLY that one task completely
- Verify ALL acceptance criteria before marking complete
- Update ONLY the `"passes"` field in plan.md (never edit descriptions)

**Design System Compliance:**
- Follow `docs/context/mojovoice-style-guide.md` exactly
- Use Electric Night color palette (deep navy + electric blue + acid green)
- Apply neubrutalist styling (thick borders, brutal shadows, sharp corners)
- Use JetBrains Mono for technical content, Inter for UI text
- All animations: 150-250ms, GPU-accelerated, honor `prefers-reduced-motion`

**Code Quality:**
- Keep codebase compilable after every commit
- Test functionality before marking task complete
- Use Tailwind CSS v4 utilities
- Follow React Aria Components patterns for accessibility
- Ensure WCAG 2.2 Level AA compliance

**Progress Tracking:**
- Append iteration summary to `claude-progress.txt`
- Git commit after each task: `feat: [feature name]`
- Log: iteration number, task ID, changes made, verification steps, commit hash

**Completion:**
- When ALL tasks have `"passes": true`, output `<promise>COMPLETE</promise>`
- If blocked, document reason in progress log and exit

**Never:**
- Attempt multiple tasks in one iteration
- Mark tasks passing without verification
- Edit task descriptions in plan.md
- Break the build
- Skip acceptance criteria
