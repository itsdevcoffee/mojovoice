use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

const APP_NAME: &str = "mojovoice";

/// MAINTENANCE: When adding new config fields, also update:
/// 1. `cmd_config_check()` in main.rs - to validate the new field
/// 2. `cmd_config_migrate()` in main.rs - to add the field with a default value
/// 3. Add `#[serde(default)]` if the field is optional
/// This ensures users can validate and migrate their configs after updates.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    pub model: ModelConfig,
    pub audio: AudioConfig,
    pub output: OutputConfig,
    #[serde(default)]
    pub ui: UiConfig,
    #[serde(default)]
    pub history: HistoryConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelConfig {
    /// Path to whisper model file (legacy, kept for backwards compatibility)
    pub path: PathBuf,
    /// HuggingFace model ID for Candle engine (e.g., "openai/whisper-large-v3-turbo")
    pub model_id: String,
    /// Path to optional draft model file for speculative decoding
    pub draft_model_path: Option<PathBuf>,
    /// Language code (e.g., "en")
    pub language: String,
    /// Optional prompt to bias the model vocabulary (technical terms)
    pub prompt: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AudioConfig {
    /// Sample rate in Hz (whisper requires 16000)
    pub sample_rate: u32,
    /// Recording timeout in seconds (0 = no timeout)
    pub timeout_secs: u32,
    /// Save audio recordings to disk
    #[serde(default)]
    pub save_audio_clips: bool,
    /// Directory to save audio clips (WAV format with timestamps)
    #[serde(default = "default_audio_clips_path")]
    pub audio_clips_path: PathBuf,
    /// Audio input device name (None = system default)
    #[serde(default)]
    pub device_name: Option<String>,
}

fn default_audio_clips_path() -> PathBuf {
    directories::BaseDirs::new()
        .map(|dirs| dirs.data_local_dir().join(APP_NAME).join("recordings"))
        .unwrap_or_else(|| PathBuf::from("./recordings"))
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OutputConfig {
    /// Force display server type: "wayland", "x11", or null for auto-detect
    pub display_server: Option<String>,
    /// Add a space after injected text
    pub append_space: bool,
    /// Command to refresh status bar UI (e.g., "pkill -RTMIN+8 waybar")
    pub refresh_command: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UiConfig {
    /// UI scale preset: "small", "medium", "large", or "custom"
    #[serde(default = "default_scale_preset")]
    pub scale_preset: String,
    /// Custom scale multiplier (0.5 to 2.0)
    #[serde(default = "default_custom_scale")]
    pub custom_scale: f32,
}

fn default_scale_preset() -> String {
    "medium".to_string()
}

fn default_custom_scale() -> f32 {
    1.0
}

impl Default for UiConfig {
    fn default() -> Self {
        Self {
            scale_preset: default_scale_preset(),
            custom_scale: default_custom_scale(),
        }
    }
}

impl UiConfig {
    /// Validate and sanitize UI config values
    pub fn validate(&mut self) {
        // Validate scale preset
        let valid_presets = ["small", "medium", "large", "custom"];
        if !valid_presets.contains(&self.scale_preset.as_str()) {
            eprintln!("Invalid scale_preset '{}', using 'medium'", self.scale_preset);
            self.scale_preset = "medium".to_string();
        }

        // Clamp custom scale to valid bounds (0.5 to 2.0)
        if self.custom_scale < 0.5 || self.custom_scale > 2.0 {
            eprintln!("Custom scale {} out of bounds, clamping to [0.5, 2.0]", self.custom_scale);
            self.custom_scale = self.custom_scale.clamp(0.5, 2.0);
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HistoryConfig {
    /// Maximum number of history entries to keep (None = unlimited)
    #[serde(default = "default_max_entries")]
    pub max_entries: Option<u32>,
}

fn default_max_entries() -> Option<u32> {
    Some(500)
}

impl Default for HistoryConfig {
    fn default() -> Self {
        Self {
            max_entries: default_max_entries(),
        }
    }
}

/// Maximum allowed value for max_entries (prevents unbounded memory usage)
const MAX_ENTRIES_UPPER_BOUND: u32 = 100_000;

impl HistoryConfig {
    /// Validate history config values
    pub fn validate(&mut self) {
        if let Some(max) = self.max_entries {
            // Enforce minimum of 5 entries
            if max < 5 {
                eprintln!("max_entries {} too low, setting to 5", max);
                self.max_entries = Some(5);
            }
            // Enforce maximum of 100,000 entries to prevent unbounded memory usage
            else if max > MAX_ENTRIES_UPPER_BOUND {
                eprintln!(
                    "max_entries {} exceeds maximum ({}), capping",
                    max, MAX_ENTRIES_UPPER_BOUND
                );
                self.max_entries = Some(MAX_ENTRIES_UPPER_BOUND);
            }
        }
    }
}

impl Default for Config {
    fn default() -> Self {
        let data_dir = directories::BaseDirs::new()
            .map(|dirs| dirs.data_local_dir().join(APP_NAME))
            .unwrap_or_else(|| PathBuf::from("."));

        Self {
            model: ModelConfig {
                path: data_dir.join("models/whisper-large-v3-turbo-safetensors"),
                model_id: "openai/whisper-large-v3-turbo".to_string(),
                draft_model_path: Some(data_dir.join("models/ggml-tiny.en.bin")),
                language: "en".to_string(),
                prompt: None, // Disabled by default - causes decoder issues when enabled
            },
            audio: AudioConfig {
                sample_rate: 16000,
                timeout_secs: 180,
                save_audio_clips: false,
                audio_clips_path: default_audio_clips_path(),
                device_name: None,
            },
            output: OutputConfig {
                display_server: None,
                append_space: true,
                refresh_command: Some("pkill -RTMIN+8 waybar".to_string()),
            },
            ui: UiConfig {
                scale_preset: default_scale_preset(),
                custom_scale: default_custom_scale(),
            },
            history: HistoryConfig::default(),
        }
    }
}

/// Load configuration from disk, creating default if not exists
pub fn load() -> Result<Config> {
    let mut config: Config = confy::load(APP_NAME, "config")?;
    // Validate and sanitize config values
    config.ui.validate();
    config.history.validate();
    Ok(config)
}

/// Save configuration to disk
pub fn save(config: &Config) -> Result<()> {
    let mut validated_config = config.clone();
    // Validate config before saving
    validated_config.ui.validate();
    validated_config.history.validate();
    confy::store(APP_NAME, "config", &validated_config)?;
    Ok(())
}

/// Get the configuration file path
pub fn config_path() -> Result<PathBuf> {
    let path = confy::get_configuration_file_path(APP_NAME, "config")?;
    Ok(path)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_config() {
        let config = Config::default();
        assert_eq!(config.audio.sample_rate, 16000);
        assert_eq!(config.model.language, "en");
        assert_eq!(config.ui.scale_preset, "medium");
        assert_eq!(config.ui.custom_scale, 1.0);
    }
}
