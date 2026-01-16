use anyhow::Result;
use clap::{Parser, Subcommand};
use tracing::info;
use tracing_appender::rolling::{RollingFileAppender, Rotation};
use tracing_subscriber::layer::SubscriberExt;
use tracing_subscriber::util::SubscriberInitExt;

mod audio;
mod benchmark;
mod commands;
mod config;
mod daemon;
mod error;
mod model;
mod output;
mod state;
mod transcribe;

/// Validate that the model file exists, returning a helpful error if not
fn validate_model_path(cfg: &config::Config) -> Result<()> {
    if !cfg.model.path.exists() {
        anyhow::bail!(
            "Model not found: {}\nRun: mojovoice download {}",
            cfg.model.path.display(),
            cfg.model.path.file_stem().unwrap_or_default().to_string_lossy()
        );
    }
    Ok(())
}

/// Truncate text to 80 chars with ellipsis for notification preview
fn truncate_preview(text: &str) -> String {
    if text.len() > 80 {
        format!("{}...", text.chars().take(77).collect::<String>())
    } else {
        text.to_string()
    }
}

/// Convert clipboard flag to OutputMode
fn output_mode_from_clipboard(clipboard: bool) -> output::OutputMode {
    if clipboard {
        output::OutputMode::Clipboard
    } else {
        output::OutputMode::Type
    }
}

#[derive(Parser)]
#[command(name = "mojovoice")]
#[command(about = "Voice dictation for Linux developers")]
#[command(version)]
struct Cli {
    /// Enable verbose logging
    #[arg(short, long, global = true)]
    verbose: bool,

    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Start or stop voice recording (toggle mode when duration=0)
    Start {
        /// Override model path
        #[arg(short, long)]
        model: Option<String>,

        /// Recording duration in seconds (0 = toggle mode)
        #[arg(short, long, default_value = "0")]
        duration: u32,

        /// Copy to clipboard instead of typing
        #[arg(short, long)]
        clipboard: bool,
    },

    /// Stop a running recording
    Stop,

    /// Cancel a running recording (discard without transcribing)
    Cancel,

    /// Download a whisper model
    Download {
        /// Model name (e.g. large-v3-turbo, distil-large-v3, base.en)
        #[arg(default_value = "large-v3-turbo")]
        model: String,
    },

    /// Show or edit configuration
    Config {
        /// Print config file path
        #[arg(long)]
        path: bool,

        /// Reset to default configuration
        #[arg(long)]
        reset: bool,

        /// Check config for missing or outdated fields
        #[arg(long)]
        check: bool,

        /// Migrate config to latest schema (creates backup)
        #[arg(long)]
        migrate: bool,
    },

    /// Check system dependencies
    Doctor,

    /// Daemon management commands
    Daemon {
        #[command(subcommand)]
        command: Option<DaemonCommands>,
    },

    /// Test enigo keyboard/clipboard functionality
    EnigoTest {
        /// Test text to paste (default: "Hello from enigo!")
        #[arg(short, long, default_value = "Hello from enigo!")]
        text: String,

        /// Test clipboard mode instead of paste
        #[arg(short, long)]
        clipboard: bool,
    },

    /// Transcribe a WAV file (for testing/debugging)
    TranscribeFile {
        /// Path to WAV file to transcribe
        path: std::path::PathBuf,

        /// Override model path
        #[arg(short, long)]
        model: Option<String>,
    },

    /// Benchmark the current model against test audio samples
    Benchmark {
        /// Custom samples directory (default: assets/audio/samples/)
        #[arg(short, long)]
        samples_dir: Option<std::path::PathBuf>,

        /// Output directory for results (default: benchmarks/)
        #[arg(short, long)]
        output_dir: Option<std::path::PathBuf>,

        /// Print results to stdout only (no file output)
        #[arg(long)]
        stdout_only: bool,

        /// Generate HTML report from all benchmark results
        #[arg(long)]
        report: bool,
    },
}

