# Moonshine ASR Implementation Guide

**Date:** 2026-01-14
**Status:** Planning
**Effort:** 2-3 days
**Priority:** High (low-VRAM option for users)

---

## Overview

Add Moonshine speech recognition as an alternative to Whisper for users with limited VRAM.

| Aspect | Details |
|--------|---------|
| **Model** | UsefulSensors Moonshine |
| **Sizes** | Tiny (27M), Base (62M) |
| **VRAM** | <0.5 GB |
| **Approach** | ONNX Runtime |
| **Language** | English only |

---

## Architecture Differences

| Aspect | Whisper | Moonshine |
|--------|---------|-----------|
| **Input** | Mel spectrogram (80/128 bins) | Raw audio (16kHz) |
| **Preprocessing** | FFT → Mel filterbank | None needed |
| **Position encoding** | Absolute | RoPE (Rotary) |
| **Tokenizer** | Whisper-specific | SentencePiece |
| **Chunk handling** | Fixed 30s chunks | Variable length |

---

## Implementation Steps

### Step 1: Add Dependencies

Add to `Cargo.toml`:

```toml
[dependencies]
ort = { version = "2.0", features = ["cuda"] }
```

The `ort` crate provides Rust bindings to ONNX Runtime with CUDA support.

### Step 2: Create MoonshineEngine

Create `src/transcribe/moonshine_engine.rs`:

```rust
//! Moonshine ASR engine using ONNX Runtime
//!
//! Moonshine is optimized for edge devices with minimal VRAM requirements.
//! Unlike Whisper, it takes raw audio input (no mel spectrogram needed).

use anyhow::{Context, Result};
use ort::{GraphOptimizationLevel, Session};
use std::path::Path;
use tracing::info;

use crate::transcribe::Transcriber;

pub struct MoonshineEngine {
    session: Session,
    sample_rate: u32,
}

impl MoonshineEngine {
    /// Create a new Moonshine engine from an ONNX model file
    pub fn new(model_path: &str) -> Result<Self> {
        info!("Loading Moonshine model from: {}", model_path);

        let session = Session::builder()?
            .with_optimization_level(GraphOptimizationLevel::Level3)?
            .with_intra_threads(4)?
            .commit_from_file(model_path)
            .context("Failed to load Moonshine ONNX model")?;

        info!("Moonshine model loaded successfully");

        Ok(Self {
            session,
            sample_rate: 16000,
        })
    }

    /// Decode output token IDs to text
    fn decode_tokens(&self, tokens: &[i64]) -> Result<String> {
        // TODO: Implement SentencePiece decoding
        // Option 1: Use `tokenizers` crate with Moonshine's tokenizer.json
        // Option 2: Use `sentencepiece` crate directly
        todo!("Implement token decoding")
    }
}

impl Transcriber for MoonshineEngine {
    fn transcribe(&mut self, audio: &[f32]) -> Result<String> {
        // Moonshine takes raw audio, no mel conversion needed
        let audio_len = audio.len();
        info!("Transcribing {} samples ({:.2}s)", audio_len, audio_len as f32 / 16000.0);

        // Prepare input tensor
        // Shape: [1, audio_length] for batch size 1
        let input_array = ndarray::Array2::from_shape_vec(
            (1, audio_len),
            audio.to_vec(),
        )?;

        let input = ort::Value::from_array(&input_array)?;

        // Run inference
        let outputs = self.session.run(vec![("audio".into(), input)])?;

        // Extract output tokens
        let output_tensor = outputs[0].extract_tensor::<i64>()?;
        let tokens: Vec<i64> = output_tensor.view().iter().copied().collect();

        // Decode to text
        self.decode_tokens(&tokens)
    }
}
```

### Step 3: Implement Tokenizer

Moonshine uses SentencePiece. Two options:

**Option A: Use `tokenizers` crate (recommended)**

```rust
use tokenizers::Tokenizer;

pub struct MoonshineEngine {
    session: Session,
    tokenizer: Tokenizer,
    sample_rate: u32,
}

impl MoonshineEngine {
    pub fn new(model_path: &str) -> Result<Self> {
        // Load tokenizer from same directory as model
        let model_dir = Path::new(model_path).parent().unwrap();
        let tokenizer_path = model_dir.join("tokenizer.json");

        let tokenizer = Tokenizer::from_file(&tokenizer_path)
            .map_err(|e| anyhow::anyhow!("Failed to load tokenizer: {}", e))?;

        // ... rest of initialization
    }

    fn decode_tokens(&self, tokens: &[i64]) -> Result<String> {
        let token_ids: Vec<u32> = tokens.iter().map(|&t| t as u32).collect();
        let decoded = self.tokenizer.decode(&token_ids, true)
            .map_err(|e| anyhow::anyhow!("Decode error: {}", e))?;
        Ok(decoded)
    }
}
```

**Option B: Use `sentencepiece` crate**

```rust
use sentencepiece::SentencePieceProcessor;

fn decode_tokens(&self, tokens: &[i64]) -> Result<String> {
    let pieces: Vec<i32> = tokens.iter().map(|&t| t as i32).collect();
    self.spp.decode_piece_ids(&pieces)
        .map_err(|e| anyhow::anyhow!("Decode error: {}", e))
}
```

