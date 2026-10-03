# Windows 11 Port — Scoping

**Date:** 2026-10-03
**Target:** Windows 11 x64, NVIDIA GPU (CUDA)
**Estimate:** ~5–8 working days to a usable build (mel rewrite done in v0.5.8)
**Status:** In progress on branch `feat/windows-port`

## Status of blockers

| Blocker | Status |
|---|---|
| mojo-audio FFI (`libmojo_audio.so`, no Windows build of Mojo) | **Done (v0.5.8)** — replaced by pure-Rust `src/transcribe/mel.rs` |
| Unix sockets for daemon IPC | Open |
| `nix` signals in `src/state/toggle.rs` | Open |
| No `icons/icon.ico` (tauri-build fails on Windows) | Open |

## 1. Incompatibility inventory

### Won't compile on Windows

| Location | Issue |
|---|---|
| `src/daemon/server.rs:4,77,235,567` | `std::os::unix::net::{UnixListener, UnixStream}` |
| `src/daemon/client.rs:3,16` | `UnixStream` |
| `ui/src-tauri/src/daemon_client.rs:4,65` | `UnixStream`; lines 7–46 also duplicate (partially) the protocol types |
| `src/state/toggle.rs:2-3,47,139,176,215,221-236` | `nix` kill/SIGUSR1/`signal()`; `nix` is a `cfg(unix)` dependency but called unconditionally from `server.rs:314`, `main.rs:1066,1119,1145` |
| `ui/src-tauri/tauri.conf.json` `bundle.icon` | No `icons/icon.ico` |

Other `cfg(target_os)` blocks have matching fallbacks (`audio/mod.rs:207`, `output/mod.rs:84`, `commands.rs:925`).

### Compiles but broken or wrong at runtime

- **Socket path checks:** `server.rs:57-60,72,549`, `daemon_client.rs:61` use `socket_path.exists()`; named pipes aren't on the filesystem.
- **Listen stop/cancel:** `toggle.rs:47,176` use `kill(pid, 0)` for liveness and SIGUSR1 to stop a separate process.
- **Shell-outs to Linux tools:** `main.rs:730` `notify-send`; `main.rs:887,897` `tail -f` (`daemon logs`); `main.rs:944` `pw-cli` (`doctor`); `commands.rs:1199` `which`, `commands.rs:1217` `ps aux`; `commands.rs:91` `nvidia-smi` gated to Linux (`commands.rs:58`) though it exists on Windows.
- **Default `refresh_command`:** `settings.rs:189` defaults to `pkill -RTMIN+8 waybar`, spawned on every state change (`toggle.rs:100`, `commands.rs:356`); UI placeholder at `ui/src/components/settings/AdvancedPanel.tsx:108`.
- **HOME / `~/.local/bin`:** `commands.rs:1138,1191-1192`; `justfile` uses `HOME` and `cp`.
- **Console window flashes:** `commands.rs:1038,1113` spawn `mojovoice daemon up` without `CREATE_NO_WINDOW` / `DETACHED_PROCESS`.
- **Split data dirs:** `ProjectDirs` (`paths.rs:7,49`) → `%LOCALAPPDATA%\mojovoice\data`; `BaseDirs`/`dirs` (`settings.rs:56,167`, `commands.rs:1360`) → `%LOCALAPPDATA%\mojovoice\models`.
- **Windows file locks:** model delete/switch (`commands.rs:797-802`) fails while the daemon has safetensors memory-mapped; history rename (`storage.rs:122`) can fail with an open reader.
- **No global hotkey/tray/autostart:** Linux relies on compositor keybinds calling the CLI; Windows effectively needs a built-in global hotkey.
- **Text typing:** enigo/SendInput can't type into elevated (admin) windows — document.
- **`listen` sink monitor** (`main.rs:1062`) has no Windows equivalent; WASAPI loopback via cpal would provide one.

## 2. IPC replacement

| Option | Pros | Cons |
|---|---|---|
| **`interprocess` local sockets (v2)** | One API: named pipes on Windows, Unix sockets elsewhere; non-blocking accept fits `server.rs:572` | Verify read/write timeout support (`client.rs:18-23`) |
| localhost TCP | Trivial | Any local user can connect (needs token); firewall prompts |
| Raw `windows-sys` named pipes | No dependency | Two code paths |

