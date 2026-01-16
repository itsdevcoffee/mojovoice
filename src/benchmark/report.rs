//! Static HTML report generator for benchmark results.
//!
//! Generates a single HTML file with embedded CSS and JavaScript
//! following the Dev Coffee brand style guide.

use anyhow::{Context, Result};
use std::path::Path;

use super::output::BenchmarkResult;

/// Generate an HTML report from all benchmark results in the output directory.
pub fn generate_report(output_dir: &Path) -> Result<std::path::PathBuf> {
    // Collect all benchmark results
    let results = collect_benchmark_results(output_dir)?;

    if results.is_empty() {
        anyhow::bail!("No benchmark results found in {}", output_dir.display());
    }

    // Generate HTML
    let html = render_html(&results);

    // Write to file
    let report_path = output_dir.join("report.html");
    std::fs::write(&report_path, html)
        .with_context(|| format!("Failed to write report to {}", report_path.display()))?;

    Ok(report_path)
}

/// Collect all benchmark JSON files from subdirectories.
fn collect_benchmark_results(output_dir: &Path) -> Result<Vec<(String, BenchmarkResult)>> {
    let mut results = Vec::new();

    if !output_dir.exists() {
        return Ok(results);
    }

    // Iterate through model directories
    for entry in std::fs::read_dir(output_dir)? {
        let entry = entry?;
        let path = entry.path();

        if path.is_dir() {
            // Read all JSON files in this model directory
            for file_entry in std::fs::read_dir(&path)? {
                let file_entry = file_entry?;
                let file_path = file_entry.path();

                if file_path.extension().map(|e| e == "json").unwrap_or(false) {
                    if let Ok(content) = std::fs::read_to_string(&file_path) {
                        if let Ok(result) = serde_json::from_str::<BenchmarkResult>(&content) {
                            let filename = file_path
                                .file_name()
                                .and_then(|n| n.to_str())
                                .unwrap_or("unknown")
                                .to_string();
                            results.push((filename, result));
                        }
                    }
                }
            }
        }
    }

    // Sort by timestamp (newest first)
    results.sort_by(|a, b| b.1.benchmark_info.timestamp.cmp(&a.1.benchmark_info.timestamp));

    Ok(results)
}

