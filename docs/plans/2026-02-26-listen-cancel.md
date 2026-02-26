# listen --cancel Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add `mojovoice listen --cancel` which discards an active listen session without transcribing, by reusing the existing SIGUSR1 mechanism and a new sentinel file `listen.cancel`.

**Architecture:** Three surgical changes: (1) add a path helper `get_listen_cancel_file()` alongside the existing path helpers in `src/state/paths.rs`; (2) add `cmd_listen_cancel()` in `src/main.rs` and wire it into the `Listen` subcommand via a `--cancel` flag; (3) add a cancel-check guard near the top of `cmd_listen_start()` — after `capture_toggle` returns and before transcription — that detects the sentinel file, deletes it, and exits without sending audio to the daemon. No new signal handlers, no new IPC, no new threads.

**Tech Stack:** Rust, clap (already used), nix (already used for SIGUSR1), std::fs (sentinel file), existing `state::toggle` helpers.

---

### Task 1: `get_listen_cancel_file()` path helper

**Files:**
- Modify: `src/state/paths.rs` (add after `get_listen_pid_file()`, line 39)

**Step 1: Write the failing test**

Add this test to the existing `#[cfg(test)] mod tests` block in `src/state/paths.rs` (after the `test_listen_pid_file_is_distinct_from_recording_pid` test, line 72):

```rust
#[test]
fn test_listen_cancel_file_path() {
    let cancel = get_listen_cancel_file().unwrap();
    assert!(cancel.to_string_lossy().ends_with("listen.cancel"));
    // Must live in the same state dir as listen.pid, not a subdirectory
    let state_dir = get_state_dir().unwrap();
    assert_eq!(cancel.parent().unwrap(), state_dir);
}
```

**Step 2: Run test to verify it fails**

```bash
cd /home/maskkiller/dev-coffee/repos/dev-voice
cargo test test_listen_cancel_file_path 2>&1 | tail -20
```

Expected: compile error — `get_listen_cancel_file` not found.

**Step 3: Add the function**

In `src/state/paths.rs`, after line 39 (the closing `}` of `get_listen_pid_file`), insert:

```rust
/// Get the listen cancel sentinel file path (~/.local/state/mojovoice/listen.cancel)
///
/// Written by `mojovoice listen --cancel` before sending SIGUSR1.
/// Checked by the listen process after `capture_toggle` returns to decide
/// whether to skip transcription.
pub fn get_listen_cancel_file() -> Result<PathBuf> {
    Ok(get_state_dir()?.join("listen.cancel"))
}
```

**Step 4: Run test to verify it passes**

```bash
cargo test test_listen_cancel_file_path 2>&1 | tail -10
```

Expected: `test test_listen_cancel_file_path ... ok`

**Step 5: Commit**

```bash
cd /home/maskkiller/dev-coffee/repos/dev-voice
git add src/state/paths.rs
git commit -m "feat: add get_listen_cancel_file() path helper"
```

---

### Task 2: `cmd_listen_cancel()` + wire `--cancel` into `Commands::Listen`

**Files:**
- Modify: `src/main.rs`
  - `Commands::Listen` struct (around line 173) — add `--cancel` flag
  - `cmd_listen()` dispatcher (around line 1021) — dispatch `--cancel` before toggle logic
  - new function `cmd_listen_cancel()` (add after `cmd_listen_stop`, around line 1099)
  - `listen_tests` module (line 1203) — add two tests

**Step 1: Write the failing tests**

Add these two tests to the `listen_tests` module at the bottom of `src/main.rs` (after the existing `test_cmd_listen_daemon_not_running_returns_error` test, around line 1258):

```rust
#[test]
fn test_listen_cancel_flag_parses() {
    let cli = Cli::parse_from(["mojovoice", "listen", "--cancel"]);
    if let Commands::Listen { cancel, .. } = cli.command {
        assert!(cancel, "--cancel flag should be true when passed");
    } else {
        panic!("Expected Listen command");
    }
}

#[test]
fn test_cmd_listen_cancel_no_session_prints_message_and_exits_ok() {
    // Ensure no listen.pid exists so we exercise the "no active session" branch
    let _ = state::toggle::cleanup_listen();

    // Also ensure no stale cancel file
    if let Ok(f) = state::paths::get_listen_cancel_file() {
        let _ = std::fs::remove_file(f);
    }

    let result = cmd_listen_cancel();
    assert!(result.is_ok(), "cancel with no session should return Ok, got: {:?}", result);
}
```

**Step 2: Run tests to verify they fail**

```bash
cd /home/maskkiller/dev-coffee/repos/dev-voice
cargo test test_listen_cancel 2>&1 | tail -20
```

