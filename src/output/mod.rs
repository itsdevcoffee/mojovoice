use anyhow::{Context, Result};
#[cfg(not(target_os = "linux"))]
use arboard::Clipboard;
use enigo::{Enigo, Keyboard, Settings};
#[cfg(test)]
use std::str::FromStr;
use tracing::info;

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub enum OutputMode {
    #[default]
    Type,
    Clipboard,
}

#[cfg(test)]
impl FromStr for OutputMode {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "type" | "inject" => Ok(Self::Type),
            "clipboard" | "copy" => Ok(Self::Clipboard),
            _ => Err(format!("Unknown output mode: {}", s)),
        }
    }
}

pub fn inject_text(text: &str, mode: OutputMode) -> Result<()> {
    if text.is_empty() {
        return Ok(());
    }

    match mode {
        OutputMode::Clipboard => {
            copy_to_clipboard(text)?;
            info!("Copied to clipboard: {} chars", text.len());
        },
        OutputMode::Type => {
            type_text(text)?;
            info!("Typed {} chars at cursor", text.len());
        },
    }
    Ok(())
}

fn copy_to_clipboard(text: &str) -> Result<()> {
    #[cfg(target_os = "linux")]
    {
        // Use wl-copy (Wayland) or xclip (X11) - arboard has Wayland issues
        use std::io::Write;
        use std::process::{Command, Stdio};

        let is_wayland = std::env::var("WAYLAND_DISPLAY").is_ok();
        let (cmd, args, install_hint) = if is_wayland {
            ("wl-copy", vec![], "wl-clipboard")
        } else {
            ("xclip", vec!["-selection", "clipboard"], "xclip")
        };

        let mut child = Command::new(cmd)
            .args(&args)
            .stdin(Stdio::piped())
            .spawn()
            .with_context(|| {
                format!(
                    "Failed to spawn {}. Install with: sudo dnf install {}",
                    cmd, install_hint
                )
            })?;

        if let Some(mut stdin) = child.stdin.take() {
            stdin.write_all(text.as_bytes())?;
        }

        let status = child.wait()?;
        if !status.success() {
            anyhow::bail!("{} exited with status: {}", cmd, status);
        }

        Ok(())
    }

    #[cfg(not(target_os = "linux"))]
    {
        let mut clipboard = Clipboard::new().context("Failed to access clipboard")?;
        clipboard
            .set_text(text)
            .context("Failed to set clipboard text")?;
        Ok(())
    }
}

fn type_text(text: &str) -> Result<()> {
    let mut enigo = Enigo::new(&Settings::default()).context("Failed to initialize enigo")?;
    enigo.text(text).context("Failed to type text")?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_output_mode_parsing() {
        assert_eq!(OutputMode::from_str("type"), Ok(OutputMode::Type));
        assert_eq!(OutputMode::from_str("clipboard"), Ok(OutputMode::Clipboard));
        assert_eq!(OutputMode::from_str("copy"), Ok(OutputMode::Clipboard));
        assert!(OutputMode::from_str("invalid").is_err());
    }

    #[test]
    fn test_empty_text() {
        let result = inject_text("", OutputMode::Type);
        assert!(result.is_ok());
    }
}