/// Render the complete HTML report.
fn render_html(results: &[(String, BenchmarkResult)]) -> String {
    let css = include_str!("report_style.css");
    let models_json = serde_json::to_string(results).unwrap_or_else(|_| "[]".to_string());

    // Get unique models for comparison
    let models: Vec<&str> = results
        .iter()
        .map(|(_, r)| r.benchmark_info.model_name.as_str())
        .collect::<std::collections::HashSet<_>>()
        .into_iter()
        .collect();

    let latest = &results[0].1;

    format!(
        r##"<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Benchmark Report | {model_name}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
{css}
    </style>
</head>
<body>
    <div class="scanlines"></div>
    <div class="grid-bg"></div>

    <div class="container">
        <header class="header">
            <div class="header-title">
                <span class="label">BENCHMARK REPORT</span>
                <h1>{model_name}</h1>
            </div>
            <div class="header-meta">
                <div class="meta-item">
                    <span class="label">VERSION</span>
                    <span class="value">{app_version}</span>
                </div>
                <div class="meta-item">
                    <span class="label">COMMIT</span>
                    <span class="value mono">{git_commit}{dirty_marker}</span>
                </div>
                <div class="meta-item">
                    <span class="label">BRANCH</span>
                    <span class="value mono">{git_branch}</span>
                </div>
                <div class="meta-item">
                    <span class="label">TIMESTAMP</span>
                    <span class="value mono">{timestamp}</span>
                </div>
            </div>
        </header>

        <section class="summary-grid">
            <div class="card">
                <div class="card-bracket tl"></div>
                <div class="card-bracket tr"></div>
                <div class="card-bracket bl"></div>
                <div class="card-bracket br"></div>
                <span class="label">SPEED</span>
                <div class="metric-large">
                    <span class="value accent">{speed_multiplier:.1}x</span>
                    <span class="unit">real-time</span>
                </div>
                <div class="metric-details">
                    <div class="detail">
                        <span class="label">RTF</span>
                        <span class="value mono">{rtf:.4}</span>
                    </div>
                    <div class="detail">
                        <span class="label">MEDIAN</span>
                        <span class="value mono">{median_rtf:.4}</span>
                    </div>
                    <div class="detail">
                        <span class="label">STD DEV</span>
                        <span class="value mono">{std_rtf:.4}</span>
                    </div>
                </div>
            </div>

            <div class="card">
                <div class="card-bracket tl"></div>
                <div class="card-bracket tr"></div>
                <div class="card-bracket bl"></div>
                <div class="card-bracket br"></div>
                <span class="label">ACCURACY</span>
                <div class="metric-large">
                    <span class="value {wer_class}">{wer:.1}%</span>
                    <span class="unit">WER</span>
                </div>
                <div class="metric-details">
                    <div class="detail">
                        <span class="label">MEDIAN</span>
                        <span class="value mono">{median_wer:.1}%</span>
                    </div>
                    <div class="detail">
                        <span class="label">CER</span>
                        <span class="value mono">{cer:.1}%</span>
                    </div>
                    <div class="detail">
                        <span class="label">STD DEV</span>
                        <span class="value mono">{std_wer:.1}%</span>
                    </div>
                </div>
            </div>

            <div class="card">
                <div class="card-bracket tl"></div>
                <div class="card-bracket tr"></div>
                <div class="card-bracket bl"></div>
                <div class="card-bracket br"></div>
                <span class="label">EXACT MATCH</span>
                <div class="metric-large">
                    <span class="value {match_class}">{exact_match_count}/{total_samples}</span>
                    <span class="unit">{exact_match_rate:.0}%</span>
                </div>
                <div class="metric-details">
                    <div class="detail">
                        <span class="label">SUBS</span>
                        <span class="value mono">{total_subs}</span>
                    </div>
                    <div class="detail">
                        <span class="label">DELS</span>
                        <span class="value mono">{total_dels}</span>
                    </div>
                    <div class="detail">
                        <span class="label">INS</span>
                        <span class="value mono">{total_ins}</span>
                    </div>
                </div>
            </div>

            <div class="card">
                <div class="card-bracket tl"></div>
                <div class="card-bracket tr"></div>
                <div class="card-bracket bl"></div>
                <div class="card-bracket br"></div>
                <span class="label">WARMUP ANALYSIS</span>
                <div class="metric-large">
                    <span class="value">{warmup_penalty:.0}%</span>
                    <span class="unit">slower</span>
                </div>
                <div class="metric-details">
                    <div class="detail">
                        <span class="label">FIRST</span>
                        <span class="value mono">{warmup_rtf:.4}</span>
                    </div>
                    <div class="detail">
                        <span class="label">REST AVG</span>
                        <span class="value mono">{post_warmup_rtf:.4}</span>
                    </div>
                    <div class="detail">
                        <span class="label">GPU</span>
                        <span class="value mono">{gpu_name}</span>
                    </div>
                </div>
            </div>
        </section>

        <section class="charts-section">
            <div class="card wide">
                <div class="card-bracket tl"></div>
                <div class="card-bracket tr"></div>
                <div class="card-bracket bl"></div>
                <div class="card-bracket br"></div>
                <span class="label">BY SAMPLE RATE</span>
                <div class="rate-groups">
                    {rate_groups_html}
                </div>
            </div>
        </section>

        <section class="samples-section">
            <div class="card wide">
                <div class="card-bracket tl"></div>
                <div class="card-bracket tr"></div>
                <div class="card-bracket bl"></div>
                <div class="card-bracket br"></div>
                <span class="label">SAMPLE RESULTS ({total_samples} SAMPLES, {total_audio_duration:.1}s AUDIO, {total_transcription_time:.2}s PROCESSING)</span>
                <table class="samples-table">
                    <thead>
                        <tr>
                            <th>FILE</th>
                            <th>DURATION</th>
                            <th>TIME</th>
                            <th>RATE</th>
                            <th>RTF</th>
                            <th>WER</th>
                            <th>CER</th>
                            <th>MATCH</th>
                        </tr>
                    </thead>
                    <tbody>
                        {samples_rows_html}
                    </tbody>
                </table>
            </div>
        </section>

        <section class="history-section">
            <div class="card wide">
                <div class="card-bracket tl"></div>
                <div class="card-bracket tr"></div>
                <div class="card-bracket bl"></div>
                <div class="card-bracket br"></div>
                <span class="label">BENCHMARK HISTORY ({total_runs} RUNS)</span>
                <table class="history-table">
                    <thead>
                        <tr>
                            <th>TIMESTAMP</th>
                            <th>MODEL</th>
                            <th>VERSION</th>
                            <th>COMMIT</th>
                            <th>RTF</th>
                            <th>WER</th>
                            <th>EXACT</th>
                        </tr>
                    </thead>
                    <tbody>
                        {history_rows_html}
                    </tbody>
                </table>
            </div>
        </section>

        <footer class="footer">
            <span class="mono">Generated by mojovoice benchmark</span>
        </footer>
    </div>

    <script>
        const benchmarkData = {models_json};
        // Future: Add interactive charts here
    </script>
</body>
</html>
"##,
        model_name = latest.benchmark_info.model_name,
        app_version = latest.benchmark_info.app_version,
        git_commit = latest.benchmark_info.git_commit.as_deref().unwrap_or("unknown"),
        dirty_marker = if latest.benchmark_info.git_dirty.unwrap_or(false) { "*" } else { "" },
        git_branch = latest.benchmark_info.git_branch.as_deref().unwrap_or("unknown"),
        timestamp = &latest.benchmark_info.timestamp[..19].replace('T', " "),
        css = css,
        models_json = models_json,
        // Speed metrics
        speed_multiplier = 1.0 / latest.aggregate_stats.average_real_time_factor,
        rtf = latest.aggregate_stats.average_real_time_factor,
        median_rtf = latest.aggregate_stats.median_real_time_factor,
        std_rtf = latest.aggregate_stats.std_dev_real_time_factor,
        // Accuracy metrics
        wer = latest.aggregate_stats.average_word_error_rate * 100.0,
        wer_class = if latest.aggregate_stats.average_word_error_rate < 0.05 { "accent" } else if latest.aggregate_stats.average_word_error_rate < 0.15 { "warning" } else { "error" },
        median_wer = latest.aggregate_stats.median_word_error_rate * 100.0,
        cer = latest.aggregate_stats.average_character_error_rate * 100.0,
        std_wer = latest.aggregate_stats.std_dev_word_error_rate * 100.0,
        // Match metrics
        exact_match_count = latest.aggregate_stats.exact_match_count,
        total_samples = latest.aggregate_stats.total_samples,
        exact_match_rate = latest.aggregate_stats.exact_match_rate * 100.0,
        match_class = if latest.aggregate_stats.exact_match_rate > 0.8 { "accent" } else if latest.aggregate_stats.exact_match_rate > 0.5 { "warning" } else { "error" },
        total_subs = latest.aggregate_stats.total_word_substitutions,
        total_dels = latest.aggregate_stats.total_word_deletions,
        total_ins = latest.aggregate_stats.total_word_insertions,
        // Warmup
        warmup_rtf = latest.aggregate_stats.warmup_rtf.unwrap_or(0.0),
        post_warmup_rtf = latest.aggregate_stats.post_warmup_average_rtf.unwrap_or(0.0),
        warmup_penalty = calculate_warmup_penalty(latest),
        gpu_name = latest.benchmark_info.gpu_name,
        // Dynamic sections
        rate_groups_html = render_rate_groups(latest),
        samples_rows_html = render_sample_rows(latest),
        history_rows_html = render_history_rows(results),
        total_runs = results.len(),
        total_audio_duration = latest.aggregate_stats.total_audio_duration_secs,
        total_transcription_time = latest.aggregate_stats.total_transcription_time_secs,
    )
}

