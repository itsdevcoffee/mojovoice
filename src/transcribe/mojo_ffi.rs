//! FFI bindings for mojo-audio mel spectrogram computation.
//!
//! Uses dynamic loading via libloading to call into libmojo_audio.so.
//! This replaces Candle's pcm_to_mel which produces incorrect frame counts.

use anyhow::{anyhow, Result};
use libloading::{Library, Symbol};
use std::path::Path;
use std::sync::OnceLock;

/// Error codes from mojo-audio
#[repr(i32)]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MojoAudioStatus {
    Success = 0,
    InvalidInput = -1,
    Allocation = -2,
    Processing = -3,
    BufferSize = -4,
    InvalidHandle = -5,
}

impl MojoAudioStatus {
    fn from_i32(code: i32) -> Self {
        match code {
            0 => Self::Success,
            -1 => Self::InvalidInput,
            -2 => Self::Allocation,
            -3 => Self::Processing,
            -4 => Self::BufferSize,
            -5 => Self::InvalidHandle,
            _ => Self::Processing, // Unknown errors map to processing error
        }
    }
}

/// Normalization options (matches MojoNormalization enum in C)
/// Note: All variants must be present to match the C ABI, even if unused in Rust.
#[repr(i32)]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[allow(dead_code)]
pub enum MojoNormalization {
    None = 0,
    Whisper = 1,
    MinMax = 2,
    ZScore = 3,
}

/// Configuration for mel spectrogram computation (matches C struct)
#[repr(C)]
#[derive(Debug, Clone, Copy)]
pub struct MojoMelConfig {
    pub sample_rate: i32,
    pub n_fft: i32,
    pub hop_length: i32,
    pub n_mels: i32,
    pub normalization: i32,
}

impl Default for MojoMelConfig {
    fn default() -> Self {
        // Default Whisper config (80 mel bins for most models)
        Self {
            sample_rate: 16000,
            n_fft: 400,
            hop_length: 160,
            n_mels: 80,
            normalization: MojoNormalization::Whisper as i32,
        }
    }
}

impl MojoMelConfig {
    /// Create config with custom number of mel bins
    /// - Use 80 for most Whisper models (tiny, base, small, medium, large-v1, large-v2)
    /// - Use 128 for Whisper Large V3 and Large V3 Turbo
    pub fn with_n_mels(n_mels: usize) -> Self {
        Self {
            n_mels: n_mels as i32,
            ..Default::default()
        }
    }
}

/// Type aliases for FFI function signatures
type MojoComputeFn = unsafe extern "C" fn(*const f32, usize, *const MojoMelConfig) -> i64;
type MojoGetShapeFn = unsafe extern "C" fn(i64, *mut usize, *mut usize) -> i32;
type MojoGetSizeFn = unsafe extern "C" fn(i64) -> usize;
type MojoGetDataFn = unsafe extern "C" fn(i64, *mut f32, usize) -> i32;
type MojoFreeFn = unsafe extern "C" fn(i64);

/// Wrapper around the mojo-audio shared library
pub struct MojoAudio {
    _lib: Library, // Keep library loaded
    compute: Symbol<'static, MojoComputeFn>,
    get_shape: Symbol<'static, MojoGetShapeFn>,
    get_size: Symbol<'static, MojoGetSizeFn>,
    get_data: Symbol<'static, MojoGetDataFn>,
    free: Symbol<'static, MojoFreeFn>,
}

// SAFETY: The mojo-audio library is verified thread-safe:
// - No global mutable state in FFI functions
// - Each call operates on independent input/output buffers
// - Handles are opaque pointers to isolated heap allocations
// - Tested under concurrent load in mojo-audio test suite
unsafe impl Send for MojoAudio {}
unsafe impl Sync for MojoAudio {}

/// Global singleton for the mojo-audio library
static MOJO_AUDIO: OnceLock<Result<MojoAudio, String>> = OnceLock::new();

impl MojoAudio {
    /// Load the mojo-audio library from the given path
    fn load_from_path(lib_path: &Path) -> Result<Self> {
        // SAFETY: We're loading a known library with C ABI functions
        let lib = unsafe { Library::new(lib_path) }
            .map_err(|e| anyhow!("Failed to load libmojo_audio.so: {}", e))?;

        // SAFETY: These symbols match the C header definitions
        unsafe {
            // Leak the library to get 'static lifetime for symbols
            let lib = Box::leak(Box::new(lib));

            let compute: Symbol<'static, MojoComputeFn> = lib
                .get(b"mojo_mel_spectrogram_compute\0")
                .map_err(|e| anyhow!("Symbol not found: mojo_mel_spectrogram_compute: {}", e))?;

            let get_shape: Symbol<'static, MojoGetShapeFn> = lib
                .get(b"mojo_mel_spectrogram_get_shape\0")
                .map_err(|e| anyhow!("Symbol not found: mojo_mel_spectrogram_get_shape: {}", e))?;

            let get_size: Symbol<'static, MojoGetSizeFn> = lib
                .get(b"mojo_mel_spectrogram_get_size\0")
                .map_err(|e| anyhow!("Symbol not found: mojo_mel_spectrogram_get_size: {}", e))?;

            let get_data: Symbol<'static, MojoGetDataFn> = lib
                .get(b"mojo_mel_spectrogram_get_data\0")
                .map_err(|e| anyhow!("Symbol not found: mojo_mel_spectrogram_get_data: {}", e))?;

            let free: Symbol<'static, MojoFreeFn> = lib
                .get(b"mojo_mel_spectrogram_free\0")
                .map_err(|e| anyhow!("Symbol not found: mojo_mel_spectrogram_free: {}", e))?;

            // Create a dummy library handle since we leaked the real one
            let dummy_lib = Library::new(lib_path)?;

            Ok(Self {
                _lib: dummy_lib,
                compute,
                get_shape,
                get_size,
                get_data,
                free,
            })
        }
    }

