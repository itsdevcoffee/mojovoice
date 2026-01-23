/// Test device name resolution (display name -> internal name)
/// Usage: cargo run --example test_device_resolution

use mojovoice::audio;

fn main() {
    println!("=== Device Name Resolution Test ===\n");

    // Get all devices first
    match audio::list_input_devices() {
        Ok(devices) => {
            println!("Available devices:");
            for device in &devices {
                println!(
                    "  Display: '{}'\n  Internal: {}\n  Default: {}\n",
                    device.name,
                    device.internal_name.as_deref().unwrap_or("(none)"),
                    device.is_default
                );
            }

            println!("\n=== Testing Resolution ===\n");

            // Test cases: display names that should resolve
            let test_names = vec![
                "Easy Effects Source",
                "easyeffects_source",  // Already internal name
                "fifine SC3 Analog Stereo",
                "alsa_input.usb-MV-SILICON_fifine_SC3_20190808-00.analog-stereo",
            ];

            for name in test_names {
                println!("Testing: '{}'", name);
                // We can't call resolve_device_name directly (it's private),
                // but we can verify by checking if it's in our device list
                let found = devices.iter().any(|d| {
                    d.name == name || d.internal_name.as_deref() == Some(name)
                });
                println!("  Found in list: {}\n", if found { "✓" } else { "✗" });
            }
        }
        Err(e) => {
            eprintln!("Error listing devices: {}", e);
            std::process::exit(1);
        }
    }
}
