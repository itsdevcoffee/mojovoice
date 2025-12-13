# dev-voice: Complete Project Context

**Status:** Production-ready | **Platform:** Linux (Wayland/X11) | **License:** MIT

## Overview

Voice dictation CLI for Linux developers. Records audio, transcribes with Whisper (GPU-accelerated), pastes text at cursor with smart clipboard handling.

**Key differentiator:** Daemon mode keeps model loaded in GPU VRAM for instant responses.

## Architecture

### Core Components

```
┌─────────────────────────────────────┐
│  Daemon (persistent process)        │
│  - Whisper medium.en in GPU VRAM    │
│  - Unix socket server                │
│  - Background recording threads      │
└─────────────────────────────────────┘
           ↕ Unix socket IPC
┌─────────────────────────────────────┐
│  Client (dev-voice start/stop)      │
│  - Sends recording requests          │
│  - Outputs transcribed text          │
│  - Smart paste (terminal detection)  │
└─────────────────────────────────────┘
           ↓
┌─────────────────────────────────────┐
│  UI Integration                      │
│  - Waybar module (3 states)          │
│  - Hyprland keybindings              │
│  - Desktop notifications             │
└─────────────────────────────────────┘
```

### Technology Stack

**Core:**
- `whisper-rs` 0.15 - Speech recognition with CUDA support
- `pipewire` 0.9 - Audio capture (native Wayland)
- `serde_json` - Daemon protocol serialization

**Audio:**
- `rubato` 0.15 - High-quality resampling
- PipeWire streams - Real-time audio capture
- 16kHz mono - Whisper requirement

**System Integration:**
- `wtype` - Wayland text injection
- `wl-copy/wl-paste` - Clipboard management
- `hyprctl` - Window detection for smart paste
- `notify-send` - Desktop notifications

**GPU Acceleration:**
- CUDA 13.0+ (requires GCC 15 support)
- Vulkan backend (alternative, not used)

## Directory Structure

```
src/
├── main.rs              # CLI entry, command routing
├── lib.rs               # Module exports
├── daemon/
│   ├── mod.rs           # Daemon module exports
│   ├── server.rs        # Unix socket server, model lifecycle
│   ├── client.rs        # Client communication helpers
│   └── protocol.rs      # Request/response types
├── audio/
│   ├── mod.rs           # Audio module exports
│   └── capture.rs       # PipeWire recording, signal handling
├── transcribe/
│   └── whisper.rs       # Whisper model wrapper
├── output/
│   └── inject.rs        # Text injection, clipboard handling
├── state/
│   ├── paths.rs         # State directory management
│   └── toggle.rs        # PID file, signal handlers
├── model/
│   ├── download.rs      # HTTP model downloads
│   ├── verify.rs        # SHA256 checksum validation
│   └── registry.rs      # Known models metadata
└── config/
    └── settings.rs      # TOML config management

State files:
~/.local/state/dev-voice/
├── daemon.sock          # Unix socket (daemon mode)
├── recording.pid        # Active recording indicator
├── processing           # Transcription in progress
└── logs/                # Rotating daily logs
```

## Key Implementation Details

### 1. Daemon Mode (Primary Mode)

**Startup:**
```bash
dev-voice daemon &  # Loads model into VRAM, starts socket server
```

**Recording flow:**
1. Client sends `StartRecording` → daemon spawns background thread
2. Daemon creates PID file (for Waybar), returns immediately
3. Thread runs `capture_toggle()` → PipeWire audio capture
4. Client sends `StopRecording` → daemon signals thread
5. Thread waits 1 second (buffer), stops, returns audio samples
6. Daemon transcribes with persistent model, returns text
7. Client pastes text, daemon cleans up PID file

**Why daemon:**
- Model load: 200ms overhead eliminated
- GPU VRAM: Model stays resident (~1.5GB for medium.en)
- Startup: 66ms (just PipeWire) vs 266ms (model + PipeWire)

### 2. Audio Capture (PipeWire)

**Stream configuration:**
- Format: F32LE mono (converted from stereo in callback)
- Sample rate: 16kHz (Whisper requirement)
- Resampling: rubato (high-quality) if source ≠ 16kHz
- Autoconnect: connects to default input device

**Signal handling:**
- SIGUSR1 triggers stop via `sigaction()` (reliable, multithreaded-safe)
- Timer checks stop flag every 100ms (mainloop can quit even if no audio)
- 1-second buffer: continues recording after stop signal for trailing words

**Critical detail:** Must use `sigaction()` not `signal()` - latter is unreliable with PipeWire threads.

