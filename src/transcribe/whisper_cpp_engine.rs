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
    /// GPU in use, if any (e.g. "AMD Radeon RX 6600")
    gpu: Option<String>,
    state: whisper_rs::WhisperState,
    language: String,
    initial_prompt: Option<String>,
    n_threads: i32,
    /// Encode only as much of the 30s window as the audio needs (faster for short
    /// clips; opt-in via MOJOVOICE_WHISPER_AUDIO_CTX=auto while it's evaluated)
    trim_audio_ctx: bool,
}

/// Boolean tuning switch from the environment ("1"/"true"/"on" or "0"/"false"/"off")
fn env_flag(name: &str) -> Option<bool> {
    let value = std::env::var(name).ok()?.to_ascii_lowercase();
    match value.as_str() {
        "1" | "true" | "on" | "auto" => Some(true),
        "0" | "false" | "off" => Some(false),
        _ => None,
    }
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
        // CPU features the build uses (AVX2 etc.); handy when diagnosing slow CPUs
        info!(
            "whisper.cpp system info: {}",
            whisper_rs::print_system_info().trim()
        );
        let mut ctx_params = WhisperContextParameters::default();
        let gpu = preferred_gpu();
        if let Some((index, name)) = &gpu {
            info!("Using GPU: {}", name);
            ctx_params.gpu_device(*index);
        }
        // Flash attention makes the encoder's 1500-frame attention much cheaper on GPUs
        let flash_attn = env_flag("MOJOVOICE_WHISPER_FLASH_ATTN").unwrap_or(gpu.is_some());
        ctx_params.flash_attn(flash_attn);
        let trim_audio_ctx = env_flag("MOJOVOICE_WHISPER_AUDIO_CTX").unwrap_or(false);
        info!(
            "whisper.cpp tuning: flash_attn={}, trim_audio_ctx={}",
            flash_attn, trim_audio_ctx
        );
        let ctx = WhisperContext::new_with_params(model_file, ctx_params)
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
            gpu: gpu.map(|(_, name)| name),
            state,
            language: language.to_string(),
            initial_prompt: initial_prompt.filter(|p| !p.is_empty()),
            n_threads,
            trim_audio_ctx,
        })
    }
}

/// The GPU whisper.cpp should use, as (`gpu_device` index, description): the first
/// discrete GPU, else the first integrated one. whisper.cpp itself just takes the first
/// GPU it enumerates, which on machines with integrated graphics plus a discrete card
/// is often the integrated one. `gpu_device` counts only GPU/iGPU devices, in order.
fn preferred_gpu() -> Option<(i32, String)> {
    use std::ffi::CStr;
    use whisper_rs::whisper_rs_sys as sys;

    let mut gpu_count = 0;
    let mut first_igpu = None;
    // SAFETY: read-only queries of ggml's static device registry; returned strings are
    // owned by ggml and copied immediately
    unsafe {
        for i in 0..sys::ggml_backend_dev_count() {
            let dev = sys::ggml_backend_dev_get(i);
            let kind = sys::ggml_backend_dev_type(dev);
            let is_gpu = kind == sys::ggml_backend_dev_type_GGML_BACKEND_DEVICE_TYPE_GPU;
            let is_igpu = kind == sys::ggml_backend_dev_type_GGML_BACKEND_DEVICE_TYPE_IGPU;
            if !is_gpu && !is_igpu {
                continue;
            }
            let desc = sys::ggml_backend_dev_description(dev);
            let name = if desc.is_null() {
                format!("GPU {}", gpu_count)
            } else {
                CStr::from_ptr(desc).to_string_lossy().into_owned()
            };
            info!(
                "GPU {}: {} ({})",
                gpu_count,
                name,
                if is_gpu { "discrete" } else { "integrated" }
            );
            if is_gpu {
                return Some((gpu_count, name));
            }
            first_igpu.get_or_insert((gpu_count, name));
            gpu_count += 1;
        }
    }
    first_igpu
}

/// Encoder context (in 20ms frames, max 1500 = 30s) covering `samples` of 16kHz audio,
/// plus a little headroom; longer audio uses the full window
fn audio_ctx_for(samples: usize) -> i32 {
    const FULL: usize = 1500;
    let frames = samples.div_ceil(320) + 64;
    frames.min(FULL) as i32
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
        if self.trim_audio_ctx {
            params.set_audio_ctx(audio_ctx_for(audio.len()));
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
        match &self.gpu {
            Some(name) => (true, format!("whisper.cpp ({}: {})", backend_name(), name)),
            None => (false, "whisper.cpp (CPU)".to_string()),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::audio_ctx_for;

    #[test]
    fn audio_ctx_covers_the_clip_with_headroom() {
        // 6.1s of audio = 305 frames of 20ms, + 64 headroom
        assert_eq!(audio_ctx_for(97_600), 369);
        // 30s or more uses the whole window
        assert_eq!(audio_ctx_for(480_000), 1500);
        assert_eq!(audio_ctx_for(1_000_000), 1500);
    }
}
