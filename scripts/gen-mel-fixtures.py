# /// script
# requires-python = ">=3.10,<3.13"
# dependencies = ["openai-whisper", "torch", "numpy"]
#
# [[tool.uv.index]]
# name = "pytorch-cpu"
# url = "https://download.pytorch.org/whl/cpu"
# explicit = true
#
# [tool.uv.sources]
# torch = { index = "pytorch-cpu" }
# ///
"""Generate reference mel spectrograms for src/transcribe/mel.rs tests.

Uses OpenAI's own `whisper.log_mel_spectrogram` as ground truth.

Usage (requires ffmpeg):
    uv run scripts/gen-mel-fixtures.py

Writes to tests/fixtures/mel/:
    input_16k.f32      2s of 16kHz mono speech (f32 little-endian)
    expected_80.f32    (80, 200) log-mel, row-major f32 little-endian
    expected_128.f32   (128, 200) log-mel, row-major f32 little-endian
"""

from pathlib import Path

import numpy as np
import torch
import whisper

ROOT = Path(__file__).resolve().parent.parent
SOURCE_WAV = ROOT / "assets/audio/samples/sample-mojovoice-clip.wav"
OUT = ROOT / "tests/fixtures/mel"

# 2 seconds starting 0.5s in (skip leading silence)
START, LENGTH = 8_000, 32_000

OUT.mkdir(parents=True, exist_ok=True)

audio = whisper.load_audio(str(SOURCE_WAV))
segment = np.ascontiguousarray(audio[START : START + LENGTH], dtype=np.float32)
assert len(segment) == LENGTH, f"source too short: {len(audio)} samples"
segment.astype("<f4").tofile(OUT / "input_16k.f32")

for n_mels in (80, 128):
    # The Rust side embeds assets/melfilters{n}.bytes; confirm they are OpenAI's filters.
    ours = np.fromfile(ROOT / f"assets/melfilters{n_mels}.bytes", dtype="<f4").reshape(n_mels, 201)
    theirs = whisper.audio.mel_filters("cpu", n_mels).numpy()
    filter_diff = np.abs(ours - theirs).max()
    assert filter_diff < 1e-6, f"melfilters{n_mels}.bytes differs from OpenAI's: {filter_diff}"

    mel = whisper.log_mel_spectrogram(torch.from_numpy(segment), n_mels=n_mels).numpy()
    mel.astype("<f4").tofile(OUT / f"expected_{n_mels}.f32")
    print(f"n_mels={n_mels}: shape={mel.shape} min={mel.min():.4f} max={mel.max():.4f} filters_diff={filter_diff:.2e}")
