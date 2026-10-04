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
SAMPLE="$REPO_ROOT/assets/audio/samples/sample-mojovoice-clip-4.wav"
EXPECTED="testing this one more time"
LOG="$(mktemp)"

# Download whisper-tiny through the CLI (exercises `mojovoice download`), then
# point the config at it
DOWNLOAD_LOG="$("$BIN" download tiny 2>&1)" || { echo "$DOWNLOAD_LOG" >&2; exit 1; }
MODEL_DIR="$(echo "$DOWNLOAD_LOG" | sed 's/\x1b\[[0-9;]*m//g' | sed -n 's/.*Model ready: //p' | tail -1)"
[ -d "$MODEL_DIR" ] || { echo "FAIL: download did not report a model dir" >&2; echo "$DOWNLOAD_LOG" >&2; exit 1; }
CONFIG="$("$BIN" config --path)"
# Replace the first `path = ...` line in plain bash: sed would treat the backslashes in
# Windows paths as escapes. A TOML literal string ('...') keeps them verbatim.
replaced=0
while IFS= read -r line || [ -n "$line" ]; do
    if [ "$replaced" = 0 ] && [[ "$line" == "path = "* ]]; then
        printf "path = '%s'\n" "$MODEL_DIR"
        replaced=1
    else
        printf '%s\n' "$line"
    fi
done < "$CONFIG" > "$CONFIG.tmp"
mv "$CONFIG.tmp" "$CONFIG"

cleanup() { "$BIN" daemon down >/dev/null 2>&1 || true; }
trap cleanup EXIT

"$BIN" daemon up >"$LOG" 2>&1 &
for _ in $(seq 1 120); do
    grep -q "accepting connections" "$LOG" && break
    if ! kill -0 $! 2>/dev/null; then break; fi
    sleep 1
done
if ! grep -q "accepting connections" "$LOG"; then
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