#[derive(Subcommand)]
enum DaemonCommands {
    /// Start the daemon server (keeps model loaded in GPU memory)
    Up {
        /// Override model path
        #[arg(short, long)]
        model: Option<String>,
    },

    /// Stop the running daemon
    Down,

    /// Restart the daemon (down + up)
    Restart {
        /// Override model path
        #[arg(short, long)]
        model: Option<String>,
    },

    /// Show daemon status (running, model, GPU)
    Status,

    /// View daemon logs
    Logs {
        /// Follow log output (like tail -f)
        #[arg(short, long)]
        follow: bool,

        /// Number of lines to show
        #[arg(short = 'n', long, default_value = "50")]
        lines: usize,
    },

    /// Print daemon PID
    Pid,
}

fn main() -> Result<()> {
    let cli = Cli::parse();

    // Initialize logging with both console and file output
    init_logging(cli.verbose)?;

    match cli.command {
        Commands::Start { model, duration, clipboard } => cmd_start(model, duration, clipboard)?,
        Commands::Stop => cmd_stop()?,
        Commands::Cancel => cmd_cancel()?,
        Commands::Download { model } => cmd_download(&model)?,
        Commands::Config { path, reset, check, migrate } => cmd_config(path, reset, check, migrate)?,
        Commands::Doctor => cmd_doctor()?,
        Commands::Daemon { command } => cmd_daemon(command)?,
        Commands::EnigoTest { text, clipboard } => commands::enigo_test(&text, clipboard)?,
        Commands::TranscribeFile { path, model } => cmd_transcribe_file(&path, model)?,
        Commands::Benchmark { samples_dir, output_dir, stdout_only, report } => {
            cmd_benchmark(samples_dir, output_dir, stdout_only, report)?
        }
    }

    Ok(())
}

/// Initialize logging with console and file output
fn init_logging(verbose: bool) -> Result<()> {
    let default_filter = if verbose { "debug" } else { "info" };

    // Set up file logging
    let log_dir = state::get_log_dir()?;
    let file_appender = RollingFileAppender::new(Rotation::DAILY, log_dir, "mojovoice.log");

    // Create layers
    let file_layer = tracing_subscriber::fmt::layer()
        .with_writer(file_appender)
        .with_ansi(false)
        .with_target(false);

    let console_layer = tracing_subscriber::fmt::layer().with_target(false);

    // Respect RUST_LOG env var, fallback to default filter
    let env_filter = tracing_subscriber::EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new(default_filter));

    // Combine layers
    tracing_subscriber::registry()
        .with(env_filter)
        .with(console_layer)
        .with(file_layer)
        .init();

    Ok(())
}

fn cmd_start(model_override: Option<String>, duration: u32, clipboard: bool) -> Result<()> {
    // Check if toggle mode (duration = 0)
    if duration == 0 {
        return cmd_start_toggle(model_override, clipboard);
    }

    // Fixed duration mode
    cmd_start_fixed(model_override, duration, clipboard)
}

/// Toggle mode: first call starts, second call stops
fn cmd_start_toggle(model_override: Option<String>, clipboard: bool) -> Result<()> {
    let mut cfg = config::load()?;
    if let Some(model_path) = model_override {
        cfg.model.path = model_path.into();
    }
    validate_model_path(&cfg)?;

    if state::is_recording()?.is_some() {
        cmd_stop_recording(clipboard)
    } else {
        cmd_start_recording(cfg.audio.timeout_secs)
    }
}

