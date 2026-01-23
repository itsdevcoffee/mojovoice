/// Simple example to list all available audio input devices
/// Usage: cargo run --example list_audio_devices

fn main() {
    // Initialize logging
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info")),
        )
        .init();

    println!("Listing audio input devices...\n");

    match mojovoice::audio::list_input_devices() {
        Ok(devices) => {
            println!("Found {} device(s):\n", devices.len());
            for (idx, device) in devices.iter().enumerate() {
                println!(
                    "  [{}] {} {}",
                    idx + 1,
                    device.name,
                    if device.is_default {
                        "(default)"
                    } else {
                        ""
                    }
                );
            }

            if devices.is_empty() {
                println!("⚠ No devices found! This might indicate:");
                println!("  - No microphone connected");
                println!("  - Missing audio permissions");
                println!("  - CPAL backend issues");
            }
        }
        Err(e) => {
            eprintln!("Error listing devices: {}", e);
            std::process::exit(1);
        }
    }
}
