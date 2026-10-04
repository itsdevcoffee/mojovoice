use anyhow::Result;
use std::path::{Path, PathBuf};

pub mod candle_engine;
mod mel;
#[cfg(feature = "whisper-cpp")]
pub mod whisper_cpp_engine;

/// Trait to abstract transcription engines
pub trait Transcriber: Send + Sync {
    /// Transcribe 16kHz mono f32 audio data to text
    ///
    /// Note: `&mut self` is required for Candle's stateful encoder/decoder forward passes.
    /// The model maintains internal state during inference that must be mutated.
    fn transcribe(&mut self, audio: &[f32]) -> Result<String>;

    /// Whether this engine runs on a GPU, and a label for status displays
    fn device_label(&self) -> (bool, String) {
        (false, "CPU".to_string())
    }
}

/// If `model_path` is a whisper.cpp GGML model (a directory containing `model.bin`, or a
/// `.bin` file), return the model file. Such models run on the whisper.cpp engine;
/// everything else (safetensors, GGUF) runs on Candle.
pub fn ggml_model_file(model_path: &Path) -> Option<PathBuf> {
    if model_path.is_dir() {
        let file = model_path.join("model.bin");
        return file.is_file().then_some(file);
    }
    let is_bin = model_path.extension().is_some_and(|ext| ext == "bin");
    (is_bin && model_path.is_file()).then(|| model_path.to_path_buf())
}

/// Load the engine for `model_path`: whisper.cpp for GGML models, Candle otherwise
pub fn load_engine(
    model_path: &Path,
    language: &str,
    initial_prompt: Option<String>,
) -> Result<Box<dyn Transcriber>> {
    match ggml_model_file(model_path) {
        #[cfg(feature = "whisper-cpp")]
        Some(model_file) => Ok(Box::new(whisper_cpp_engine::WhisperCppEngine::new(
            &model_file,
            language,
            initial_prompt,
        )?)),
        #[cfg(not(feature = "whisper-cpp"))]
        Some(_) => anyhow::bail!(
            "{} is a whisper.cpp (GGML) model, but this build doesn't include the whisper.cpp engine",
            model_path.display()
        ),
        None => Ok(Box::new(candle_engine::CandleEngine::with_options(
            model_path
                .to_str()
                .ok_or_else(|| anyhow::anyhow!("Invalid model path"))?,
            language,
            initial_prompt,
        )?)),
    }
}

#[cfg(test)]
mod tests {
    use super::ggml_model_file;

    #[test]
    fn detects_ggml_models() {
        let dir = std::env::temp_dir().join(format!("mojovoice-ggml-test-{}", std::process::id()));
        let ggml_dir = dir.join("ggml-base-en");
        let candle_dir = dir.join("whisper-base-en");
        std::fs::create_dir_all(&ggml_dir).unwrap();
        std::fs::create_dir_all(&candle_dir).unwrap();
        std::fs::write(ggml_dir.join("model.bin"), b"").unwrap();
        std::fs::write(candle_dir.join("model.safetensors"), b"").unwrap();
        std::fs::write(dir.join("ggml-tiny.bin"), b"").unwrap();

        assert_eq!(ggml_model_file(&ggml_dir), Some(ggml_dir.join("model.bin")));
        assert_eq!(ggml_model_file(&candle_dir), None);
        assert_eq!(
            ggml_model_file(&dir.join("ggml-tiny.bin")),
            Some(dir.join("ggml-tiny.bin"))
        );
        assert_eq!(ggml_model_file(&dir.join("missing")), None);

        std::fs::remove_dir_all(&dir).unwrap();
    }
}
