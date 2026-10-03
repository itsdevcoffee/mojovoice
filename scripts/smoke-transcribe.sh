#!/bin/bash
# End-to-end smoke test: start the daemon with whisper-tiny and transcribe a
# sample WAV through the real binary. Catches releases that build fine but
# can't transcribe (e.g. missing runtime libraries).
#
# Usage:
#   ./scripts/smoke-transcribe.sh [path/to/mojovoice]
#
# Overwrites the model path in the mojovoice config, so run it in CI or on a
# machine where that doesn't matter.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BIN="$(realpath "${1:-$REPO_ROOT/target/release/mojovoice}")"
MODEL_DIR="${SMOKE_MODEL_DIR:-$HOME/.cache/mojovoice-smoke/whisper-tiny}"
SAMPLE="$REPO_ROOT/assets/audio/samples/sample-mojovoice-clip-4.wav"
EXPECTED="testing this one more time"
LOG="$(mktemp)"

mkdir -p "$MODEL_DIR"
for f in config.json tokenizer.json model.safetensors; do
    [ -s "$MODEL_DIR/$f" ] || curl -fsSL -o "$MODEL_DIR/$f" \
        "https://huggingface.co/openai/whisper-tiny/resolve/main/$f"
done

# Create the default config, then point it at whisper-tiny
"$BIN" config >/dev/null
CONFIG="$HOME/.config/mojovoice/config.toml"
sed -i "0,/^path = .*/s||path = \"$MODEL_DIR\"|" "$CONFIG"

cleanup() { "$BIN" daemon down >/dev/null 2>&1 || true; }
trap cleanup EXIT

"$BIN" daemon up >"$LOG" 2>&1 &
for _ in $(seq 1 120); do
    grep -q "ready for transcription" "$LOG" && break
    if ! kill -0 $! 2>/dev/null; then break; fi
    sleep 1
done
if ! grep -q "ready for transcription" "$LOG"; then
    echo "FAIL: daemon did not become ready" >&2
    cat "$LOG" >&2
    exit 1
fi

OUTPUT="$("$BIN" transcribe-file "$SAMPLE" 2>&1)" || true
TEXT="$(echo "$OUTPUT" | sed -n '/=== Transcription ===/,$p' | tail -n +2)"
echo "Transcription: $TEXT"

if echo "$TEXT" | grep -qi "$EXPECTED"; then
    echo "PASS"
else
    echo "FAIL: expected transcription to contain \"$EXPECTED\"" >&2
    echo "$OUTPUT" >&2
    cat "$LOG" >&2
    exit 1
fi
