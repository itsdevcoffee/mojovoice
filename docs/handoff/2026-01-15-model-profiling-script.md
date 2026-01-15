# Model Profiling & Benchmarking Script

**Date:** 2026-01-15
**Status:** Ready for implementation
**Priority:** Medium

## Overview

Create a script that systematically benchmarks the currently running Whisper model by transcribing test audio samples and comparing results against ground truth transcripts.

## Requirements

### Core Functionality

1. **Detect Active Model**
   - Query daemon status to identify which model is running
   - Extract model name from daemon status output
   - Validate daemon is running before proceeding

2. **Process Test Samples**
   - Read all WAV files from `assets/audio/samples/`
   - Load ground truth transcripts from `assets/audio/samples/manifest.json`
   - Send each sample to daemon for transcription
   - Measure transcription time per sample

3. **Calculate Metrics**
   - **Transcription Time** - Time taken to transcribe each clip
   - **Word Error Rate (WER)** - Percentage of words that differ from ground truth
   - **Character Error Rate (CER)** - Character-level accuracy
   - **Real-Time Factor (RTF)** - `transcription_time / audio_duration` (e.g., 0.5 = 2x faster than real-time)
   - **Exact Match Rate** - Boolean: did transcription exactly match ground truth?
   - **Aggregate Statistics** - Average WER, total time, fastest/slowest samples

4. **Output Results**
   - Save results as JSON in structured directory: `benchmarks/{model_name}/{timestamp}.json`
   - Include both per-sample breakdown and aggregate statistics
   - Include model metadata (format, quantization, size)

## Technical Context

### Daemon API

The mojovoice daemon exposes a Unix socket API at `~/.local/state/mojovoice/daemon.sock`.

**Check daemon status:**
```bash
./target/release/mojovoice daemon status
```

**Example output:**
```
Daemon is running (PID: 2571132)
Model: /home/maskkiller/.local/share/applications/mojovoice/models/whisper-large-v3-turbo-q4k-gguf
Socket: /home/maskkiller/.local/state/mojovoice/daemon.sock
```

**Transcribe audio via CLI:**
```bash
./target/release/mojovoice transcribe /path/to/audio.wav
```

Or via socket API (see `src/daemon/server.rs` for protocol details).

### Test Data Location

- **Audio samples:** `assets/audio/samples/*.wav`
- **Ground truth:** `assets/audio/samples/manifest.json`

**Manifest format:**
```json
{
  "samples": [
    {
      "file": "sample-mojovoice-clip.wav",
      "transcript": "Alright, testing 1, 2, 3, testing 1, 2, 3 to see if this works.",
      "source": "local-recording",
      "sample_rate": 16000,
      "duration_secs": 7.08
    }
  ]
}
```

### Model Name Extraction

From the daemon status output, the model path format is:
```
/home/maskkiller/.local/share/applications/mojovoice/models/{model_name}
```

Extract the directory name (e.g., `whisper-large-v3-turbo-q4k-gguf`) to use as the benchmark directory name.

## Output File Structure

```
benchmarks/
  whisper-large-v3-turbo/
    2026-01-15_17-30-45.json
    2026-01-15_18-15-22.json
  whisper-large-v3-turbo-q4k-gguf/
    2026-01-15_17-35-12.json
  whisper-tiny-en/
    2026-01-15_19-00-05.json
```

**Naming convention:** `benchmarks/{model_name}/{YYYY-MM-DD_HH-MM-SS}.json`

## JSON Output Format

