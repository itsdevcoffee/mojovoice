use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

const APP_NAME: &str = "hyprvoice";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    pub model: ModelConfig,
    pub audio: AudioConfig,
    pub output: OutputConfig,
    #[serde(default)]
    pub ui: UiConfig,
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
                timeout_secs: 30,
                save_audio_clips: false,
                audio_clips_path: default_audio_clips_path(),
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
        }
    }
}

/// Load configuration from disk, creating default if not exists
pub fn load() -> Result<Config> {
    let mut config: Config = confy::load(APP_NAME, "config")?;
    // Validate and sanitize UI config values
    config.ui.validate();
    Ok(config)
}

/// Save configuration to disk
pub fn save(config: &Config) -> Result<()> {
    let mut validated_config = config.clone();
    // Validate UI config before saving
    validated_config.ui.validate();
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
