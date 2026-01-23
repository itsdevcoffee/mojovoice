/// Debug CPAL device enumeration - shows what CPAL can actually see
/// Usage: cargo run --example debug_cpal_devices

use cpal::traits::{DeviceTrait, HostTrait};

fn main() {
    println!("=== CPAL Device Debug ===\n");

    let host = cpal::default_host();
    println!("Using CPAL host: {:?}\n", host.id());

    // Try to get default input device
    match host.default_input_device() {
        Some(device) => {
            println!("✓ Default input device:");
            print_device_info(&device, true);
        }
        None => {
            println!("✗ No default input device found!");
        }
    }

    println!("\n--- All Input Devices ---\n");

    match host.input_devices() {
        Ok(devices) => {
            let mut count = 0;
            for (idx, device) in devices.enumerate() {
                count += 1;
                println!("Device #{}:", idx + 1);
                print_device_info(&device, false);
                println!();
            }

            if count == 0 {
                println!("⚠ No input devices found!");
            } else {
                println!("Total: {} device(s) found", count);
            }
        }
        Err(e) => {
            eprintln!("Error enumerating devices: {:?}", e);
        }
    }
}

fn print_device_info(device: &cpal::Device, indent: bool) {
    let prefix = if indent { "  " } else { "" };

    match device.name() {
        Ok(name) => println!("{}Name: {}", prefix, name),
        Err(e) => println!("{}Name: <error: {:?}>", prefix, e),
    }

    // Try to get supported configurations
    match device.supported_input_configs() {
        Ok(configs) => {
            let configs: Vec<_> = configs.collect();
            println!("{}Configs: {} available", prefix, configs.len());
            if !configs.is_empty() {
                let first = &configs[0];
                println!(
                    "{}  Sample rates: {:?} - {:?}",
                    prefix,
                    first.min_sample_rate(),
                    first.max_sample_rate()
                );
                println!("{}  Channels: {}", prefix, first.channels());
            }
        }
        Err(e) => println!("{}Configs: <error: {:?}>", prefix, e),
    }

    // Try to get default config
    match device.default_input_config() {
        Ok(config) => {
            println!(
                "{}Default: {}Hz, {} ch",
                prefix,
                config.sample_rate().0,
                config.channels()
            );
        }
        Err(e) => println!("{}Default config: <error: {:?}>", prefix, e),
    }
}
