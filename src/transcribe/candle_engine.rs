use anyhow::Result;
use candle_core::{Device, IndexOp, Tensor};
use candle_nn::VarBuilder;
use candle_transformers::models::whisper::{self, Config};
use hf_hub::{Repo, api::sync::Api};
use std::io::Read;
use std::path::Path;
use tokenizers::Tokenizer;
use tracing::{debug, info, warn};

use super::mojo_ffi;
use crate::transcribe::Transcriber;

/// Validate that a file is a valid GGUF format by checking the magic bytes
fn is_valid_gguf(path: &Path) -> bool {
    // GGUF files start with magic number "GGUF" (0x46554747 in little-endian)
    if let Ok(mut file) = std::fs::File::open(path) {
        let mut magic = [0u8; 4];
        if file.read_exact(&mut magic).is_ok() {
            // GGUF magic: "GGUF" = [0x47, 0x47, 0x55, 0x46]
            return &magic == b"GGUF";
        }
    }
    false
}

// Temperature fallback constants (from official Candle Whisper example)
const TEMPERATURES: [f64; 6] = [0.0, 0.2, 0.4, 0.6, 0.8, 1.0];
const COMPRESSION_RATIO_THRESHOLD: f64 = 2.4;
const LOGPROB_THRESHOLD: f64 = -1.0;

// Audio chunking constants for long-form transcription
const CHUNK_LENGTH_SECS: f32 = 30.0; // Maximum 30 seconds per chunk (Whisper limit)
const CHUNK_OVERLAP_SECS: f32 = 5.0; // 5-second overlap between chunks
const SAMPLE_RATE: usize = 16000; // Whisper requires 16kHz audio

/// Model wrapper supporting both normal (safetensors) and quantized (GGUF) models
enum Model {
    Normal(whisper::model::Whisper),
    Quantized(whisper::quantized_model::Whisper),
}

impl Model {
    /// Forward pass through encoder
    fn encoder_forward(&mut self, mel: &Tensor, flush: bool) -> Result<Tensor> {
        match self {
            Self::Normal(m) => Ok(m.encoder.forward(mel, flush)?),
            Self::Quantized(m) => Ok(m.encoder.forward(mel, flush)?),
        }
    }

    /// Forward pass through decoder
    fn decoder_forward(
        &mut self,
        tokens: &Tensor,
        audio_features: &Tensor,
        flush: bool,
    ) -> Result<Tensor> {
        match self {
            Self::Normal(m) => Ok(m.decoder.forward(tokens, audio_features, flush)?),
            Self::Quantized(m) => Ok(m.decoder.forward(tokens, audio_features, flush)?),
        }
    }

    /// Final linear projection to vocabulary
    fn decoder_final_linear(&self, x: &Tensor) -> Result<Tensor> {
        match self {
            Self::Normal(m) => Ok(m.decoder.final_linear(x)?),
            Self::Quantized(m) => Ok(m.decoder.final_linear(x)?),
        }
    }
}

/// Candle-based Whisper transcription engine
pub struct CandleEngine {
    device: Device,
    model: Model,
    tokenizer: Tokenizer,
    language: String,
    initial_prompt: Option<String>,
    suppress_tokens: Tensor,
    num_mel_bins: usize,   // 128 for large-v3/turbo, 80 for others
    is_english_only: bool, // True for .en models (skip lang/task tokens)
}

