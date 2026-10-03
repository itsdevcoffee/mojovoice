//! Whisper log-mel spectrogram, matching OpenAI's `whisper.audio.log_mel_spectrogram`.
//!
//! Pipeline: reflect-pad by n_fft/2 → periodic Hann window → 400-point STFT (hop 160)
//! → power spectrum (last frame dropped) → mel filterbank → log10 → clamp to max-8
//! → (x + 4) / 4.
//!
//! The filterbanks in `assets/melfilters{80,128}.bytes` are OpenAI's `mel_filters.npz`
//! stored as row-major (n_mels, 201) f32 little-endian. `scripts/gen-mel-fixtures.py`
//! verifies this and generates the reference outputs used by the tests below.

use anyhow::{Result, bail};
use realfft::RealFftPlanner;

pub const N_FFT: usize = 400;
pub const HOP_LENGTH: usize = 160;
const N_FREQS: usize = N_FFT / 2 + 1;

static MEL_FILTERS_80: &[u8] = include_bytes!("../../assets/melfilters80.bytes");
static MEL_FILTERS_128: &[u8] = include_bytes!("../../assets/melfilters128.bytes");

/// One triangular mel filter, stored as its nonzero span only.
struct MelFilter {
    start: usize,
    weights: Vec<f32>,
}

impl MelFilter {
    fn apply(&self, power: &[f32]) -> f32 {
        self.weights
            .iter()
            .zip(&power[self.start..])
            .map(|(w, p)| w * p)
            .sum()
    }
}

fn load_filters(n_mels: usize) -> Result<Vec<MelFilter>> {
    let bytes = match n_mels {
        80 => MEL_FILTERS_80,
        128 => MEL_FILTERS_128,
        _ => bail!("Unsupported mel bin count: {} (expected 80 or 128)", n_mels),
    };

    let filters = bytes
        .chunks_exact(4 * N_FREQS)
        .map(|row| {
            let row: Vec<f32> = row
                .chunks_exact(4)
                .map(|b| f32::from_le_bytes([b[0], b[1], b[2], b[3]]))
                .collect();
            let start = row.iter().position(|&w| w != 0.0).unwrap_or(0);
            let end = row.iter().rposition(|&w| w != 0.0).map_or(start, |i| i + 1);
            MelFilter {
                start,
                weights: row[start..end].to_vec(),
            }
        })
        .collect::<Vec<_>>();

    debug_assert_eq!(filters.len(), n_mels);
    Ok(filters)
}

/// Mirror `pad` samples onto each end, excluding the edge sample (numpy/torch "reflect").
fn reflect_pad(samples: &[f32], pad: usize) -> Vec<f32> {
    let n = samples.len();
    let mut padded = Vec::with_capacity(n + 2 * pad);
    padded.extend((1..=pad).rev().map(|i| samples[i]));
    padded.extend_from_slice(samples);
    padded.extend((0..pad).map(|j| samples[n - 2 - j]));
    padded
}

