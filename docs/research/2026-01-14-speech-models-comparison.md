# Speech-to-Text Model Comparison

**Date:** 2026-01-14
**Status:** Research
**Purpose:** Evaluate current model support and potential additions

---

## Current Model Support

### Loading Methods

| Method | Format | Precision | VRAM | Code Path |
|--------|--------|-----------|------|-----------|
| **Registry** | GGML/GGUF | 4-5 bit quantized | ~40-60% less | `VarBuilder::from_gguf()` |
| **HuggingFace** | Safetensors | F32 (32-bit) | Full size | `VarBuilder::from_mmaped_safetensors()` |

### Supported Models

| Model | Params | GGML Size | F32 VRAM Est. | Quantized VRAM Est. | Mel Bins |
|-------|--------|-----------|---------------|---------------------|----------|
| tiny | 39M | 78 MB | 0.5-0.7 GB | 0.3-0.5 GB | 80 |
| tiny.en | 39M | 78 MB | 0.5-0.7 GB | 0.3-0.5 GB | 80 |
| base | 74M | 148 MB | 0.6-0.9 GB | 0.4-0.6 GB | 80 |
| base.en | 74M | 148 MB | 0.6-0.9 GB | 0.4-0.6 GB | 80 |
| small | 244M | 488 MB | 1.3-1.6 GB | 0.8-1.0 GB | 80 |
| small.en | 244M | 488 MB | 1.3-1.6 GB | 0.8-1.0 GB | 80 |
| medium.en | 769M | 1,530 MB | 3.5-4.0 GB | 2.0-2.5 GB | 80 |
| large-v3 | 1.55B | 3,100 MB | 6.5-7.5 GB | 3.5-4.0 GB | 128 |
| large-v3-turbo | 809M | 1,625 MB | 3.7-4.5 GB | 2.2-2.7 GB | 128 |
| distil-large-v3 | 756M | 1,520 MB | 3.5-4.0 GB | 2.0-2.5 GB | 128 |

---

## Benchmark Comparison (2026)

| Model | WER (%) | RTFx | Params | Notes |
|-------|---------|------|--------|-------|
| **Canary Qwen 2.5B** | 5.63 | 418x | 2.5B | #1 on HuggingFace ASR leaderboard |
| IBM Granite Speech 3.3 | 5.85 | - | 8B | Best deletion handling |
| Whisper Large V3 | 7.4 | - | 1.55B | Multilingual leader (99+ langs) |
| Whisper Large V3 Turbo | 7.75 | 216x | 809M | 6x faster than V3 |
| Distil-Whisper V3 | ~7.4 | 5-6x | 756M | 6x faster, 49% smaller |
| Parakeet TDT 1.1B | ~8.0 | 2000x+ | 1.1B | Ultra-fast processing |
| Moonshine | ~Small | Fast | <100M | Edge/on-device optimized |

**WER** = Word Error Rate (lower is better)
**RTFx** = Real-Time Factor (how many times faster than real-time)

---

## Models to Consider Adding

### High Priority

#### NVIDIA Canary Qwen 2.5B
- **WER:** 5.63% (25% better than Whisper Large V3)
- **Speed:** 418x real-time
- **VRAM:** ~5-6 GB (F32), ~2-3 GB (quantized)
- **HuggingFace:** `nvidia/canary-qwen-2.5b`
- **Pros:** Best accuracy, reasonable size
- **Cons:** Different architecture (not Whisper-compatible), requires new inference code

#### Moonshine
- **WER:** Comparable to Whisper Small
- **Size:** <100M params
- **VRAM:** <0.5 GB
- **HuggingFace:** `usefulsensors/moonshine`
- **Pros:** Tiny footprint, edge-optimized
- **Cons:** English-only, less accurate than large models

### Medium Priority

#### Parakeet TDT 1.1B
- **WER:** ~8%
- **Speed:** 2000x+ real-time
- **VRAM:** ~2-3 GB
- **Pros:** Extremely fast
- **Cons:** NVIDIA NeMo framework dependency

#### IBM Granite Speech 3.3 8B
- **WER:** 5.85%
- **VRAM:** ~32 GB (too large for most consumer GPUs)
- **Pros:** Excellent accuracy, translation support
- **Cons:** Massive VRAM requirement

---

## Implementation Considerations

### Adding Non-Whisper Models

Current `CandleEngine` is Whisper-specific:
- Uses Whisper tokenizer
- Expects Whisper model architecture
- Hardcoded special tokens (`<|startoftranscript|>`, etc.)

**Options:**
1. **Create new engine** - `CanaryEngine`, `MoonshineEngine`
2. **Abstract `Transcriber` trait** - Already exists, add new implementations
3. **Use external inference** - Call separate binary/service

### Recommended Approach

```
src/transcribe/
├── mod.rs              # Transcriber trait (existing)
├── candle_engine.rs    # Whisper models (existing)
├── canary_engine.rs    # Canary Qwen (new)
└── moonshine_engine.rs # Moonshine (new)
```

---

## Decision Matrix

| Model | Accuracy | Speed | VRAM | Effort | Recommendation |
|-------|----------|-------|------|--------|----------------|
| Canary Qwen 2.5B | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | High | Add if accuracy is priority |
| Moonshine | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | Medium | Add for edge/low-VRAM |
| Parakeet | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | High | Skip (NeMo dependency) |
| Granite 8B | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐ | High | Skip (too large) |

---

## Sources

- [Best open source STT model in 2026 - Northflank](https://northflank.com/blog/best-open-source-speech-to-text-stt-model-in-2025-benchmarks)
- [OpenAI Whisper vs Other Models - Jamy AI](https://www.jamy.ai/blog/openai-whisper-vs-other-open-source-transcription-models/)
- [2025 Edge STT Benchmark - Ionio](https://www.ionio.ai/blog/2025-edge-speech-to-text-model-benchmark-whisper-vs-competitors)
- [Top Open Source STT Models - Modal](https://modal.com/blog/open-source-stt)
