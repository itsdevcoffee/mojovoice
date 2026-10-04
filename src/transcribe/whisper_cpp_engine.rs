//! whisper.cpp engine for GGML models (via whisper-rs).
//!
//! Built with the `whisper-vulkan` feature, whisper.cpp runs on any GPU with a Vulkan
//! driver (AMD, Intel or NVIDIA), which Candle can't use on Windows. whisper.cpp splits
//! long audio itself, so unlike the Candle engine this needs no chunking.

use anyhow::{Context, Result};
use std::path::Path;
use tracing::info;
use whisper_rs::{FullParams, SamplingStrategy, WhisperContext, WhisperContextParameters};

use super::Transcriber;

pub struct WhisperCppEngine {
    // Owns the model; `state` holds the per-transcription buffers
    _ctx: WhisperContext,
    state: whisper_rs::WhisperState,
    language: String,
    initial_prompt: Option<String>,
    n_threads: i32,
}

impl WhisperCppEngine {
    pub fn new(model_file: &Path, language: &str, initial_prompt: Option<String>) -> Result<Self> {
        // Route whisper.cpp's own logging (backend/device selection, timings) to tracing
        whisper_rs::install_logging_hooks();

        info!(
            "Loading GGML model with whisper.cpp ({}): {}",
            backend_name(),
            model_file.display()
        );
        let ctx = WhisperContext::new_with_params(model_file, WhisperContextParameters::default())
            .with_context(|| format!("Failed to load GGML model {}", model_file.display()))?;
        let state = ctx
            .create_state()
            .context("Failed to create whisper.cpp state")?;

        // Decoding on CPU (or feeding the GPU) scales well up to ~8 threads
        let n_threads = std::thread::available_parallelism()
            .map(|n| n.get().min(8) as i32)
            .unwrap_or(4);

        Ok(Self {
            _ctx: ctx,
            state,
            language: language.to_string(),
            initial_prompt: initial_prompt.filter(|p| !p.is_empty()),
            n_threads,
        })
    }
}

/// The compute backend this build of whisper.cpp uses
pub fn backend_name() -> &'static str {
    if cfg!(feature = "whisper-vulkan") {
        "Vulkan"
    } else {
        "CPU"
    }
}

impl Transcriber for WhisperCppEngine {
    fn transcribe(&mut self, audio: &[f32]) -> Result<String> {
        if audio.is_empty() {
            return Ok(String::new());
        }

        let mut params = FullParams::new(SamplingStrategy::Greedy { best_of: 1 });
        // whisper.cpp detects the language itself for "auto"
        params.set_language(Some(&self.language));
        params.set_n_threads(self.n_threads);
        params.set_no_context(true);
        params.set_suppress_blank(true);
        params.set_print_progress(false);
        params.set_print_realtime(false);
        params.set_print_special(false);
        params.set_print_timestamps(false);
        if let Some(prompt) = &self.initial_prompt {
            params.set_initial_prompt(prompt);
        }

        info!(
            "Transcribing {} samples ({:.2}s) with whisper.cpp [lang={}, prompt={}]",
            audio.len(),
            audio.len() as f32 / 16_000.0,
            self.language,
            self.initial_prompt.is_some()
        );
        self.state
            .full(params, audio)
            .context("whisper.cpp transcription failed")?;

        let mut text = String::new();
        for segment in self.state.as_iter() {
            text.push_str(&segment.to_str_lossy()?);
        }
        Ok(text.trim().to_string())
    }

    fn device_label(&self) -> (bool, String) {
        (
            cfg!(feature = "whisper-vulkan"),
            format!("whisper.cpp ({})", backend_name()),
        )
    }
}