Expected: compile errors — `cancel` field missing from `Commands::Listen`, `cmd_listen_cancel` not defined.

**Step 3: Add `--cancel` field to `Commands::Listen`**

In `src/main.rs`, the `Commands::Listen` variant (around line 173) currently ends with:

```rust
    /// Copy to clipboard instead of typing
    #[arg(short, long)]
    clipboard: bool,
},
```

Change it to:

```rust
    /// Copy to clipboard instead of typing
    #[arg(short, long)]
    clipboard: bool,

    /// Cancel (discard) the active listen session without transcribing
    #[arg(long)]
    cancel: bool,
},
```

**Step 4: Update `cmd_listen()` to dispatch `--cancel`**

The current `cmd_listen` function (around line 1021) is:

```rust
fn cmd_listen(source: Option<String>, max_duration: u32, clipboard: bool) -> Result<()> {
    if state::toggle::is_listening()?.is_some() {
        // Second invocation: stop the running session
        return cmd_listen_stop();
    }
    // First invocation: start a new session
    cmd_listen_start(source, max_duration, clipboard)
}
```

Replace the entire function with:

```rust
fn cmd_listen(source: Option<String>, max_duration: u32, clipboard: bool, cancel: bool) -> Result<()> {
    if cancel {
        return cmd_listen_cancel();
    }
    if state::toggle::is_listening()?.is_some() {
        // Second invocation: stop the running session
        return cmd_listen_stop();
    }
    // First invocation: start a new session
    cmd_listen_start(source, max_duration, clipboard)
}
```

**Step 5: Update the match arm in `main()` to pass `cancel`**

In `main()` (around line 284), the existing match arm is:

```rust
Commands::Listen {
    source,
    max_duration,
    clipboard,
} => cmd_listen(source, max_duration, clipboard)?,
```

Change it to:

```rust
Commands::Listen {
    source,
    max_duration,
    clipboard,
    cancel,
} => cmd_listen(source, max_duration, clipboard, cancel)?,
```

**Step 6: Add `cmd_listen_cancel()`**

Add this function immediately after `cmd_listen_stop()` (after line 1099 in the original file):

```rust
/// Cancel a running listen session: write the cancel sentinel then send SIGUSR1.
/// The listen process will detect the sentinel after capture_toggle returns and
/// skip transcription.
fn cmd_listen_cancel() -> Result<()> {
    match state::toggle::is_listening()? {
        None => {
            println!("no listen session active");
            Ok(())
        }
        Some(state) => {
            // Write sentinel so the listen process knows to skip transcription
            let cancel_file = state::paths::get_listen_cancel_file()?;
            std::fs::write(&cancel_file, "")
                .with_context(|| format!("Failed to write cancel file: {}", cancel_file.display()))?;

            // Reuse the same stop signal — the existing SIGUSR1 handler fires
            state::toggle::stop_listen(&state)?;
            println!("Listen session cancelled.");
            Ok(())
        }
    }
}
```

Note: `with_context` requires `use anyhow::Context;` which is already at the top of `main.rs` via the module-level import. Confirm it exists:

```bash
grep "use anyhow" /home/maskkiller/dev-coffee/repos/dev-voice/src/main.rs
```

If not present, add `use anyhow::Context;` near the top of `src/main.rs` with the other `use` statements. (It is already present via `anyhow::Result` — the `Context` trait needs to be in scope for `.with_context()`. Check with `grep -n "Context" src/main.rs`. If absent, add `use anyhow::Context;`.)

**Step 7: Run tests to verify they pass**

```bash
cd /home/maskkiller/dev-coffee/repos/dev-voice
cargo test test_listen_cancel 2>&1 | tail -20
```

Expected: both tests pass.

Also run the full listen test suite to check for regressions:

```bash
cargo test listen_tests 2>&1 | tail -30
```

Expected: all existing listen tests still pass.

**Step 8: Verify the binary compiles cleanly**

```bash
cargo build 2>&1 | tail -20
```

Expected: no errors.

**Step 9: Commit**

```bash
cd /home/maskkiller/dev-coffee/repos/dev-voice
git add src/main.rs
git commit -m "feat: add listen --cancel flag and cmd_listen_cancel()"
```

---

### Task 3: Cancel-check guard in `cmd_listen_start()`

This is the listen-process side: after `capture_toggle` returns and before sending audio to the daemon, check for the sentinel file. If it exists, delete it and return without transcribing.

**Files:**
- Modify: `src/main.rs` — `cmd_listen_start()` function (around line 1031)
- Modify: `src/main.rs` — `listen_tests` module (add one test)

**Step 1: Write the failing test**

Add to the `listen_tests` module (after the cancel tests from Task 2):

