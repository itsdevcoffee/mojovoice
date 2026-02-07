# mojo-audio v0.2.0 - Linux Build Handoff

**Date:** 2026-02-06
**Purpose:** Instructions for building and uploading the Linux x86_64 binary for mojo-audio v0.2.0, then updating mojovoice to use it.

---

## Background

mojo-audio v0.2.0 was released with macOS support and Mojo 0.26.2+ API compatibility fixes. The release on GitHub (`itsdevcoffee/mojo-audio`) currently only has a **macOS arm64** binary. We need a **Linux x86_64** binary built and uploaded.

### What changed in v0.2.0

1. **`pixi.toml`** - Added `osx-arm64` platform, made MKL BLAS Linux-only, switched default environment to OpenBLAS
2. **`src/ffi/audio_ffi.mojo`** - Inlined type definitions from `ffi/types.mojo` (imports don't work in shared library builds). Fixed `MutExternalOrigin` → `MutAnyOrigin` and `ImmutExternalOrigin` → `ImmutAnyOrigin`
3. **`src/audio.mojo`** - Changed all 16 instances of `MutOrigin.external` → `MutAnyOrigin`
4. **`.gitignore`** - Added `*.dylib` and `*.tar.gz` patterns

The FFI interface (function signatures, structs, error codes) is unchanged from v0.1.0. This is a compatibility update only.

---

## Task 1: Build Linux x86_64 binary

```bash
cd ~/dev-coffee/repos/mojo-audio
git fetch --tags
git checkout v0.2.0

# Install dependencies (pulls Mojo + OpenBLAS for Linux)
pixi install

# Build optimized shared library
pixi run build-ffi-optimized

# Verify build
file libmojo_audio.so
# Expected: ELF 64-bit LSB shared object, x86-64
ls -lh libmojo_audio.so
# Expected: ~20-30 KB
```

### Troubleshooting

- **Mojo API errors about `MutAnyOrigin`**: The nightly channel may have resolved to a different Mojo version. Try `pixi update` to get the latest nightly, or check if `MutExternalOrigin` is still the correct name on your Mojo version.
- **`unable to locate module 'types'`**: This was fixed in v0.2.0 by inlining types into `audio_ffi.mojo`. Make sure you're on the `v0.2.0` tag.

---

## Task 2: Upload to GitHub release

```bash
RELEASE_TAG="v0.2.0"
PLATFORM="linux-x86_64"

mkdir -p release/$PLATFORM
cp libmojo_audio.so release/$PLATFORM/
cp include/mojo_audio.h release/$PLATFORM/

cat > release/$PLATFORM/INSTALL.md << 'EOF'
# mojo-audio FFI - linux-x86_64

## Installation
```bash
sudo cp libmojo_audio.so /usr/local/lib/
sudo cp mojo_audio.h /usr/local/include/
sudo ldconfig
```
EOF

tar czf mojo-audio-$RELEASE_TAG-$PLATFORM.tar.gz -C release/$PLATFORM .

# Upload to existing release
gh release upload $RELEASE_TAG mojo-audio-$RELEASE_TAG-$PLATFORM.tar.gz

# Verify both assets are present
gh release view $RELEASE_TAG --json assets --jq '.assets[].name'
# Expected:
#   mojo-audio-v0.2.0-macos-arm64.tar.gz
#   mojo-audio-v0.2.0-linux-x86_64.tar.gz
```

---

## Task 3: Update mojovoice

The mojovoice repo at `~/dev-coffee/repos/mojovoice` currently has a v0.1.0 Linux `.so` in `lib/`. Replace it with the v0.2.0 build:

```bash
cp libmojo_audio.so ~/dev-coffee/repos/mojovoice/lib/libmojo_audio.so
```

Then commit:

```bash
cd ~/dev-coffee/repos/mojovoice
git add lib/libmojo_audio.so
git commit -m "chore: update libmojo_audio.so to v0.2.0"
```

---

## Verification

After updating mojovoice, verify the FFI integration still works:

```bash
cd ~/dev-coffee/repos/mojovoice
cargo build
# Run a test transcription to confirm mel spectrogram computation works
```

The FFI interface is identical between v0.1.0 and v0.2.0 - only internal Mojo API compatibility was updated.