fn calculate_warmup_penalty(result: &BenchmarkResult) -> f64 {
    match (result.aggregate_stats.warmup_rtf, result.aggregate_stats.post_warmup_average_rtf) {
        (Some(warmup), Some(post)) if post > 0.0 => ((warmup - post) / post) * 100.0,
        _ => 0.0,
    }
}

fn render_rate_groups(result: &BenchmarkResult) -> String {
    result
        .aggregate_stats
        .by_sample_rate
        .iter()
        .map(|group| {
            let wer_class = if group.average_wer < 0.05 {
                "accent"
            } else if group.average_wer < 0.15 {
                "warning"
            } else {
                "error"
            };
            format!(
                r#"<div class="rate-group">
                    <div class="rate-header">
                        <span class="rate-value mono">{sample_rate} Hz</span>
                        <span class="rate-count">{count} samples</span>
                    </div>
                    <div class="rate-metrics">
                        <div class="rate-metric">
                            <span class="label">WER</span>
                            <span class="value {wer_class}">{wer:.1}%</span>
                        </div>
                        <div class="rate-metric">
                            <span class="label">RTF</span>
                            <span class="value mono">{rtf:.4}</span>
                        </div>
                        <div class="rate-metric">
                            <span class="label">EXACT</span>
                            <span class="value">{exact}/{count}</span>
                        </div>
                    </div>
                </div>"#,
                sample_rate = group.sample_rate,
                count = group.sample_count,
                wer = group.average_wer * 100.0,
                wer_class = wer_class,
                rtf = group.average_rtf,
                exact = group.exact_match_count,
            )
        })
        .collect::<Vec<_>>()
        .join("\n")
}

