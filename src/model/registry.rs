/// On-disk format of a model's weights
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ModelFormat {
    /// `model.safetensors` (full precision)
    Safetensors,
    /// `model.gguf` (quantized, Candle)
    Gguf,
    /// `model.bin` in whisper.cpp's GGML format (run by the whisper.cpp engine, which
    /// can use any Vulkan GPU)
    Ggml,
}

impl ModelFormat {
    pub fn as_str(&self) -> &'static str {
        match self {
            ModelFormat::Safetensors => "safetensors",
            ModelFormat::Gguf => "gguf",
            ModelFormat::Ggml => "ggml",
        }
    }
}

/// A Whisper model that can be downloaded from HuggingFace and loaded by the Candle engine.
///
/// Each model is stored as a directory (`dir_name`) under the models directory containing
/// `config.json`, `tokenizer.json`, and `model.safetensors` or `model.gguf`; GGML models
/// are a single self-contained `model.bin`.
#[derive(Debug, Clone)]
pub struct ModelInfo {
    pub name: &'static str,
    /// Directory name under the models directory
    pub dir_name: &'static str,
    pub size_mb: u32,
    pub family: &'static str,
    pub quantization: &'static str,
    pub format: ModelFormat,
    /// HuggingFace repo holding the weights (e.g. "openai/whisper-large-v3-turbo")
    pub repo_id: &'static str,
    /// GGUF only: repo to fetch config.json and tokenizer.json from
    pub base_repo_id: Option<&'static str>,
    /// GGUF/GGML: weights filename inside `repo_id`
    pub remote_file: Option<&'static str>,
}

/// One file to fetch for a model
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ModelFile {
    /// Name inside the model directory
    pub local_name: &'static str,
    pub repo_id: &'static str,
    /// Name inside the HuggingFace repo
    pub remote_name: &'static str,
}

impl ModelFile {
    pub fn url(&self) -> String {
        format!(
            "https://huggingface.co/{}/resolve/main/{}",
            self.repo_id, self.remote_name
        )
    }
}

/// Model used when none is specified
pub const DEFAULT_MODEL: &str = "large-v3-turbo";

