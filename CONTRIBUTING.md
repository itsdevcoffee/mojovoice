# Contributing to Mojo Voice

Thanks for your interest in contributing to Mojo Voice! This document provides guidelines and instructions for contributing.

## Getting Started

### Prerequisites

- Rust 1.85 or later
- For CUDA builds: NVIDIA CUDA Toolkit
- For macOS Metal builds: Xcode Command Line Tools

### Development Setup

```bash
git clone https://github.com/itsdevcoffee/mojovoice.git
cd mojovoice

# Build (choose one)
just build           # CPU only
just build-cuda      # NVIDIA GPU (Linux)
cargo build --release --features metal  # macOS

# Run tests
cargo test

# Run lints
cargo clippy
cargo fmt --check
```

## How to Contribute

### Reporting Bugs

1. Check [existing issues](https://github.com/itsdevcoffee/mojovoice/issues) to avoid duplicates
2. Use the bug report template if available
3. Include:
   - OS and version (e.g., Fedora 42, macOS 15)
   - Mojo Voice version (`mojovoice --version`)
   - Steps to reproduce
   - Expected vs actual behavior
   - Relevant logs (`mojovoice daemon logs`)

### Suggesting Features

1. Check the [roadmap](docs/project/todos/roadmap.md) to see if it's planned
2. Open a [discussion](https://github.com/itsdevcoffee/mojovoice/discussions) for larger ideas
3. For smaller features, open an issue with the "enhancement" label

### Submitting Code

1. **Fork** the repository
2. **Create a branch** from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. **Make your changes** following the code style below
4. **Test** your changes:
   ```bash
   cargo test
   cargo clippy
   cargo fmt --check
   ```
5. **Commit** with a clear message:
   ```bash
   git commit -m "feat: add support for X"
   ```
6. **Push** and open a Pull Request

## Code Style

### Rust

- Follow standard Rust conventions
- Run `cargo fmt` before committing
- Run `cargo clippy` and address warnings
- Add tests for new functionality
- Document public APIs with doc comments

### Commit Messages

We use [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` — New feature
- `fix:` — Bug fix
- `docs:` — Documentation only
- `refactor:` — Code change that neither fixes a bug nor adds a feature
- `test:` — Adding or updating tests
- `chore:` — Maintenance tasks (deps, CI, etc.)

Examples:
```
feat: add support for Polybar integration
fix: resolve audio device enumeration on PipeWire
docs: update README with new CLI commands
refactor: simplify daemon startup logic
```

### UI (Tauri/React)

- Use TypeScript for all new code
- Follow existing component patterns
- Use Tailwind CSS for styling
- Keep components focused and small

## Project Structure

```
mojovoice/
├── src/                    # Rust CLI and daemon
│   ├── main.rs            # CLI entry point
│   ├── daemon/            # Daemon implementation
│   ├── transcribe/        # Whisper transcription
│   └── model/             # Model management
├── ui/                     # Tauri desktop app
│   ├── src/               # React frontend
│   └── src-tauri/         # Tauri backend
├── integrations/          # Status bar integrations
│   └── waybar/
├── docs/                  # Documentation
└── lib/                   # FFI libraries
```

## Testing

### Running Tests

```bash
# All tests
cargo test

# Specific test
cargo test test_name

# With output
cargo test -- --nocapture
```

### Manual Testing

```bash
# Start daemon
mojovoice daemon up

# Test transcription
mojovoice start
# Speak something
mojovoice stop

# Check logs
mojovoice daemon logs -f
```

## Getting Help

- Open an [issue](https://github.com/itsdevcoffee/mojovoice/issues) for bugs
- Start a [discussion](https://github.com/itsdevcoffee/mojovoice/discussions) for questions
- Check existing docs in the `docs/` directory

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