```json
{
  "benchmark_info": {
    "timestamp": "2026-01-15T17:30:45Z",
    "model_name": "whisper-large-v3-turbo-q4k-gguf",
    "model_path": "/home/maskkiller/.local/share/applications/mojovoice/models/whisper-large-v3-turbo-q4k-gguf",
    "model_format": "gguf",
    "quantization": "Q4_K",
    "model_size_mb": 478,
    "daemon_pid": 2571132
  },
  "samples": [
    {
      "file": "sample-mojovoice-clip.wav",
      "duration_secs": 7.08,
      "sample_rate": 16000,
      "ground_truth": "Alright, testing 1, 2, 3, testing 1, 2, 3 to see if this works.",
      "transcription": "Alright, testing 1, 2, 3, testing 1, 2, 3 to see if this works.",
      "transcription_time_secs": 0.45,
      "real_time_factor": 0.064,
      "word_error_rate": 0.0,
      "character_error_rate": 0.0,
      "exact_match": true
    },
    {
      "file": "harvard-list01-female.wav",
      "duration_secs": 33.6,
      "sample_rate": 8000,
      "ground_truth": "The birch canoe slid on the smooth planks...",
      "transcription": "The birch canoe slid on the smooth planks...",
      "transcription_time_secs": 2.1,
      "real_time_factor": 0.063,
      "word_error_rate": 0.02,
      "character_error_rate": 0.01,
      "exact_match": false
    }
  ],
  "aggregate_stats": {
    "total_samples": 10,
    "total_audio_duration_secs": 158.42,
    "total_transcription_time_secs": 9.87,
    "average_real_time_factor": 0.062,
    "average_word_error_rate": 0.015,
    "average_character_error_rate": 0.008,
    "exact_match_count": 7,
    "exact_match_rate": 0.7,
    "fastest_sample": {
      "file": "sample-mojovoice-clip-3.wav",
      "real_time_factor": 0.054
    },
    "slowest_sample": {
      "file": "harvard-list57-male.wav",
      "real_time_factor": 0.075
    }
  }
}
```

## Implementation Notes

### WER Calculation

Use the Levenshtein distance algorithm to calculate Word Error Rate:

```
WER = (substitutions + deletions + insertions) / total_words_in_reference
```

Normalize both strings before comparison:
- Convert to lowercase
- Remove punctuation
- Collapse whitespace

### CER Calculation

Similar to WER but at character level:

```
CER = (substitutions + deletions + insertions) / total_chars_in_reference
```

### Real-Time Factor

```
RTF = transcription_time / audio_duration
```

- RTF < 1.0 means faster than real-time
- RTF = 1.0 means real-time speed
- RTF > 1.0 means slower than real-time

### Model Metadata Extraction

To get model format/quantization/size, match against the registry in `ui/src-tauri/src/commands.rs` (`get_model_registry()` function).

## Script Requirements

**Language:** Python or Rust (developer preference)

**Dependencies:**
- JSON parsing
- Audio file metadata reading (for duration/sample rate)
- Levenshtein distance library (for WER/CER)
- Daemon socket communication OR CLI invocation
- File I/O for results

**CLI Usage:**
```bash
# Run benchmark on currently active model
./scripts/benchmark-model.sh

# Or if Python:
python scripts/benchmark_model.py
```

## Success Criteria

- [ ] Script detects active model from daemon status
- [ ] Processes all 10 audio samples from `assets/audio/samples/`
- [ ] Calculates WER, CER, RTF, and exact match metrics
- [ ] Outputs JSON to `benchmarks/{model_name}/{timestamp}.json`
- [ ] Includes both per-sample and aggregate statistics
- [ ] Handles errors gracefully (daemon not running, missing files, etc.)
- [ ] Takes less than 5 minutes to run on all samples

## Future Enhancements (Optional)

- Compare multiple benchmark runs for the same model
- Generate markdown report with tables/charts
- Track performance regressions over time
- Support for custom audio sample directories
- Parallel transcription of samples (if daemon supports it)
- GPU utilization metrics during transcription

## Files to Reference

- `assets/audio/samples/manifest.json` - Ground truth transcripts
- `src/daemon/server.rs` - Daemon socket protocol
- `ui/src-tauri/src/commands.rs` - Model registry (for metadata)
- `target/release/mojovoice` - CLI binary for transcription

## Questions for Developer

1. Should the script create the `benchmarks/` directory if it doesn't exist?
2. How should the script handle daemon errors (e.g., model crashes mid-benchmark)?
3. Should we normalize transcripts before comparison (lowercase, punctuation removal)?
4. Should the script validate audio file formats before sending to daemon?
