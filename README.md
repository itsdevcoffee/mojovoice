# dev-voice

**Voice-to-text dictation for developers.** Speak naturally, get accurate transcription, text appears at your cursor.

Fast, local, private. Works on Linux, macOS, and Windows. Powered by OpenAI Whisper with optional GPU acceleration.

---

## Features

- 🎤 **Toggle mode** - Press once to start, press again to stop and transcribe
- 🚀 **GPU acceleration** - CUDA (NVIDIA), Metal (Apple Silicon), ROCm (AMD)
- 🔒 **100% local** - No cloud, no API keys, no internet required
- ⚡ **Cross-platform** - Linux (Wayland/X11), macOS (Intel/ARM), Windows
- 🎯 **Cursor injection** - Text appears where you're typing
- 📋 **Clipboard mode** - Optional paste workflow
- 🔧 **Daemon mode** - Background service with instant response

---

## Quick Start

### 1. Download Pre-Built Binary

Choose your platform from the [latest release](https://github.com/itsdevcoffee/dev-voice/releases):

| Platform | Download | GPU Support | Requirements |
|----------|----------|-------------|--------------|
| **Linux (CPU)** | `dev-voice-linux-x64` | None | Works everywhere |
| **Linux (NVIDIA)** | `dev-voice-linux-x64-cuda` | CUDA | NVIDIA GPU + CUDA 12.x runtime |
| **macOS (M1/M2/M3/M4)** | `dev-voice-macos-arm64` | None | macOS 13+ |
| **macOS (M1+ GPU)** | `dev-voice-macos-15-arm64-metal` | Metal | macOS 15+ on Apple Silicon |
| **macOS (Intel)** | `dev-voice-macos-intel` | None | macOS 13-26, Intel Macs |

**Alternatively**, download from GitHub Actions artifacts:
```bash
gh run download <run-id> -n <artifact-name>
```

### 2. Make Executable
```bash
chmod +x dev-voice
```

### 3. Download a Model
```bash
./dev-voice download base.en
```

### 4. Start Daemon
```bash
./dev-voice daemon
```

### 5. Use It
```bash
# In another terminal:
./dev-voice start    # Start recording
# Speak...
./dev-voice stop     # Stop and transcribe
```

Text appears at your cursor!

---

## Platform-Specific Setup

### Linux

#### **Wayland** (Fedora, Ubuntu 22.04+, most modern distros)

**System dependencies:**
```bash
# Fedora/RHEL
sudo dnf install alsa-lib-devel libxkbcommon-devel

# Ubuntu/Debian
sudo apt install libasound2-dev libxkbcommon-dev
```

**Runtime (clipboard mode only):**
```bash
sudo dnf install wl-clipboard      # Fedora
sudo apt install wl-clipboard      # Ubuntu
```

Works out of the box with default build.

#### **X11** (Older systems)

**If using X11 instead of Wayland**, install xclip for clipboard mode:
```bash
sudo dnf install xclip    # Fedora
sudo apt install xclip    # Ubuntu
```

**Note:** X11 requires rebuilding from source with `features = ["x11rb"]` in Cargo.toml line 80.

#### **CUDA (NVIDIA GPUs)**

**Download:** `dev-voice-linux-x64-cuda`

**Requirements:**
- NVIDIA GPU (GTX 10xx series or newer)
- CUDA Runtime 12.x ([download](https://developer.nvidia.com/cuda-downloads))

**Test CUDA is available:**
```bash
nvidia-smi
```

**Run with CUDA libraries:**
```bash
# If CUDA not in system path:
LD_LIBRARY_PATH=/usr/local/cuda/lib64:$LD_LIBRARY_PATH ./dev-voice daemon

# Or add to ~/.bashrc:
export LD_LIBRARY_PATH=/usr/local/cuda/lib64:$LD_LIBRARY_PATH
```

**Performance:** ~5-10x faster transcription vs CPU

---

### macOS

#### **Apple Silicon (M1/M2/M3/M4)**

**Download:**
- `dev-voice-macos-arm64` (CPU-only, universal)
- `dev-voice-macos-15-arm64-metal` (GPU acceleration, macOS 15+)

**Permissions:** On first run, macOS will ask for microphone and accessibility permissions:
1. **Microphone** - Required for audio capture
2. **Accessibility** - Required for text injection

Grant both in System Settings → Privacy & Security.

**Metal GPU acceleration:**
- macOS 15 (Sequoia) or newer recommended
- Works on macOS 13-14 with `macos-14-arm64-metal` variant
- 2-3x faster transcription vs CPU
- Model automatically loads to GPU VRAM

#### **Intel Macs**

**Download:** `dev-voice-macos-intel`

**Supported versions:** macOS 13 (Ventura) through macOS 26 (Tahoe)

**Note:** macOS 26 is the final Intel-supported version. No GPU acceleration available on Intel Macs.

---

### Windows

**Status:** Code ready, binaries not yet provided.

**Dependencies in Cargo.toml** (lines 74-75) support Windows via native SendInput API.

**To build from source on Windows:**
```bash
cargo build --release
```

---

## GPU Acceleration Guide

### **NVIDIA GPUs (Linux only)**

**Hardware:** GTX 10xx series or newer
**Software:** CUDA Toolkit 12.x
**Binary:** `dev-voice-linux-x64-cuda`
**Speedup:** 5-10x faster than CPU

**Install CUDA:**
```bash
# Check if installed
nvidia-smi

# Download from NVIDIA if needed
# https://developer.nvidia.com/cuda-downloads
```

### **Apple Silicon (macOS only)**

**Hardware:** M1, M2, M3, M4 (any Mac with Apple Silicon)
**Software:** macOS 15+ recommended (works on 13-14)
**Binary:** `dev-voice-macos-15-arm64-metal`
**Speedup:** 2-3x faster than CPU

**No installation needed** - Metal is built into macOS.

### **AMD GPUs (Advanced)**

**Binary:** Not provided (build from source)
**Software:** ROCm 5.0+
**Build command:**
```bash
cargo build --release --features rocm
```

**Note:** ROCm setup is complex. See [ROCm documentation](https://rocm.docs.amd.com/).

---

## Building from Source

### Prerequisites

**All platforms:**
- Rust 1.85+ ([install](https://rustup.rs/))
- CMake 3.14+
- Clang/LLVM

**Platform-specific:**
```bash
# Linux (Fedora)
sudo dnf install cmake clang alsa-lib-devel libxkbcommon-devel

# Linux (Ubuntu/Debian)
sudo apt install cmake clang libasound2-dev libxkbcommon-dev pkg-config

# macOS
brew install cmake

# Windows
# Install Visual Studio Build Tools + CMake
```

### Build Commands

```bash
# Clone repository
git clone https://github.com/itsdevcoffee/dev-voice.git
cd dev-voice

# CPU-only (default, works everywhere)
cargo build --release

# With GPU acceleration
cargo build --release --features cuda    # NVIDIA
cargo build --release --features metal   # Apple Silicon
cargo build --release --features rocm    # AMD
cargo build --release --features vulkan  # Cross-platform Vulkan

# Binary output
./target/release/dev-voice
```

---

## Usage

### Daemon Mode (Recommended)

**Start background service:**
```bash
dev-voice daemon
```

**In another terminal:**
```bash
dev-voice start      # Begin recording
# Speak your text...
dev-voice stop       # Transcribe and inject
```

### One-Shot Mode

**Record for fixed duration:**
```bash
dev-voice once --duration 10    # Record 10 seconds, then transcribe
```

### Download Models

**First time setup:**
```bash
# Tiny (fast, less accurate, 75MB)
dev-voice download tiny.en

# Base (balanced, 148MB) - Recommended
dev-voice download base.en

# Small (more accurate, 488MB)
dev-voice download small.en
```

**Available models:** `tiny`, `tiny.en`, `base`, `base.en`, `small`, `small.en`

---

## Configuration

**Config file:** `~/.config/dev-voice/config.toml` (auto-created)

```toml
[model]
path = "~/.local/share/dev-voice/models/ggml-base.en.bin"
language = "en"

[audio]
sample_rate = 16000    # Don't change - uses device default, resamples automatically
timeout_secs = 30

[output]
append_space = true
```

**Note:** Audio capture now uses device's native configuration (e.g., 48kHz stereo) and automatically converts to Whisper's required 16kHz mono. No manual configuration needed.

---

## Keyboard Shortcuts

### Linux (Hyprland/Sway)

Add to `~/.config/hypr/hyprland.conf`:
```ini
bind = SUPER, V, exec, dev-voice start --duration 10
bind = SUPER SHIFT, V, exec, dev-voice start -c  # Clipboard mode
```

### macOS

Use system keyboard shortcuts or tools like [Karabiner](https://karabiner-elements.pqrs.org/).

---

## Troubleshooting

### macOS Permissions

**Microphone permission denied:**
1. Open System Settings → Privacy & Security → Microphone
2. Enable for Terminal (or your terminal app)

**Text injection not working:**
1. Open System Settings → Privacy & Security → Accessibility
2. Enable for Terminal (or your terminal app)

### Linux Audio Issues

**No audio device found:**
```bash
# Check if ALSA sees your microphone
arecord -l

# Test recording
arecord -d 5 test.wav
```

**Wayland text injection not working:**
- Verify you're using Wayland: `echo $XDG_SESSION_TYPE`
- Ensure compositor supports text injection (Hyprland, Sway, KDE work)

### CUDA Issues

**Library not found (`libcudart.so.12`):**
```bash
# Add CUDA to library path
export LD_LIBRARY_PATH=/usr/local/cuda/lib64:$LD_LIBRARY_PATH

# Or if using Ollama's CUDA:
export LD_LIBRARY_PATH=/usr/local/lib/ollama:$LD_LIBRARY_PATH

# Add to ~/.bashrc to make permanent
echo 'export LD_LIBRARY_PATH=/usr/local/cuda/lib64:$LD_LIBRARY_PATH' >> ~/.bashrc
```

**Verify GPU is being used:**
Look for this in daemon logs:
```
whisper_backend_init_gpu: using CUDA0 backend
INFO Model loaded and resident in GPU VRAM
```

---

## Platform Compatibility

### Supported Platforms

| OS | Architecture | Versions | Status | GPU |
|----|--------------|----------|--------|-----|
| **Linux** | x86_64 | Any modern distro | ✅ Tested | CUDA, ROCm, Vulkan |
| **macOS** | Apple Silicon (ARM64) | 13 (Ventura) - 26 (Tahoe) | ✅ Tested | Metal |
| **macOS** | Intel (x86_64) | 13 (Ventura) - 26 (Tahoe) | ✅ Tested | None |
| **Windows** | x86_64 | 10/11 | 🟡 Code ready, untested | None yet |

### Tested Configurations

- ✅ **Fedora 42** (Wayland) - Primary development platform
- ✅ **Ubuntu 24.04** (Wayland) - CI tested
- ✅ **macOS 26 Tahoe** (Apple Silicon) - User tested
- ✅ **macOS 14/15** (Apple Silicon) - CI tested
- ✅ **macOS 15** (Intel) - CI tested

---

## Architecture

```
┌─────────────┐
│ dev-voice   │  CLI commands (start, stop, daemon, download)
│   (client)  │
└──────┬──────┘
       │ Unix socket
       ↓
┌─────────────┐
│   daemon    │  Background service
│             │
├─────────────┤
│ Audio       │  CPAL → Device native config (48kHz stereo)
│ Capture     │  Convert → 16kHz mono for Whisper
├─────────────┤
│ Whisper     │  Speech recognition
│ Inference   │  GPU: CUDA/Metal/ROCm | CPU: Fallback
├─────────────┤
│ Text        │  enigo → Direct typing (cross-platform)
│ Injection   │  OR clipboard → wl-copy/xclip/arboard
└─────────────┘
```

**Key improvements in v0.2.0:**
- **Audio:** PipeWire → CPAL (cross-platform, automatic device config)
- **Text injection:** wtype/xdotool → enigo (cross-platform, reliable)
- **GPU:** Added Metal (macOS), improved CUDA support

---

## Advanced Usage

### Clipboard Mode (Linux)

**Requires:** `wl-clipboard` (Wayland) or `xclip` (X11)

```bash
dev-voice start -c --duration 10
```

Text goes to clipboard instead of typing directly. Useful for:
- Pasting into terminals that block input simulation
- Reviewing transcription before pasting
- Clipboard-based workflows

### Environment Variables

```bash
# Verbose logging
RUST_LOG=debug dev-voice daemon

# Override model path
MODEL_PATH=~/custom/model.bin dev-voice start

# CUDA library path
LD_LIBRARY_PATH=/custom/cuda/lib64:$LD_LIBRARY_PATH dev-voice daemon
```

### Systemd Service (Linux)

Create `~/.config/systemd/user/dev-voice.service`:
```ini
[Unit]
Description=dev-voice daemon
After=default.target

[Service]
ExecStart=%h/.local/bin/dev-voice daemon
Restart=on-failure
Environment="RUST_LOG=info"

[Install]
WantedBy=default.target
```

Enable:
```bash
systemctl --user enable --now dev-voice
```

---

## Development

### Running Tests
```bash
cargo test
```

### Code Quality
```bash
cargo clippy
cargo fmt --all
```

### CI/CD

**Full multi-platform CI** with GitHub Actions:
- ✅ 17 test jobs across Linux, macOS ARM, macOS Intel
- ✅ 6 artifact builds (CPU + GPU variants)
- ✅ Linting, formatting, code coverage
- ✅ CUDA builds via NVIDIA container
- ✅ Metal builds on macOS runners

See `.github/workflows/ci.yml` for details.

---

## Technical Details

### Audio Processing

**Input:** Device native format (typically 48kHz stereo on macOS, 44.1kHz on Linux)
**Processing:**
1. Capture at device's default config (avoids "unsupported configuration" errors)
2. Convert stereo → mono (average channels)
3. Resample to 16kHz (Whisper requirement)
4. Pass to Whisper model

**Why this approach?**
- ✅ Works on macOS 26+ (requires device defaults)
- ✅ Compatible across all platforms
- ✅ Avoids audio configuration errors
- ✅ Higher quality source before downsampling

### Text Injection

**Type mode (default):**
- Uses `enigo` library for cross-platform text typing
- Simulates keyboard events directly
- Works on Wayland, X11, macOS (CoreGraphics), Windows (SendInput)
- ~100ms delay for typical sentences

**Clipboard mode (`-c` flag):**
- Linux: Uses `wl-copy` (Wayland) or `xclip` (X11) subprocess
- macOS/Windows: Uses `arboard` native clipboard API
- Text persists in clipboard for manual pasting

### GPU Acceleration

**CUDA (NVIDIA):**
- Compiles with `--features cuda`
- Requires CUDA 12.x runtime at runtime
- Uses cuBLAS for matrix operations
- Model loaded to GPU VRAM
- ~5-10x speedup vs CPU

**Metal (Apple Silicon):**
- Compiles with `--features metal`
- Built into macOS, no installation needed
- Uses Metal Performance Shaders
- Model loaded to unified memory
- ~2-3x speedup vs CPU

**Fallback:**
- CPU-only builds use optimized CPU inference
- Still fast enough for real-time transcription
- Base model: ~2-3 seconds for 10-second audio on modern CPUs

---

## FAQ

**Q: Why does it ask for accessibility permissions on macOS?**
A: Text injection requires accessibility access to send keyboard events to other applications.

**Q: Does this work offline?**
A: Yes! 100% local. Models stored at `~/.local/share/dev-voice/models/`.

**Q: Which model should I use?**
A: Start with `base.en` (148MB) - good balance of speed and accuracy. Upgrade to `small.en` if you need better accuracy.

**Q: Can I use this in my IDE/terminal/browser?**
A: Yes! Text injection works in any application that accepts keyboard input.

**Q: What about privacy?**
A: All processing happens locally. No data sent to cloud. No telemetry.

**Q: Why does CUDA binary require `LD_LIBRARY_PATH`?**
A: CUDA libraries are dynamically linked. This is standard for GPU applications. Set it once in your shell config.

**Q: Does this work on Wayland?**
A: Yes! Tested on Hyprland, Sway, and other Wayland compositors.

---

## Performance Comparison

**Base model (`ggml-base.en.bin`), 10-second audio clip:**

| Hardware | Time | Speedup |
|----------|------|---------|
| CPU (AMD Ryzen 7) | ~3.0s | 1x |
| CPU (Apple M1) | ~2.2s | 1.4x |
| NVIDIA RTX 4060 Ti (CUDA) | ~0.5s | **6x** |
| Apple M2 (Metal) | ~1.0s | **3x** |

*Your mileage may vary based on hardware, model size, and audio length.*

---

## Breaking Changes

### v0.2.0 (Phase 4 - Cross-Platform Migration)

**Audio capture:**
- ❌ Removed PipeWire-specific code
- ✅ Added CPAL (cross-platform)
- ✅ Automatic device configuration handling

**Text injection:**
- ❌ Removed wtype/xdotool (Linux-only)
- ✅ Added enigo (cross-platform)
- ⚠️ Type mode no longer preserves clipboard (use `-c` flag if needed)

**Platform support:**
- ✅ Added macOS support (Intel and Apple Silicon)
- ✅ Added Windows code (binaries coming soon)
- ✅ Improved Linux compatibility (Wayland and X11)

---

## Contributing

Contributions welcome! Please:
1. Run `cargo test` before submitting
2. Run `cargo clippy` and `cargo fmt`
3. Update docs if adding features
4. Test on your platform if possible

---

## License

MIT License - see [LICENSE](LICENSE) file.

---

## Acknowledgments

- [whisper.cpp](https://github.com/ggml-org/whisper.cpp) - High-performance Whisper inference
- [CPAL](https://github.com/rustaudio/cpal) - Cross-platform audio
- [enigo](https://github.com/enigo-rs/enigo) - Cross-platform input simulation
- OpenAI Whisper team - Speech recognition model

---

**Built with ❤️ for developers who think faster than they type.**