impl CandleEngine {
    /// Create a new CandleEngine with language and optional initial prompt
    ///
    /// # Arguments
    /// * `model_id` - Local file path to GGUF model OR HuggingFace model ID
    ///   - Local: "/path/to/model.gguf" or "/path/to/model.bin"
    ///   - HuggingFace: "openai/whisper-large-v3-turbo" (downloads safetensors)
    ///   - HuggingFace quantized: "Demonthos/candle-quantized-whisper-large-v3-turbo" (downloads GGUF)
    /// * `language` - Language code (e.g., "en", "es", "fr")
    /// * `initial_prompt` - Optional technical vocabulary prompt to bias transcription
    pub fn with_options(
        model_id: &str,
        language: &str,
        initial_prompt: Option<String>,
    ) -> Result<Self> {
        let device = Self::get_device()?;
        info!("Using device: {:?}", device);

        // Check if model_id is a local path (file or directory)
        let model_path = Path::new(model_id);
        let is_local = model_path.exists();

        // Detect model format:
        // 1. Direct GGUF file: /path/to/model.gguf
        // 2. Directory with GGUF: /path/to/model_dir/model.gguf
        // 3. Directory with safetensors: /path/to/model_dir/model.safetensors
        let is_direct_gguf =
            is_local && (model_id.ends_with(".gguf") || model_id.ends_with(".bin"));
        let is_dir_gguf = is_local && model_path.is_dir() && model_path.join("model.gguf").exists();
        let is_quantized = is_direct_gguf || is_dir_gguf;

        let (config, tokenizer, model) = if is_local {
            info!("Loading model from local path: {}", model_id);

            if is_quantized {
                // Load GGUF quantized model
                info!("Detected quantized model (GGUF format)");

                // Determine the actual GGUF file path
                let gguf_path = if is_direct_gguf {
                    model_path.to_path_buf()
                } else {
                    model_path.join("model.gguf")
                };

                // Validate GGUF file format
                if !is_valid_gguf(&gguf_path) {
                    anyhow::bail!(
                        "Invalid or corrupted GGUF file: {:?}. File may be a different format (GGML, safetensors) or corrupted.",
                        gguf_path
                    );
                }

                // For quantized models, we need config and tokenizer
                // Try local files first (if downloaded via registry), fall back to HuggingFace
                let (config, tokenizer) = if is_dir_gguf {
                    let config_path = model_path.join("config.json");
                    let tokenizer_path = model_path.join("tokenizer.json");

                    if config_path.exists() && tokenizer_path.exists() {
                        info!("Using local config and tokenizer");
                        let config: Config =
                            serde_json::from_str(&std::fs::read_to_string(&config_path)?)?;
                        let tokenizer = Tokenizer::from_file(&tokenizer_path)
                            .map_err(|e| anyhow::anyhow!("Failed to load tokenizer: {}", e))?;
                        (config, tokenizer)
                    } else {
                        // Fall back to HuggingFace for config/tokenizer
                        // WARNING: Using large-v3-turbo config - may not match your GGUF model!
                        warn!(
                            "Config/tokenizer not found locally - falling back to openai/whisper-large-v3-turbo. \
                             If your GGUF model is not based on large-v3-turbo, this may cause issues. \
                             Consider downloading the model via the UI to get matching config files."
                        );
                        let api = Api::new()?;
                        let repo =
                            api.repo(Repo::model("openai/whisper-large-v3-turbo".to_string()));
                        let config_filename = repo.get("config.json")?;
                        let tokenizer_filename = repo.get("tokenizer.json")?;
                        let config: Config =
                            serde_json::from_str(&std::fs::read_to_string(config_filename)?)?;
                        let tokenizer = Tokenizer::from_file(tokenizer_filename)
                            .map_err(|e| anyhow::anyhow!("Failed to load tokenizer: {}", e))?;
                        (config, tokenizer)
                    }
                } else {
                    // Direct GGUF file - must fetch from HuggingFace
                    // WARNING: Using large-v3-turbo config - may not match your GGUF model!
                    warn!(
                        "Direct GGUF file without local config - falling back to openai/whisper-large-v3-turbo. \
                         If your GGUF model is not based on large-v3-turbo, this may cause issues."
                    );
                    let api = Api::new()?;
                    let repo = api.repo(Repo::model("openai/whisper-large-v3-turbo".to_string()));
                    let config_filename = repo.get("config.json")?;
                    let tokenizer_filename = repo.get("tokenizer.json")?;
                    let config: Config =
                        serde_json::from_str(&std::fs::read_to_string(config_filename)?)?;
                    let tokenizer = Tokenizer::from_file(tokenizer_filename)
                        .map_err(|e| anyhow::anyhow!("Failed to load tokenizer: {}", e))?;
                    (config, tokenizer)
                };

                // Load quantized weights
                let vb = candle_transformers::quantized_var_builder::VarBuilder::from_gguf(
                    &gguf_path, &device,
                )?;
                let model = Model::Quantized(whisper::quantized_model::Whisper::load(
                    &vb,
                    config.clone(),
                )?);

                (config, tokenizer, model)
            } else {
                // Load safetensors from local directory
                info!("Loading local safetensors model");

                let config_path = model_path.join("config.json");
                let tokenizer_path = model_path.join("tokenizer.json");
                let weights_path = model_path.join("model.safetensors");

                // Verify files exist
                if !config_path.exists() {
                    anyhow::bail!("Config not found: {:?}", config_path);
                }
                if !tokenizer_path.exists() {
                    anyhow::bail!("Tokenizer not found: {:?}", tokenizer_path);
                }
                if !weights_path.exists() {
                    anyhow::bail!("Model weights not found: {:?}", weights_path);
                }

                let config: Config = serde_json::from_str(&std::fs::read_to_string(config_path)?)?;
                let tokenizer = Tokenizer::from_file(tokenizer_path)
                    .map_err(|e| anyhow::anyhow!("Failed to load tokenizer: {}", e))?;

                let vb = unsafe {
                    VarBuilder::from_mmaped_safetensors(&[weights_path], whisper::DTYPE, &device)?
                };
                let model = Model::Normal(whisper::model::Whisper::load(&vb, config.clone())?);

                (config, tokenizer, model)
            }
        } else {
            // Download from HuggingFace
            info!("Downloading model from HuggingFace: {}", model_id);

            let api = Api::new()?;
            let repo = api.repo(Repo::model(model_id.to_string()));

            let config_filename = repo.get("config.json")?;
            let tokenizer_filename = repo.get("tokenizer.json")?;

            let config: Config = serde_json::from_str(&std::fs::read_to_string(config_filename)?)?;
            let tokenizer = Tokenizer::from_file(tokenizer_filename)
                .map_err(|e| anyhow::anyhow!("Failed to load tokenizer: {}", e))?;

            // Try to load quantized model first, fall back to safetensors
            let model = if let Ok(weights_filename) = repo.get("model.gguf") {
                info!("Found GGUF model, loading quantized variant");
                let vb = candle_transformers::quantized_var_builder::VarBuilder::from_gguf(
                    &weights_filename,
                    &device,
                )?;
                Model::Quantized(whisper::quantized_model::Whisper::load(
                    &vb,
                    config.clone(),
                )?)
            } else {
                info!("Loading safetensors model (normal precision)");
                let weights_filename = repo.get("model.safetensors")?;
                let vb = unsafe {
                    VarBuilder::from_mmaped_safetensors(
                        &[weights_filename],
                        whisper::DTYPE,
                        &device,
                    )?
                };
                Model::Normal(whisper::model::Whisper::load(&vb, config.clone())?)
            };

            (config, tokenizer, model)
        };

        info!("Model loaded successfully");

        // Detect English-only models (they use a simpler token sequence)
        // English-only models have forced_decoder_ids that skip language/task tokens
        // They expect: <|sot|><|notimestamps|>... instead of <|sot|><|lang|><|task|><|notimestamps|>...
        let is_english_only = model_id.contains(".en")
            || model_id.ends_with("-en")
            || model_id.contains("whisper-tiny-en")
            || model_id.contains("whisper-base-en")
            || model_id.contains("whisper-small-en")
            || model_id.contains("whisper-medium-en");

        if is_english_only {
            info!("Detected English-only model - using simplified token sequence");
        }

        // Build suppress tokens mask to prevent unwanted tokens (like 199)
        let vocab_size = tokenizer.get_vocab_size(true);
        let no_ts_token = tokenizer
            .token_to_id("<|notimestamps|>")
            .ok_or_else(|| anyhow::anyhow!("No timestamps token not found"))?;

        let mut suppress_list = vec![220u32]; // Blank token only (NOT EOT - we need that!)
        // Suppress all timestamp tokens (everything after <|notimestamps|>)
        for i in (no_ts_token + 1)..vocab_size as u32 {
            suppress_list.push(i);
        }

        let mut mask = vec![0f32; vocab_size];
        for &token in &suppress_list {
            mask[token as usize] = f32::NEG_INFINITY;
        }
        let suppress_tokens = Tensor::new(&mask[..], &device)?;
        info!(
            "Suppress mask created: {} tokens suppressed",
            suppress_list.len()
        );

        info!(
            "CandleEngine initialization complete - ready for transcription (num_mel_bins={})",
            config.num_mel_bins
        );

        Ok(Self {
            device,
            model,
            tokenizer,
            language: language.to_string(),
            initial_prompt,
            suppress_tokens,
            num_mel_bins: config.num_mel_bins,
            is_english_only,
        })
    }

