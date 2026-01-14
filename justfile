# dev-voice build automation
# Run `just --list` to see available commands

# Default install location
install_dir := env_var("HOME") / ".local/bin"
lib_dir := install_dir / "lib"

# CUDA library paths for linking
cuda_flags := "-L /usr/lib64 -L /usr/local/lib/ollama"

# Default recipe: show help
default:
    @just --list

# === Build Commands ===

# Build for CPU only (no CUDA)
build:
    cargo build --release

# Build with CUDA support
build-cuda:
    RUSTFLAGS="{{cuda_flags}}" cargo build --release --features cuda

# Quick dev build (debug, no optimizations)
dev:
    cargo build

# Run Tauri UI in dev mode (hot reload)
ui:
    cd ui && npm run tauri:dev

# === Install Commands ===

# Install CPU build to ~/.local/bin
# Note: rm before cp handles "Text file busy" when daemon is running
install: build
    @mkdir -p {{lib_dir}}
    rm -f {{install_dir}}/mojovoice
    cp target/release/mojovoice {{install_dir}}/
    cp lib/libmojo_audio.so {{lib_dir}}/
    @echo "Installed mojovoice to {{install_dir}}"
    @echo "Run 'just daemon-restart' to use the new build"

# Install CUDA build to ~/.local/bin
install-cuda: build-cuda
    @mkdir -p {{lib_dir}}
    rm -f {{install_dir}}/mojovoice
    cp target/release/mojovoice {{install_dir}}/
    cp lib/libmojo_audio.so {{lib_dir}}/
    @echo "Installed mojovoice (CUDA) to {{install_dir}}"
    @echo "Run 'just daemon-restart' to use the new build"

# Install and restart daemon
install-restart: install-cuda
    @echo "Restarting daemon..."
    -{{install_dir}}/mojovoice daemon down 2>/dev/null || true
    @sleep 1
    {{install_dir}}/mojovoice daemon up &
    @sleep 2
    {{install_dir}}/mojovoice daemon status

# === Development Helpers ===

# Run clippy lints
lint:
    cargo clippy --all-targets --all-features -- -D warnings

# Run tests
test:
    cargo test

# Check compilation without building
check:
    cargo check

# Check CUDA build compiles
check-cuda:
    RUSTFLAGS="{{cuda_flags}}" cargo check --features cuda

# Format code
fmt:
    cargo fmt

# === Daemon Commands ===

# Start daemon (foreground, for debugging)
daemon-fg:
    {{install_dir}}/mojovoice daemon up

# Bring daemon up (background)
daemon-up:
    {{install_dir}}/mojovoice daemon up &

# Bring daemon down
daemon-down:
    {{install_dir}}/mojovoice daemon down

# Restart daemon
daemon-restart:
    {{install_dir}}/mojovoice daemon restart

# Show daemon status
daemon-status:
    {{install_dir}}/mojovoice daemon status

# Follow daemon logs
daemon-logs:
    {{install_dir}}/mojovoice daemon logs -f

# === Cleanup ===

# Clean build artifacts
clean:
    cargo clean

# === Mojo Audio ===

# Rebuild mojo-audio library (requires pixi)
mojo-rebuild:
    cd ../mojo-audio && pixi run mojo build src/ffi/audio_ffi.mojo -o libmojo_audio.so --emit shared-lib
    cp ../mojo-audio/libmojo_audio.so lib/
    @echo "Rebuilt and copied libmojo_audio.so"