/// Registry of downloadable models (shared by the CLI and the desktop app)
pub const MODEL_REGISTRY: &[ModelInfo] = &[
    // SAFETENSORS MODELS (Full precision)

    // Large V3 Turbo (Recommended - fast and accurate)
    ModelInfo {
        name: "large-v3-turbo",
        dir_name: "whisper-large-v3-turbo",
        size_mb: 1550,
        family: "Large V3 Turbo",
        quantization: "Full",
        format: ModelFormat::Safetensors,
        repo_id: "openai/whisper-large-v3-turbo",
        base_repo_id: None,
        remote_file: None,
    },
    // Distil-Whisper (Faster, English-optimized)
    ModelInfo {
        name: "distil-large-v3.5",
        dir_name: "distil-large-v3.5",
        size_mb: 1510,
        family: "Distil",
        quantization: "Full",
        format: ModelFormat::Safetensors,
        repo_id: "distil-whisper/distil-large-v3.5",
        base_repo_id: None,
        remote_file: None,
    },
    ModelInfo {
        name: "distil-large-v3",
        dir_name: "distil-large-v3",
        size_mb: 1510,
        family: "Distil",
        quantization: "Full",
        format: ModelFormat::Safetensors,
        repo_id: "distil-whisper/distil-large-v3",
        base_repo_id: None,
        remote_file: None,
    },
    ModelInfo {
        name: "distil-large-v2",
        dir_name: "distil-large-v2",
        size_mb: 1510,
        family: "Distil",
        quantization: "Full",
        format: ModelFormat::Safetensors,
        repo_id: "distil-whisper/distil-large-v2",
        base_repo_id: None,
        remote_file: None,
    },
    ModelInfo {
        name: "distil-small.en",
        dir_name: "distil-small-en",
        size_mb: 332,
        family: "Distil",
        quantization: "Full",
        format: ModelFormat::Safetensors,
        repo_id: "distil-whisper/distil-small.en",
        base_repo_id: None,
        remote_file: None,
    },
    // Large V3
    ModelInfo {
        name: "large-v3",
        dir_name: "whisper-large-v3",
        size_mb: 3094,
        family: "Large V3",
        quantization: "Full",
        format: ModelFormat::Safetensors,
        repo_id: "openai/whisper-large-v3",
        base_repo_id: None,
        remote_file: None,
    },
    // Large V2
    ModelInfo {
        name: "large-v2",
        dir_name: "whisper-large-v2",
        size_mb: 3094,
        family: "Large V2",
        quantization: "Full",
        format: ModelFormat::Safetensors,
        repo_id: "openai/whisper-large-v2",
        base_repo_id: None,
        remote_file: None,
    },
    // Large V1
    ModelInfo {
        name: "large",
        dir_name: "whisper-large",
        size_mb: 3094,
        family: "Large",
        quantization: "Full",
        format: ModelFormat::Safetensors,
        repo_id: "openai/whisper-large",
        base_repo_id: None,
        remote_file: None,
    },
    // Medium
    ModelInfo {
        name: "medium",
        dir_name: "whisper-medium",
        size_mb: 3090,
        family: "Medium",
        quantization: "Full",
        format: ModelFormat::Safetensors,
        repo_id: "openai/whisper-medium",
        base_repo_id: None,
        remote_file: None,
    },
    ModelInfo {
        name: "medium.en",
        dir_name: "whisper-medium-en",
        size_mb: 3090,
        family: "Medium",
        quantization: "Full",
        format: ModelFormat::Safetensors,
        repo_id: "openai/whisper-medium.en",
        base_repo_id: None,
        remote_file: None,
    },
    // Small
    ModelInfo {
        name: "small",
        dir_name: "whisper-small",
        size_mb: 970,
        family: "Small",
        quantization: "Full",
        format: ModelFormat::Safetensors,
        repo_id: "openai/whisper-small",
        base_repo_id: None,
        remote_file: None,
    },
    ModelInfo {
        name: "small.en",
        dir_name: "whisper-small-en",
        size_mb: 970,
        family: "Small",
        quantization: "Full",
        format: ModelFormat::Safetensors,
        repo_id: "openai/whisper-small.en",
        base_repo_id: None,
        remote_file: None,
    },
    // Base
    ModelInfo {
        name: "base",
        dir_name: "whisper-base",
        size_mb: 293,
        family: "Base",
        quantization: "Full",
        format: ModelFormat::Safetensors,
        repo_id: "openai/whisper-base",
        base_repo_id: None,
        remote_file: None,
    },
    ModelInfo {
        name: "base.en",
        dir_name: "whisper-base-en",
        size_mb: 293,
        family: "Base",
        quantization: "Full",
        format: ModelFormat::Safetensors,
        repo_id: "openai/whisper-base.en",
        base_repo_id: None,
        remote_file: None,
    },
    // Tiny
    ModelInfo {
        name: "tiny",
        dir_name: "whisper-tiny",
        size_mb: 154,
        family: "Tiny",
        quantization: "Full",
        format: ModelFormat::Safetensors,
        repo_id: "openai/whisper-tiny",
        base_repo_id: None,
        remote_file: None,
    },
    ModelInfo {
        name: "tiny.en",
        dir_name: "whisper-tiny-en",
        size_mb: 154,
        family: "Tiny",
        quantization: "Full",
        format: ModelFormat::Safetensors,
        repo_id: "openai/whisper-tiny.en",
        base_repo_id: None,
        remote_file: None,
    },
    // GGUF MODELS (Quantized - smaller & faster)
    // Note: These may or may not work with Candle's from_gguf() loader.
    // The Demonthos model is confirmed to work; others are experimental.

    // Large V3 Turbo GGUF variants
    ModelInfo {
        name: "large-v3-turbo-q8",
        dir_name: "whisper-large-v3-turbo-q8-gguf",
        size_mb: 478,
        family: "Large V3 Turbo",
        quantization: "Q8_0",
        format: ModelFormat::Gguf,
        repo_id: "Demonthos/candle-quantized-whisper-large-v3-turbo",
        base_repo_id: Some("openai/whisper-large-v3-turbo"),
        remote_file: Some("model.gguf"),
    },
    ModelInfo {
        name: "large-v3-turbo-q4",
        dir_name: "whisper-large-v3-turbo-q4-gguf",
        size_mb: 528,
        family: "Large V3 Turbo",
        quantization: "Q4_1",
        format: ModelFormat::Gguf,
        repo_id: "xkeyC/whisper-large-v3-turbo-gguf",
        base_repo_id: Some("openai/whisper-large-v3-turbo"),
        remote_file: Some("model_q4_1.gguf"),
    },
    ModelInfo {
        name: "large-v3-turbo-q4k",
        dir_name: "whisper-large-v3-turbo-q4k-gguf",
        size_mb: 478,
        family: "Large V3 Turbo",
        quantization: "Q4_K",
        format: ModelFormat::Gguf,
        repo_id: "xkeyC/whisper-large-v3-turbo-gguf",
        base_repo_id: Some("openai/whisper-large-v3-turbo"),
        remote_file: Some("model_q4_k.gguf"),
    },
    // Large V3 GGUF variants
    ModelInfo {
        name: "large-v3-q8",
        dir_name: "whisper-large-v3-q8-gguf",
        size_mb: 1660,
        family: "Large V3",
        quantization: "Q8_0",
        format: ModelFormat::Gguf,
        repo_id: "vonjack/whisper-large-v3-gguf",
        base_repo_id: Some("openai/whisper-large-v3"),
        remote_file: Some("whisper-large-v3-q8_0.gguf"),
    },
    ModelInfo {
        name: "large-v3-f16",
        dir_name: "whisper-large-v3-f16-gguf",
        size_mb: 3100,
        family: "Large V3",
        quantization: "F16",
        format: ModelFormat::Gguf,
        repo_id: "vonjack/whisper-large-v3-gguf",
        base_repo_id: Some("openai/whisper-large-v3"),
        remote_file: Some("whisper-large-v3-f16.gguf"),
    },
    // Medium GGUF variants
    ModelInfo {
        name: "medium-q4k",
        dir_name: "whisper-medium-q4k-gguf",
        size_mb: 446,
        family: "Medium",
        quantization: "Q4_K",
        format: ModelFormat::Gguf,
        repo_id: "OllmOne/whisper-medium-GGUF",
        base_repo_id: Some("openai/whisper-medium"),
        remote_file: Some("model-q4k.gguf"),
    },
    // ===========================================
    // GGML MODELS (whisper.cpp engine; GPU via Vulkan on any vendor)
    // ===========================================
    ModelInfo {
        name: "ggml-large-v3-turbo",
        dir_name: "ggml-large-v3-turbo",
        size_mb: 1624,
        family: "Large V3 Turbo",
        quantization: "Full",
        format: ModelFormat::Ggml,
        repo_id: "ggerganov/whisper.cpp",
        base_repo_id: None,
        remote_file: Some("ggml-large-v3-turbo.bin"),
    },
    ModelInfo {
        name: "ggml-large-v3-turbo-q8_0",
        dir_name: "ggml-large-v3-turbo-q8_0",
        size_mb: 874,
        family: "Large V3 Turbo",
        quantization: "Q8_0",
        format: ModelFormat::Ggml,
        repo_id: "ggerganov/whisper.cpp",
        base_repo_id: None,
        remote_file: Some("ggml-large-v3-turbo-q8_0.bin"),
    },
    ModelInfo {
        name: "ggml-large-v3-turbo-q5_0",
        dir_name: "ggml-large-v3-turbo-q5_0",
        size_mb: 574,
        family: "Large V3 Turbo",
        quantization: "Q5_0",
        format: ModelFormat::Ggml,
        repo_id: "ggerganov/whisper.cpp",
        base_repo_id: None,
        remote_file: Some("ggml-large-v3-turbo-q5_0.bin"),
    },
    ModelInfo {
        name: "ggml-distil-large-v3.5",
        dir_name: "ggml-distil-large-v3.5",
        size_mb: 1519,
        family: "Distil",
        quantization: "Full",
        format: ModelFormat::Ggml,
        repo_id: "distil-whisper/distil-large-v3.5-ggml",
        base_repo_id: None,
        remote_file: Some("ggml-model.bin"),
    },
    ModelInfo {
        name: "ggml-medium.en",
        dir_name: "ggml-medium-en",
        size_mb: 1533,
        family: "Medium",
        quantization: "Full",
        format: ModelFormat::Ggml,
        repo_id: "ggerganov/whisper.cpp",
        base_repo_id: None,
        remote_file: Some("ggml-medium.en.bin"),
    },
    ModelInfo {
        name: "ggml-small.en",
        dir_name: "ggml-small-en",
        size_mb: 488,
        family: "Small",
        quantization: "Full",
        format: ModelFormat::Ggml,
        repo_id: "ggerganov/whisper.cpp",
        base_repo_id: None,
        remote_file: Some("ggml-small.en.bin"),
    },
    ModelInfo {
        name: "ggml-base.en",
        dir_name: "ggml-base-en",
        size_mb: 148,
        family: "Base",
        quantization: "Full",
        format: ModelFormat::Ggml,
        repo_id: "ggerganov/whisper.cpp",
        base_repo_id: None,
        remote_file: Some("ggml-base.en.bin"),
    },
];