    fn get_device() -> Result<Device> {
        // Try CUDA first with detailed error reporting
        match Device::new_cuda(0) {
            Ok(device) => {
                info!("CUDA device initialized successfully");
                return Ok(device);
            },
            Err(e) => {
                warn!("CUDA initialization failed: {}", e);
            },
        }

        // Try Metal (macOS)
        if candle_core::utils::metal_is_available() {
            info!("Using Metal device");
            return Ok(Device::new_metal(0)?);
        }

        // Fallback to CPU
        warn!("No GPU accelerator found, falling back to CPU");
        Ok(Device::Cpu)
    }

    /// Get special token IDs from the tokenizer
    fn get_special_tokens(&self) -> Result<SpecialTokens> {
        // Helper to convert token string to ID
        let token_id = |token: &str| -> Result<u32> {
            self.tokenizer
                .token_to_id(token)
                .ok_or_else(|| anyhow::anyhow!("Token not found: {}", token))
        };

        let sot_token = token_id("<|startoftranscript|>")?;
        let eot_token = token_id("<|endoftext|>")?;
        let transcribe_token = token_id("<|transcribe|>")?;
        let no_timestamps_token = token_id("<|notimestamps|>")?;
        let language_token = token_id(&format!("<|{}|>", self.language))?;

        Ok(SpecialTokens {
            sot_token,
            eot_token,
            transcribe_token,
            no_timestamps_token,
            language_token,
        })
    }

