
- [x] MemRL vocabulary learning — fix initial_prompt bias + personalized vocabulary system
  - Added: 2026-02-22
  - Priority: high
  - Promoted: Tasks #1-3 in batch 2026-02-22 (Task 4 auto-mining deferred for next batch)
  - Notes: |
    The goal is a self-improving transcription system that learns the user's personal vocabulary
    (proper nouns, tech terms, names) and injects them into Whisper's initial_prompt to bias
    transcription. Example errors: "clod" → "Claude", "maximum slope" → "Maximus Loop",
    "mojovoice" getting mangled.

    ## What exists already (don't rebuild)
    - `src/transcribe/candle_engine.rs` — initial_prompt is fully wired but DISABLED at line 177
      because it was "causing decoder issues". Root cause: comment says "Long prompts cause decoder
      to get stuck in infinite loops", and the token limit is hardcoded to 50 tokens. Fix first.
    - `src/config/settings.rs` — `prompt: Option<String>` field exists, just set to None by default
    - `src/history/storage.rs` — transcription history already being stored with UUIDs

    ## What to build (4 tasks suggested)

    **Task 1: Fix initial_prompt decoder bug**
    The prompt token limit of 50 is too aggressive — investigate why longer prompts cause loops.
    Whisper actually supports up to 224 prompt tokens. The decoder bug is likely in how prompt
    tokens are positioned in the token sequence (they need to come before sot/lang tokens, not after).
    Fix the encode_initial_prompt() logic and token sequence assembly in candle_engine.rs.
    Verify with a 5-10 word prompt like "Claude Maximus Wolfie Aqimo Mojo".

    **Task 2: SQLite vocabulary store**
    Create `~/.config/dev-voice/vocab.db` (or reuse existing config dir — check CLAUDE.md).
    Table: `vocabulary(id, term TEXT, added_at, use_count, source TEXT)`.
    Source values: 'manual' (user added), 'auto' (detected from correction), 'history' (mined
    from transcription history). Simple Rust module: `src/vocab/store.rs`.

    **Task 3: vocab CLI commands**
    Add to existing CLI:
    - `dev-voice vocab add <term>` — adds term to vocabulary store
    - `dev-voice vocab list` — shows current vocabulary with use counts  
    - `dev-voice vocab remove <term>` — removes a term
    - `dev-voice vocab correct <wrong> <right>` — records a correction + auto-adds <right> to vocab
    Load vocabulary at transcription time and format as initial_prompt: "Claude, Maximus Loop,
    Wolfie, Aqimo" (comma-separated, sorted by use_count DESC, truncated to ~200 tokens).

    **Task 4: Auto-mining from transcription history**
    The history store already has UUIDs and transcription text. Mine it for candidate vocabulary:
    - Find words that appear frequently and are capitalized mid-sentence (likely proper nouns)
    - Find words that appear in patterns like "called X" or "named X"
    - Surface candidates to user via `dev-voice vocab suggest` for confirmation
    This is the MemRL "pattern extraction" analog — the system learns vocabulary from its own
    output rather than requiring manual `vocab add` for everything.

    ## Architecture note
    This is intentionally NOT the full Maximus episodes/corrections/patterns system — it's a
    simpler domain-specific MemRL loop: transcribe → user corrects → vocab grows → better
    transcription next time. Keep it self-contained in dev-voice with its own vocab SQLite.
    Don't import maximus-loop libraries.

    ## Related repo
    `/home/maskkiller/dev-coffee/repos/mojo-audio` — mel spectrogram in Mojo lang. Not directly
    related to vocab learning but may be relevant if switching audio processing backends.