    /// Get the global mojo-audio instance, loading if necessary
    pub fn get() -> Result<&'static Self> {
        let result = MOJO_AUDIO.get_or_init(|| {
            // Try multiple paths for the library
            let paths = [
                // Relative to executable (for releases)
                std::env::current_exe()
                    .ok()
                    .and_then(|p| p.parent().map(|p| p.join("lib/libmojo_audio.so"))),
                // Development path
                Some(std::path::PathBuf::from("lib/libmojo_audio.so")),
                // System path
                Some(std::path::PathBuf::from("/usr/local/lib/libmojo_audio.so")),
            ];

            for path_opt in paths.iter() {
                if let Some(path) = path_opt {
                    if path.exists() {
                        match Self::load_from_path(path) {
                            Ok(lib) => {
                                tracing::info!("Loaded mojo-audio from: {}", path.display());
                                return Ok(lib);
                            }
                            Err(e) => {
                                tracing::warn!(
                                    "Failed to load mojo-audio from {}: {}",
                                    path.display(),
                                    e
                                );
                            }
                        }
                    }
                }
            }

            Err("Could not find libmojo_audio.so in any search path".to_string())
        });

        result
            .as_ref()
            .map_err(|e| anyhow!("{}", e))
    }

    /// Compute mel spectrogram from audio samples
    ///
    /// Returns (n_mels, n_frames, data) where data is row-major [n_mels][n_frames]
    pub fn compute_mel(&self, audio: &[f32], config: &MojoMelConfig) -> Result<(usize, usize, Vec<f32>)> {
        if audio.is_empty() {
            return Err(anyhow!("Empty audio input"));
        }

        // Debug: Log config and audio stats
        tracing::info!(
            "MOJO CONFIG: sample_rate={}, n_fft={}, hop_length={}, n_mels={}, normalization={}",
            config.sample_rate, config.n_fft, config.hop_length, config.n_mels, config.normalization
        );
        let audio_min = audio.iter().cloned().fold(f32::INFINITY, f32::min);
        let audio_max = audio.iter().cloned().fold(f32::NEG_INFINITY, f32::max);
        let audio_mean = audio.iter().sum::<f32>() / audio.len() as f32;
        tracing::info!(
            "AUDIO INPUT: len={}, min={:.4}, max={:.4}, mean={:.6}",
            audio.len(), audio_min, audio_max, audio_mean
        );

        // Call mojo to compute mel spectrogram
        let handle = unsafe {
            (self.compute)(audio.as_ptr(), audio.len(), config as *const MojoMelConfig)
        };

        // Check for errors (negative values are error codes)
        if handle <= 0 {
            let status = MojoAudioStatus::from_i32(handle as i32);
            return Err(anyhow!("Mojo mel computation failed: {:?}", status));
        }

        // Get shape
        let mut n_mels: usize = 0;
        let mut n_frames: usize = 0;
        let status = unsafe { (self.get_shape)(handle, &mut n_mels, &mut n_frames) };
        if status != 0 {
            unsafe { (self.free)(handle) };
            return Err(anyhow!(
                "Failed to get mel shape: {:?}",
                MojoAudioStatus::from_i32(status)
            ));
        }

        // Get size and allocate buffer
        let size = unsafe { (self.get_size)(handle) };
        if size == 0 || size != n_mels * n_frames {
            unsafe { (self.free)(handle) };
            return Err(anyhow!("Invalid mel spectrogram size: {}", size));
        }

        let mut data = vec![0.0f32; size];

        // Copy data
        let status = unsafe { (self.get_data)(handle, data.as_mut_ptr(), size) };
        if status != 0 {
            unsafe { (self.free)(handle) };
            return Err(anyhow!(
                "Failed to get mel data: {:?}",
                MojoAudioStatus::from_i32(status)
            ));
        }

        // Free the handle
        unsafe { (self.free)(handle) };

        Ok((n_mels, n_frames, data))
    }
}

/// Compute mel spectrogram with specified number of mel bins
///
/// Uses mojo-audio's native Whisper normalization (NORM_WHISPER)
///
/// # Arguments
/// * `audio` - Audio samples (16kHz mono f32)
/// * `n_mels` - Number of mel bins (80 for most models, 128 for large-v3/turbo)
pub fn compute_mel_spectrogram_with_n_mels(
    audio: &[f32],
    n_mels: usize,
) -> Result<(usize, usize, Vec<f32>)> {
    let mojo = MojoAudio::get()?;
    let config = MojoMelConfig::with_n_mels(n_mels);
    mojo.compute_mel(audio, &config)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_config() {
        let config = MojoMelConfig::default();
        assert_eq!(config.sample_rate, 16000);
        assert_eq!(config.n_fft, 400);
        assert_eq!(config.hop_length, 160);
        assert_eq!(config.n_mels, 80); // Default for most Whisper models
        assert_eq!(config.normalization, MojoNormalization::Whisper as i32);
    }

    #[test]
    fn test_config_with_n_mels() {
        let config = MojoMelConfig::with_n_mels(128);
        assert_eq!(config.n_mels, 128); // For Whisper Large V3/Turbo
        // Other params should use defaults
        assert_eq!(config.sample_rate, 16000);
        assert_eq!(config.n_fft, 400);
    }
}
