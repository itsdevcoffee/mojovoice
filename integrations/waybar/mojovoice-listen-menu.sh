#!/usr/bin/env bash
# mojovoice-listen-menu.sh — Right-click context menu for the listen Waybar module
#
# Uses rofi in dmenu mode with a custom Electric Night theme.
# Shows context-aware options based on current listen session state.

STATE_DIR="${XDG_STATE_HOME:-$HOME/.local/state}/mojovoice"
LISTEN_PID_FILE="${STATE_DIR}/listen.pid"
SOCKET_FILE="${STATE_DIR}/daemon.sock"

# ── Detect current state ──────────────────────────────────────────────────────
IS_DAEMON_UP=false
IS_LISTENING=false

[[ -S "$SOCKET_FILE" ]] && pgrep -f "mojovoice daemon" &>/dev/null && IS_DAEMON_UP=true

if [[ -f "$LISTEN_PID_FILE" ]]; then
    PID=$(head -n 1 "$LISTEN_PID_FILE" 2>/dev/null)
    [[ "$PID" =~ ^[0-9]+$ ]] && kill -0 "$PID" 2>/dev/null && IS_LISTENING=true
fi

# ── Build context-aware menu entries ─────────────────────────────────────────
declare -a OPTS

if $IS_LISTENING; then
    OPTS+=(
        "  Stop and transcribe"
        "  Cancel (discard audio)"
    )
else
    $IS_DAEMON_UP && OPTS+=("  Start listening")
fi

# Always-available entries
OPTS+=(
    "  List audio sources"
    "  Daemon status"
)
$IS_DAEMON_UP || OPTS+=("  Start daemon")

# ── Rofi Electric Night theme ─────────────────────────────────────────────────
ROFI_THEME='
window {
    width: 320px;
    border: 2px;
    border-color: rgba(6, 182, 212, 0.6);
    background-color: #0A0E1A;
    border-radius: 6px;
}
mainbox {
    padding: 4px 0;
    background-color: transparent;
}
inputbar { enabled: false; }
listview {
    padding: 2px 0;
    background-color: transparent;
    spacing: 0;
}
element {
    padding: 8px 14px;
    background-color: transparent;
    text-color: #64748B;
    border-radius: 2px;
}
element selected {
    background-color: rgba(6, 182, 212, 0.12);
    text-color: #06B6D4;
}
element-text {
    font: "JetBrains Mono 10";
    background-color: transparent;
    text-color: inherit;
    vertical-align: 0.5;
}
prompt {
    enabled: false;
}
'

# ── Show menu ─────────────────────────────────────────────────────────────────
CHOICE=$(printf '%s\n' "${OPTS[@]}" \
    | rofi -dmenu \
           -p "" \
           -theme-str "$ROFI_THEME" \
           -no-custom \
           -l "${#OPTS[@]}" \
    2>/dev/null)

[[ -z "$CHOICE" ]] && exit 0

# ── Handle selection ──────────────────────────────────────────────────────────
case "$CHOICE" in
    *"Stop and transcribe"*)
        mojovoice listen &
        ;;
    *"Cancel"*)
        mojovoice listen --cancel &
        ;;
    *"Start listening"*)
        mojovoice listen &
        ;;
    *"List audio sources"*)
        SOURCES=$(pactl list sources short 2>/dev/null \
            | awk '{print $2}' \
            | grep '\.monitor' \
            | sed 's/^/  [Monitor] /' \
            | head -8)
        [[ -z "$SOURCES" ]] && SOURCES="  No monitor sources found"
        notify-send \
            --app-name="mojovoice listen" \
            --urgency=low \
            "Audio Sources" \
            "Available monitors:\n${SOURCES}\n\nUse --source to specify one."
        ;;
    *"Daemon status"*)
        STATUS=$(mojovoice daemon status 2>&1)
        notify-send \
            --app-name="mojovoice listen" \
            --urgency=low \
            "Daemon Status" \
            "${STATUS}"
        ;;
    *"Start daemon"*)
        notify-send \
            --app-name="mojovoice listen" \
            --urgency=low \
            "Starting daemon..." \
            "Run: mojovoice daemon up"
        mojovoice daemon up &
        ;;
esac

# Refresh Waybar module after action
sleep 0.5
pkill -RTMIN+9 waybar