/// Stop recording and transcribe (called from toggle mode)
fn cmd_stop_recording(clipboard: bool) -> Result<()> {
    info!("Recording in progress, requesting transcription from daemon...");
    println!("Stopping recording and transcribing...");

    if !daemon::is_daemon_running() {
        anyhow::bail!("Daemon is not running. Start it first with: mojovoice daemon &");
    }

    let processing_file = state::get_state_dir()?.join("processing");
    std::fs::write(&processing_file, "")?;
    let _processing_cleanup = scopeguard::guard((), |_| {
        let _ = std::fs::remove_file(&processing_file);
    });

    let response = daemon::send_request(&daemon::DaemonRequest::StopRecording)?;
    let _ = state::cleanup_processing();

    match response {
        daemon::DaemonResponse::Success { text } => {
            if text.is_empty() {
                info!("No speech detected");
                return Ok(());
            }

            let output_mode = output_mode_from_clipboard(clipboard);
            info!("Transcribed: {}", text);
            output::inject_text(&text, output_mode)?;
            info!("Text output via {:?}", output_mode);

            send_notification("Transcription Complete", &truncate_preview(&text), "normal");
            Ok(())
        }
        daemon::DaemonResponse::Error { message } => anyhow::bail!("Daemon error: {}", message),
        _ => anyhow::bail!("Unexpected response from daemon"),
    }
}

/// Start recording (called from toggle mode)
fn cmd_start_recording(timeout_secs: u32) -> Result<()> {
    info!("Starting recording via daemon (max {} seconds)", timeout_secs);
    println!("Recording started. Run 'mojovoice start' again or 'mojovoice stop' to finish.");

    if !daemon::is_daemon_running() {
        anyhow::bail!("Daemon is not running. Start it first with: mojovoice daemon &");
    }

    let response = daemon::send_request(&daemon::DaemonRequest::StartRecording {
        max_duration: timeout_secs,
    })?;

    match response {
        daemon::DaemonResponse::Recording => {
            info!("Daemon started recording");
            println!("Recording... Press Super+V again to stop and transcribe.");
            Ok(())
        }
        daemon::DaemonResponse::Error { message } => anyhow::bail!("Failed to start recording: {}", message),
        _ => anyhow::bail!("Unexpected response from daemon"),
    }
}

/// Fixed duration recording mode
fn cmd_start_fixed(model_override: Option<String>, duration: u32, clipboard: bool) -> Result<()> {
    use transcribe::Transcriber;

    info!("Loading configuration...");
    let mut cfg = config::load()?;
    if let Some(model_path) = model_override {
        cfg.model.path = model_path.into();
    }
    info!("Model: {}", cfg.model.path.display());
    validate_model_path(&cfg)?;

    let output_mode = output_mode_from_clipboard(clipboard);
    info!("Output mode: {:?}", output_mode);

    info!("Loading whisper model...");
    let mut transcriber = transcribe::candle_engine::CandleEngine::with_options(
        cfg.model.path.to_str().ok_or_else(|| anyhow::anyhow!("Invalid model path"))?,
        &cfg.model.language,
        cfg.model.prompt.clone(),
    )?;
    info!("Model loaded successfully");

    info!("Recording for {} seconds...", duration);
    let audio_data = audio::capture(duration, cfg.audio.sample_rate)?;
    info!("Captured {} samples", audio_data.len());

    let processing_file = state::get_state_dir()?.join("processing");
    std::fs::write(&processing_file, "")?;
    let _processing_cleanup = scopeguard::guard((), |_| {
        let _ = std::fs::remove_file(&processing_file);
    });

    info!("Transcribing...");
    let text = transcriber.transcribe(&audio_data)?;

    if text.is_empty() {
        info!("No speech detected");
        return Ok(());
    }

    info!("Transcribed: {}", text);
    output::inject_text(&text, output_mode)?;
    info!("Text output via {:?}", output_mode);

    send_notification("Transcription Complete", &truncate_preview(&text), "normal");
    Ok(())
}

/// Stop a running recording
fn cmd_stop() -> Result<()> {
    if let Some(recording_state) = state::is_recording()? {
        info!("Stopping recording (PID: {})", recording_state.pid);
        // Send stop signal via daemon
        daemon::daemon_stop_recording()?;
        println!("Stop signal sent to recording process");
    } else {
        println!("No recording in progress");
    }
    Ok(())
}