impl ModelInfo {
    /// Find a model by registry name (e.g. "large-v3-turbo", "base.en")
    pub fn find(name: &str) -> Option<&'static ModelInfo> {
        MODEL_REGISTRY.iter().find(|m| m.name == name)
    }

    /// Find a model by its directory name (e.g. "whisper-large-v3-turbo")
    pub fn find_by_dir(dir_name: &str) -> Option<&'static ModelInfo> {
        MODEL_REGISTRY.iter().find(|m| m.dir_name == dir_name)
    }

    /// List all available model names
    pub fn available_models() -> Vec<&'static str> {
        MODEL_REGISTRY.iter().map(|m| m.name).collect()
    }

    /// Files that make up this model, and where to fetch each one
    pub fn files(&self) -> Vec<ModelFile> {
        if self.format == ModelFormat::Ggml {
            // Self-contained: weights, vocabulary and config in one file
            return vec![ModelFile {
                local_name: "model.bin",
                repo_id: self.repo_id,
                remote_name: self.remote_file.unwrap_or("model.bin"),
            }];
        }
        let (weights_name, weights_remote, meta_repo) = match self.format {
            ModelFormat::Safetensors => ("model.safetensors", "model.safetensors", self.repo_id),
            ModelFormat::Gguf | ModelFormat::Ggml => (
                "model.gguf",
                self.remote_file.unwrap_or("model.gguf"),
                self.base_repo_id.unwrap_or(self.repo_id),
            ),
        };
        vec![
            ModelFile {
                local_name: weights_name,
                repo_id: self.repo_id,
                remote_name: weights_remote,
            },
            ModelFile {
                local_name: "config.json",
                repo_id: meta_repo,
                remote_name: "config.json",
            },
            ModelFile {
                local_name: "tokenizer.json",
                repo_id: meta_repo,
                remote_name: "tokenizer.json",
            },
        ]
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashSet;

    #[test]
    fn default_model_exists() {
        assert!(ModelInfo::find(DEFAULT_MODEL).is_some());
    }

    #[test]
    fn names_and_dirs_are_unique() {
        let names: HashSet<_> = MODEL_REGISTRY.iter().map(|m| m.name).collect();
        let dirs: HashSet<_> = MODEL_REGISTRY.iter().map(|m| m.dir_name).collect();
        assert_eq!(names.len(), MODEL_REGISTRY.len());
        assert_eq!(dirs.len(), MODEL_REGISTRY.len());
    }

    #[test]
    fn gguf_models_have_base_repo_and_file() {
        for m in MODEL_REGISTRY
            .iter()
            .filter(|m| m.format == ModelFormat::Gguf)
        {
            assert!(m.base_repo_id.is_some(), "{} missing base_repo_id", m.name);
            assert!(m.remote_file.is_some(), "{} missing remote_file", m.name);
        }
    }

    #[test]
    fn ggml_models_are_a_single_bin_file() {
        let m = ModelInfo::find("ggml-large-v3-turbo").unwrap();
        assert_eq!(
            m.files(),
            vec![ModelFile {
                local_name: "model.bin",
                repo_id: "ggerganov/whisper.cpp",
                remote_name: "ggml-large-v3-turbo.bin",
            }]
        );
        for m in MODEL_REGISTRY
            .iter()
            .filter(|m| m.format == ModelFormat::Ggml)
        {
            assert!(m.remote_file.is_some(), "{} missing remote_file", m.name);
        }
    }

    #[test]
    fn safetensors_files_come_from_one_repo() {
        let files = ModelInfo::find("tiny").unwrap().files();
        assert_eq!(
            files.iter().map(|f| f.local_name).collect::<Vec<_>>(),
            ["model.safetensors", "config.json", "tokenizer.json"]
        );
        assert!(files.iter().all(|f| f.repo_id == "openai/whisper-tiny"));
        assert_eq!(
            files[0].url(),
            "https://huggingface.co/openai/whisper-tiny/resolve/main/model.safetensors"
        );
    }

    #[test]
    fn gguf_metadata_comes_from_base_repo() {
        let m = ModelInfo::find("large-v3-turbo-q4").unwrap();
        let files = m.files();
        assert_eq!(files[0].local_name, "model.gguf");
        assert_eq!(files[0].remote_name, "model_q4_1.gguf");
        assert_eq!(files[0].repo_id, "xkeyC/whisper-large-v3-turbo-gguf");
        assert_eq!(files[1].repo_id, "openai/whisper-large-v3-turbo");
    }

    #[test]
    fn find_by_dir_round_trips() {
        for m in MODEL_REGISTRY {
            assert_eq!(ModelInfo::find_by_dir(m.dir_name).unwrap().name, m.name);
        }
    }
}
