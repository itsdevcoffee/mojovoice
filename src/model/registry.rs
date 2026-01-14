/// Information about a Whisper model
#[derive(Debug, Clone)]
pub struct ModelInfo {
    pub name: &'static str,
    pub filename: &'static str,
    pub url: &'static str,
    pub sha256: &'static str,
    pub size_mb: u32,
}

/// Registry of known Whisper models with their checksums
pub const MODEL_REGISTRY: &[ModelInfo] = &[
    // ===========================================
    // Large V3 Turbo (Recommended for most users)
    // ===========================================
    ModelInfo {
        name: "large-v3-turbo",
        filename: "ggml-large-v3-turbo.bin",
        url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo.bin",
        sha256: "1fc70f774d38eb169993ac391eea357ef47c88757ef72ee5943879b7e8e2bc69",
        size_mb: 1625,
    },
    ModelInfo {
        name: "large-v3-turbo-q5_0",
        filename: "ggml-large-v3-turbo-q5_0.bin",
        url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo-q5_0.bin",
        sha256: "394221709cd5ad1f40c46e6031ca61bce88931e6e088c188294c6d5a55ffa7e2",
        size_mb: 547,
    },
    ModelInfo {
        name: "large-v3-turbo-q8_0",
        filename: "ggml-large-v3-turbo-q8_0.bin",
        url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo-q8_0.bin",
        sha256: "317eb69c11673c9de1e1f0d459b253999804ec71ac4c23c17ecf5fbe24e259a1",
        size_mb: 834,
    },
    // ===========================================
    // Distil-Whisper (Fast, efficient variants)
    // ===========================================
    ModelInfo {
        name: "distil-large-v3.5",
        filename: "ggml-distil-large-v3.5.bin",
        url: "https://huggingface.co/distil-whisper/distil-large-v3.5-ggml/resolve/main/ggml-model.bin",
        sha256: "ec2498919b498c5f6b00041adb45650124b3cd9f26f545fffa8f5d11c28dcf26",
        size_mb: 1449,
    },
    ModelInfo {
        name: "distil-large-v3",
        filename: "ggml-distil-large-v3.bin",
        url: "https://huggingface.co/distil-whisper/distil-large-v3-ggml/resolve/main/ggml-distil-large-v3.bin",
        sha256: "2883a11b90fb10ed592d826edeaee7d2929bf1ab985109fe9e1e7b4d2b69a298",
        size_mb: 1520,
    },
    ModelInfo {
        name: "distil-large-v2",
        filename: "ggml-distil-large-v2.bin",
        url: "https://huggingface.co/distil-whisper/distil-large-v2/resolve/main/ggml-large-32-2.en.bin",
        sha256: "2ed2bbe6c4138b3757f292b0622981bdb3d02bcac57f77095670dac85fab3cd6",
        size_mb: 1449,
    },
    ModelInfo {
        name: "distil-medium.en",
        filename: "ggml-distil-medium.en.bin",
        url: "https://huggingface.co/distil-whisper/distil-medium.en/resolve/main/ggml-medium-32-2.en.bin",
        sha256: "ad53ccb618188b210550e98cc32bf5a13188d86635e395bb11115ed275d6e7aa",
        size_mb: 757,
    },
    ModelInfo {
        name: "distil-small.en",
        filename: "ggml-distil-small.en.bin",
        url: "https://huggingface.co/distil-whisper/distil-small.en/resolve/main/ggml-distil-small.en.bin",
        sha256: "7691eb11167ab7aaf6b3e05d8266f2fd9ad89c550e433f86ac266ebdee6c970a",
        size_mb: 321,
    },
    // ===========================================
    // Large V3 (Full precision and quantized)
    // ===========================================
    ModelInfo {
        name: "large-v3",
        filename: "ggml-large-v3.bin",
        url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3.bin",
        sha256: "64d182b440b98d5203c4f9bd541544d84c605196c4f7b845dfa11fb23594d1e2",
        size_mb: 3100,
    },
    ModelInfo {
        name: "large-v3-q5_0",
        filename: "ggml-large-v3-q5_0.bin",
        url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-q5_0.bin",
        sha256: "d75795ecff3f83b5faa89d1900604ad8c780abd5739fae406de19f23ecd98ad1",
        size_mb: 1031,
    },
    // ===========================================
    // Large V2 (Stable, well-tested)
    // ===========================================
    ModelInfo {
        name: "large-v2",
        filename: "ggml-large-v2.bin",
        url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v2.bin",
        sha256: "9a423fe4d40c82774b6af34115b8b935f34152246eb19e80e376071d3f999487",
        size_mb: 2950,
    },
    ModelInfo {
        name: "large-v2-q5_0",
        filename: "ggml-large-v2-q5_0.bin",
        url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v2-q5_0.bin",
        sha256: "3a214837221e4530dbc1fe8d734f302af393eb30bd0ed046042ebf4baf70f6f2",
        size_mb: 1031,
    },
    // ===========================================
    // Large V1 (Legacy)
    // ===========================================
    ModelInfo {
        name: "large-v1",
        filename: "ggml-large-v1.bin",
        url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v1.bin",
        sha256: "7d99f41a10525d0206bddadd86760181fa920438b6b33237e3118ff6c83bb53d",
        size_mb: 2950,
    },
    // ===========================================
    // Medium (Full precision and quantized)
    // ===========================================
    ModelInfo {
        name: "medium",
        filename: "ggml-medium.bin",
        url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.bin",
        sha256: "6c14d5adee5f86394037b4e4e8b59f1673b6cee10e3cf0b11bbdbee79c156208",
        size_mb: 1463,
    },
    ModelInfo {
        name: "medium.en",
        filename: "ggml-medium.en.bin",
        url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.en.bin",
        sha256: "cc37e93478338ec7700281a7ac30a10128929eb8f427dda2e865faa8f6da4356",
        size_mb: 1530,
    },
    ModelInfo {
        name: "medium-q5_0",
        filename: "ggml-medium-q5_0.bin",
        url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium-q5_0.bin",
        sha256: "19fea4b380c3a618ec4723c3eef2eb785ffba0d0538cf43f8f235e7b3b34220f",
        size_mb: 514,
    },
    ModelInfo {
        name: "medium.en-q5_0",
        filename: "ggml-medium.en-q5_0.bin",
        url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.en-q5_0.bin",
        sha256: "76733e26ad8fe1c7a5bf7531a9d41917b2adc0f20f2e4f5531688a8c6cd88eb0",
        size_mb: 514,
    },
    // ===========================================
    // Small (Full precision and quantized)
    // ===========================================
    ModelInfo {
        name: "small",
        filename: "ggml-small.bin",
        url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin",
        sha256: "1be3a9b2063867b937e64e2ec7483364a79917e157fa98c5d94b5c1571299571",
        size_mb: 488,
    },
    ModelInfo {
        name: "small.en",
        filename: "ggml-small.en.bin",
        url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.en.bin",
        sha256: "c6138d6d58ecc8322097e0f987c32f1be8bb0a18532a3f88f734d1bbf9c41e5d",
        size_mb: 488,
    },
    ModelInfo {
        name: "small-q5_1",
        filename: "ggml-small-q5_1.bin",
        url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small-q5_1.bin",
        sha256: "ae85e4a935d7a567bd102fe55afc16bb595bdb618e11b2fc7591bc08120411bb",
        size_mb: 181,
    },
    ModelInfo {
        name: "small.en-q5_1",
        filename: "ggml-small.en-q5_1.bin",
        url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.en-q5_1.bin",
        sha256: "bfdff4894dcb76bbf647d56263ea2a96645423f1669176f4844a1bf8e478ad30",
        size_mb: 181,
    },
    // ===========================================
    // Base (Full precision and quantized)
    // ===========================================
    ModelInfo {
        name: "base",
        filename: "ggml-base.bin",
        url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin",
        sha256: "60ed5bc3dd14eea856493d334349b405782ddcaf0028d4b5df4088345fba2efe",
        size_mb: 148,
    },
    ModelInfo {
        name: "base.en",
        filename: "ggml-base.en.bin",
        url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin",
        sha256: "a03779c86df3323075f5e796cb2ce5029f00ec8869eee3fdfb897afe36c6d002",
        size_mb: 148,
    },
    ModelInfo {
        name: "base-q5_1",
        filename: "ggml-base-q5_1.bin",
        url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base-q5_1.bin",
        sha256: "422f1ae452ade6f30a004d7e5c6a43195e4433bc370bf23fac9cc591f01a8898",
        size_mb: 57,
    },
    ModelInfo {
        name: "base.en-q5_1",
        filename: "ggml-base.en-q5_1.bin",
        url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en-q5_1.bin",
        sha256: "4baf70dd0d7c4247ba2b81fafd9c01005ac77c2f9ef064e00dcf195d0e2fdd2f",
        size_mb: 57,
    },
    // ===========================================
    // Tiny (Full precision and quantized)
    // ===========================================
    ModelInfo {
        name: "tiny",
        filename: "ggml-tiny.bin",
        url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin",
        sha256: "be07e048e1e599ad46341c8d2a135645097a538221678b7acdd1b1919c6e1b21",
        size_mb: 78,
    },
    ModelInfo {
        name: "tiny.en",
        filename: "ggml-tiny.en.bin",
        url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.en.bin",
        sha256: "921e4cf8686fdd993dcd081a5da5b6c365bfde1162e72b08d75ac75289920b1f",
        size_mb: 78,
    },
    ModelInfo {
        name: "tiny-q5_1",
        filename: "ggml-tiny-q5_1.bin",
        url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny-q5_1.bin",
        sha256: "818710568da3ca15689e31a743197b520007872ff9576237bda97bd1b469c3d7",
        size_mb: 31,
    },
    ModelInfo {
        name: "tiny.en-q5_1",
        filename: "ggml-tiny.en-q5_1.bin",
        url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.en-q5_1.bin",
        sha256: "c77c5766f1cef09b6b7d47f21b546cbddd4157886b3b5d6d4f709e91e66c7c2b",
        size_mb: 31,
    },
];