/// Compute a Whisper log-mel spectrogram of 16kHz mono audio.
///
/// Returns row-major `(n_mels, n_frames)` data and `n_frames`, where
/// `n_frames = samples.len() / HOP_LENGTH` (3000 for a 30s chunk).
pub fn log_mel_spectrogram(samples: &[f32], n_mels: usize) -> Result<(Vec<f32>, usize)> {
    let filters = load_filters(n_mels)?;

    let pad = N_FFT / 2;
    if samples.len() <= pad {
        bail!(
            "Audio too short for mel spectrogram: {} samples (need > {})",
            samples.len(),
            pad
        );
    }
    let padded = reflect_pad(samples, pad);

    // torch.stft(center=True) yields 1 + len/hop frames; Whisper drops the last one.
    let n_frames = samples.len() / HOP_LENGTH;

    // Periodic Hann window (torch.hann_window default)
    let window: Vec<f32> = (0..N_FFT)
        .map(|i| {
            let phase = 2.0 * std::f64::consts::PI * i as f64 / N_FFT as f64;
            (0.5 * (1.0 - phase.cos())) as f32
        })
        .collect();

    let fft = RealFftPlanner::<f32>::new().plan_fft_forward(N_FFT);
    let mut frame = fft.make_input_vec();
    let mut spectrum = fft.make_output_vec();
    let mut scratch = fft.make_scratch_vec();
    let mut power = vec![0.0f32; N_FREQS];
    let mut mel = vec![0.0f32; n_mels * n_frames];

    for t in 0..n_frames {
        let start = t * HOP_LENGTH;
        for ((x, s), w) in frame
            .iter_mut()
            .zip(&padded[start..start + N_FFT])
            .zip(&window)
        {
            *x = s * w;
        }

        fft.process_with_scratch(&mut frame, &mut spectrum, &mut scratch)
            .map_err(|e| anyhow::anyhow!("FFT failed: {}", e))?;

        for (p, c) in power.iter_mut().zip(&spectrum) {
            *p = c.norm_sqr();
        }

        for (m, filter) in filters.iter().enumerate() {
            mel[m * n_frames + t] = filter.apply(&power).max(1e-10).log10();
        }
    }

    let max = mel.iter().copied().fold(f32::NEG_INFINITY, f32::max);
    let floor = max - 8.0;
    for v in &mut mel {
        *v = (v.max(floor) + 4.0) / 4.0;
    }

    Ok((mel, n_frames))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn read_f32(bytes: &[u8]) -> Vec<f32> {
        bytes
            .chunks_exact(4)
            .map(|b| f32::from_le_bytes([b[0], b[1], b[2], b[3]]))
            .collect()
    }

    fn assert_matches_openai(n_mels: usize, expected: &[u8]) {
        let input = read_f32(include_bytes!("../../tests/fixtures/mel/input_16k.f32"));
        let expected = read_f32(expected);

        let (mel, n_frames) = log_mel_spectrogram(&input, n_mels).unwrap();

        assert_eq!(n_frames, 200);
        assert_eq!(mel.len(), expected.len());
        let max_diff = mel
            .iter()
            .zip(&expected)
            .map(|(a, b)| (a - b).abs())
            .fold(0.0f32, f32::max);
        assert!(
            max_diff < 1e-4,
            "n_mels={}: max abs diff vs OpenAI reference = {}",
            n_mels,
            max_diff
        );
    }

    #[test]
    fn matches_openai_80_mels() {
        assert_matches_openai(
            80,
            include_bytes!("../../tests/fixtures/mel/expected_80.f32"),
        );
    }

    #[test]
    fn matches_openai_128_mels() {
        assert_matches_openai(
            128,
            include_bytes!("../../tests/fixtures/mel/expected_128.f32"),
        );
    }

    #[test]
    fn thirty_second_chunk_has_3000_frames() {
        let (mel, n_frames) = log_mel_spectrogram(&vec![0.0; 480_000], 128).unwrap();
        assert_eq!(n_frames, 3000);
        assert_eq!(mel.len(), 128 * 3000);
    }

    #[test]
    fn silence_is_finite_and_flat() {
        // log10(1e-10) = -10 everywhere → (-10 + 4) / 4
        let (mel, _) = log_mel_spectrogram(&vec![0.0; 16_000], 80).unwrap();
        assert!(mel.iter().all(|&v| (v - -1.5).abs() < 1e-6));
    }

    #[test]
    fn rejects_unsupported_mel_count() {
        assert!(log_mel_spectrogram(&vec![0.0; 16_000], 64).is_err());
    }

    #[test]
    fn rejects_too_short_audio() {
        assert!(log_mel_spectrogram(&[0.0; 200], 80).is_err());
    }

    #[test]
    fn reflect_pad_matches_numpy() {
        // np.pad([1, 2, 3, 4], 2, mode="reflect") == [3, 2, 1, 2, 3, 4, 3, 2]
        assert_eq!(
            reflect_pad(&[1.0, 2.0, 3.0, 4.0], 2),
            vec![3.0, 2.0, 1.0, 2.0, 3.0, 4.0, 3.0, 2.0]
        );
    }
}
