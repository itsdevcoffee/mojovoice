# Listen Command Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add `mojovoice listen [--source <name>] [--max-duration <secs>]` as a standalone toggle command that captures audio from any PipeWire source (including application monitors) and transcribes via the daemon.

**Architecture:** Standalone CLI process — no daemon involvement during capture. On second invocation, sends SIGUSR1 to the first process's PID (read from `listen.pid`). On stop, sends raw PCM samples to the daemon's existing `TranscribeAudio` IPC endpoint. Fully isolated from `start`/`stop` via a separate `listen.pid` state file.

**Tech Stack:** Rust, clap (derive), nix (SIGUSR1), existing `audio::capture_toggle`, existing `daemon::send_request(TranscribeAudio)`, existing `output::inject_text`.

---

### Task 1: `get_listen_pid_file()` path helper

**Files:**
- Modify: `src/state/paths.rs`

**Step 1: Write the failing test**

Add inside the existing `#[cfg(test)]` block in `src/state/paths.rs`:

```rust
#[test]
fn test_listen_pid_file_is_distinct_from_recording_pid() {
    let listen_pid = get_listen_pid_file().unwrap();
    let recording_pid = get_pid_file().unwrap();
    assert_ne!(listen_pid, recording_pid);
    assert!(listen_pid.to_string_lossy().ends_with("listen.pid"));
}
```

**Step 2: Run test to verify it fails**

```bash
cargo test test_listen_pid_file_is_distinct_from_recording_pid 2>&1 | tail -5
```

Expected: `error[E0425]: cannot find function 'get_listen_pid_file'`

**Step 3: Write minimal implementation**

After `get_pid_file()` in `src/state/paths.rs`, add:

```rust
/// Get the listen PID file path (separate from recording PID)
pub fn get_listen_pid_file() -> Result<PathBuf> {
    Ok(get_state_dir()?.join("listen.pid"))
}
```

**Step 4: Run test to verify it passes**

```bash
cargo test test_listen_pid_file_is_distinct_from_recording_pid 2>&1 | tail -5
```

Expected: `test state::paths::tests::test_listen_pid_file_is_distinct_from_recording_pid ... ok`

**Step 5: Commit**

```bash
git add src/state/paths.rs
git commit -m "feat: add get_listen_pid_file() path helper"
```

---

### Task 2: Listen state helpers

These mirror `is_recording`/`start_recording`/`cleanup_recording`/`stop_recording` exactly, but use `listen.pid`.

**Files:**
- Modify: `src/state/toggle.rs`

**Step 1: Write the failing tests**

Add inside the existing `#[cfg(test)]` block in `src/state/toggle.rs`:

```rust
#[test]
fn test_listen_state_lifecycle() {
    // Clean up any existing state first
    let _ = cleanup_listen();

    // Should not be listening initially
    assert!(is_listening().unwrap().is_none());

    // Start listening
    start_listen().unwrap();

    // Should be listening now
    let state = is_listening().unwrap();
    assert!(state.is_some());
    assert_eq!(state.unwrap().pid, std::process::id());

    // Clean up
    cleanup_listen().unwrap();

    // Should not be listening after cleanup
    assert!(is_listening().unwrap().is_none());
}

#[test]
fn test_listen_stale_pid_is_cleaned_up() {
    use std::io::Write;

    let pid_file = super::paths::get_listen_pid_file().unwrap();
    // Write a PID that will never exist
    let mut file = std::fs::File::create(&pid_file).unwrap();
    writeln!(file, "99999999").unwrap();
    writeln!(file, "0").unwrap();
    drop(file);

    // is_listening should clean up the stale file and return None
    let result = is_listening().unwrap();
    assert!(result.is_none());
    assert!(!pid_file.exists(), "stale PID file should have been removed");
}

#[test]
fn test_listen_and_recording_pid_files_are_independent() {
    let _ = cleanup_listen();
    let _ = cleanup_recording();

    start_listen().unwrap();
    assert!(is_listening().unwrap().is_some());
    assert!(is_recording().unwrap().is_none()); // start did NOT get touched

    cleanup_listen().unwrap();
}
```