    /// Encode the initial prompt if provided
    fn encode_initial_prompt(&self) -> Result<Vec<u32>> {
        if let Some(ref prompt) = self.initial_prompt {
            let encoding = self
                .tokenizer
                .encode(prompt.clone(), false)
                .map_err(|e| anyhow::anyhow!("Failed to encode initial prompt: {}", e))?;

            let tokens = encoding.get_ids().to_vec();

            // CRITICAL: Whisper expects short prompts (<50 tokens)
            // Long prompts cause decoder to get stuck in infinite loops
            const MAX_PROMPT_TOKENS: usize = 50;
            if tokens.len() > MAX_PROMPT_TOKENS {
                warn!(
                    "Initial prompt has {} tokens, truncating to {} (prompt length: {} chars)",
                    tokens.len(),
                    MAX_PROMPT_TOKENS,
                    prompt.len()
                );
                Ok(tokens[..MAX_PROMPT_TOKENS].to_vec())
            } else {
                debug!("Using {} prompt tokens", tokens.len());
                Ok(tokens)
            }
        } else {
            Ok(Vec::new())
        }
    }

    fn decode_at_temperature(
        &mut self,
        mel: &Tensor,
        temperature: f64,
    ) -> Result<(String, f64, f64)> {
        debug!(
            "decode_at_temperature: mel shape {:?}, temp {}",
            mel.shape(),
            temperature
        );

        let special_tokens = self.get_special_tokens()?;
        debug!(
            "Special tokens: SOT={}, EOT={}, Lang={}, Transcribe={}, NoTS={}",
            special_tokens.sot_token,
            special_tokens.eot_token,
            special_tokens.language_token,
            special_tokens.transcribe_token,
            special_tokens.no_timestamps_token
        );

        let prompt_tokens = self.encode_initial_prompt()?;
        debug!("Got {} prompt tokens", prompt_tokens.len());

        // Run encoder
        debug!(
            "Running encoder forward pass on mel shape: {:?}",
            mel.shape()
        );
        let audio_features = self.model.encoder_forward(mel, true)?;
        debug!(
            "Encoder output: batch={}, frames={}, d_model={}",
            audio_features.dim(0)?,
            audio_features.dim(1)?,
            audio_features.dim(2)?
        );

        // Build initial token sequence based on model type:
        // - Multilingual: <|sot|><|lang|><|transcribe|><|notimestamps|>[prompt]
        // - English-only: <|sot|><|notimestamps|>[prompt]
        let mut current_tokens = if self.is_english_only {
            // English-only models expect simplified sequence (no language/task tokens)
            vec![special_tokens.sot_token, special_tokens.no_timestamps_token]
        } else {
            // Multilingual models need full sequence
            vec![
                special_tokens.sot_token,
                special_tokens.language_token,
                special_tokens.transcribe_token,
                special_tokens.no_timestamps_token,
            ]
        };
        let num_special = current_tokens.len();
        current_tokens.extend_from_slice(&prompt_tokens);
        debug!(
            "Initial tokens: {} special + {} prompt = {} total (english_only={})",
            num_special,
            prompt_tokens.len(),
            current_tokens.len(),
            self.is_english_only
        );

        // Greedy decoding loop with quality metrics
        let mut result_tokens = Vec::new();
        let start_result_idx = current_tokens.len();

        // Decoder has hard limit of 448 total positions
        let max_tokens = 448_usize.saturating_sub(start_result_idx);
        debug!(
            "Max new tokens: {} (start_idx={})",
            max_tokens, start_result_idx
        );

        // Quality metrics tracking
        let mut sum_logprob = 0.0f64;
        let mut logprob_count = 0;

        // Track repeated tokens to detect infinite loops
        let mut last_token: Option<u32> = None;
        let mut repeat_count = 0;
        const MAX_REPEATS: usize = 3;

        for iteration in 0..max_tokens {
            let input = Tensor::new(current_tokens.as_slice(), &self.device)?.unsqueeze(0)?;

            // Flush KV cache only on first iteration
            let decoder_output =
                self.model
                    .decoder_forward(&input, &audio_features, iteration == 0)?;

            let logits = self.model.decoder_final_linear(&decoder_output)?;
            let logits = logits.squeeze(0)?;
            let seq_len = logits.dim(0)?;
            let mut last_logit = logits.i((seq_len - 1, ..))?;

            // Apply suppress mask and temperature
            last_logit = last_logit.broadcast_add(&self.suppress_tokens)?;
            if temperature > 0.0 {
                last_logit = (last_logit / temperature)?;
            }

            // Compute log probabilities for quality metrics
            let log_probs = candle_nn::ops::softmax(&last_logit, 0)?;
            let next_token = last_logit.argmax(0)?.to_scalar::<u32>()?;

            let token_logprob = log_probs.get(next_token as usize)?.to_scalar::<f32>()? as f64;
            if token_logprob > 0.0 {
                sum_logprob += token_logprob.ln();
                logprob_count += 1;
            }

            if next_token == special_tokens.eot_token {
                debug!("EOT at iteration {}", iteration);
                break;
            }

            // Detect infinite loops from repeated tokens
            if let Some(last) = last_token {
                if last == next_token {
                    repeat_count += 1;
                    if repeat_count >= MAX_REPEATS {
                        warn!(
                            "Token {} repeated {} times, breaking loop ({} tokens generated)",
                            next_token,
                            repeat_count,
                            result_tokens.len()
                        );
                        break;
                    }
                } else {
                    repeat_count = 0;
                }
            }
            last_token = Some(next_token);
            current_tokens.push(next_token);

            if current_tokens.len() > start_result_idx {
                result_tokens.push(next_token);
            }
        }

        // Decode tokens to text (skip_special_tokens=true)
        let decoded = self
            .tokenizer
            .decode(&result_tokens, true)
            .map_err(|e| anyhow::anyhow!("Decoding error: {}", e))?;

        let text = decoded.trim().to_string();
        debug!("Decoded {} tokens: \"{}\"", result_tokens.len(), text);

        // Calculate quality metrics
        let avg_logprob = if logprob_count > 0 {
            sum_logprob / logprob_count as f64
        } else {
            0.0
        };

        let compression_ratio = if !text.is_empty() {
            result_tokens.len() as f64 / text.len() as f64
        } else {
            0.0
        };

        debug!(
            "Quality: avg_logprob={:.3}, compression={:.3}",
            avg_logprob, compression_ratio
        );

        Ok((text, avg_logprob, compression_ratio))
    }

