//! Load and parse the test audio samples manifest.

use anyhow::{Context, Result};
use serde::Deserialize;
use std::path::Path;

/// Audio sample manifest structure.
#[allow(dead_code)] // Fields populated by serde deserialization
#[derive(Debug, Deserialize)]
pub struct SampleManifest {
    pub description: String,
    pub samples: Vec<AudioSample>,
}

/// Individual audio sample metadata.
#[allow(dead_code)] // Fields populated by serde deserialization
#[derive(Debug, Deserialize)]
pub struct AudioSample {
    pub file: String,
    pub transcript: String,
    pub source: String,
    pub sample_rate: u32,
    pub duration_secs: f64,
    #[serde(default)]
    pub notes: Option<String>,
    #[serde(default)]
    pub source_url: Option<String>,
    #[serde(default)]
    pub harvard_list: Option<u32>,
}

/// Load manifest.json from samples directory.
pub fn load_manifest(samples_dir: &Path) -> Result<SampleManifest> {
    let manifest_path = samples_dir.join("manifest.json");
    let content = std::fs::read_to_string(&manifest_path)
        .with_context(|| format!("Failed to read manifest: {}", manifest_path.display()))?;

    serde_json::from_str(&content)
        .with_context(|| format!("Failed to parse manifest: {}", manifest_path.display()))
}

/// Load WAV file and convert to 16kHz mono f32 samples.
pub fn load_audio_samples(path: &Path) -> Result<Vec<f32>> {
    use hound::WavReader;
    use rubato::{
        Resampler, SincFixedIn, SincInterpolationParameters, SincInterpolationType, WindowFunction,
    };

    const TARGET_SAMPLE_RATE: u32 = 16000;

    let mut reader =
        WavReader::open(path).with_context(|| format!("Failed to open WAV: {}", path.display()))?;
    let spec = reader.spec();

    // Read raw samples with proper error handling
    let samples: Vec<f32> = match spec.sample_format {
        hound::SampleFormat::Float => reader
            .samples::<f32>()
            .collect::<Result<Vec<_>, _>>()
            .with_context(|| format!("Failed to read float samples from {}", path.display()))?,
        hound::SampleFormat::Int => {
            let max_val = (1 << (spec.bits_per_sample - 1)) as f32;
            reader
                .samples::<i32>()
                .collect::<Result<Vec<_>, _>>()
                .with_context(|| format!("Failed to read int samples from {}", path.display()))?
                .into_iter()
                .map(|s| s as f32 / max_val)
                .collect()
        }
    };

    // Convert stereo to mono if needed (handle odd sample counts)
    let mono_samples: Vec<f32> = if spec.channels == 2 {
        samples
            .chunks(2)
            .map(|chunk| {
                if chunk.len() == 2 {
                    (chunk[0] + chunk[1]) / 2.0
                } else {
                    chunk[0] // Last sample if odd count
                }
            })
            .collect()
    } else {
        samples
    };

    // Resample to 16kHz if needed
    if spec.sample_rate != TARGET_SAMPLE_RATE {
        let params = SincInterpolationParameters {
            sinc_len: 256,
            f_cutoff: 0.95,
            interpolation: SincInterpolationType::Linear,
            oversampling_factor: 256,
            window: WindowFunction::BlackmanHarris2,
        };

        let mut resampler = SincFixedIn::<f32>::new(
            TARGET_SAMPLE_RATE as f64 / spec.sample_rate as f64,
            2.0,
            params,
            mono_samples.len(),
            1,
        )?;

        let waves_in = vec![mono_samples];
        let mut waves_out = resampler.process(&waves_in, None)?;
        Ok(waves_out.remove(0))
    } else {
        Ok(mono_samples)
    }
}
