use anyhow::Result;

pub mod candle_engine;
pub mod whisper;

/// Trait to abstract transcription engines
pub trait Transcriber: Send + Sync {
    /// Transcribe 16kHz mono f32 audio data to text
    ///
    /// Note: `&mut self` is required for Candle's stateful encoder/decoder forward passes.
    /// The model maintains internal state during inference that must be mutated.
    fn transcribe(&mut self, audio: &[f32]) -> Result<String>;
}
