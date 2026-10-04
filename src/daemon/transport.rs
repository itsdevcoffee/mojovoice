//! Local IPC transport between clients and the daemon.
//!
//! Unix uses a socket file in the state directory. Windows has no socket files, so it
//! uses a per-user named pipe (`\\.\pipe\mojovoice-<user>`) instead.

use anyhow::{Context, Result};
use interprocess::local_socket::{ListenerNonblockingMode, ListenerOptions, Name, prelude::*};
use std::time::Duration;

pub use interprocess::local_socket::{Listener, Stream};

#[cfg(unix)]
fn socket_path() -> Result<std::path::PathBuf> {
    Ok(crate::state::paths::get_state_dir()?.join("daemon.sock"))
}

#[cfg(unix)]
fn name() -> Result<Name<'static>> {
    use interprocess::local_socket::GenericFilePath;
    socket_path()?
        .to_fs_name::<GenericFilePath>()
        .context("Invalid daemon socket path")
}

#[cfg(windows)]
fn pipe_name() -> String {
    // Pipe names are machine-wide, so include the user to keep sessions apart
    let user: String = std::env::var("USERNAME")
        .unwrap_or_default()
        .chars()
        .filter(|c| c.is_ascii_alphanumeric() || *c == '-' || *c == '_')
        .collect();
    if user.is_empty() {
        "mojovoice".to_string()
    } else {
        format!("mojovoice-{}", user)
    }
}

#[cfg(windows)]
fn name() -> Result<Name<'static>> {
    use interprocess::local_socket::GenericNamespaced;
    pipe_name()
        .to_ns_name::<GenericNamespaced>()
        .context("Invalid daemon pipe name")
}

/// Human-readable daemon endpoint, for logs
pub fn endpoint() -> String {
    #[cfg(unix)]
    return socket_path().map_or_else(|_| "daemon.sock".into(), |p| p.display().to_string());
    #[cfg(windows)]
    return format!(r"\\.\pipe\{}", pipe_name());
}

/// Bind the daemon listener. `accept()` is nonblocking so the server can poll its
/// shutdown flag; accepted streams are blocking.
pub fn bind() -> Result<Listener> {
    let listener = ListenerOptions::new()
        .name(name()?)
        .create_sync()
        .with_context(|| format!("Failed to bind daemon endpoint {}", endpoint()))?;
    listener
        .set_nonblocking(ListenerNonblockingMode::Accept)
        .context("Failed to set listener non-blocking")?;
    Ok(listener)
}

/// Connect to the daemon. `timeout` bounds each read and write on Unix; Windows named
/// pipes don't support timeouts, so Windows clients wait for the daemon's reply.
pub fn connect(timeout: Duration) -> Result<Stream> {
    let stream = Stream::connect(name()?).context("Failed to connect to daemon. Is it running?")?;
    #[cfg(unix)]
    {
        stream
            .set_recv_timeout(Some(timeout))
            .context("Failed to set read timeout")?;
        stream
            .set_send_timeout(Some(timeout))
            .context("Failed to set write timeout")?;
    }
    #[cfg(windows)]
    let _ = timeout;
    Ok(stream)
}

/// Remove a socket file left behind by a daemon that didn't shut down cleanly.
/// Only call this after confirming no daemon answers. No-op on Windows, where a
/// named pipe disappears with its process.
pub fn remove_stale() -> Result<()> {
    #[cfg(unix)]
    {
        let path = socket_path()?;
        if path.exists() {
            std::fs::remove_file(&path).context("Failed to remove stale daemon socket")?;
        }
    }
    Ok(())
}
