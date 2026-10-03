use anyhow::{Context, Result};
use std::fs::{self, File};
use std::io::{BufWriter, Read, Write};
use std::path::{Path, PathBuf};
use tracing::info;

use super::registry::{ModelFile, ModelInfo};

/// Download a model's files from HuggingFace into `models_dir/<dir_name>`.
///
/// Files are fetched into a `.download` directory that is renamed into place only
/// once every file has arrived, so an interrupted download never looks complete.
/// Returns the model directory (skipping the download if it is already complete).
pub fn download_model(model: &ModelInfo, models_dir: &Path) -> Result<PathBuf> {
    let files = model.files();
    let dest_dir = models_dir.join(model.dir_name);

    if files.iter().all(|f| dest_dir.join(f.local_name).exists()) {
        info!("Model already downloaded: {}", dest_dir.display());
        return Ok(dest_dir);
    }

    let temp_dir = models_dir.join(format!("{}.download", model.dir_name));
    if temp_dir.exists() {
        fs::remove_dir_all(&temp_dir).context("Failed to clear previous partial download")?;
    }
    fs::create_dir_all(&temp_dir).context("Failed to create models directory")?;

    info!(
        "Downloading {} [{}] ({} MB) from {}",
        model.name,
        model.format.as_str(),
        model.size_mb,
        model.repo_id
    );

    for file in &files {
        if let Err(e) = download_file(file, &temp_dir.join(file.local_name)) {
            fs::remove_dir_all(&temp_dir).ok();
            return Err(e);
        }
    }

    if dest_dir.exists() {
        fs::remove_dir_all(&dest_dir).context("Failed to replace incomplete model directory")?;
    }
    fs::rename(&temp_dir, &dest_dir).context("Failed to move downloaded model into place")?;

    info!("Model saved to {}", dest_dir.display());
    Ok(dest_dir)
}

fn download_file(file: &ModelFile, dest: &Path) -> Result<()> {
    let url = file.url();
    info!("Fetching {}", url);

    let response = ureq::get(&url)
        .call()
        .with_context(|| format!("Failed to download {}", url))?;
    let content_length = response
        .header("content-length")
        .and_then(|s| s.parse::<u64>().ok());

    let mut reader = response.into_reader();
    let mut writer = BufWriter::new(File::create(dest).context("Failed to create download file")?);

    let mut buffer = [0u8; 65536];
    let mut downloaded: u64 = 0;
    let mut last_progress = 0;

    loop {
        let bytes_read = reader.read(&mut buffer)?;
        if bytes_read == 0 {
            break;
        }
        writer.write_all(&buffer[..bytes_read])?;
        downloaded += bytes_read as u64;

        // Report progress every 5% (only worth it for the weights)
        if let Some(total) = content_length.filter(|&t| t > 10_000_000) {
            let progress = ((downloaded as f64 / total as f64) * 100.0) as u32;
            if progress >= last_progress + 5 {
                info!(
                    "{}: {}% ({:.1} MB / {:.1} MB)",
                    file.local_name,
                    progress,
                    downloaded as f64 / 1_000_000.0,
                    total as f64 / 1_000_000.0
                );
                last_progress = progress;
            }
        }
    }

    writer.flush()?;
    Ok(())
}
