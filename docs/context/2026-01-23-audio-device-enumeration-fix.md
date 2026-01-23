# Audio Device Enumeration Fix

**Date:** 2026-01-23
**Issue:** Missing audio devices in Settings UI and ALSA error messages

## Problem

1. **Missing Devices:** The Settings UI only showed 3 devices (System Default, default, pipewire, Khadas Mind Graphics Speaker) when the system had many more available (fifine SC3 microphone, Bluetooth devices, EasyEffects sources)

2. **ALSA Errors:** Console spam from ALSA library:
   ```
   ALSA lib pcm.c:2722:(snd_pcm_open_noupdate) [error.pcm] Unknown PCM pulse
   ALSA lib pcm.c:2722:(snd_pcm_open_noupdate) [error.pcm] Unknown PCM jack
   ALSA lib pcm.c:2722:(snd_pcm_open_noupdate) [error.pcm] Unknown PCM oss
   ```

## Root Cause

### Missing Devices
CPAL (Cross-Platform Audio Library) uses ALSA as its backend on Linux. On modern PipeWire systems, ALSA is just a compatibility layer and only exposes a limited set of "hint devices". Most audio devices are only visible through PipeWire/PulseAudio APIs, which CPAL doesn't support natively.

### ALSA Errors
The errors occur when ALSA tries to enumerate all possible device plugins (pulse, jack, oss) during device discovery. On PipeWire systems, these plugins aren't installed since PipeWire provides its own compatibility layer. The errors are harmless but noisy.

## Solution

### Device Enumeration (Fixed)
Implemented a hybrid approach in `src/audio/mod.rs`:

1. **On Linux:** Query PipeWire directly using `pactl` to get the full list of audio sources
2. **Device Selection:** When a PipeWire source is selected, temporarily set it as the system default using `pactl set-default-source`, then use CPAL with the "default" ALSA device
3. **Fallback:** If PipeWire query fails, fall back to CPAL's native ALSA device enumeration
4. **Cross-platform:** Other platforms (macOS, Windows) continue using CPAL's native backends

**Changes:**
- `list_input_devices()` - Now queries PipeWire on Linux for comprehensive device list
- `AudioDeviceInfo` - Added `internal_name` field to store PipeWire source names
- `setup_audio_device()` - Enhanced to handle PipeWire source selection
- `set_pipewire_source_temporarily()` - New function to switch default source

### ALSA Errors (Documented, Not Fixed)
The ALSA errors are cosmetic and occur in the ALSA C library before our Rust code runs. They don't affect functionality.

**Workarounds:**
1. **Suppress in config:** Create `~/.asoundrc` with minimal ALSA configuration
2. **Ignore:** The errors are harmless and only appear during device enumeration
3. **Environment variable:** Could set `LIBASOUND_DEBUG=0` (not implemented)

We chose not to suppress them programmatically to avoid adding complexity for a cosmetic issue.

## Testing

```bash
# List devices with new implementation
RUST_LOG=info cargo run --example list_audio_devices

# Expected output (example):
# Found 4 PipeWire audio source(s)
#   [1] Khadas Mind Graphics Speaker Analog Stereo
#   [2] fifine SC3 Analog Stereo
#   [3] AirPods Pro
#   [4] Easy Effects Source (default)
```

## Files Modified

- `src/audio/mod.rs` - Core audio device enumeration and selection logic
- `ui/src-tauri/src/commands.rs` - Updated `AudioDevice` struct with `internal_name` field
- `examples/list_audio_devices.rs` - Simple example to test device enumeration
- `examples/debug_cpal_devices.rs` - Debug tool to inspect CPAL backend behavior

## Future Improvements

1. **CPAL PipeWire Backend:** Once CPAL adds native PipeWire support, we can simplify this code
2. **Device Change Detection:** Monitor for audio device changes and update UI dynamically
3. **Per-device Settings:** Remember volume/gain settings for specific devices
4. **Device Testing:** Add UI button to test audio capture from selected device

## Related Issues

- CPAL issue tracker: https://github.com/RustAudio/cpal/issues (search for PipeWire)
- PipeWire ALSA plugin: https://gitlab.freedesktop.org/pipewire/pipewire/-/wikis/Config-ALSA