impl ModelInfo {
    /// Find a model by name (e.g., "base.en", "small")
    pub fn find(name: &str) -> Option<&'static ModelInfo> {
        // Try exact match first
        if let Some(info) = MODEL_REGISTRY.iter().find(|m| m.name == name) {
            return Some(info);
        }

        // Try matching without ggml- prefix
        let normalized = name.trim_start_matches("ggml-").trim_end_matches(".bin");
        MODEL_REGISTRY.iter().find(|m| m.name == normalized)
    }

    /// List all available model names
    pub fn available_models() -> Vec<&'static str> {
        MODEL_REGISTRY.iter().map(|m| m.name).collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_find_model() {
        // Distil variants
        assert!(ModelInfo::find("distil-large-v3.5").is_some());
        assert!(ModelInfo::find("distil-large-v3").is_some());
        assert!(ModelInfo::find("distil-large-v2").is_some());
        assert!(ModelInfo::find("distil-medium.en").is_some());
        assert!(ModelInfo::find("distil-small.en").is_some());

        // Quantized variants
        assert!(ModelInfo::find("large-v3-turbo-q5_0").is_some());
        assert!(ModelInfo::find("large-v3-q5_0").is_some());
        assert!(ModelInfo::find("medium-q5_0").is_some());
        assert!(ModelInfo::find("small-q5_1").is_some());
        assert!(ModelInfo::find("base-q5_1").is_some());
        assert!(ModelInfo::find("tiny-q5_1").is_some());

        // Standard variants
        assert!(ModelInfo::find("base.en").is_some());
        assert!(ModelInfo::find("tiny.en").is_some());
        assert!(ModelInfo::find("large-v2").is_some());
        assert!(ModelInfo::find("large-v1").is_some());

        // Non-existent
        assert!(ModelInfo::find("nonexistent").is_none());
    }

    #[test]
    fn test_find_model_with_prefix() {
        let info = ModelInfo::find("ggml-base.en.bin");
        assert!(info.is_some());
        assert_eq!(info.unwrap().name, "base.en");
    }

    #[test]
    fn test_model_count() {
        // Ensure we have all expected models (31 total)
        let count = MODEL_REGISTRY.len();
        assert!(count >= 25, "Expected at least 25 models, got {}", count);
    }
}
