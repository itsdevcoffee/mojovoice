//! Enigo keyboard/clipboard testing command

use anyhow::Result;

use crate::output::{self, OutputMode};

/// Tests clipboard operations and text injection with a countdown for window focus.
pub fn run(text: &str, clipboard: bool) -> Result<()> {
    println!("\n=== Enigo Test Suite ===\n");

    let mode = if clipboard { OutputMode::Clipboard } else { OutputMode::Type };
    println!("Mode: {:?}", mode);
    println!("Test text: {:?}\n", text);

    test_clipboard_operations();
    countdown_to_paste();
    execute_injection(text, mode)?;

    println!("\n=== Test Complete ===\n");
    Ok(())
}

fn test_clipboard_operations() {
    println!("Testing clipboard operations...");

    match arboard::Clipboard::new().and_then(|mut cb| cb.get_text()) {
        Ok(content) => println!("✓ Clipboard read successful ({} chars)", content.len()),
        Err(e) => println!("✗ Clipboard read failed: {}", e),
    }

    match arboard::Clipboard::new().and_then(|mut cb| cb.set_text("enigo-test")) {
        Ok(()) => println!("✓ Clipboard write successful"),
        Err(e) => println!("✗ Clipboard write failed: {}", e),
    }
}

fn countdown_to_paste() {
    use std::{thread::sleep, time::Duration};
    println!("\n>>> Focus your target window now! Typing in 3 seconds...");
    sleep(Duration::from_secs(1));
    println!(">>> 2...");
    sleep(Duration::from_secs(1));
    println!(">>> 1...");
    sleep(Duration::from_secs(1));
}

fn execute_injection(text: &str, mode: OutputMode) -> Result<()> {
    println!("\nExecuting text injection...");

    output::inject_text(text, mode)?;

    println!("✓ inject_text completed successfully");
    let msg = if mode == OutputMode::Clipboard {
        "Text copied to clipboard!"
    } else {
        "Text typed at cursor!"
    };
    println!("\n✓ {msg}");
    Ok(())
}
