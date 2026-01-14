# mojovoice UI

Modern, glassmorphic desktop interface for mojovoice built with Tauri 2.0, React, and Tailwind CSS.

## 🎨 Tech Stack

- **Frontend:** React 19 + TypeScript
- **Desktop:** Tauri 2.0
- **Styling:** Tailwind CSS with glassmorphism
- **State:** Zustand
- **Animations:** Framer Motion
- **Icons:** Lucide React
- **Charts:** Recharts (ready for stats dashboard)

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ (or Bun/pnpm)
- Rust 1.70+
- System dependencies for Tauri (see below)

### Install Dependencies

```bash
cd ui
npm install
```

### Run Development Server

```bash
npm run tauri:dev
```

This will:
1. Start Vite dev server on `localhost:1420`
2. Build Tauri backend
3. Open the app window

### Build for Production

```bash
npm run tauri:build
```

Output will be in `src-tauri/target/release/`

## 🏗️ Project Structure

```
ui/
├── src/
│   ├── components/       # React components
│   │   └── Dashboard.tsx
│   ├── lib/              # Utilities
│   │   └── utils.ts
│   ├── stores/           # Zustand stores
│   │   └── appStore.ts
│   ├── styles/           # Global styles
│   │   └── globals.css
│   ├── App.tsx           # Main app component
│   └── main.tsx          # Entry point
├── src-tauri/            # Tauri Rust backend
│   ├── src/
│   │   ├── main.rs       # App entry
│   │   └── commands.rs   # IPC commands
│   ├── Cargo.toml
│   └── tauri.conf.json
└── package.json
```

## 🔌 IPC Commands

Tauri commands available via `invoke()`:

- `get_daemon_status()` - Check mojovoice daemon status
- `start_recording()` - Start audio recording
- `stop_recording()` - Stop and transcribe
- `get_transcription_history()` - Get past transcriptions
- `download_model(model_name)` - Download Whisper model
- `get_system_info()` - Get system specs (CPU, RAM, GPU)

## 🎨 Design System

### Glassmorphism Utilities

```tsx
// Predefined glass components
<div className="glass-panel">...</div>  // Large panel with strong blur
<div className="glass-card">...</div>   // Card with medium blur
<button className="glass-button">...</button>  // Interactive glass button

// Custom glass
<div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl" />
```

### Color Palette

- **Primary:** Cyan (`#00d4ff`) - Electric blue accent
- **Secondary:** Magenta (`#ff0080`) - Purple/pink accent
- **Background:** Very dark gray (`#0a0a0a`)
- **Glass:** Semi-transparent white overlays

### Animations

- Framer Motion for smooth transitions
- Custom glow effects for active states
- Pulse animations for recording indicator

## 🔧 Development

### Hot Reload

Frontend changes reload automatically. Rust changes require rebuild (Ctrl+C and re-run `npm run tauri:dev`).

### Debugging

Dev tools open automatically in debug mode (see `src-tauri/src/main.rs`).

### System Dependencies

**Linux:**
```bash
sudo apt install libwebkit2gtk-4.1-dev \
  build-essential \
  curl \
  wget \
  file \
  libxdo-dev \
  libssl-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev
```

**macOS:**
```bash
xcode-select --install
```

**Windows:**
```
Install Visual Studio C++ Build Tools
```

## 📝 Next Steps

- [ ] Wire up real IPC to mojovoice daemon (Unix socket)
- [ ] Add settings panel (model selection, audio devices)
- [ ] Build transcription history view
- [ ] Add audio visualizer component
- [ ] Implement dev tools panel
- [ ] Add system tray integration
- [ ] Create charts for performance stats

## 🎯 Current State

**Working:**
- ✅ Basic Tauri app structure
- ✅ Glassmorphic dashboard UI
- ✅ Mock daemon status display
- ✅ Recording button with animations
- ✅ Zustand state management

**TODO:**
- ⏳ Connect to actual mojovoice daemon
- ⏳ Real-time audio visualization
- ⏳ Settings and configuration
- ⏳ Multiple views (history, dev tools)

---

Built with ❤️ using Tauri 2.0
