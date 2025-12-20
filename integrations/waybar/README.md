# Waybar Integration for dev-voice

Status bar module for Waybar that displays real-time voice dictation status with visual feedback.

## Features
- **Three-state visual feedback**: Idle, Recording, Thinking
- **Signal-based updates**: Instantaneous UI refresh (no polling)
- **Timer display**: Shows recording duration
- **Click actions**: Start/stop recording from Waybar
- **Animated states**: Pulsing effect for active states

## Requirements
- Waybar (tested on v0.9+)
- Nerd Fonts (for icons)
- dev-voice installed

## Installation

### Quick Install
```bash
./integrations/waybar/install.sh
```

### Manual Install
1. Copy files to Waybar config:
   ```bash
   mkdir -p ~/.config/waybar/integrations/dev-voice
   cp integrations/waybar/* ~/.config/waybar/integrations/dev-voice/
   chmod +x ~/.config/waybar/integrations/dev-voice/dev-voice-status.sh
   ```

2. Add to your Waybar config (`~/.config/waybar/config.jsonc`):
   ```jsonc
   {
     "include": ["~/.config/waybar/integrations/dev-voice/module.jsonc"],
     "modules-left": [..., "custom/dev-voice"]
   }
   ```

3. (Optional) Import CSS into `~/.config/waybar/style.css`:
   ```css
   @import "integrations/dev-voice/style.css";
   ```

4. Configure dev-voice refresh command:
   ```bash
   dev-voice config
   ```
   Add to `[output]` section:
   ```toml
   refresh_command = "pkill -RTMIN+8 waybar"
   ```

5. Reload Waybar:
   ```bash
   pkill -SIGUSR2 waybar
   ```

## States

| State | Icon | Color | Description |
|-------|------|-------|-------------|
| Idle | 󰔊 | Gray | Ready to record |
| Recording | 󰑋 | Red (pulsing) | Active recording with timer |
| Thinking | 󱐋 | Yellow (pulsing) | Transcribing audio |

## Customization

### Change Icons
Edit `dev-voice-status.sh`:
```bash
ICON_IDLE="󰔊"      # Your preferred idle icon
ICON_RECORDING="󰑋" # Your preferred recording icon
ICON_PROCESSING="󱐋" # Your preferred processing icon
```

### Change Colors
Edit `style.css` or add to your main stylesheet:
```css
#custom-dev-voice.recording {
  color: #your-color;
}
```

### Change Signal Number
If RTMIN+8 conflicts with other modules, change in both:
- `module.jsonc`: `"signal": 8` → `"signal": N`
- dev-voice config: `refresh_command = "pkill -RTMIN+N waybar"`

## Troubleshooting

**Icon not updating:**
- Verify signal number matches in config and module
- Check script is executable: `chmod +x dev-voice-status.sh`
- Tail Waybar logs: `journalctl -f --user-unit waybar`

**Icons showing as boxes:**
- Install a Nerd Font: `yay -S ttf-nerd-fonts-symbols`
- Update Waybar font in your theme

**Module not appearing:**
- Verify include path is correct
- Check `custom/dev-voice` is in a modules list
- Reload Waybar: `pkill -SIGUSR2 waybar`