### Step 4: Add Model Registry Entries

Add to `src/model/registry.rs`:

```rust
// Moonshine models (ONNX format)
ModelInfo {
    name: "moonshine-tiny",
    filename: "moonshine-tiny.onnx",
    url: "https://huggingface.co/UsefulSensors/moonshine-tiny-onnx/resolve/main/model.onnx",
    sha256: "TODO_GET_HASH",
    size_mb: 100,  // Approximate
},
ModelInfo {
    name: "moonshine-base",
    filename: "moonshine-base.onnx",
    url: "https://huggingface.co/UsefulSensors/moonshine-base-onnx/resolve/main/model.onnx",
    sha256: "TODO_GET_HASH",
    size_mb: 250,  // Approximate
},
```

Also need to download tokenizer files alongside model.

### Step 5: Update Module Structure

Update `src/transcribe/mod.rs`:

```rust
use anyhow::Result;

pub mod candle_engine;
pub mod moonshine_engine;

/// Trait to abstract transcription engines
pub trait Transcriber: Send + Sync {
    fn transcribe(&mut self, audio: &[f32]) -> Result<String>;
}

/// Supported model types
pub enum ModelType {
    Whisper,
    Moonshine,
}

/// Create a transcriber based on model type
pub fn create_transcriber(
    model_type: ModelType,
    model_path: &str,
    language: &str,
) -> Result<Box<dyn Transcriber>> {
    match model_type {
        ModelType::Whisper => {
            let engine = candle_engine::CandleEngine::with_options(model_path, language, None)?;
            Ok(Box::new(engine))
        }
        ModelType::Moonshine => {
            let engine = moonshine_engine::MoonshineEngine::new(model_path)?;
            Ok(Box::new(engine))
        }
    }
}
```

### Step 6: Update Config

Update `src/config/settings.rs`:

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelConfig {
    /// Model type: "whisper" or "moonshine"
    #[serde(default = "default_model_type")]
    pub model_type: String,

    /// Path to model file
    pub path: PathBuf,

    // ... existing fields
}

fn default_model_type() -> String {
    "whisper".to_string()
}
```

### Step 7: Update Daemon

Update `src/daemon/server.rs` to use the factory:

```rust
use crate::transcribe::{self, ModelType};

fn new(_model_path: &Path) -> Result<Self> {
    let config = crate::config::load()?;

    let model_type = match config.model.model_type.as_str() {
        "moonshine" => ModelType::Moonshine,
        _ => ModelType::Whisper,
    };

    let transcriber = transcribe::create_transcriber(
        model_type,
        config.model.path.to_str().unwrap(),
        &config.model.language,
    )?;

    // ... rest unchanged
}
```

---

## Testing

### Unit Tests

```rust
// src/transcribe/moonshine_engine.rs

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    #[ignore] // Requires model file
    fn test_moonshine_loads() {
        let engine = MoonshineEngine::new("models/moonshine-tiny.onnx");
        assert!(engine.is_ok());
    }

    #[test]
    #[ignore] // Requires model file
    fn test_moonshine_transcribes() {
        let mut engine = MoonshineEngine::new("models/moonshine-tiny.onnx").unwrap();

        // Load test audio
        let audio = vec![0.0f32; 16000]; // 1 second of silence
        let result = engine.transcribe(&audio);

        assert!(result.is_ok());
    }
}
```

### Integration Tests

Add to `tests/transcription.rs`:

```rust
#[test]
#[ignore]
fn test_moonshine_sample_audio() {
    let mut engine = MoonshineEngine::new("models/moonshine-base.onnx").unwrap();

    let audio = load_wav("assets/audio/samples/harvard_01.wav").unwrap();
    let text = engine.transcribe(&audio).unwrap();

    assert!(text.to_lowercase().contains("oak"));
}
```

---

## File Checklist

- [ ] `Cargo.toml` - Add `ort` dependency
- [ ] `src/transcribe/moonshine_engine.rs` - New engine implementation
- [ ] `src/transcribe/mod.rs` - Add module, create factory function
- [ ] `src/model/registry.rs` - Add Moonshine ONNX model entries
- [ ] `src/config/settings.rs` - Add `model_type` field
- [ ] `src/daemon/server.rs` - Use transcriber factory
- [ ] `tests/transcription.rs` - Add Moonshine tests

---

## Resources

- [Moonshine GitHub](https://github.com/usefulsensors/moonshine)
- [Moonshine HuggingFace](https://huggingface.co/UsefulSensors/moonshine)
- [ONNX Models](https://huggingface.co/UsefulSensors/moonshine-base-onnx)
- [ort crate docs](https://docs.rs/ort/latest/ort/)
- [HuggingFace Transformers Moonshine](https://huggingface.co/docs/transformers/model_doc/moonshine)

---

## Notes

- Moonshine is English-only (no multilingual support)
- No mel spectrogram preprocessing needed (simpler pipeline)
- Variable-length audio support (no fixed 30s chunks)
- Much faster on short audio clips due to no padding