**Recommendation:** `interprocess`. Add `daemon::transport` (`bind()`/`connect()`); Unix keeps the filesystem path, Windows uses a namespaced pipe. Delete the duplicate protocol in `ui/src-tauri/src/daemon_client.rs` and use `mojovoice::daemon::{protocol, client}`. `is_daemon_running` → ping only. Listen stop: poll a `listen.stop` file in the capture loop (like the existing `listen.cancel`); PID liveness via `sysinfo` (already a UI dependency). Keep SIGUSR1 behind `cfg(unix)`.

## 3. CUDA on Windows

- Toolchain: VS 2022 Build Tools (MSVC), CUDA Toolkit 12.x, `CUDA_PATH`, `nvcc` + `cl.exe` on PATH.
- Set `CUDA_COMPUTE_CAP` (bindgen_cuda otherwise calls `nvidia-smi`); use 80 to match the Linux release (covers RTX 30-series+).
- `NVCC_CCBIN` / `-allow-unsupported-compiler` if VS is newer than CUDA supports.
- cudarc `dynamic-linking`: runtime needs `cublas64_12`, `cublasLt64_12` (~500 MB), `curand64_10`, `nvrtc64_*` DLLs — bundle (redistributable, heavy) or require a CUDA runtime install.
- Unverified risk: `tokenizers` default `esaxx_fast` may cause MSVC CRT mismatch (`LNK2038`); disable default features if so.

## 4. CI / release

- `ci.yml`: add `windows-latest` to check/test matrix.
- `release.yml`: `build-windows-cpu` (zip `mojovoice.exe` + README/LICENSE); CUDA job via `Jimver/cuda-toolkit` on `windows-latest` with `CUDA_COMPUTE_CAP=80` (no GPU needed, unlike Linux where we build in a container).
- Tauri: NSIS `.exe` + MSI via `tauri-action`; add `icon.ico` (`npm run tauri icon`); bundle the CLI via `bundle.externalBin` and resolve it next to `current_exe`.
- Signing: unsigned builds hit SmartScreen; cheapest is Azure Trusted Signing (~$10/mo) via `bundle.windows.signCommand`. Sign `mojovoice.exe` too.
- Run `scripts/smoke-transcribe.sh` equivalent on Windows (PowerShell) in CI.

## 5. Phased plan

| # | Task | Size | Depends on |
|---|---|---|---|
| **P0 – Builds** | | | |
| ~~0.1~~ | ~~Rust mel, validated against OpenAI~~ | Done (v0.5.8) | – |
| 0.2 | `transport` module (interprocess); server, client, Tauri client switched; duplicate protocol removed | M (1 d) | – |
| 0.3 | `cfg`-split `toggle.rs` (PID liveness, stop-file) | S (3 h) | 0.2 |
| 0.4 | `icon.ico`; CI `windows-latest` check + test | S (2 h) | 0.2, 0.3 |
| **P1 – Runs** | | | |
| 1.1 | Shell-outs: Rust log tail, `notify-rust`, doctor, `nvidia-smi` on Windows, `refresh_command` default `None` off Linux | S–M (4–6 h) | P0 |
| 1.2 | Tauri: externalBin sidecar, `CREATE_NO_WINDOW`, remove HOME/`which`/`ps`, single data-dir root, unload model before delete/switch | M (1 d) | P0 |
| 1.3 | CUDA on a real Windows box; DLL plan | M (0.5–1 d) | P0 |
| **P2 – Usable** | | | |
| 2.1 | Global hotkey (`global-hotkey` in daemon or `tauri-plugin-global-shortcut`) | M (1 d) | P1 |
| 2.2 | Optional: tray, autostart, WASAPI loopback for `listen` | M | P1 |
| **P3 – Ships** | | | |
| 3.1 | `release.yml` Windows CLI (CPU + CUDA) zip and NSIS/MSI | S–M (0.5 d) | P1 |
| 3.2 | Code signing | S (+ account wait) | 3.1 |

## Decisions (2026-10-03)

1. **CUDA runtime:** Require users to install the CUDA 12 runtime (no bundled DLLs); detect it and fall back to CPU when missing — same as the Linux CUDA build.
2. **Global hotkey:** In the daemon (`global-hotkey` crate), so it works for CLI-only users and without the desktop window.
3. **Code signing:** Ship unsigned for now (SmartScreen "Run anyway"); revisit once the port is stable.
4. **Installer:** NSIS `.exe` only.
