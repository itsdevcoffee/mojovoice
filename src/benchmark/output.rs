//! Benchmark result serialization and file output.

use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

/// Top-level benchmark result.
#[derive(Debug, Serialize, Deserialize)]
pub struct BenchmarkResult {
    pub benchmark_info: BenchmarkInfo,
    pub samples: Vec<SampleResult>,
    pub aggregate_stats: AggregateStats,
}

/// Benchmark metadata.
#[derive(Debug, Serialize, Deserialize)]
pub struct BenchmarkInfo {
    pub timestamp: String,
    // Version tracking (with defaults for backwards compatibility)
    #[serde(default)]
    pub app_version: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub git_commit: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub git_branch: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub git_dirty: Option<bool>,
    // Model info
    pub model_name: String,
    pub model_path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model_format: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub quantization: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model_size_mb: Option<u32>,
    pub gpu_enabled: bool,
    pub gpu_name: String,
}

/// Git repository information.
#[derive(Debug, Default)]
pub struct GitInfo {
    pub commit: Option<String>,
    pub branch: Option<String>,
    pub dirty: Option<bool>,
}

/// Get git information from the current repository.
pub fn get_git_info() -> GitInfo {
    let commit = std::process::Command::new("git")
        .args(["rev-parse", "--short=8", "HEAD"])
        .output()
        .ok()
        .filter(|o| o.status.success())
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string());

    let branch = std::process::Command::new("git")
        .args(["rev-parse", "--abbrev-ref", "HEAD"])
        .output()
        .ok()
        .filter(|o| o.status.success())
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string());

    let dirty = std::process::Command::new("git")
        .args(["status", "--porcelain"])
        .output()
        .ok()
        .filter(|o| o.status.success())
        .map(|o| !o.stdout.is_empty());

    GitInfo { commit, branch, dirty }
}

/// Per-sample transcription result.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SampleResult {
    pub file: String,
    pub duration_secs: f64,
    pub sample_rate: u32,
    pub ground_truth: String,
    pub transcription: String,
    pub transcription_time_secs: f64,
    pub real_time_factor: f64,
    pub word_error_rate: f64,
    pub character_error_rate: f64,
    pub exact_match: bool,
    // Error breakdown (with defaults for backwards compatibility)
    #[serde(default)]
    pub word_substitutions: usize,
    #[serde(default)]
    pub word_deletions: usize,
    #[serde(default)]
    pub word_insertions: usize,
}

/// Aggregate statistics across all samples.
#[derive(Debug, Serialize, Deserialize)]
pub struct AggregateStats {
    pub total_samples: usize,
    pub total_audio_duration_secs: f64,
    pub total_transcription_time_secs: f64,
    // RTF statistics (with defaults for backwards compatibility)
    pub average_real_time_factor: f64,
    #[serde(default)]
    pub median_real_time_factor: f64,
    #[serde(default)]
    pub std_dev_real_time_factor: f64,
    // WER statistics
    pub average_word_error_rate: f64,
    #[serde(default)]
    pub median_word_error_rate: f64,
    #[serde(default)]
    pub std_dev_word_error_rate: f64,
    // CER statistics
    pub average_character_error_rate: f64,
    #[serde(default)]
    pub median_character_error_rate: f64,
    // Error totals
    #[serde(default)]
    pub total_word_substitutions: usize,
    #[serde(default)]
    pub total_word_deletions: usize,
    #[serde(default)]
    pub total_word_insertions: usize,
    // Match stats
    pub exact_match_count: usize,
    pub exact_match_rate: f64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub fastest_sample: Option<SampleRef>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub slowest_sample: Option<SampleRef>,
    // Warmup analysis (first sample often slower)
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub warmup_rtf: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub post_warmup_average_rtf: Option<f64>,
    // Quality grouping by sample rate
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub by_sample_rate: Vec<SampleRateGroup>,
}

/// Statistics grouped by sample rate.
#[derive(Debug, Serialize, Deserialize)]
pub struct SampleRateGroup {
    pub sample_rate: u32,
    pub sample_count: usize,
    pub total_duration_secs: f64,
    pub average_rtf: f64,
    pub average_wer: f64,
    pub average_cer: f64,
    pub exact_match_count: usize,
}

