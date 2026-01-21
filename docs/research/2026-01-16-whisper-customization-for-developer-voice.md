# Whisper Model Customization for Developer Voice-to-Text

**Status:** Research
**Date:** 2026-01-16
**Context:** Techniques for creating a Whisper model optimized for MojoVoice (vibe coding)

---

## TL;DR

| Technique | Training Required | Data Needed | Hardware | Best For |
|-----------|------------------|-------------|----------|----------|
| **Prompt Engineering** | No | None | Any | Quick terminology hints |
| **LoRA Fine-tuning** | Yes (light) | 5-20 hours | 1x 16GB GPU | Domain vocabulary |
| **QLoRA** | Yes (light) | 5-20 hours | 1x 8GB GPU | Memory-constrained |
| **Full Fine-tuning** | Yes (heavy) | 20-100+ hours | 4x 24GB+ GPU | Maximum accuracy |
| **Distillation** | Yes (heavy) | 1000+ hours | Multi-GPU | Faster inference |
| **Quantization** | No | Calibration set | CPU/edge | Deployment optimization |

---

## Glossary: Training/Tuning Terminology

### Pre-training
- Training a model from scratch on massive datasets
- Whisper was pre-trained on 680,000 hours of audio
- **Not practical for individuals** - requires enormous compute

### Fine-tuning
- Adapting a pre-trained model to a specific task/domain
- Updates model weights using domain-specific data
- Much less data/compute than pre-training

### Transfer Learning
- Using knowledge from one task to improve performance on another
- Whisper's multilingual training enables transfer to new domains
- Fine-tuning is a form of transfer learning

### Parameter-Efficient Fine-Tuning (PEFT)
- Techniques that update only a small fraction of model parameters
- Examples: LoRA, adapters, soft prompts
- Reduces memory, prevents catastrophic forgetting

### Knowledge Distillation
- Training a smaller "student" model to mimic a larger "teacher"
- Student learns from teacher's output distributions, not just labels
- Produces faster models with minimal quality loss

### Quantization
- Reducing numerical precision (FP32 → INT8 → INT4)
- Shrinks model size, speeds inference
- **Post-training** (no retraining) or **quantization-aware training**

---

## Fine-Tuning Approaches

### 1. Full Fine-Tuning

Updates all model parameters. Maximum flexibility but highest compute cost.

**Pros:**
- Best potential accuracy
- Full model adaptation

**Cons:**
- High memory (Large V3 needs 40GB+ VRAM for training)
- Risk of catastrophic forgetting
- Slow training

**When to use:** Large domain shift, abundant data, production quality requirement