```rust
#[test]
fn test_cmd_listen_start_skips_transcription_when_cancel_file_present() {
    // Pre-create the cancel sentinel. cmd_listen_start should detect it
    // immediately after capture_toggle would return and exit Ok without
    // touching the daemon.
    //
    // We don't actually run capture_toggle (that needs audio hardware),
    // so we test the cancel-check helper directly.
    use state::paths::get_listen_cancel_file;

    let cancel_file = get_listen_cancel_file().unwrap();
    std::fs::write(&cancel_file, "").unwrap();
    assert!(cancel_file.exists(), "setup: cancel file should exist");

    let should_skip = check_and_clear_cancel_file().unwrap();
    assert!(should_skip, "should return true when cancel file is present");
    assert!(!cancel_file.exists(), "cancel file should be deleted after check");

    // Call again with no cancel file — should return false
    let should_skip_again = check_and_clear_cancel_file().unwrap();
    assert!(!should_skip_again, "should return false when cancel file is absent");
}
```

**Step 2: Run the test to verify it fails**

```bash
cd /home/maskkiller/dev-coffee/repos/dev-voice
cargo test test_cmd_listen_start_skips_transcription_when_cancel_file_present 2>&1 | tail -20
```

Expected: compile error — `check_and_clear_cancel_file` not found.

**Step 3: Add the `check_and_clear_cancel_file()` helper and the guard**

First, add the helper function in `src/main.rs`. Place it just before `cmd_listen_start` (around line 1031):

```rust
/// Returns `true` and deletes the sentinel if `listen.cancel` exists; otherwise `false`.
/// Called by `cmd_listen_start` after `capture_toggle` returns to decide whether to
/// skip transcription.
fn check_and_clear_cancel_file() -> Result<bool> {
    let cancel_file = state::paths::get_listen_cancel_file()?;
    if cancel_file.exists() {
        std::fs::remove_file(&cancel_file)
            .with_context(|| format!("Failed to remove cancel file: {}", cancel_file.display()))?;
        return Ok(true);
    }
    Ok(false)
}
```

Next, in `cmd_listen_start`, locate this block (around line 1056):

```rust
    // Always clean up PID file, even if capture failed
    let _ = state::toggle::cleanup_listen();

    let samples = samples?;

    if samples.is_empty() {
        println!("No audio captured.");
        return Ok(());
    }
```

Insert the cancel check immediately after `cleanup_listen` and before the `samples?` unwrap:

```rust
    // Always clean up PID file, even if capture failed
    let _ = state::toggle::cleanup_listen();

    // Cancel check: if --cancel was invoked while we were capturing, skip transcription
    if check_and_clear_cancel_file()? {
        println!("Listen session cancelled.");
        return Ok(());
    }

    let samples = samples?;

    if samples.is_empty() {
        println!("No audio captured.");
        return Ok(());
    }
```

**Step 4: Run the test to verify it passes**

```bash
cd /home/maskkiller/dev-coffee/repos/dev-voice
cargo test test_cmd_listen_start_skips_transcription_when_cancel_file_present 2>&1 | tail -20
```

Expected: `test ... ok`

**Step 5: Run all listen tests + full unit test suite for regressions**

```bash
cd /home/maskkiller/dev-coffee/repos/dev-voice
cargo test 2>&1 | tail -40
```

Expected: all tests pass.

**Step 6: Final build check**

```bash
cargo build 2>&1 | tail -10
```

Expected: no errors, no warnings about unused variables.

**Step 7: Commit**

```bash
cd /home/maskkiller/dev-coffee/repos/dev-voice
git add src/main.rs
git commit -m "feat: skip transcription when listen.cancel sentinel is present"
```

---

## End-to-End Manual Smoke Test (after all tasks complete)

These are not automated — run them manually once to confirm the full flow works.

**Scenario A — no session active:**
```bash
mojovoice listen --cancel
# Expected stdout: "no listen session active"
# Expected exit code: 0
echo $?
```

**Scenario B — cancel while listening (requires daemon running):**

Terminal 1:
```bash
mojovoice listen
# Expected: "Listening on ..."
```

Terminal 2 (immediately after):
```bash
mojovoice listen --cancel
# Expected: "Listen session cancelled."
```

Terminal 1 should print `"Listen session cancelled."` and exit without typing/pasting anything.

**Verify no sentinel file is left behind after cancel:**
```bash
ls ~/.local/state/mojovoice/listen.cancel 2>&1
# Expected: "No such file or directory"
```

**Scenario C — normal stop still works (regression):**

Terminal 1:
```bash
mojovoice listen
```

Terminal 2:
```bash
mojovoice listen
# Expected: "Listen session stopped. Transcribing..."
```

Terminal 1 should transcribe and output text normally.