### 3. Text Injection (Smart Paste)

**Wayland flow:**
1. Save current clipboard with `wl-paste`
2. Copy transcription with `wl-copy`
3. Detect focused window via `hyprctl activewindow -j`
4. Parse JSON for window class (simple parser, no serde)
5. Paste: `wtype -M ctrl -M shift -k v` (terminals) or `wtype -M ctrl -k v` (others)
6. Restore original clipboard 50ms later

**Terminal detection:**
- Terminals use Ctrl+Shift+V: kitty, alacritty, foot, wezterm, etc.
- Other apps use Ctrl+V
- Hyprland-specific via `hyprctl` (won't work on other compositors)

**Clipboard preservation:** Critical UX feature - users often have URLs/code copied

### 4. Waybar Integration

**Status script:** `~/.config/waybar/scripts/dev-voice-status.sh`
- Returns JSON: `{"text": "icon", "tooltip": "...", "class": "state"}`
- Checks PID file + process validation
- 3 states: idle (󰍭), recording ( + timer), processing (󰑮)

**Module config:** `~/.config/waybar/modules`
```jsonc
"custom/dev-voice": {
    "exec": "/absolute/path/to/script.sh",
    "on-click": "dev-voice start &",  // & critical for non-blocking
    "interval": 1,
    "return-type": "json",
}
```

**CSS:** Uses existing `blink` animation (GTK CSS doesn't support custom @keyframes)

**Critical:** on-click MUST run commands with `&` - Waybar pauses interval polling during click handler

### 5. Hyprland Keybindings

**Config:** `~/.config/hypr/UserConfigs/UserKeybinds.conf`
```
$devVoiceEnv = PATH="/usr/local/cuda-13.0/bin:$PATH" LD_LIBRARY_PATH="/usr/local/cuda-13.0/lib64:$LD_LIBRARY_PATH"
bind = $mainMod, V, exec, $devVoiceEnv dev-voice start
bind = $mainMod SHIFT, V, exec, $devVoiceEnv dev-voice start -c
```

**Why inline env vars:** Hyprland doesn't source shell rc files, only reads .zshenv (but safer to be explicit)

**CUDA paths required:** Without these, model fails to load from keybindings

### 6. GPU Acceleration (CUDA)

**Requirements:**
- CUDA Toolkit 13.0+ (GCC 15 support required for Fedora 42)
- NVIDIA driver 580.00+ (user has 580.105.08)
- Build: `cargo build --release --features cuda`

**Model loading:**
- Whisper detects CUDA automatically
- Logs show: "use gpu = 1", "Device 0: NVIDIA GeForce RTX 4060 Ti"
- VRAM usage: base.en=147MB, medium.en=~1.5GB, large=~3GB

**Performance:**
- Base model: ~2s for 5s audio
- Medium model: ~4s for 5s audio (2x slower but 50% more accurate)
- Still feels instant due to GPU speed

## Configuration

**File:** `~/.config/dev-voice/config.toml`

```toml
[model]
path = "/home/maskkiller/.local/share/applications/dev-voice/models/ggml-medium.en.bin"
language = "en"

[audio]
sample_rate = 16000      # Whisper requirement
timeout_secs = 30        # Fixed duration mode timeout

[output]
append_space = true      # Add space after injected text
```

**Models available:**
- tiny.en (75MB) - fast, poor quality
- base.en (147MB) - good baseline
- small.en (466MB) - 30% better
- **medium.en (1.5GB)** - ⭐ current, 50% better
- large (3GB) - 60% better, multilingual

## Development Notes

### Building

```bash
# Standard build (CPU only)
cargo build --release

# With CUDA (required for production)
cargo build --release --features cuda

# With Vulkan (alternative GPU backend)
cargo build --release --features vulkan
```

### Dependencies (dnf)

```bash
# Wayland tools
sudo dnf install wtype wl-clipboard

# X11 tools (fallback)
sudo dnf install xdotool xclip

# CUDA (for GPU)
# Install CUDA Toolkit 13.0+ manually (not in Fedora repos)
```

### Signal Handling Gotcha

**WRONG:**
```rust
signal::signal(Signal::SIGUSR1, handler)  // Unreliable in multithreaded
```

**RIGHT:**
```rust
signal::sigaction(Signal::SIGUSR1, &sig_action)  // Reliable
```

PipeWire uses threads internally - `signal()` has undefined behavior.

### PID File Management

**Daemon mode:** Only daemon creates/deletes PID file
- Created: when background recording thread starts
- Contains: daemon process PID (not client PID)
- Deleted: after transcription completes
- Used by: Waybar for UI state, client for toggle detection

**Why daemon PID:** Client exits immediately, daemon persists

### Timer for Stop Signal

**Problem:** `mainloop.run()` blocks, signal sets flag but nothing checks it if no audio flows

**Solution:** Timer checks `should_stop()` every 100ms
```rust
let timer = mainloop.loop_().add_timer(move |_| {
    if should_stop() {
        ml.quit();
    }
});
timer.update_timer(
    Some(Duration::from_millis(100)),
    Some(Duration::from_millis(100)),
);
```

### 1-Second Buffer

**Why:** Users press stop immediately after speaking, cutting off last words

**Implementation:** Timer detects stop, waits 1s before quitting mainloop
```rust
if stop.is_none() {
    *stop = Some(Instant::now());  // Record stop time
    info!("Recording for 1 more second");
} else if stop_instant.elapsed() >= Duration::from_secs(1) {
    ml.quit();  // Actually stop
}
```

## User Environment

**System:**
- Fedora 42 (GCC 15.2.1)
- Hyprland 0.51.1 (Wayland compositor)
- NVIDIA driver 580.105.08
- RTX 4060 Ti 8GB (8.9 compute capability)

**Audio setup:**
- Blue Microphones USB (default source)
- PipeWire audio server
- Stereo source → converted to mono in capture

**Shell:** zsh with custom dotfiles

## Common Issues & Solutions

### Audio not capturing
**Symptom:** "No audio captured" after recording
**Fix:** Restart PipeWire
```bash
systemctl --user restart pipewire pipewire-pulse wireplumber
```

### Stop signal not working
**Cause:** No timer checking flag, or using `signal()` instead of `sigaction()`
**Fix:** Timer added (src/audio/capture.rs:396-422)

### Waybar icon not updating
**Cause:** on-click commands block polling
**Fix:** Add `&` to run commands in background

### CUDA build fails
**Cause:** GCC version incompatibility
**Fix:** Use CUDA 13.0+ (supports GCC 15)

### Daemon "Already recording" error
**Cause:** Daemon stuck in recording state from crashed client
**Fix:** Restart daemon: `pkill -f "dev-voice daemon" && dev-voice daemon &`

### Super+V doesn't work
**Cause:** Missing CUDA env vars in Hyprland context
**Fix:** Add inline env vars in keybindings (see section 5)

## Performance Characteristics

**First recording (cold start):**
- Model load: 200ms (only on daemon startup)
- Audio setup: 66ms (PipeWire stream)
- Recording: user duration + 1s buffer
- Transcription: ~0.4-0.8s per second of audio (medium.en on RTX 4060 Ti)

**Subsequent recordings (daemon running):**
- Audio setup: 66ms ← only this!
- Recording: user duration + 1s buffer
- Transcription: ~0.4-0.8s per second of audio

**Example:** 5s recording takes ~69ms to start + 5s recording + 1s buffer + 3s transcription = ~9s total

## Future Improvements

### Considered but not implemented:
- **Streaming transcription:** Whisper is batch-only, would need different model
- **Distil-Whisper:** 6x faster, 50% smaller, but whisper-rs compatibility unclear
- **LLM post-processing:** Grammar/punctuation fixes via Claude API
- **Auto-start daemon:** systemd user service
- **VAD (Voice Activity Detection):** Auto-start on speech, no key press needed

### Easy wins:
- Add `large` model support (3GB VRAM, +10% accuracy)
- Configurable buffer duration (currently hardcoded 1s)
- Multiple model profiles (fast/accurate modes)
- Noise reduction pre-processing

## Testing Scenarios

### Basic flow:
```bash
dev-voice daemon &       # Start daemon
dev-voice start          # Start recording (Waybar icon appears)
# speak: "this is a test"
dev-voice start          # Stop, transcribe, paste
# Should paste: "This is a test."
```

### Clipboard preservation:
```bash
echo "saved text" | wl-copy  # Save something
dev-voice start
# speak: "new text"
dev-voice start                # Pastes "New text."
wl-paste                       # Should output: "saved text"
```

### Terminal detection:
```bash
# In kitty:
dev-voice start → stop   # Should use Ctrl+Shift+V

# In browser:
dev-voice start → stop   # Should use Ctrl+V
```

### GPU persistence:
```bash
dev-voice daemon &
nvidia-smi | grep dev-voice  # Shows ~1500MB
dev-voice start → stop       # Do recording
nvidia-smi | grep dev-voice  # Still shows ~1500MB (model stayed loaded)
```

## Code Patterns

### Daemon protocol pattern:
```rust
// Client sends request
let request = DaemonRequest::StartRecording { max_duration: 300 };
let response = daemon::send_request(&request)?;

// Daemon handles in background thread
let handle = thread::spawn(move || {
    capture_toggle(max_duration, 16000)
});
```

### Audio capture pattern:
```rust
// Add timer to check stop signal (critical!)
let timer = mainloop.loop_().add_timer(move |_| {
    if should_stop() {
        ml.quit();
    }
});
```

### Terminal detection pattern:
```rust
// Get window class from Hyprland
let output = Command::new("hyprctl")
    .args(["activewindow", "-j"])
    .output()?;

// Simple JSON parsing (no serde overhead)
let class = extract_json_string(&json_str, "class");

// Check against known terminals
const TERMINALS: &[&str] = &["kitty", "alacritty", ...];
let is_terminal = TERMINALS.contains(&class);
```

## Critical Files

**Do not modify without understanding implications:**

1. **src/audio/capture.rs:396-422** - Timer that checks stop signal
   - Removal breaks stop functionality
   - 100ms interval is optimal (balance responsiveness/CPU)

2. **src/daemon/server.rs:145** - PID file creation in daemon
   - Must be in daemon, not client (client exits immediately)
   - Daemon PID must be in file (for process validation)

3. **src/output/inject.rs:91-151** - Clipboard save/restore
   - 50ms delay critical (paste must complete before restore)
   - Order matters: save → copy → paste → restore

4. **~/.config/hypr/UserConfigs/UserKeybinds.conf:44** - CUDA env vars
   - Required for keybindings to work
   - Hyprland doesn't source shell rc files

## Debug Commands

```bash
# Check daemon status
ls -la ~/.local/state/dev-voice/daemon.sock

# Check recording state
cat ~/.local/state/dev-voice/recording.pid

# View logs
tail -f ~/.local/state/dev-voice/logs/dev-voice.log.$(date +%Y-%m-%d)

# Check PipeWire audio
wpctl status | grep -A10 "Sources"

# Test audio capture
timeout 3s pw-record --target 48 /tmp/test.wav

# Check GPU usage
nvidia-smi | grep dev-voice

# Kill stuck daemon
pkill -f "dev-voice daemon"
```

## Environment Setup

**Required in .zshenv (for Hyprland):**
```bash
export PATH=/usr/local/cuda-13.0/bin:$PATH
export LD_LIBRARY_PATH=/usr/local/cuda-13.0/lib64:$LD_LIBRARY_PATH
```

**Build time:**
- Clean build: ~5 minutes
- Incremental: ~30-60 seconds
- CUDA linking adds ~10 seconds

## Git History Context

**Key commits:**
- `31fb834` - MVP implementation (CPU-only)
- `2bebac0` - Toggle mode, file logging
- `2005886` - Notifications, processing state
- `96fb342` - Smart clipboard paste with terminal detection
- `37b3757` - Timer for stop signal reliability
- `983c6e8` - Clipboard preservation
- `407cb18` - Daemon mode with GPU persistence

## Design Decisions

**Why Unix socket over TCP?**
- Faster (~1ms vs ~10ms localhost TCP)
- Automatic cleanup on daemon crash
- No port conflicts

**Why PID file instead of daemon state query?**
- Waybar needs file-based check (can't query daemon)
- Simple, works across restarts
- Compatible with existing toggle mode

**Why not streaming transcription?**
- Whisper is batch-only (processes complete audio segments)
- Streaming requires different model (DeepSpeech, Vosk)
- Batch + GPU is fast enough for dictation use case

**Why JSON protocol?**
- Human-readable for debugging
- Serde makes it trivial
- Overhead negligible for small messages

## Related Files (Outside Repo)

**Waybar:**
- `~/.config/waybar/scripts/dev-voice-status.sh` - Status indicator
- `~/.config/waybar/modules` - Module definition
- `~/.config/waybar/configs/[TOP] Minimal - Long` - Config integration
- `~/.config/waybar/style/[Colored] Translucent.css` - Styling

**Hyprland:**
- `~/.config/hypr/UserConfigs/UserKeybinds.conf` - Super+V bindings

These are user dotfiles, not part of the repo.

## Project Goals

**Primary:** Fast, accurate, local voice dictation for Linux developers
**Secondary:** Privacy (no cloud), GPU utilization, Wayland-first design
**Non-goals:** Streaming transcription, voice commands, multi-language (English only)

---

**Last updated:** 2025-12-13 | **Context complete** ✓