    /// Decode with temperature fallback until quality thresholds are met
    fn decode_with_fallback(&mut self, mel: &Tensor) -> Result<String> {
        for (i, &temp) in TEMPERATURES.iter().enumerate() {
            let is_last = i == TEMPERATURES.len() - 1;

            match self.decode_at_temperature(mel, temp) {
                Ok((text, avg_logprob, compression_ratio)) => {
                    let quality_ok = compression_ratio <= COMPRESSION_RATIO_THRESHOLD
                        && avg_logprob >= LOGPROB_THRESHOLD;

                    if is_last || quality_ok {
                        debug!(
                            "Decode at temp {}: logprob={:.3}, compression={:.3}",
                            temp, avg_logprob, compression_ratio
                        );
                        return Ok(text);
                    }

                    debug!("Quality check failed at temp {}, trying next", temp);
                },
                Err(e) => {
                    warn!("Decoding failed at temp {}: {}", temp, e);
                },
            }
        }

        anyhow::bail!("All temperature fallbacks failed")
    }

    /// Transcribe a single chunk of audio (max 30 seconds)
    fn transcribe_chunk(&mut self, audio: &[f32]) -> Result<String> {
        if audio.is_empty() {
            return Ok(String::new());
        }

        // Pad/truncate audio to exactly 30 seconds (Whisper requirement)
        const N_SAMPLES: usize = 480000; // 30s * 16kHz
        let mut padded_audio = audio.to_vec();
        padded_audio.resize(N_SAMPLES, 0.0);

        // Convert audio to mel spectrogram via mojo-audio FFI
        let (n_mels, frames, mel_data) =
            mojo_ffi::compute_mel_spectrogram_with_n_mels(&padded_audio, self.num_mel_bins)?;

        if mel_data.is_empty() || frames == 0 {
            anyhow::bail!("Invalid mel spectrogram from mojo-audio");
        }

        debug!(
            "Mel spectrogram: {}x{} (n_mels={})",
            n_mels, frames, self.num_mel_bins
        );

        let mel = Tensor::from_vec(mel_data, (n_mels, frames), &self.device)?;
        let mel = mel.unsqueeze(0)?;

        self.decode_with_fallback(&mel)
    }
}