**Step 2: Run tests to verify they fail**

```bash
cargo test test_listen 2>&1 | tail -10
```

Expected: `error[E0425]: cannot find function 'is_listening'`

**Step 3: Write minimal implementation**

Add these imports at the top of `src/state/toggle.rs` (they're already present, just noting):
- `super::paths::get_pid_file` is already imported — add `get_listen_pid_file`

Add after the `use super::paths::get_pid_file;` import line:

```rust
use super::paths::get_listen_pid_file;
```

Then add the following after the `cleanup_recording()` function (around line 154):

```rust
/// Check if a listen session is currently in progress
pub fn is_listening() -> Result<Option<RecordingState>> {
    let pid_file = get_listen_pid_file()?;

    if !pid_file.exists() {
        return Ok(None);
    }

    let content = fs::read_to_string(&pid_file)?;
    let mut lines = content.lines();

    let pid: u32 = lines.next().and_then(|s| s.parse().ok()).unwrap_or(0);
    let started_at: u64 = lines.next().and_then(|s| s.parse().ok()).unwrap_or(0);

    if pid == 0 {
        let _ = fs::remove_file(&pid_file);
        return Ok(None);
    }

    let process_exists = signal::kill(Pid::from_raw(pid as i32), None).is_ok();
    if !process_exists {
        info!("Cleaning up stale listen PID file (process {} not running)", pid);
        let _ = fs::remove_file(&pid_file);
        return Ok(None);
    }

    Ok(Some(RecordingState { pid, started_at }))
}

/// Mark listen session as started (create listen.pid)
pub fn start_listen() -> Result<()> {
    let pid_file = get_listen_pid_file()?;
    let pid = std::process::id();
    let started_at = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .context("System time is before UNIX epoch")?
        .as_secs();

    let mut file = fs::File::create(&pid_file).context("Failed to create listen PID file")?;
    writeln!(file, "{}", pid)?;
    writeln!(file, "{}", started_at)?;
    info!("Listen session started (PID: {}, file: {})", pid, pid_file.display());
    Ok(())
}

/// Clean up listen PID file
pub fn cleanup_listen() -> Result<()> {
    let pid_file = get_listen_pid_file()?;
    if pid_file.exists() {
        fs::remove_file(&pid_file)?;
        info!("Cleaned up listen PID file");
    }
    Ok(())
}

/// Stop a running listen session by sending SIGUSR1
pub fn stop_listen(state: &RecordingState) -> Result<()> {
    info!("Sending stop signal to listen process (PID: {})", state.pid);
    signal::kill(Pid::from_raw(state.pid as i32), Signal::SIGUSR1)
        .context("Failed to send stop signal to listen process")?;
    Ok(())
}
```

**Step 4: Run tests to verify they pass**

```bash
cargo test test_listen 2>&1 | tail -10
```

Expected: all 3 `test_listen_*` tests pass.

**Step 5: Commit**

```bash
git add src/state/toggle.rs
git commit -m "feat: add listen session state helpers (is_listening, start_listen, cleanup_listen, stop_listen)"
```

---

### Task 3: Expose monitor sources in device list

Currently `list_pipewire_devices()` silently skips `.monitor` sources. This makes Discord audio invisible. Change it to include monitors with a `[Monitor]` label prefix.

**Files:**
- Modify: `src/audio/mod.rs`

**Step 1: Write the failing test**

Add inside `#[cfg(test)]` in `src/audio/mod.rs`:

```rust
#[test]
fn test_monitor_source_display_name_gets_prefix() {
    // Simulate the naming logic for a monitor source
    let source_name = "alsa_output.pci-0000_00_1f.3.analog-stereo.monitor";
    let description = "Built-in Audio Analog Stereo";

    let display_name = if source_name.ends_with(".monitor") {
        format!("[Monitor] {}", description)
    } else {
        description.to_string()
    };

    assert!(display_name.starts_with("[Monitor]"));
    assert!(display_name.contains("Built-in Audio"));
}

#[test]
fn test_non_monitor_source_has_no_prefix() {
    let source_name = "alsa_input.pci-0000_00_1f.3.analog-stereo";
    let description = "Built-in Audio Analog Stereo";

    let display_name = if source_name.ends_with(".monitor") {
        format!("[Monitor] {}", description)
    } else {
        description.to_string()
    };

    assert!(!display_name.starts_with("[Monitor]"));
    assert_eq!(display_name, description);
}
```

**Step 2: Run tests to verify they pass already** (these test logic, not the function)

```bash
cargo test test_monitor_source 2>&1 | tail -5
```

Expected: both pass (they test the conditional logic inline). This confirms the naming convention.

**Step 3: Apply the change to `list_pipewire_devices()`**

In `src/audio/mod.rs`, find the block at around line 117-136 in `list_pipewire_devices()`:

```rust
        // Skip monitor sources (outputs) - we only want input sources
        if source_name.ends_with(".monitor") {
            continue;
        }

        // Get human-readable description
        let description = get_source_description(&source_name).unwrap_or_else(|| source_name.clone());

        devices.push(AudioDeviceInfo {
            name: description,
```

Replace it with:

```rust
        // Get human-readable description
        let description = get_source_description(&source_name).unwrap_or_else(|| source_name.clone());

        // Prefix monitor sources (application audio loopbacks) so they're visually distinct
        let display_name = if source_name.ends_with(".monitor") {
            format!("[Monitor] {}", description)
        } else {
            description
        };

        devices.push(AudioDeviceInfo {
            name: display_name,
```

**Step 4: Build to verify no compile errors**

```bash
cargo build 2>&1 | tail -5
```

Expected: `Finished` with no errors.

**Step 5: Commit**

```bash
git add src/audio/mod.rs
git commit -m "feat: expose monitor sources in device list with [Monitor] prefix"
```

---

### Task 4: `Commands::Listen` clap struct + dispatch

**Files:**
- Modify: `src/main.rs`

**Step 1: Add the `Listen` variant to `Commands` enum**

In `src/main.rs`, inside the `Commands` enum after the `Vocab` variant (around line 170), add:

```rust
    /// Listen to an external audio source and transcribe (toggle mode)
    Listen {
        /// PipeWire/ALSA source name (e.g. "[Monitor] Speakers"). Defaults to system input.
        #[arg(short, long)]
        source: Option<String>,

        /// Max recording duration in seconds before auto-stop (default: 300)
        #[arg(short = 'd', long, default_value = "300")]
        max_duration: u32,

        /// Copy to clipboard instead of typing
        #[arg(short, long)]
        clipboard: bool,
    },
```

**Step 2: Add the match arm in `main()`**

In `src/main.rs`, inside the `match cli.command` block after `Commands::Vocab { command } => cmd_vocab(command)?`, add:

```rust
        Commands::Listen {
            source,
            max_duration,
            clipboard,
        } => cmd_listen(source, max_duration, clipboard)?,
```

**Step 3: Add stub `cmd_listen()` that always errors**

Add after `cmd_vocab()` at the bottom of `src/main.rs`:

```rust
fn cmd_listen(source: Option<String>, max_duration: u32, clipboard: bool) -> Result<()> {
    anyhow::bail!("cmd_listen not yet implemented (source={:?}, max_duration={}, clipboard={})", source, max_duration, clipboard)
}
```

**Step 4: Build and smoke-test the CLI parses it**

```bash
cargo build 2>&1 | tail -3
./target/debug/mojovoice listen --help
```

Expected output includes:
```
Listen to an external audio source and transcribe (toggle mode)

Usage: mojovoice listen [OPTIONS]

Options:
  -s, --source <SOURCE>
  -d, --max-duration <MAX_DURATION>  [default: 300]
  -c, --clipboard
```

**Step 5: Commit**

```bash
git add src/main.rs
git commit -m "feat: add Listen subcommand to CLI (stub)"
```

---

### Task 5: `cmd_listen_stop()` — second-invocation path

**Files:**
- Modify: `src/main.rs`

**Step 1: Write the failing test**

There's no ergonomic unit test for signal sending across processes, so we test the stale-PID branch with a real PID file:

Add a test module at the bottom of `src/main.rs`:

```rust
#[cfg(test)]
mod listen_tests {
    use super::*;

    #[test]
    fn test_cmd_listen_stop_no_session_returns_error() {
        // Ensure no listen.pid exists
        let _ = state::toggle::cleanup_listen();

        let result = cmd_listen_stop();
        assert!(result.is_err());
        let msg = result.unwrap_err().to_string();
        assert!(msg.contains("no listen session active"), "got: {}", msg);
    }
}
```

**Step 2: Run test to verify it fails**

```bash
cargo test test_cmd_listen_stop_no_session 2>&1 | tail -5
```

Expected: `error[E0425]: cannot find function 'cmd_listen_stop'`

**Step 3: Write `cmd_listen_stop()`**

Add after the `cmd_listen()` stub:

```rust
/// Stop a running listen session (second invocation of `mojovoice listen`)
fn cmd_listen_stop() -> Result<()> {
    match state::toggle::is_listening()? {
        Some(state) => {
            info!("Sending stop signal to listen session (PID: {})", state.pid);
            state::toggle::stop_listen(&state)?;
            println!("Listen session stopped. Transcribing...");
            Ok(())
        }
        None => anyhow::bail!("no listen session active"),
    }
}
```

**Step 4: Run test to verify it passes**

```bash
cargo test test_cmd_listen_stop_no_session 2>&1 | tail -5
```

Expected: `test listen_tests::test_cmd_listen_stop_no_session_returns_error ... ok`

**Step 5: Commit**

```bash
git add src/main.rs
git commit -m "feat: implement cmd_listen_stop() with no-session error"
```

---

### Task 6: `cmd_listen_start()` + wire up `cmd_listen()` dispatcher

**Files:**
- Modify: `src/main.rs`

**Step 1: Write the failing test**

Add to the `listen_tests` module:

```rust
    #[test]
    fn test_cmd_listen_default_max_duration_is_300() {
        // The clap default for max_duration must be 300
        // This tests that parsing the default value works correctly
        use clap::Parser;
        let cli = Cli::parse_from(["mojovoice", "listen"]);
        if let Commands::Listen { max_duration, .. } = cli.command {
            assert_eq!(max_duration, 300);
        } else {
            panic!("Expected Listen command");
        }
    }

    #[test]
    fn test_cmd_listen_already_listening_returns_error() {
        // Start a fake listen session with current PID
        state::toggle::start_listen().unwrap();

        // Trying to start again should error
        let result = cmd_listen_start(None, 300, false);
        assert!(result.is_err());
        let msg = result.unwrap_err().to_string();
        assert!(msg.contains("listen session already active"), "got: {}", msg);

        // Clean up
        let _ = state::toggle::cleanup_listen();
    }
```

**Step 2: Run tests to verify they fail**

```bash
cargo test listen_tests 2>&1 | tail -10
```

Expected: `error[E0425]: cannot find function 'cmd_listen_start'`

**Step 3: Write `cmd_listen_start()` and update `cmd_listen()` dispatcher**

Replace the `cmd_listen()` stub with:

```rust
fn cmd_listen(source: Option<String>, max_duration: u32, clipboard: bool) -> Result<()> {
    if state::toggle::is_listening()?.is_some() {
        // Second invocation: stop
        return cmd_listen_stop();
    }
    // First invocation: start
    cmd_listen_start(source, max_duration, clipboard)
}

/// Start capturing audio from source, block until stop signal or max_duration
fn cmd_listen_start(source: Option<String>, max_duration: u32, clipboard: bool) -> Result<()> {
    // Guard: refuse to start if already listening
    if state::toggle::is_listening()?.is_some() {
        anyhow::bail!("listen session already active — run 'mojovoice listen' again to stop it");
    }

    if !daemon::is_daemon_running() {
        anyhow::bail!(
            "daemon is not running — start it first with: mojovoice daemon up"
        );
    }

    let cfg = config::load()?;
    let output_mode = output_mode_from_clipboard(clipboard);

    // Reset stop flag (starts false in a new process, but be explicit)
    state::toggle::STOP_RECORDING.store(false, std::sync::atomic::Ordering::SeqCst);
    state::toggle::setup_signal_handler()?;

    state::toggle::start_listen()?;
    println!(
        "Listening on {}. Run 'mojovoice listen' again to stop (max {}s).",
        source.as_deref().unwrap_or("default input"),
        max_duration
    );

    let samples = audio::capture_toggle(
        max_duration,
        cfg.audio.sample_rate,
        source.as_deref(),
    );

    // Always clean up the PID file, even if capture failed
    let _ = state::toggle::cleanup_listen();

    let samples = samples?;

    if samples.is_empty() {
        println!("No audio captured.");
        return Ok(());
    }

    info!("Captured {} samples, sending to daemon for transcription...", samples.len());

    let response = daemon::send_request(&daemon::DaemonRequest::TranscribeAudio { samples })?;

    match response {
        daemon::DaemonResponse::Success { text } => {
            if text.is_empty() {
                println!("No speech detected.");
                return Ok(());
            }
            info!("Transcribed: {}", text);
            output::inject_text(&text, output_mode)?;
            send_notification("Listen Transcription", &truncate_preview(&text), "normal");
            Ok(())
        }
        daemon::DaemonResponse::Error { message } => {
            anyhow::bail!("Transcription failed: {}", message)
        }
        _ => anyhow::bail!("Unexpected response from daemon"),
    }
}
```

**Step 4: Run tests to verify they pass**

```bash
cargo test listen_tests 2>&1 | tail -15
```

Expected: all `listen_tests` pass.

**Step 5: Full build to confirm no regressions**

```bash
cargo build 2>&1 | tail -5
cargo test 2>&1 | tail -20
```

Expected: build succeeds, all existing tests still pass.

**Step 6: Commit**

```bash
git add src/main.rs
git commit -m "feat: implement mojovoice listen command with toggle, source selection, and 300s default timeout"
```

---

### Task 7: Manual end-to-end verification

**Step 1: Start the daemon**

```bash
RUSTFLAGS="-L /usr/lib64 -L /usr/local/lib/ollama" cargo build --release --features cuda
./target/release/mojovoice daemon up &
sleep 5
./target/release/mojovoice daemon status
```

Expected: `Status: Running`, `GPU: Enabled`

**Step 2: List available sources including monitors**

```bash
pactl list sources short
./target/release/mojovoice doctor
```

Confirm at least one `[Monitor]` source would be visible (check `pactl` output for `.monitor` entries).

**Step 3: Test listen toggle with default source**

```bash
# Terminal 1: start listen
./target/release/mojovoice listen
# Speak or play audio for a few seconds
# Terminal 2: stop listen
./target/release/mojovoice listen
```

Expected: transcription text is typed at cursor.

**Step 4: Test with explicit source**

```bash
# Find a monitor source name:
pactl list sources short | grep monitor

# Use it:
./target/release/mojovoice listen --source "alsa_output.pci-0000_00_1f.3.analog-stereo.monitor"
./target/release/mojovoice listen   # stop
```

**Step 5: Test error cases**

```bash
# Double-stop (should error clearly)
./target/release/mojovoice listen  # no session active

# Bad source name
./target/release/mojovoice listen --source "nonexistent-device-xyz"

# Daemon down
./target/release/mojovoice daemon down
./target/release/mojovoice listen  # should error: daemon not running
./target/release/mojovoice daemon up &
```

**Step 6: Confirm start/stop keybind still works independently**

```bash
./target/release/mojovoice start   # starts mic recording
./target/release/mojovoice start   # stops and transcribes
```

Expected: unaffected by listen changes.

**Step 7: Commit if any fixes were needed**

```bash
git add -p
git commit -m "fix: <describe any fixes>"
```

---

## Notes

- `STOP_RECORDING` is a process-global atomic. Since each `mojovoice` CLI invocation is a separate process, `listen_start` and a concurrent `start` (in the daemon process) each have their own copy — no interference.
- The `--source` flag accepts both display names (e.g. `"[Monitor] Speakers"`) and raw PipeWire source names (e.g. `alsa_output...monitor`) — `resolve_device_name()` in `audio/mod.rs` handles both.
- Waybar is intentionally NOT updated by `listen` (out of scope per design doc). Add later if desired.
