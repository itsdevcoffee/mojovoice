# Waybar Integration for mojovoice

Real-time voice dictation status module for Waybar.

## Features
- Four-state visual feedback (Offline, Idle, Recording, Thinking)
- Signal-based instant updates (no polling lag)
- Recording timer display
- Click to start/stop recording
- Animated pulsing for active states

## Requirements
- Waybar v0.9+
- Nerd Fonts (for icons)
- mojovoice installed

## Quick Install

```bash
./integrations/waybar/install.sh
```

Then follow the on-screen instructions to add the config snippet.

## Manual Install

### Step 1: Install Script
```bash
cp integrations/waybar/mojovoice-status.sh ~/.config/waybar/scripts/
chmod +x ~/.config/waybar/scripts/mojovoice-status.sh
```

### Step 2: Add Module Config
Add this to your `~/.config/waybar/modules` file or directly in `config.jsonc`:

```jsonc
"custom/mojovoice": {
  "format": "{}",
  "return-type": "json",
  "exec": "~/.config/waybar/scripts/mojovoice-status.sh",
  "on-click": "mojovoice start &",
  "on-click-right": "mojovoice stop &",
  "signal": 8,
  "tooltip": true
}
```

### Step 3: Add to Module List
In your `config.jsonc`, add `custom/mojovoice` to a module list:
```jsonc
"modules-left": ["...", "custom/mojovoice"],
```

### Step 4: Add Styles (Optional)
Add to your `~/.config/waybar/style.css`:

```css
#custom-mojovoice {
  padding: 0 10px;
  margin: 0 4px;
}

#custom-mojovoice.recording {
  color: #ff5555;
  animation: pulse 1.5s ease-in-out infinite;
}

#custom-mojovoice.processing {
  color: #f1fa8c;
  animation: pulse 1s ease-in-out infinite;
}

#custom-mojovoice.idle {
  color: #6272a4;
}

#custom-mojovoice.offline {
  color: #44475a;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
```

### Step 5: Configure Refresh Command
Edit `~/.config/mojovoice/config.toml`:
```toml
[output]
refresh_command = "pkill -RTMIN+8 waybar"
```

### Step 6: Reload Waybar
```bash
pkill -SIGUSR2 waybar
```

## States

| State | Icon | Color | Trigger |
|-------|------|-------|---------|
| Offline | 󱘖 | Dark gray | Daemon not running |
| Idle | 󰍬 | Gray | Daemon running, no activity |
| Recording | 󰑋 | Red (pulsing) | `mojovoice start` |
| Thinking | 󱐋 | Yellow (pulsing) | Processing audio |

## Customization

### Change Icons
Edit `~/.config/waybar/scripts/mojovoice-status.sh`:
```bash
ICON_OFFLINE="󱘖"
ICON_IDLE="󰍬"
ICON_RECORDING="󰑋"
ICON_PROCESSING="󱐋"
```

### Change Signal Number
If signal 8 conflicts:
- In module config: `"signal": 8` → `"signal": N`
- In mojovoice config: `refresh_command = "pkill -RTMIN+N waybar"`

### Change Colors
Adjust the hex values in `style.css` to match your theme.

## Troubleshooting

**Module not appearing:**
- Verify script path is correct
- Check `custom/mojovoice` is in a module list
- Reload: `pkill -SIGUSR2 waybar`

**Icons not updating:**
- Verify signal number matches in both configs
- Check script is executable
- Test manually: `~/.config/waybar/scripts/mojovoice-status.sh`

**Icons showing as boxes:**
- Install Nerd Fonts: `yay -S ttf-nerd-fonts-symbols`
- Or use simple text icons instead