fn render_sample_rows(result: &BenchmarkResult) -> String {
    result
        .samples
        .iter()
        .map(|sample| {
            let wer_class = if sample.word_error_rate < 0.01 {
                "accent"
            } else if sample.word_error_rate < 0.15 {
                "warning"
            } else {
                "error"
            };
            let match_icon = if sample.exact_match { "✓" } else { "✗" };
            let match_class = if sample.exact_match { "accent" } else { "error" };
            format!(
                r#"<tr>
                    <td class="mono">{file}</td>
                    <td class="mono">{duration:.1}s</td>
                    <td class="mono">{time:.3}s</td>
                    <td class="mono">{rate}</td>
                    <td class="mono">{rtf:.4}</td>
                    <td class="{wer_class}">{wer:.1}%</td>
                    <td class="mono">{cer:.1}%</td>
                    <td class="{match_class}">{match_icon}</td>
                </tr>"#,
                file = sample.file,
                duration = sample.duration_secs,
                time = sample.transcription_time_secs,
                rate = sample.sample_rate,
                rtf = sample.real_time_factor,
                wer = sample.word_error_rate * 100.0,
                wer_class = wer_class,
                cer = sample.character_error_rate * 100.0,
                match_icon = match_icon,
                match_class = match_class,
            )
        })
        .collect::<Vec<_>>()
        .join("\n")
}

fn render_history_rows(results: &[(String, BenchmarkResult)]) -> String {
    results
        .iter()
        .map(|(_, result)| {
            let timestamp = &result.benchmark_info.timestamp[..19].replace('T', " ");
            let commit = result.benchmark_info.git_commit.as_deref().unwrap_or("-");
            let dirty = if result.benchmark_info.git_dirty.unwrap_or(false) { "*" } else { "" };
            format!(
                r#"<tr>
                    <td class="mono">{timestamp}</td>
                    <td class="mono">{model}</td>
                    <td class="mono">{version}</td>
                    <td class="mono">{commit}{dirty}</td>
                    <td class="mono">{rtf:.4}</td>
                    <td class="mono">{wer:.1}%</td>
                    <td class="mono">{exact}/{total}</td>
                </tr>"#,
                timestamp = timestamp,
                model = result.benchmark_info.model_name,
                version = result.benchmark_info.app_version,
                commit = commit,
                dirty = dirty,
                rtf = result.aggregate_stats.average_real_time_factor,
                wer = result.aggregate_stats.average_word_error_rate * 100.0,
                exact = result.aggregate_stats.exact_match_count,
                total = result.aggregate_stats.total_samples,
            )
        })
        .collect::<Vec<_>>()
        .join("\n")
}
