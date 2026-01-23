# Mojo Voice

<div align="center">

**Voice-to-text for developers who think faster than they type.**

[![Version](https://img.shields.io/github/v/release/itsdevcoffee/mojovoice?label=version)](https://github.com/itsdevcoffee/mojovoice/releases/latest)
[![License](https://img.shields.io/github/license/itsdevcoffee/mojovoice)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-linux%20%7C%20macos-blue)]()
[![Rust](https://img.shields.io/badge/rust-1.85-orange)]()

Fast • Local • Private • GPU-Accelerated

[Quick Start](#-quick-start) • [Features](#-features) • [Models](#-models) • [Documentation](#-documentation)

</div>

---

## What is Mojo Voice?

Mojo Voice is a **privacy-first voice dictation tool** that runs 100% locally on your machine. Press a hotkey, speak naturally, and your words appear at your cursor — no cloud, no latency, no subscriptions.

Built in Rust. Powered by OpenAI Whisper. Ships with a native desktop app.

---

## 🚀 Quick Start

### 1. Download

**Linux (NVIDIA GPU)** — Recommended for fastest performance:
```bash
curl -LO https://github.com/itsdevcoffee/mojovoice/releases/latest/download/mojovoice-linux-x64-cuda.tar.gz
tar -xzf mojovoice-linux-x64-cuda.tar.gz
sudo mv mojovoice /usr/local/bin/
```

<details>
<summary><strong>Other platforms</strong></summary>

**Linux (CPU only):**
```bash
curl -LO https://github.com/itsdevcoffee/mojovoice/releases/latest/download/mojovoice-linux-x64.tar.gz
tar -xzf mojovoice-linux-x64.tar.gz
sudo mv mojovoice /usr/local/bin/
```

**macOS (Apple Silicon):**
```bash
curl -LO https://github.com/itsdevcoffee/mojovoice/releases/latest/download/mojovoice-macos-arm64.tar.gz
tar -xzf mojovoice-macos-arm64.tar.gz
sudo mv mojovoice /usr/local/bin/
```

**macOS (Intel):**
```bash
curl -LO https://github.com/itsdevcoffee/mojovoice/releases/latest/download/mojovoice-macos-intel.tar.gz
tar -xzf mojovoice-macos-intel.tar.gz
sudo mv mojovoice /usr/local/bin/
```

</details>

### 2. Download a Model

```bash
mojovoice download large-v3-turbo    # 1.6 GB - Best quality + fast
# OR
mojovoice download base.en           # 148 MB - Quick start, English only
```

### 3. Start the Daemon

```bash
mojovoice daemon up
```

### 4. Transcribe

```bash
mojovoice start    # Begin recording
# Speak: "Hello world, this is a test"
mojovoice stop     # Transcribe and type at cursor
```

**That's it.** Text appears wherever your cursor is.

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| **GPU Accelerated** | CUDA (NVIDIA), Metal (Apple Silicon), ROCm (AMD) — 5-10x faster than CPU |
| **100% Local** | Your voice never leaves your machine. Works offline. |
| **Desktop App** | Native Tauri UI with dashboard, model manager, and settings |
| **31 Whisper Models** | From tiny (78 MB) to large-v3 (3.1 GB), including quantized variants |
| **Transcription History** | Searchable history with copy/export functionality |
| **Waybar Integration** | Real-time status indicator for Hyprland/Sway users |
| **Sub-500ms Latency** | Daemon mode keeps the model loaded for instant response |

---

## 🖥️ Desktop App

Mojo Voice includes a full desktop application built with Tauri. **Download and run — no CLI needed.**

### Download Desktop App

| Platform | Download |
|----------|----------|
| Linux | [MojoVoice-linux-x64.AppImage](https://github.com/itsdevcoffee/mojovoice/releases/latest/download/MojoVoice-linux-x64.AppImage) |
| Linux (Debian/Ubuntu) | [MojoVoice-linux-x64.deb](https://github.com/itsdevcoffee/mojovoice/releases/latest/download/MojoVoice-linux-x64.deb) |
| macOS (Apple Silicon) | [MojoVoice-macos-arm64.dmg](https://github.com/itsdevcoffee/mojovoice/releases/latest/download/MojoVoice-macos-arm64.dmg) |
| macOS (Intel) | [MojoVoice-macos-intel.dmg](https://github.com/itsdevcoffee/mojovoice/releases/latest/download/MojoVoice-macos-intel.dmg) |

### Features

- **Dashboard** — Record button, daemon controls, live status
- **Model Manager** — Download, switch, and delete models with visual quality/speed indicators
- **Settings** — Audio device selection, language, recording timeout, UI scaling
- **History** — Browse and search past transcriptions
- **DevTools** — Export diagnostics, view logs

---

## 🎯 Models

### Recommended Picks

| Model | Size | Speed | Quality | Best For |
|-------|------|-------|---------|----------|
| `large-v3-turbo` | 1.6 GB | ⚡⚡⚡⚡ | ⭐⭐⭐⭐⭐ | **Best overall** — Fast + accurate |
| `distil-large-v3` | 1.5 GB | ⚡⚡⚡⚡⚡ | ⭐⭐⭐⭐ | Maximum speed |
| `base.en` | 148 MB | ⚡⚡⚡ | ⭐⭐⭐ | Quick start, English only |
| `tiny.en` | 78 MB | ⚡⚡⚡⚡⚡ | ⭐⭐ | Testing, low resources |

### All Available Models

<details>
<summary>View all 31 models</summary>

**Large V3 Turbo:**
- `large-v3-turbo` (1625 MB) — Recommended
- `large-v3-turbo-q5_0` (547 MB) — Quantized
- `large-v3-turbo-q8_0` (834 MB) — Quantized

**Distil-Whisper:**
- `distil-large-v3.5` (1449 MB)
- `distil-large-v3` (1520 MB)
- `distil-large-v2` (1449 MB)
- `distil-medium.en` (757 MB) — English only
- `distil-small.en` (321 MB) — English only

**Large:**
- `large-v3` (3100 MB)
- `large-v3-q5_0` (1031 MB)
- `large-v2` (2950 MB)
- `large-v2-q5_0` (1031 MB)
- `large-v1` (2950 MB)

**Medium:**
- `medium` (1463 MB)
- `medium.en` (1530 MB) — English only
- `medium-q5_0` (514 MB)
- `medium.en-q5_0` (514 MB) — English only

**Small:**
- `small` (488 MB)
- `small.en` (488 MB) — English only
- `small-q5_1` (181 MB)
- `small.en-q5_1` (181 MB) — English only

**Base:**
- `base` (148 MB)
- `base.en` (148 MB) — English only
- `base-q5_1` (57 MB)
- `base.en-q5_1` (57 MB) — English only

**Tiny:**
- `tiny` (78 MB)
- `tiny.en` (78 MB) — English only
- `tiny-q5_1` (31 MB)
- `tiny.en-q5_1` (31 MB) — English only

</details>

---

## 💻 CLI Reference

| Command | Description |
|---------|-------------|
| `mojovoice start` | Begin recording (use with hotkey) |
| `mojovoice stop` | Stop recording and transcribe |
| `mojovoice cancel` | Cancel recording without transcribing |
| `mojovoice daemon up` | Start the daemon |
| `mojovoice daemon down` | Stop the daemon |
| `mojovoice daemon restart` | Restart the daemon |
| `mojovoice daemon status` | Check daemon status |
| `mojovoice daemon logs -f` | Follow daemon logs |
| `mojovoice download <model>` | Download a Whisper model |
| `mojovoice config --check` | Validate configuration |
| `mojovoice doctor` | Check system dependencies |
| `mojovoice benchmark` | Run performance benchmark |

### Options

```bash
mojovoice start -c              # Copy to clipboard instead of typing
mojovoice start -d 10           # Record for exactly 10 seconds
mojovoice daemon logs -n 50     # Show last 50 log lines
mojovoice benchmark --report    # Generate HTML benchmark report
```

---

## ⚙️ Configuration

Config file: `~/.config/mojovoice/config.toml`

```toml
[model]
model_id = "large-v3-turbo"
language = "en"
# Optional: bias transcription toward technical terms
prompt = "async, await, rust, cargo, kubernetes, docker"

[audio]
sample_rate = 16000
timeout_secs = 180        # Max recording duration
# device_name = "default"  # Uncomment to specify audio device

[output]
append_space = true
refresh_command = "pkill -RTMIN+8 waybar"  # Update status bar

[history]
max_entries = 1000
```

---

## 🖥️ Platform Support

| Platform | Architecture | GPU | Status |
|----------|--------------|-----|--------|
| Linux | x86_64 | CUDA (NVIDIA) | ✅ Tested |
| Linux | x86_64 | ROCm (AMD) | 🟡 Untested |
| Linux | x86_64 | CPU | ✅ Tested |
| macOS | Apple Silicon | Metal | ✅ Tested |
| macOS | Intel | CPU | ✅ Tested |
| Windows | x86_64 | — | 🟡 Planned |

**Tested on:** Fedora 42, Ubuntu 24.04, macOS 14-15

---

## 🔌 Integrations

### Waybar (Hyprland/Sway)

Real-time status indicator showing: Offline → Idle → Recording → Processing

```bash
cd integrations/waybar
./install.sh
```

See [integrations/waybar/README.md](integrations/waybar/README.md) for details.

### Hyprland Keybinds

```conf
# ~/.config/hypr/hyprland.conf
bind = SUPER, V, exec, mojovoice start
bind = SUPER SHIFT, V, exec, mojovoice stop
bind = SUPER, Escape, exec, mojovoice cancel
```

### Systemd Service

```bash
# Create user service
mkdir -p ~/.config/systemd/user
cat > ~/.config/systemd/user/mojovoice.service << 'EOF'
[Unit]
Description=Mojo Voice Daemon
After=graphical-session.target

[Service]
ExecStart=/usr/local/bin/mojovoice daemon up
ExecStop=/usr/local/bin/mojovoice daemon down
Restart=on-failure

[Install]
WantedBy=default.target
EOF

systemctl --user enable --now mojovoice
```

---

## 🛠️ Building from Source

```bash
git clone https://github.com/itsdevcoffee/mojovoice.git
cd mojovoice

# Using just (recommended)
just build-cuda      # NVIDIA GPU
just build           # CPU only

# Or cargo directly
cargo build --release --features cuda    # NVIDIA
cargo build --release --features metal   # macOS
cargo build --release                    # CPU only
```

---

## 🗺️ Roadmap

### ✅ Completed

- **v0.5.x** — Model management UI, transcription history, audio device selection, daemon subcommands, visual quality meters
- **v0.4.x** — Tauri desktop app, dashboard, settings UI, dev tools
- **v0.3.x** — Project rename to Mojo Voice
- **v0.2.x** — Cross-platform support (macOS, Linux), CPAL audio, clipboard mode

### 🔮 Future

- **v0.6** — Polybar integration, noise cancellation (DeepFilterNet)
- **v0.7** — Context-aware vocabulary (detect file types, bias accordingly)
- **v1.0** — IDE plugins (VSCode, Neovim), voice commands, production-ready polish

[Full roadmap →](docs/project/todos/roadmap.md)

---

## 📚 Documentation

| Guide | Description |
|-------|-------------|
| [Waybar Integration](integrations/waybar/README.md) | Status indicator setup |
| [Architecture](docs/context/current-implementation-state.md) | Technical overview |
| [Roadmap](docs/project/todos/roadmap.md) | Feature planning |

---

## 🤝 Contributing

```bash
git clone https://github.com/itsdevcoffee/mojovoice.git
cd mojovoice
just build           # Build
cargo test           # Test
cargo clippy         # Lint
cargo fmt --check    # Format check
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

---

## 📊 Performance

| Hardware | Model | 10s Audio |
|----------|-------|-----------|
| RTX 4090 (CUDA) | large-v3-turbo | ~0.5s |
| Apple M2 (Metal) | large-v3-turbo | ~1.0s |
| Ryzen 7 (CPU) | large-v3-turbo | ~3.0s |

Run your own benchmark:
```bash
mojovoice benchmark --report
```

---

## 📄 License

[MIT License](LICENSE) — Free and open source.

---

## 🙏 Acknowledgments

- [OpenAI Whisper](https://github.com/openai/whisper) — Speech recognition model
- [Candle](https://github.com/huggingface/candle) — Rust ML framework
- [Tauri](https://tauri.app) — Desktop app framework
- [CPAL](https://github.com/RustAudio/cpal) — Cross-platform audio

---

## Trademark Notice

Mojo® is a trademark of Modular, Inc. This project is not affiliated with, endorsed by, or sponsored by Modular, Inc.
