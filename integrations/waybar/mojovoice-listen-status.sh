#!/usr/bin/env bash
# mojovoice-listen-status.sh — Waybar module for listen (signal intercept) mode
#
# States:
#   offline     — daemon not running
#   idle        — daemon up, no listen session
#   listening   — listen.pid exists with live process (shows animated waveform + timer)
#   transcribing — listen session just ended, processing inference
#
# Signal 9 triggers a refresh (pkill -RTMIN+9 waybar)

STATE_DIR="${XDG_STATE_HOME:-$HOME/.local/state}/mojovoice"
LISTEN_PID_FILE="${STATE_DIR}/listen.pid"
PROCESSING_FILE="${STATE_DIR}/listen.processing"
SOCKET_FILE="${STATE_DIR}/daemon.sock"

# ── Icons (Nerd Fonts MD) ───────────────────────────────────────────────────
ICON_IDLE="󰋋"        # headphones outline — ready, dormant
ICON_LISTENING="󰋋"   # headphones — active (styled differently via CSS)
ICON_TRANSCRIBING="󱄑" # brain/sparkle — inference running
ICON_OFFLINE="󰟎"     # headphones-off — no daemon

# ── Animated waveform frames (cycles per second via interval=1) ─────────────
WAVE_FRAMES=("▁▃▆▃▁" "▂▅▇▅▂" "▃▇▅▂▄" "▅▇▃▁▅" "▇▄▁▄▇" "▅▂▄▇▄" "▃▁▆▄▂" "▁▄▇▅▁")
FRAME=$(( $(date +%s) % ${#WAVE_FRAMES[@]} ))
WAVE="${WAVE_FRAMES[$FRAME]}"

# ── Daemon check ─────────────────────────────────────────────────────────────
if [[ ! -S "$SOCKET_FILE" ]] || ! pgrep -f "mojovoice daemon" &>/dev/null; then
    [[ -S "$SOCKET_FILE" ]] && rm -f "$SOCKET_FILE"
    echo "{\"text\": \"${ICON_OFFLINE}\", \"tooltip\": \"daemon offline\", \"class\": \"offline\"}"
    exit 0
fi

# ── Transcribing check (sentinel file written by status script on stop) ──────
if [[ -f "$PROCESSING_FILE" ]]; then
    echo "{\"text\": \"${ICON_TRANSCRIBING}\", \"tooltip\": \"Transcribing audio...\", \"class\": \"transcribing\"}"
    exit 0
fi

# ── Listening check ──────────────────────────────────────────────────────────
if [[ -f "$LISTEN_PID_FILE" ]]; then
    PID=$(head -n 1 "$LISTEN_PID_FILE" 2>/dev/null || echo "")

    if [[ "$PID" =~ ^[0-9]+$ ]] && kill -0 "$PID" 2>/dev/null; then
        STARTED_AT=$(sed -n '2p' "$LISTEN_PID_FILE" 2>/dev/null || echo "0")
        NOW=$(date +%s)
        ELAPSED=$(( NOW - STARTED_AT ))
        MINS=$(( ELAPSED / 60 ))
        SECS=$(( ELAPSED % 60 ))
        TIME_STR=$(printf "%d:%02d" "$MINS" "$SECS")

        # Detect if using monitor source from the process args
        SOURCE_HINT=""
        PROC_ARGS=$(cat /proc/"$PID"/cmdline 2>/dev/null | tr '\0' ' ')
        if echo "$PROC_ARGS" | grep -q "\.monitor"; then
            SOURCE_HINT=" ⟵"   # arrow indicating "from output"
        fi

        TEXT="${ICON_LISTENING} ${WAVE}${SOURCE_HINT} ${TIME_STR}"
        TOOLTIP="Listening...\\nElapsed: ${TIME_STR}\\nPID: ${PID}\\nRight-click for options"

        echo "{\"text\": \"${TEXT}\", \"tooltip\": \"${TOOLTIP}\", \"class\": \"listening\"}"
        exit 0
    else
        # Stale PID — clean up
        rm -f "$LISTEN_PID_FILE"
    fi
fi

# ── Idle ──────────────────────────────────────────────────────────────────────
DEFAULT_SINK=$(pactl get-default-sink 2>/dev/null | tr -d '[:space:]')
TOOLTIP="Ready to listen"
[[ -n "$DEFAULT_SINK" ]] && TOOLTIP="Ready to listen\\nSink: ${DEFAULT_SINK}.monitor\\nLeft-click to start · Right-click for menu"

echo "{\"text\": \"${ICON_IDLE}\", \"tooltip\": \"${TOOLTIP}\", \"class\": \"idle\"}"