impl Transcriber for CandleEngine {
    fn transcribe(&mut self, audio: &[f32]) -> Result<String> {
        if audio.is_empty() {
            return Ok(String::new());
        }

        let duration_secs = audio.len() as f32 / SAMPLE_RATE as f32;
        info!(
            "Transcribing {} samples ({:.2}s) [lang={}, prompt={}]",
            audio.len(),
            duration_secs,
            self.language,
            self.initial_prompt.is_some()
        );

        // Short audio - process directly
        if duration_secs <= CHUNK_LENGTH_SECS {
            return self.transcribe_chunk(audio);
        }

        // Long audio - split into overlapping chunks
        debug!(
            "Splitting {:.1}s audio into {:.0}s chunks with {:.0}s overlap",
            duration_secs, CHUNK_LENGTH_SECS, CHUNK_OVERLAP_SECS
        );

        let chunk_samples = (CHUNK_LENGTH_SECS * SAMPLE_RATE as f32) as usize;
        let overlap_samples = (CHUNK_OVERLAP_SECS * SAMPLE_RATE as f32) as usize;
        let stride = chunk_samples - overlap_samples;

        let mut results = Vec::new();
        let mut offset = 0;

        while offset < audio.len() {
            let end = (offset + chunk_samples).min(audio.len());
            let chunk = &audio[offset..end];

            match self.transcribe_chunk(chunk) {
                Ok(text) if !text.is_empty() => results.push(text),
                Ok(_) => {},
                Err(e) => warn!("Chunk {} failed: {}", results.len() + 1, e),
            }

            offset += stride;

            // Process remainder if close to end
            if offset + chunk_samples > audio.len() && offset < audio.len() {
                let remaining = &audio[offset..];
                if remaining.len() > overlap_samples {
                    if let Ok(text) = self.transcribe_chunk(remaining) {
                        if !text.is_empty() {
                            results.push(text);
                        }
                    }
                }
                break;
            }
        }

        let final_text = results.join(" ");
        debug!(
            "Long-form transcription: {} chunks, {} chars",
            results.len(),
            final_text.len()
        );

        Ok(final_text)
    }
}

struct SpecialTokens {
    sot_token: u32,
    eot_token: u32,
    transcribe_token: u32,
    no_timestamps_token: u32,
    language_token: u32,
}

#[cfg(test)]
mod tests {
    #[test]
    fn test_empty_audio() {
        let empty_audio: Vec<f32> = vec![];
        assert_eq!(empty_audio.len(), 0);
    }

    #[test]
    fn test_special_tokens_format() {
        let language = "en";
        let expected_format = format!("<|{}|>", language);
        assert_eq!(expected_format, "<|en|>");
    }
}
