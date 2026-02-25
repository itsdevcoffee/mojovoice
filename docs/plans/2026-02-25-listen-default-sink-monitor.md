# Listen Default Sink Monitor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** When `mojovoice listen` is run without `--source`, automatically capture from the monitor of the current default PipeWire sink instead of the microphone.

**Architecture:** Add a `get_default_sink_monitor()` helper to `src/audio/mod.rs` (Linux-only, alongside existing `get_pipewire_default_source()`). In `cmd_listen_start` in `src/main.rs`, use `Option::or_else` to fall back to the auto-detected monitor when no `--source` is given. On non-Linux platforms the behavior is unchanged (default mic).

**Tech Stack:** Rust, `pactl get-default-sink` (PipeWire/PulseAudio CLI), existing `audio` module patterns.

---

### Task 1: `get_default_sink_monitor()` helper

**Files:**
- Modify: `src/audio/mod.rs` (add after `get_pipewire_default_source()` at line ~237)

**Step 1: Write the failing test**

Add inside `#[cfg(test)] mod tests` in `src/audio/mod.rs`:

```rust
#[test]
#[cfg(target_os = "linux")]
fn test_get_default_sink_monitor_returns_monitor_suffix() {
    // On any Linux system with PipeWire/PulseAudio, the result should
    // either be None (pactl unavailable) or Some(s) where s ends with ".monitor"
    match get_default_sink_monitor() {
        Some(source) => assert!(
            source.ends_with(".monitor"),
            "expected .monitor suffix, got: {}",
            source
        ),
        None => println!("pactl unavailable or no default sink — skipping assertion"),
    }
}
```

**Step 2: Run test to verify it fails**

```bash
cd /home/maskkiller/dev-coffee/repos/dev-voice && cargo test test_get_default_sink_monitor 2>&1 | tail -5
```

Expected: compile error — `get_default_sink_monitor` not found.

**Step 3: Implement the function**

Add directly after `get_pipewire_default_source()` (after line 237 in `src/audio/mod.rs`):

```rust
/// Get the monitor source for the current default PipeWire/PulseAudio sink.
/// Returns e.g. "bluez_output.XX_XX_XX.1.monitor" for the active headphones.
/// Returns None if pactl is unavailable or no default sink is set.
#[cfg(target_os = "linux")]
pub fn get_default_sink_monitor() -> Option<String> {
    use std::process::Command;

    let output = Command::new("pactl")
        .args(["get-default-sink"])
        .output()
        .ok()?;

    if !output.status.success() {
        return None;
    }

    let sink = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if sink.is_empty() {
        return None;
    }

    Some(format!("{}.monitor", sink))
}
```

**Step 4: Run test to verify it passes**

```bash
cd /home/maskkiller/dev-coffee/repos/dev-voice && cargo test test_get_default_sink_monitor 2>&1 | tail -5
```

Expected: `test audio::tests::test_get_default_sink_monitor_returns_monitor_suffix ... ok`

**Step 5: Commit**

```bash
cd /home/maskkiller/dev-coffee/repos/dev-voice && git add src/audio/mod.rs && git commit -m "feat: add get_default_sink_monitor() to auto-detect PipeWire output monitor"
```

---

### Task 2: Wire up default sink monitor in `cmd_listen_start`

**Files:**
- Modify: `src/main.rs` — `cmd_listen_start` function and `listen_tests` module

**Step 1: Write the failing test**

Add inside `listen_tests` in `src/main.rs`:

```rust
#[test]
#[cfg(target_os = "linux")]
fn test_cmd_listen_start_auto_detects_monitor_source() {
    // When no --source is given, the status message should mention
    // a .monitor source (not "default input") on Linux with PipeWire.
    // We test the source resolution logic directly.
    let resolved = audio::get_default_sink_monitor();
    if let Some(ref source) = resolved {
        assert!(
            source.ends_with(".monitor"),
            "auto-detected source should end with .monitor, got: {}",
            source
        );
    }
    // If None, pactl is unavailable — acceptable fallback
}
```

**Step 2: Run test to verify it passes already** (it tests `get_default_sink_monitor` directly — will pass once Task 1 is done)

```bash
cd /home/maskkiller/dev-coffee/repos/dev-voice && cargo test test_cmd_listen_start_auto_detects 2>&1 | tail -5
```

Expected: passes (or compile error if Task 1 not done yet — do Task 1 first).

**Step 3: Apply the source resolution change in `cmd_listen_start`**

In `src/main.rs`, find `cmd_listen_start`. After the `daemon::is_daemon_running()` guard and `config::load()`, add the Linux-specific source resolution block. The change is a single `#[cfg]` block that replaces `None` with the auto-detected monitor when available.

Find this section (around line 1036–1041):

```rust
    if !daemon::is_daemon_running() {
        anyhow::bail!("daemon is not running — start it first with: mojovoice daemon up");
    }

    let cfg = config::load()?;
    let output_mode = output_mode_from_clipboard(clipboard);
```

Add the resolution block immediately after `config::load()`:

```rust
    if !daemon::is_daemon_running() {
        anyhow::bail!("daemon is not running — start it first with: mojovoice daemon up");
    }

    let cfg = config::load()?;
    let output_mode = output_mode_from_clipboard(clipboard);

    // On Linux: default to monitor of current default sink (captures app audio like Discord)
    // when no explicit --source is given. Falls back to default mic if pactl unavailable.
    #[cfg(target_os = "linux")]
    let source = source.or_else(|| audio::get_default_sink_monitor());
```

**Step 4: Build to verify no compile errors**

```bash
cd /home/maskkiller/dev-coffee/repos/dev-voice && cargo build 2>&1 | tail -5
```

Expected: `Finished` — no errors.

**Step 5: Run all listen tests**

```bash
cd /home/maskkiller/dev-coffee/repos/dev-voice && cargo test listen_tests 2>&1 | tail -10
```

Expected: all listen tests pass.

**Step 6: Run full test suite**

```bash
cd /home/maskkiller/dev-coffee/repos/dev-voice && cargo test 2>&1 | tail -10
```

Expected: 0 failures.

**Step 7: Smoke test — verify the status message shows the monitor source**

```bash
cd /home/maskkiller/dev-coffee/repos/dev-voice && cargo build 2>&1 | tail -3
# Start listen without --source, check the printed message
# It should say "Listening on bluez_output.XX...monitor" not "Listening on default input"
./target/debug/mojovoice listen &
sleep 1
./target/debug/mojovoice listen
```

Expected: first invocation prints `Listening on bluez_output.<mac>.1.monitor. Run 'mojovoice listen' again to stop (max 300s).`

**Step 8: Commit**

```bash
cd /home/maskkiller/dev-coffee/repos/dev-voice && git add src/main.rs && git commit -m "feat: mojovoice listen defaults to default sink monitor on Linux"
```