fn cmd_cancel() -> Result<()> {
    // Send cancel signal via daemon (silent, no-op if not recording)
    daemon::daemon_cancel_recording()?;

    // Refresh waybar to return to idle state
    state::toggle::refresh_waybar();

    Ok(())
}

fn cmd_download(model_name: &str) -> Result<()> {
    let cfg = config::load()?;
    let models_dir = cfg.model.path.parent().unwrap_or(std::path::Path::new("."));

    let model_info = model::ModelInfo::find(model_name).ok_or_else(|| {
        let available = model::ModelInfo::available_models();
        anyhow::anyhow!(
            "Unknown model: {}\nAvailable models: {}",
            model_name,
            available.join(", ")
        )
    })?;

    let dest = model::download_model(model_info, models_dir)?;
    info!("Model ready: {}", dest.display());

    Ok(())
}

fn cmd_config(show_path: bool, reset: bool, check: bool, migrate: bool) -> Result<()> {
    if reset {
        let cfg = config::Config::default();
        config::save(&cfg)?;
        info!("Configuration reset to defaults");
        return Ok(());
    }

    if show_path {
        let path = config::config_path()?;
        println!("{}", path.display());
        return Ok(());
    }

    if check {
        return cmd_config_check();
    }

    if migrate {
        return cmd_config_migrate();
    }

    let cfg = config::load()?;
    let toml = toml::to_string_pretty(&cfg)?;
    println!("{}", toml);

    Ok(())
}

/// Check config for missing or outdated fields
fn cmd_config_check() -> Result<()> {
    let current = config::load()?;
    let defaults = config::Config::default();

    println!("Configuration Validation\n");

    let mut has_warnings = false;

    // Check model_id (required for Candle engine)
    if current.model.model_id.is_empty() {
        println!("✗ model.model_id = (missing, required for Candle engine)");
        has_warnings = true;
    } else {
        println!("✓ model.model_id = \"{}\"", current.model.model_id);
    }

    // Check model path
    let model_exists = current.model.path.exists();
    println!(
        "{} model.path = {}",
        if model_exists { "✓" } else { "✗" },
        current.model.path.display()
    );
    if !model_exists {
        has_warnings = true;
    }

    // Check draft model
    match &current.model.draft_model_path {
        Some(path) => {
            let exists = path.exists();
            println!(
                "{} model.draft_model_path = {}",
                if exists { "✓" } else { "⚠" },
                path.display()
            );
            if !exists {
                has_warnings = true;
            }
        },
        None => {
            println!("⚠ model.draft_model_path = (missing, speculative decoding disabled)");
            has_warnings = true;
        },
    }

    // Check prompt
    match &current.model.prompt {
        Some(p) if !p.is_empty() => println!("✓ model.prompt = (set, {} chars)", p.len()),
        _ => {
            println!("⚠ model.prompt = (missing, using no technical biasing)");
            has_warnings = true;
        },
    }

    // Check refresh_command
    match &current.output.refresh_command {
        Some(cmd) => println!("✓ output.refresh_command = \"{}\"", cmd),
        None => {
            if let Some(default_cmd) = &defaults.output.refresh_command {
                println!("⚠ output.refresh_command = (missing, no UI refresh)");
                println!("  Suggestion: {}", default_cmd);
                has_warnings = true;
            }
        },
    }

    // Show appropriate message based on validation results
    if has_warnings {
        println!("\nRun 'mojovoice config --migrate' to auto-update missing fields.");
    } else {
        println!("\n✓ Your config is valid and up to date.");
    }

    Ok(())
}