/// Reference to a sample for fastest/slowest tracking.
#[derive(Debug, Serialize, Deserialize)]
pub struct SampleRef {
    pub file: String,
    pub real_time_factor: f64,
}

/// Create benchmark output directory: benchmarks/{model_name}/
pub fn create_output_dir(output_base: &Path, model_name: &str) -> Result<PathBuf> {
    // Sanitize model name for filesystem
    let safe_name: String = model_name
        .chars()
        .map(|c| if c.is_alphanumeric() || c == '-' || c == '_' { c } else { '-' })
        .collect();

    let dir = output_base.join(&safe_name);
    std::fs::create_dir_all(&dir)
        .with_context(|| format!("Failed to create output directory: {}", dir.display()))?;

    Ok(dir)
}

/// Generate timestamped filename: YYYY-MM-DD_HH-MM-SS.json
pub fn generate_filename() -> String {
    let now = chrono::Local::now();
    format!("{}.json", now.format("%Y-%m-%d_%H-%M-%S"))
}

/// Generate ISO 8601 timestamp for benchmark_info.
pub fn generate_timestamp() -> String {
    chrono::Utc::now().to_rfc3339()
}

/// Write benchmark results to JSON file.
pub fn write_results(dir: &Path, result: &BenchmarkResult) -> Result<PathBuf> {
    let filename = generate_filename();
    let path = dir.join(&filename);

    let json = serde_json::to_string_pretty(result)
        .context("Failed to serialize benchmark results")?;

    std::fs::write(&path, json)
        .with_context(|| format!("Failed to write results to: {}", path.display()))?;

    Ok(path)
}

/// Calculate median of a sorted slice.
fn median(sorted: &[f64]) -> f64 {
    if sorted.is_empty() {
        return 0.0;
    }
    let mid = sorted.len() / 2;
    if sorted.len() % 2 == 0 {
        (sorted[mid - 1] + sorted[mid]) / 2.0
    } else {
        sorted[mid]
    }
}

/// Calculate standard deviation.
fn std_dev(values: &[f64], mean: f64) -> f64 {
    if values.len() < 2 {
        return 0.0;
    }
    let variance: f64 = values.iter().map(|v| (v - mean).powi(2)).sum::<f64>() / values.len() as f64;
    variance.sqrt()
}

