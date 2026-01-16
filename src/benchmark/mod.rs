//! Model benchmarking module.
//!
//! Benchmarks the active Whisper model against test audio samples,
//! calculating WER, CER, RTF, and other metrics.

pub mod manifest;
pub mod metrics;
pub mod output;
pub mod report;

use anyhow::{Context, Result};
use std::path::Path;
use std::time::Instant;
use tracing::{info, warn};

use crate::daemon::{
    is_daemon_running, send_request, daemon_get_status,
    DaemonRequest, DaemonResponse,
};

use manifest::{load_audio_samples, load_manifest};
use metrics::{character_error_rate, exact_match, word_error_rate};
use output::{
    calculate_aggregates, create_output_dir, generate_timestamp, get_git_info, write_results,
    BenchmarkInfo, BenchmarkResult, SampleResult,
};

/// Run benchmark on all samples in the given directory.
pub fn run_benchmark(samples_dir: &Path, output_dir: &Path, stdout_only: bool) -> Result<()> {
    // Verify daemon is running
    if !is_daemon_running() {
        anyhow::bail!("Daemon is not running. Start it first with: mojovoice daemon up");
    }

    // Get daemon status for model info
    let status = daemon_get_status()?;
    info!("Daemon status: model={}, gpu={}", status.model_name, status.gpu_name);

    // Extract model name from path (last component)
    let model_name = extract_model_name(&status.model_name);
    let (format, quantization) = detect_model_format(&model_name);

    println!("Benchmarking model: {}", model_name);
    println!("GPU: {} ({})", if status.gpu_enabled { "Enabled" } else { "Disabled" }, status.gpu_name);
    println!();

    // Load manifest
    let manifest = load_manifest(samples_dir)?;
    info!("Loaded manifest with {} samples", manifest.samples.len());
    println!("Found {} audio samples", manifest.samples.len());
    println!();

    // Process each sample
    let mut results: Vec<SampleResult> = Vec::new();

    for (i, sample) in manifest.samples.iter().enumerate() {
        let audio_path = samples_dir.join(&sample.file);

        if !audio_path.exists() {
            warn!("Sample not found: {}", audio_path.display());
            println!("[{}/{}] SKIP {} (file not found)", i + 1, manifest.samples.len(), sample.file);
            continue;
        }

        print!("[{}/{}] {} ... ", i + 1, manifest.samples.len(), sample.file);

        match process_sample(&audio_path, sample) {
            Ok(result) => {
                println!(
                    "WER: {:.1}%, RTF: {:.3}{}",
                    result.word_error_rate * 100.0,
                    result.real_time_factor,
                    if result.exact_match { " (exact)" } else { "" }
                );
                results.push(result);
            }
            Err(e) => {
                println!("ERROR: {}", e);
                warn!("Failed to process {}: {}", sample.file, e);
            }
        }
    }

    if results.is_empty() {
        anyhow::bail!("No samples were successfully processed");
    }

    // Calculate aggregates
    let aggregates = calculate_aggregates(&results);

    // Get version and git info
    let git_info = get_git_info();
    let app_version = env!("CARGO_PKG_VERSION").to_string();

    // Build final result
    let benchmark_result = BenchmarkResult {
        benchmark_info: BenchmarkInfo {
            timestamp: generate_timestamp(),
            app_version,
            git_commit: git_info.commit,
            git_branch: git_info.branch,
            git_dirty: git_info.dirty,
            model_name: model_name.clone(),
            model_path: status.model_name.clone(),
            model_format: format,
            quantization,
            model_size_mb: None,
            gpu_enabled: status.gpu_enabled,
            gpu_name: status.gpu_name,
        },
        samples: results,
        aggregate_stats: aggregates,
    };

    // Print summary
    println!();
    println!("=== Summary ===");
    println!("Samples:     {}/{}", benchmark_result.aggregate_stats.total_samples, manifest.samples.len());
    println!("Total audio: {:.1}s", benchmark_result.aggregate_stats.total_audio_duration_secs);
    println!("Total time:  {:.2}s", benchmark_result.aggregate_stats.total_transcription_time_secs);
    println!();
    println!("--- Speed ---");
    println!("Avg RTF:     {:.3} ({:.1}x real-time)",
        benchmark_result.aggregate_stats.average_real_time_factor,
        1.0 / benchmark_result.aggregate_stats.average_real_time_factor
    );
    println!("Median RTF:  {:.3} ({:.1}x real-time)",
        benchmark_result.aggregate_stats.median_real_time_factor,
        1.0 / benchmark_result.aggregate_stats.median_real_time_factor
    );
    if let (Some(warmup), Some(post)) = (
        benchmark_result.aggregate_stats.warmup_rtf,
        benchmark_result.aggregate_stats.post_warmup_average_rtf,
    ) {
        println!("Warmup RTF:  {:.3} (first sample)", warmup);
        println!("Post-warmup: {:.3} (avg of rest)", post);
    }
    println!();
    println!("--- Accuracy ---");
    println!("Avg WER:     {:.1}% (median: {:.1}%, std: {:.1}%)",
        benchmark_result.aggregate_stats.average_word_error_rate * 100.0,
        benchmark_result.aggregate_stats.median_word_error_rate * 100.0,
        benchmark_result.aggregate_stats.std_dev_word_error_rate * 100.0
    );
    println!("Avg CER:     {:.1}% (median: {:.1}%)",
        benchmark_result.aggregate_stats.average_character_error_rate * 100.0,
        benchmark_result.aggregate_stats.median_character_error_rate * 100.0
    );
    println!("Errors:      {} subs, {} dels, {} ins",
        benchmark_result.aggregate_stats.total_word_substitutions,
        benchmark_result.aggregate_stats.total_word_deletions,
        benchmark_result.aggregate_stats.total_word_insertions
    );
    println!("Exact match: {}/{} ({:.0}%)",
        benchmark_result.aggregate_stats.exact_match_count,
        benchmark_result.aggregate_stats.total_samples,
        benchmark_result.aggregate_stats.exact_match_rate * 100.0
    );

    // Print by sample rate if multiple rates exist
    if benchmark_result.aggregate_stats.by_sample_rate.len() > 1 {
        println!();
        println!("--- By Sample Rate ---");
        for group in &benchmark_result.aggregate_stats.by_sample_rate {
            println!("{:>5}Hz: {} samples, WER {:.1}%, RTF {:.3}",
                group.sample_rate,
                group.sample_count,
                group.average_wer * 100.0,
                group.average_rtf
            );
        }
    }

    // Output results
    if stdout_only {
        println!();
        println!("=== JSON Output ===");
        let json = serde_json::to_string_pretty(&benchmark_result)?;
        println!("{}", json);
    } else {
        let model_dir = create_output_dir(output_dir, &model_name)?;
        let output_path = write_results(&model_dir, &benchmark_result)?;
        println!();
        println!("Results saved to: {}", output_path.display());
    }

    Ok(())
}