/// Migrate config to latest schema with backup
fn cmd_config_migrate() -> Result<()> {
    use std::fs;
    use std::time::SystemTime;

    let config_path = config::config_path()?;
    let backup_dir = config_path.parent().unwrap().join("backups");
    fs::create_dir_all(&backup_dir)?;

    // Create timestamped backup
    let timestamp = SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)?
        .as_secs();
    let backup_path = backup_dir.join(format!("config.toml.backup-{}", timestamp));

    println!("Creating backup: {}", backup_path.display());
    fs::copy(&config_path, &backup_path)?;

    // Load current and defaults
    let mut current = config::load()?;
    let defaults = config::Config::default();

    // Merge: Keep user values, add missing fields from defaults
    if current.model.model_id.is_empty() {
        current.model.model_id = "openai/whisper-large-v3-turbo".to_string();
        println!("✓ Added model.model_id");
    }

    if current.model.draft_model_path.is_none() {
        current.model.draft_model_path = defaults.model.draft_model_path;
        println!("✓ Added model.draft_model_path");
    }

    if current.model.prompt.is_none() {
        current.model.prompt = defaults.model.prompt;
        println!("✓ Added model.prompt (technical vocabulary)");
    }

    if current.output.refresh_command.is_none() {
        current.output.refresh_command = defaults.output.refresh_command;
        println!("✓ Added output.refresh_command");
    }

    // Save updated config
    config::save(&current)?;
    println!("\nMigration complete! Config updated with new fields.");
    println!("Backup saved to: {}", backup_path.display());

    Ok(())
}

/// Send desktop notification
fn send_notification(title: &str, body: &str, urgency: &str) {
    let _ = std::process::Command::new("notify-send")
        .args([
            "-a",
            "mojovoice",
            "-i",
            "audio-input-microphone",
            "-u",
            urgency,
            title,
            body,
        ])
        .spawn();
}

fn cmd_daemon(command: Option<DaemonCommands>) -> Result<()> {
    match command {
        None => {
            // No subcommand - show help
            println!("Daemon management commands\n");
            println!("Usage: mojovoice daemon <COMMAND>\n");
            println!("Commands:");
            println!("  up        Start the daemon server");
            println!("  down      Stop the running daemon");
            println!("  restart   Restart the daemon");
            println!("  status    Show daemon status");
            println!("  logs      View daemon logs");
            println!("  pid       Print daemon PID");
            println!("\nRun 'mojovoice daemon <COMMAND> --help' for more info");
            Ok(())
        }
        Some(DaemonCommands::Up { model }) => cmd_daemon_up(model),
        Some(DaemonCommands::Down) => cmd_daemon_down(),
        Some(DaemonCommands::Restart { model }) => cmd_daemon_restart(model),
        Some(DaemonCommands::Status) => cmd_daemon_status(),
        Some(DaemonCommands::Logs { follow, lines }) => cmd_daemon_logs(follow, lines),
        Some(DaemonCommands::Pid) => cmd_daemon_pid(),
    }
}

fn cmd_daemon_up(model_override: Option<String>) -> Result<()> {
    // Check if already running
    if daemon::is_daemon_running() {
        anyhow::bail!("Daemon is already running. Use 'mojovoice daemon restart' to restart it.");
    }

    let mut cfg = config::load()?;
    if let Some(model_path) = model_override {
        cfg.model.path = model_path.into();
    }
    validate_model_path(&cfg)?;

    info!("Starting daemon with model: {}", cfg.model.path.display());
    println!("Starting daemon...");

    daemon::run_daemon(&cfg.model.path)?;
    Ok(())
}

fn cmd_daemon_down() -> Result<()> {
    if !daemon::is_daemon_running() {
        println!("Daemon is not running");
        return Ok(());
    }

    println!("Stopping daemon...");
    daemon::daemon_shutdown()?;
    println!("Daemon stopped");
    Ok(())
}