/// Calculate aggregate statistics from sample results.
pub fn calculate_aggregates(samples: &[SampleResult]) -> AggregateStats {
    if samples.is_empty() {
        return AggregateStats {
            total_samples: 0,
            total_audio_duration_secs: 0.0,
            total_transcription_time_secs: 0.0,
            average_real_time_factor: 0.0,
            median_real_time_factor: 0.0,
            std_dev_real_time_factor: 0.0,
            average_word_error_rate: 0.0,
            median_word_error_rate: 0.0,
            std_dev_word_error_rate: 0.0,
            average_character_error_rate: 0.0,
            median_character_error_rate: 0.0,
            total_word_substitutions: 0,
            total_word_deletions: 0,
            total_word_insertions: 0,
            exact_match_count: 0,
            exact_match_rate: 0.0,
            fastest_sample: None,
            slowest_sample: None,
            warmup_rtf: None,
            post_warmup_average_rtf: None,
            by_sample_rate: Vec::new(),
        };
    }

    let total_samples = samples.len();
    let total_audio_duration_secs: f64 = samples.iter().map(|s| s.duration_secs).sum();
    let total_transcription_time_secs: f64 = samples.iter().map(|s| s.transcription_time_secs).sum();

    // RTF statistics
    let rtf_values: Vec<f64> = samples.iter().map(|s| s.real_time_factor).collect();
    let average_real_time_factor = if total_audio_duration_secs > 0.0 {
        total_transcription_time_secs / total_audio_duration_secs
    } else {
        0.0
    };
    let mut sorted_rtf = rtf_values.clone();
    sorted_rtf.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
    let median_real_time_factor = median(&sorted_rtf);
    let std_dev_real_time_factor = std_dev(&rtf_values, average_real_time_factor);

    // WER statistics
    let wer_values: Vec<f64> = samples.iter().map(|s| s.word_error_rate).collect();
    let average_word_error_rate = wer_values.iter().sum::<f64>() / total_samples as f64;
    let mut sorted_wer = wer_values.clone();
    sorted_wer.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
    let median_word_error_rate = median(&sorted_wer);
    let std_dev_word_error_rate = std_dev(&wer_values, average_word_error_rate);

    // CER statistics
    let cer_values: Vec<f64> = samples.iter().map(|s| s.character_error_rate).collect();
    let average_character_error_rate = cer_values.iter().sum::<f64>() / total_samples as f64;
    let mut sorted_cer = cer_values.clone();
    sorted_cer.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
    let median_character_error_rate = median(&sorted_cer);

    // Error totals
    let total_word_substitutions: usize = samples.iter().map(|s| s.word_substitutions).sum();
    let total_word_deletions: usize = samples.iter().map(|s| s.word_deletions).sum();
    let total_word_insertions: usize = samples.iter().map(|s| s.word_insertions).sum();

    let exact_match_count = samples.iter().filter(|s| s.exact_match).count();
    let exact_match_rate = exact_match_count as f64 / total_samples as f64;

    // Fastest/slowest
    let fastest_sample = samples
        .iter()
        .filter(|s| s.real_time_factor.is_finite())
        .min_by(|a, b| {
            a.real_time_factor
                .partial_cmp(&b.real_time_factor)
                .unwrap_or(std::cmp::Ordering::Equal)
        })
        .map(|s| SampleRef {
            file: s.file.clone(),
            real_time_factor: s.real_time_factor,
        });

    let slowest_sample = samples
        .iter()
        .filter(|s| s.real_time_factor.is_finite())
        .max_by(|a, b| {
            a.real_time_factor
                .partial_cmp(&b.real_time_factor)
                .unwrap_or(std::cmp::Ordering::Equal)
        })
        .map(|s| SampleRef {
            file: s.file.clone(),
            real_time_factor: s.real_time_factor,
        });

    // Warmup analysis (first sample vs rest)
    let (warmup_rtf, post_warmup_average_rtf) = if samples.len() > 1 {
        let first_rtf = samples[0].real_time_factor;
        let rest_rtf: f64 = samples[1..].iter().map(|s| s.real_time_factor).sum::<f64>()
            / (samples.len() - 1) as f64;
        (Some(first_rtf), Some(rest_rtf))
    } else {
        (None, None)
    };

    // Group by sample rate
    let mut rate_groups: std::collections::HashMap<u32, Vec<&SampleResult>> =
        std::collections::HashMap::new();
    for sample in samples {
        rate_groups.entry(sample.sample_rate).or_default().push(sample);
    }

    let mut by_sample_rate: Vec<SampleRateGroup> = rate_groups
        .into_iter()
        .map(|(rate, group)| {
            let count = group.len();
            let duration: f64 = group.iter().map(|s| s.duration_secs).sum();
            let trans_time: f64 = group.iter().map(|s| s.transcription_time_secs).sum();
            SampleRateGroup {
                sample_rate: rate,
                sample_count: count,
                total_duration_secs: duration,
                average_rtf: if duration > 0.0 { trans_time / duration } else { 0.0 },
                average_wer: group.iter().map(|s| s.word_error_rate).sum::<f64>() / count as f64,
                average_cer: group.iter().map(|s| s.character_error_rate).sum::<f64>() / count as f64,
                exact_match_count: group.iter().filter(|s| s.exact_match).count(),
            }
        })
        .collect();
    by_sample_rate.sort_by_key(|g| g.sample_rate);

    AggregateStats {
        total_samples,
        total_audio_duration_secs,
        total_transcription_time_secs,
        average_real_time_factor,
        median_real_time_factor,
        std_dev_real_time_factor,
        average_word_error_rate,
        median_word_error_rate,
        std_dev_word_error_rate,
        average_character_error_rate,
        median_character_error_rate,
        total_word_substitutions,
        total_word_deletions,
        total_word_insertions,
        exact_match_count,
        exact_match_rate,
        fastest_sample,
        slowest_sample,
        warmup_rtf,
        post_warmup_average_rtf,
        by_sample_rate,
    }
}
