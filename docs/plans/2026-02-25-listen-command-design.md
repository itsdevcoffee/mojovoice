# Design: `mojovoice listen` Command

**Date:** 2026-02-25
**Status:** Approved
**Branch:** memrl

## Problem

When pair-programming remotely over Discord, the user wants to transcribe their co-founder's spoken instructions without switching mic inputs manually or running a second daemon. The existing `mojovoice start` toggle captures the user's microphone only.

## Solution

A new `mojovoice listen [--source <name>] [--max-duration <secs>]` subcommand that:
- Captures audio from any PipeWire/ALSA source (including `.monitor` sources for application output)
- Toggles on second invocation (same UX as `mojovoice start`)
- Uses completely separate state from the existing `start` toggle — the two can run simultaneously
- Delegates transcription to the already-running daemon via the existing `TranscribeAudio` IPC message

## Architecture

`listen` is a **standalone CLI toggle**. The daemon is not involved during capture — only at the end for transcription.

```
First call:   mojovoice listen [--source <name>] [--max-duration 300]
                → writes ~/.local/state/mojovoice/listen.pid
                → opens audio stream from <source> (or system default)
                → blocks, polling STOP_RECORDING atomic every 100ms
                → auto-stops after max-duration (default 300s)

Second call:  mojovoice listen
                → reads listen.pid, finds PID
                → sends SIGUSR1 to that PID
                → exits 0

On stop (signal or timeout):
                → stops capture stream
                → removes listen.pid
                → sends TranscribeAudio { samples } to daemon socket
                → receives Success { text }
                → calls output::inject_text() → types at cursor
```

## Components

### New

| Component | Location | Description |
|---|---|---|
| `Commands::Listen { source, max_duration, clipboard }` | `src/main.rs` | New clap subcommand |
| `cmd_listen()` | `src/main.rs` | Toggle dispatcher — checks `listen.pid`, routes to start or stop |
| `cmd_listen_start(source, max_duration, output_mode)` | `src/main.rs` | Installs signal handler, runs `capture_toggle`, transcribes, injects |
| `cmd_listen_stop()` | `src/main.rs` | Reads `listen.pid`, sends SIGUSR1, exits |
| `get_listen_pid_file()` | `src/state/paths.rs` | Returns `{state_dir}/listen.pid` |
| `write_listen_pid()` / `clear_listen_pid()` | `src/state/paths.rs` or inline | Lifecycle for `listen.pid` |

### Reused Without Changes

| Component | Why reusable |
|---|---|
| `audio::capture_toggle(max_duration, rate, source)` | Already accepts source name and max duration |
| `state::toggle::setup_signal_handler()` + `should_stop()` | SIGUSR1 → `STOP_RECORDING` atomic, already wired |
| `audio::list_input_devices()` with monitor filter removed | Expose `.monitor` sources so Discord audio is selectable |
| `daemon::client::send_request(TranscribeAudio { samples })` | Existing IPC path |
| `output::inject_text(text, mode)` | Existing output path |

**No daemon changes required.**

## Monitor Source Exposure

`src/audio/mod.rs:list_pipewire_devices()` currently skips `.monitor` sources. To make Discord audio selectable, remove (or make optional) the filter at line 124:

```rust
// Before (skips monitor sources):
if source_name.ends_with(".monitor") {
    continue;
}

// After (include monitors with a label prefix):
let display_name = if source_name.ends_with(".monitor") {
    format!("[Monitor] {}", description)
} else {
    description
};
```

This change affects `list_input_devices()` which is called by both the UI device picker and the new `listen` command. The change is additive — it exposes more choices, does not remove any existing ones.

## Default Behavior

| Flag | Default | Notes |
|---|---|---|
| `--source` | system default input | same as `start` |
| `--max-duration` | `300` (5 minutes) | auto-stops and transcribes |
| `--clipboard` | `false` | type at cursor; `--clipboard` copies instead |

## Error Handling

| Scenario | Behavior |
|---|---|
| `--source <name>` not found | `setup_audio_device` returns error → print message + exit 1 |
| Second `mojovoice listen` with no `listen.pid` | "no listen session active" + exit 1 |
| `listen.pid` exists but process is dead (stale) | Remove stale file, print "stale listen session cleared" + exit 0 |
| Daemon not running when stop transcribes | "daemon not running — start it with `mojovoice daemon up`" + exit 1 |
| `start` and `listen` active simultaneously | Fully supported — separate PID files, separate signals, separate state |
| Max duration reached | Capture stops automatically, transcribes + injects same as manual stop |

## Testing Plan (TDD)

Tests to write **before** implementation:

1. `get_listen_pid_file()` returns a path distinct from `get_pid_file()`
2. `list_input_devices()` includes `.monitor` sources after filter change
3. `cmd_listen` with no `listen.pid` → calls start path (mocked capture)
4. `cmd_listen` with live `listen.pid` → sends SIGUSR1 to that PID
5. `cmd_listen` with stale `listen.pid` → clears file, reports stale
6. `resolve_device_name` matches a monitor source name
7. Max duration of 300s is passed to `capture_toggle` by default
8. `TranscribeAudio` IPC round-trip returns text (covered by existing daemon tests)

## What Does NOT Change

- `mojovoice start` / `stop` / `cancel` — untouched
- `recording.pid` — untouched
- Daemon IPC protocol — untouched
- Waybar refresh logic — `listen` does not update Waybar (out of scope)
- Settings UI — `--source` is a CLI flag only for now