fn cmd_daemon_restart(model_override: Option<String>) -> Result<()> {
    // Shutdown if running
    if daemon::is_daemon_running() {
        println!("Shutting down existing daemon...");
        daemon::daemon_shutdown()?;

        // Wait for daemon to actually stop (up to 5 seconds)
        let mut attempts = 0;
        while daemon::is_daemon_running() && attempts < 50 {
            std::thread::sleep(std::time::Duration::from_millis(100));
            attempts += 1;
        }

        if daemon::is_daemon_running() {
            anyhow::bail!("Daemon did not shut down within 5 seconds. Try 'mojovoice daemon shutdown' manually.");
        }
        println!("Daemon stopped.");
    }

    // Start new daemon (bypass the is_running check since we just stopped it)
    let mut cfg = config::load()?;
    if let Some(model_path) = model_override {
        cfg.model.path = model_path.into();
    }
    validate_model_path(&cfg)?;

    info!("Starting daemon with model: {}", cfg.model.path.display());
    println!("Starting daemon...");

    daemon::run_daemon(&cfg.model.path)?;
    Ok(())
}

fn cmd_daemon_status() -> Result<()> {
    if !daemon::is_daemon_running() {
        println!("Status: Stopped");
        return Ok(());
    }

    let status = daemon::daemon_get_status()?;
    let gpu_status = if status.gpu_enabled { "Enabled" } else { "Disabled" };

    println!("Status: Running");
    println!("Model:  {}", status.model_name);
    println!("GPU:    {} ({})", gpu_status, status.gpu_name);

    if let Ok(pid_file) = state::get_daemon_pid_file() {
        if let Ok(pid) = std::fs::read_to_string(&pid_file) {
            println!("PID:    {}", pid.trim());
        }
    }

    Ok(())
}

fn cmd_daemon_logs(follow: bool, lines: usize) -> Result<()> {
    let log_dir = state::get_log_dir()?;

    // Find the most recent log file (they have date suffixes like mojovoice.log.2026-01-14)
    let log_file = std::fs::read_dir(&log_dir)?
        .filter_map(|e| e.ok())
        .map(|e| e.path())
        .filter(|p| {
            p.file_name()
                .and_then(|n| n.to_str())
                .is_some_and(|n| n.starts_with("mojovoice.log"))
        })
        .max_by_key(|p| p.metadata().and_then(|m| m.modified()).ok());

    let log_file = match log_file {
        Some(f) => f,
        None => {
            println!("No log files found in: {}", log_dir.display());
            return Ok(());
        }
    };

    println!("Log file: {}\n", log_file.display());

    if follow {
        // Use tail -f for following
        let status = std::process::Command::new("tail")
            .args(["-f", "-n", &lines.to_string()])
            .arg(&log_file)
            .status()?;

        if !status.success() {
            anyhow::bail!("tail command failed");
        }
    } else {
        // Just show last N lines
        let output = std::process::Command::new("tail")
            .args(["-n", &lines.to_string()])
            .arg(&log_file)
            .output()?;

        print!("{}", String::from_utf8_lossy(&output.stdout));
    }

    Ok(())
}

fn cmd_daemon_pid() -> Result<()> {
    let pid_file = state::get_daemon_pid_file()?;

    if !pid_file.exists() {
        if daemon::is_daemon_running() {
            println!("Daemon is running but PID file not found");
            println!("(This may happen with older daemon versions)");
        } else {
            println!("Daemon is not running");
        }
        return Ok(());
    }

    let pid = std::fs::read_to_string(&pid_file)?;
    println!("{}", pid.trim());
    Ok(())
}

fn cmd_doctor() -> Result<()> {
    println!("Checking system dependencies...\n");

    println!("[OK] Text injection (enigo - cross-platform, built-in)");
    println!("[OK] Clipboard (arboard - cross-platform, built-in)");

    let cfg = config::load()?;
    let model_ok = cfg.model.path.exists();
    println!(
        "\n[{}] Whisper model: {}",
        if model_ok { "OK" } else { "MISSING" },
        cfg.model.path.display()
    );

    if !model_ok {
        println!("\nDownload a model with: mojovoice download base.en");
    }

    let pw_ok = std::process::Command::new("pw-cli")
        .arg("info")
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false);
    println!("\n[{}] PipeWire", if pw_ok { "OK" } else { "MISSING" });

    // Show log location
    if let Ok(log_dir) = state::get_log_dir() {
        println!("\nLogs: {}", log_dir.display());
    }

    println!();
    Ok(())
}