**Results:** Studies show WER reductions from 70% → 28% on technical domains ([source](https://medium.com/@sushanttwayana1/fine-tuning-whisper-large-v3-for-domain-specific-speech-recognition-47bfd9c4a0bf))

---

### 2. LoRA (Low-Rank Adaptation)

Injects small trainable matrices into transformer layers while freezing base weights.

```
Original: Y = W·X
LoRA:     Y = W·X + (A·B)·X
          where A,B are small rank-r matrices
```

**Key parameters:**
- `r` (rank): 8-64 typical, controls adapter capacity
- `alpha`: scaling factor, typically 2×r
- `target_modules`: Usually attention projections (q,k,v,o) and FFN layers

**Typical config:**
```python
LoraConfig(
    r=32,
    lora_alpha=64,
    target_modules=["q_proj", "v_proj", "k_proj", "out_proj", "fc1", "fc2"],
    lora_dropout=0.05
)
```

**Results:**
- Updates only 0.8-1.6% of parameters
- CER: 49.5% → 11.1% with just LoRA r=8 ([source](https://pmc.ncbi.nlm.nih.gov/articles/PMC12431075/))
- Memory: ~5-10GB VRAM for Large V3

**Sources:** [AWS LoRA Tutorial](https://aws.amazon.com/blogs/machine-learning/fine-tune-whisper-models-on-amazon-sagemaker-with-lora/), [Emergent Mind](https://www.emergentmind.com/topics/lora-finetuned-whisper)

---

### 3. QLoRA (Quantized LoRA)

Combines 4-bit quantization with LoRA for extreme memory efficiency.

**How it works:**
1. Quantize base model to 4-bit NormalFloat (NF4)
2. Keep LoRA adapters in 16-bit
3. Dequantize on-the-fly during forward/backward passes

**Benefits:**
- Train 65B models on single 48GB GPU
- 7B models trainable on 16GB laptop VRAM
- Matches 16-bit LoRA performance with NF4

**Innovations:**
- **NF4**: Information-theoretically optimal for normally distributed weights
- **Double quantization**: Quantizes the quantization constants
- **Paged optimizers**: Handles memory spikes

**Note:** QLoRA was developed for LLMs. Direct Whisper implementations are emerging but less documented.

**Sources:** [QLoRA Paper](https://arxiv.org/abs/2305.14314), [HuggingFace Blog](https://huggingface.co/blog/4bit-transformers-bitsandbytes)

---

### 4. Adapter Layers (Bottleneck Adapters)

Insert small trainable modules between transformer layers.

```
Input → LayerNorm → Down-project → Activation → Up-project → + Input
```

**Comparison to LoRA:**
- Similar parameter efficiency
- Slightly higher latency (sequential vs parallel)
- Good for multi-task/multi-domain scenarios

**Key finding:** Adapters effectively mitigate catastrophic forgetting ([source](https://www.researchgate.net/publication/374947764_Using_Adapters_to_Overcome_Catastrophic_Forgetting_in_End-to-End_Automatic_Speech_Recognition))

---

### 5. Soft Prompt Tuning (SPT)

Prepends learnable "soft" tokens to input that steer model behavior.

**Variants:**
- **Shallow prompts**: Only at input layer
- **Deep prompts**: At every layer (more effective)
- **SLCT**: Soft Language Code Tuning for multilingual

**Best for:** Code-switching, maintaining prior knowledge while adapting

**Research:** SPT4ASR shows deep prompt tuning most effective for code-switching ASR ([source](https://arxiv.org/abs/2506.21576))

---

### 6. Layer Freezing Strategies

Freeze certain layers while fine-tuning others.

**Common approaches:**
- **Freeze encoder, train decoder**: Preserves acoustic understanding
- **Freeze bottom N layers**: Lower layers capture universal features
- **Progressive unfreezing**: Start frozen, gradually unfreeze

**Findings:**
- Freezing encoder entirely works well for most domain adaptation
- Bottom-layer freezing has "strongest ability" with lowest compute ([source](https://link.springer.com/article/10.1186/s13636-024-00349-3))

---

## Knowledge Distillation

### Distil-Whisper

Creates smaller, faster models by training on teacher's outputs.

**Architecture:**
- Copy encoder entirely (frozen)
- Reduce decoder: 32 layers → 4 layers (first + last)
- Train on KL divergence + pseudo-label loss

**Results:**
- **6x faster** inference
- **49% smaller** (809M → ~390M params)
- **<1% WER degradation** on OOD data
- Less prone to hallucination on long audio

**Training data:** 22,000 hours from 9 open-source datasets

**Speculative decoding:** Use distilled model as "draft" for large model verification → 2x faster with identical outputs

**Limitation:** Currently English-only; community efforts ongoing for other languages

**Sources:** [Distil-Whisper Paper](https://arxiv.org/abs/2311.00430), [GitHub](https://github.com/huggingface/distil-whisper)

---

## Quantization for Deployment

### Post-Training Quantization

No retraining required. Apply after fine-tuning.

| Method | Precision | Speed Gain | Size Reduction | Accuracy Impact |
|--------|-----------|------------|----------------|-----------------|
| Dynamic INT8 | 8-bit | ~1.5-2x | ~4x | Minimal |
| Static INT8 | 8-bit | ~2-3x | ~4x | Requires calibration |
| INT4 | 4-bit | ~2-4x | ~8x | Measurable but acceptable |

**Dynamic quantization (ONNX Runtime):**
- Weights quantized, activations in higher precision
- No calibration data needed
- Best for CPU inference

**Static quantization:**
- Both weights and activations quantized
- Requires representative calibration set
- Better for GPU/accelerator inference

**Results with LoRA-INT8 Whisper:**
- 60MB checkpoint (from ~1.5GB)
- RTF = 0.20 on MacBook M1 Max (5x real-time)
- 43% lower latency than FP16

**Sources:** [Quantization Analysis](https://arxiv.org/html/2503.09905v1), [ONNX Quantization](https://onnxruntime.ai/docs/performance/model-optimizations/quantization.html)

### Hardware Support

| Platform | INT8 Support |
|----------|--------------|
| AMD Zen 4 | VNNI instructions |
| Intel 12th+ Gen | VNNI |
| Apple M1/M2/M3/M4 | Neural Engine |
| NVIDIA Tensor Core | FP16/INT8 mixed |
| ARM Neoverse V1/V2 | Dot-product |

---

## Data Considerations

### How Much Data?

| Scenario | Hours Needed | Approach |
|----------|--------------|----------|
| Vocabulary boost | 1-5 hours | LoRA, few epochs |
| Domain adaptation | 5-20 hours | LoRA or full fine-tune |
| New language/accent | 20-100 hours | Full fine-tune |
| Production quality | 100+ hours | Full fine-tune + evaluation |

**Key finding:** Fine-tuning Whisper-large-v2 with just 20 hours reduced WER by 56.94% ([source](https://arxiv.org/html/2412.15726v1))

---

### Synthetic Data Generation

Create training data using TTS when real recordings are scarce.

**Pipeline:**
1. Create text corpus with target vocabulary (code keywords, variable names, etc.)
2. Generate audio with TTS (VITS, Tacotron2, Coqui TTS)
3. Add realistic noise/room effects
4. Fine-tune Whisper on synthetic + real data

**TTS options:**
- **Coqui TTS**: Open source, multiple architectures
- **VITS**: Fast, high quality, end-to-end
- **Tacotron2**: Mature, well-documented

**Effective with minimal data:** 5 audio files + 40 epochs = working jargon recognition ([source](https://medium.com/axinc-ai/whisper-fine-tuning-to-transcribe-jargon-976164a5eac8))

**Repository:** [dscripka/synthetic_speech_dataset_generation](https://github.com/dscripka/synthetic_speech_dataset_generation)

---

### Developer/Code Voice Data

**Existing resources:**
- **ACM Programming by Voice Dataset**: First dataset of spoken code transcripts ([paper](https://dl.acm.org/doi/fullHtml/10.1145/3571884.3597130))
- **Serenade**: Open-source voice coding engine with training data

**Challenge:** Scaling spoken code datasets requires programmers (expensive to recruit) and time-consuming transcription.

**Approach for MojoVoice:**
1. Record yourself speaking code commands
2. Use existing code corpora for text prompts
3. Generate synthetic audio with TTS
4. Mix synthetic + real recordings

---

## Preventing Catastrophic Forgetting

When fine-tuning, the model may "forget" general speech recognition ability.

### Techniques

| Technique | Description | Effectiveness |
|-----------|-------------|---------------|
| **LoRA/Adapters** | Freeze base weights | Very effective |
| **Mixed training data** | Include general + domain data | Effective |
| **Elastic Weight Consolidation** | Penalize changes to important weights | Moderate |
| **Orthogonal LoRA (O-LoRA)** | Orthogonal gradient descent | Very effective |
| **Model interpolation** | Blend fine-tuned + original weights | Simple, effective |

**Key findings:**
- LoRA-Whisper "mitigates language interference and avoids catastrophic forgetting" ([source](https://arxiv.org/html/2406.06619v1))
- O-LoRA reduced forgetting: Chinese WER 30% → 12.35% after Tibetan fine-tuning ([source](https://arxiv.org/html/2408.10680v1))

### Critical: Preserve Timestamps

Whisper Turbo is especially prone to forgetting timestamp generation. If timestamps break, long-form transcription fails entirely.

**Mitigation:** Include timestamped samples in training data ([source](https://www.ivrit.ai/en/2025/02/13/training-whisper/))

---

## Model Selection

### Whisper Model Comparison

| Model | Params | VRAM (inference) | VRAM (training) | Speed | Accuracy |
|-------|--------|------------------|-----------------|-------|----------|
| tiny | 39M | 1GB | 4GB | Fastest | Lowest |
| base | 74M | 1GB | 6GB | Very fast | Low |
| small | 244M | 2GB | 10GB | Fast | Good |
| medium | 769M | 5GB | 20GB | Moderate | Very good |
| large-v2 | 1.55B | 10GB | 40GB+ | Slow | Excellent |
| large-v3 | 1.55B | 10GB | 40GB+ | Slow | Best |
| **large-v3-turbo** | 809M | 6GB | 20GB | **6x faster** | Near large-v2 |

### Recommendation for MojoVoice

**Start with: `large-v3-turbo`**

- Best speed/accuracy tradeoff
- 6x faster than large-v3, accuracy within 1-2%
- Reasonable VRAM for LoRA fine-tuning (~10-12GB)
- Already optimized (4-layer decoder vs 32)

**Alternative: `distil-whisper-large-v2`**
- Even faster (6x over base large)
- 49% smaller
- Good for resource-constrained deployment

---

## Whisper Conditioning & Prompts

### Without Training

Whisper accepts conditioning tokens that influence transcription:

**Prompt token:** Conditions on "previous" text (style/vocabulary hints)
```python
# Tells model to expect technical terms
model.transcribe(audio, initial_prompt="Let me write some Python code using numpy arrays and pandas dataframes")
```

**Limitations:**
- Max 224 tokens
- Only affects first 30s (subsequent chunks use previous output)
- Not as powerful as fine-tuning

### Special Tokens

```
<|startoftranscript|> <|en|> <|transcribe|> [<|notimestamps|>]
```

- Language ID affects vocabulary expectations
- Task token: `<|transcribe|>` vs `<|translate|>`
- Timestamps can be enabled/disabled

**Sources:** [OpenAI Cookbook](https://cookbook.openai.com/examples/whisper_prompting_guide), [HuggingFace Docs](https://huggingface.co/docs/transformers/model_doc/whisper)

---

## Evaluation Metrics

### WER (Word Error Rate)

```
WER = (Substitutions + Insertions + Deletions) / Total Words
```

- Standard metric for English ASR
- Easy to interpret (lower = better)
- Limitation: All errors weighted equally

### CER (Character Error Rate)

```
CER = (Substitutions + Insertions + Deletions) / Total Characters
```

- Better for morphologically complex languages
- More granular error measurement
- Recommended for multilingual evaluation ([source](https://aclanthology.org/2025.findings-naacl.277/))

### Domain-Specific Evaluation

For developer voice-to-text:
- **Keyword accuracy**: Did it get `numpy`, `async`, `useState` right?
- **Code validity**: Can the transcribed code compile/run?
- **Semantic similarity**: Does meaning match intent?

**Tools:** `jiwer` library for WER/CER computation

---

## Recommended Approach for MojoVoice

### Phase 1: Quick Wins (No Training)

1. Use `large-v3-turbo` with Mojo-Audio FFI
2. Add prompt conditioning with programming vocabulary
3. Benchmark baseline WER on developer speech samples

### Phase 2: Data Collection

1. **Vocabulary list**: Common code terms, framework names, CLI commands
2. **Record real samples**: 5-10 hours of developer voice commands
3. **Generate synthetic data**: Use TTS for vocabulary coverage
4. **Format properly**: Include timestamps, varied speakers

### Phase 3: LoRA Fine-Tuning

```bash
# Example training config
python train.py \
  --model_name openai/whisper-large-v3-turbo \
  --dataset ./developer_voice_dataset \
  --output_dir ./mojovoice-tuned \
  --use_peft \
  --lora_r 32 \
  --lora_alpha 64 \
  --learning_rate 1e-4 \  # 40x smaller than pretraining
  --max_steps 5000 \
  --per_device_train_batch_size 8 \
  --gradient_accumulation_steps 4
```

### Phase 4: Evaluation & Iteration

1. Evaluate on held-out developer speech
2. Check for catastrophic forgetting on general speech
3. Iterate on data mix if needed

### Phase 5: Deployment Optimization

1. Export to ONNX
2. Apply INT8 dynamic quantization
3. Benchmark latency/throughput
4. Consider speculative decoding with distilled model

---

## Resources

### Tutorials
- [HuggingFace Fine-Tune Whisper](https://huggingface.co/blog/fine-tune-whisper)
- [Modal Domain-Specific Vocab](https://modal.com/docs/examples/fine_tune_asr)
- [AWS LoRA Fine-Tuning](https://aws.amazon.com/blogs/machine-learning/fine-tune-whisper-models-on-amazon-sagemaker-with-lora/)

### Repositories
- [vasistalodagala/whisper-finetune](https://github.com/vasistalodagala/whisper-finetune)
- [Vaibhavs10/fast-whisper-finetuning](https://github.com/Vaibhavs10/fast-whisper-finetuning)
- [huggingface/distil-whisper](https://github.com/huggingface/distil-whisper)

### Papers
- [Whisper Original Paper](https://cdn.openai.com/papers/whisper.pdf)
- [Distil-Whisper](https://arxiv.org/abs/2311.00430)
- [LoRA](https://arxiv.org/abs/2106.09685)
- [QLoRA](https://arxiv.org/abs/2305.14314)

### Voice Coding
- [Serenade](https://serenade.ai/) - Open-source voice coding
- [ACM Programming by Voice](https://dl.acm.org/doi/fullHtml/10.1145/3571884.3597130)

---

## Summary

For MojoVoice, the most practical path:

1. **Start with `large-v3-turbo`** - best speed/accuracy for real-time
2. **Collect 10-20 hours** of developer voice data (mix real + synthetic)
3. **LoRA fine-tune** with r=32, targeting attention layers
4. **Evaluate** on code-specific WER metrics
5. **Quantize to INT8** for deployment

This approach requires:
- 1x 16GB GPU (or 8GB with QLoRA)
- ~1-2 days training time
- Minimal risk of catastrophic forgetting
- Incremental improvement path
