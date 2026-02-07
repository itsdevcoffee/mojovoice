// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod daemon_client;

use tauri::Manager;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            // Ensure config file exists (creates default if not present)
            // This uses the CLI's config module which handles defaults via confy
            if let Err(e) = mojovoice::config::load() {
                eprintln!("Warning: Failed to initialize config: {}", e);
            }

            #[cfg(debug_assertions)]
            {
                let window = app.get_webview_window("main").unwrap();
                window.open_devtools();
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_daemon_status,
            commands::start_recording,
            commands::stop_recording,
            commands::cancel_recording,
            commands::get_transcription_history,
            commands::delete_history_entry,
            commands::clear_history,
            commands::download_model,
            commands::get_system_info,
            commands::get_config,
            commands::save_config,
            commands::start_daemon,
            commands::stop_daemon,
            commands::restart_daemon,
            commands::validate_path,
            // Model management
            commands::list_available_models,
            commands::list_downloaded_models,
            commands::delete_model,
            commands::switch_model,
            commands::cancel_download,
            commands::get_storage_info,
            // Audio devices
            commands::list_audio_devices,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