/// Run benchmark on test audio samples
fn cmd_benchmark(
    samples_dir: Option<std::path::PathBuf>,
    output_dir: Option<std::path::PathBuf>,
    stdout_only: bool,
    report: bool,
) -> Result<()> {
    // Default paths relative to current working directory
    let samples_dir = samples_dir.unwrap_or_else(|| std::path::PathBuf::from("assets/audio/samples"));
    let output_dir = output_dir.unwrap_or_else(|| std::path::PathBuf::from("benchmarks"));

    // If --report flag is set, generate HTML report from existing results
    if report {
        let report_path = benchmark::report::generate_report(&output_dir)?;
        println!("Report generated: {}", report_path.display());
        return Ok(());
    }

    if !samples_dir.exists() {
        anyhow::bail!(
            "Samples directory not found: {}\nExpected to find test audio files here.",
            samples_dir.display()
        );
    }

    benchmark::run_benchmark(&samples_dir, &output_dir, stdout_only)
}

/// Transcribe a WAV file via daemon (for testing/debugging)
fn cmd_transcribe_file(path: &std::path::Path, _model_override: Option<String>) -> Result<()> {
    use hound::WavReader;
    use rubato::{Resampler, SincFixedIn, SincInterpolationParameters, SincInterpolationType, WindowFunction};

    const TARGET_SAMPLE_RATE: u32 = 16000;

    if !daemon::is_daemon_running() {
        anyhow::bail!("Daemon is not running. Start it first with: mojovoice daemon &");
    }

    if !path.exists() {
        anyhow::bail!("File not found: {}", path.display());
    }

    info!("Loading WAV file: {}", path.display());
    let mut reader = WavReader::open(path)?;
    let spec = reader.spec();

    info!(
        "WAV spec: {} channels, {}Hz, {}-bit {:?}",
        spec.channels, spec.sample_rate, spec.bits_per_sample, spec.sample_format
    );

    let samples: Vec<f32> = match spec.sample_format {
        hound::SampleFormat::Float => reader.samples::<f32>().map(|s| s.unwrap()).collect(),
        hound::SampleFormat::Int => {
            let max_val = (1 << (spec.bits_per_sample - 1)) as f32;
            reader.samples::<i32>().map(|s| s.unwrap() as f32 / max_val).collect()
        }
    };
    info!("Loaded {} raw samples", samples.len());

    let mono_samples: Vec<f32> = if spec.channels == 2 {
        info!("Converting stereo to mono...");
        samples.chunks(2).map(|chunk| (chunk[0] + chunk[1]) / 2.0).collect()
    } else {
        samples
    };
    info!("Mono samples: {}", mono_samples.len());

    let audio_16k: Vec<f32> = if spec.sample_rate != TARGET_SAMPLE_RATE {
        info!("Resampling from {}Hz to {}Hz...", spec.sample_rate, TARGET_SAMPLE_RATE);

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
        waves_out.remove(0)
    } else {
        mono_samples
    };

    let duration_secs = audio_16k.len() as f32 / TARGET_SAMPLE_RATE as f32;
    info!("Final audio: {} samples ({:.2}s at {}Hz)", audio_16k.len(), duration_secs, TARGET_SAMPLE_RATE);

    info!("Sending to daemon for transcription...");
    let response = daemon::send_request(&daemon::DaemonRequest::TranscribeAudio { samples: audio_16k })?;

    match response {
        daemon::DaemonResponse::Success { text } => println!("\n=== Transcription ===\n{}\n", text),
        daemon::DaemonResponse::Error { message } => anyhow::bail!("Transcription failed: {}", message),
        _ => anyhow::bail!("Unexpected response from daemon"),
    }

    Ok(())
}