/// Process a single audio sample.
fn process_sample(
    audio_path: &Path,
    sample: &manifest::AudioSample,
) -> Result<SampleResult> {
    // Load and resample audio
    let audio_samples = load_audio_samples(audio_path)
        .with_context(|| format!("Failed to load audio: {}", audio_path.display()))?;

    // Time the transcription
    let start = Instant::now();
    let response = send_request(&DaemonRequest::TranscribeAudio { samples: audio_samples })?;
    let transcription_time = start.elapsed();

    let transcription = match response {
        DaemonResponse::Success { text } => text,
        DaemonResponse::Error { message } => {
            anyhow::bail!("Transcription failed: {}", message);
        }
        _ => anyhow::bail!("Unexpected response from daemon"),
    };

    // Validate duration
    if sample.duration_secs <= 0.0 {
        anyhow::bail!(
            "Invalid sample duration: {} seconds for {}",
            sample.duration_secs,
            sample.file
        );
    }

    // Calculate metrics
    let (wer, subs, dels, ins) = word_error_rate(&sample.transcript, &transcription);
    let cer = character_error_rate(&sample.transcript, &transcription);
    let is_exact = exact_match(&sample.transcript, &transcription);
    let rtf = transcription_time.as_secs_f64() / sample.duration_secs;

    Ok(SampleResult {
        file: sample.file.clone(),
        duration_secs: sample.duration_secs,
        sample_rate: sample.sample_rate,
        ground_truth: sample.transcript.clone(),
        transcription,
        transcription_time_secs: transcription_time.as_secs_f64(),
        real_time_factor: rtf,
        word_error_rate: wer,
        character_error_rate: cer,
        exact_match: is_exact,
        word_substitutions: subs,
        word_deletions: dels,
        word_insertions: ins,
    })
}

/// Extract model name from full path.
fn extract_model_name(model_path: &str) -> String {
    std::path::Path::new(model_path)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or(model_path)
        .to_string()
}

/// Detect format and quantization from model name.
fn detect_model_format(model_name: &str) -> (Option<String>, Option<String>) {
    let name_lower = model_name.to_lowercase();

    // Detect format
    let format = if name_lower.contains("safetensors") {
        Some("safetensors".to_string())
    } else if name_lower.contains("gguf") {
        Some("gguf".to_string())
    } else if name_lower.contains("ggml") {
        Some("ggml".to_string())
    } else {
        None
    };

    // Detect quantization
    let quant = if name_lower.contains("q4_k") || name_lower.contains("q4k") {
        Some("Q4_K".to_string())
    } else if name_lower.contains("q5_0") {
        Some("Q5_0".to_string())
    } else if name_lower.contains("q5_1") {
        Some("Q5_1".to_string())
    } else if name_lower.contains("q8_0") {
        Some("Q8_0".to_string())
    } else if name_lower.contains("f16") {
        Some("F16".to_string())
    } else {
        None
    };

    (format, quant)
}
