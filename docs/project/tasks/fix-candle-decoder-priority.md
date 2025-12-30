# URGENT: Fix Candle Decoder - Apply Agent 1 Findings

**Status:** Blocked - Code not applied
**Priority:** P0 - Blocking all progress
**Created:** 2025-12-27

## Problem

Decoder produces garbage output with token 199 loops:
- Output: "same looking looking same looking"
- Expected: "testing 123 testing 123..."
- Token 199 repeats after 5-6 iterations

## Root Cause (from Agent 1 Research)

Three critical components MISSING from implementation:
1. ❌ Suppress tokens mask
2. ❌ Temperature fallback
3. ❌ Quality metrics

## Required Changes

See complete implementation in the fixing agent's output. Key changes needed in `src/transcribe/candle_engine.rs`:

### 1. Add Constants (line 10)
```rust
const TEMPERATURES: [f64; 6] = [0.0, 0.2, 0.4, 0.6, 0.8, 1.0];
const COMPRESSION_RATIO_THRESHOLD: f64 = 2.4;
const LOGPROB_THRESHOLD: f64 = -1.0;
```

### 2. Add Field to Struct (line 19)
```rust
suppress_tokens: Tensor,
```

### 3. Build Suppress Mask in with_options()

After line 57 (after mel filters), add:
```rust
// Build suppress tokens mask
let vocab_size = tokenizer.get_vocab_size(true);
let mut suppress_list = vec![220u32, eot_token];  // Blank + EOT

// Suppress timestamp tokens
let no_ts_token = tokenizer.token_to_id("<|notimestamps|>").unwrap();
for i in (no_ts_token + 1)..vocab_size as u32 {
    suppress_list.push(i);
}

// Create mask tensor
let mut mask = vec![0f32; vocab_size];
for &token in &suppress_list {
    mask[token as usize] = f32::NEG_INFINITY;
}
let suppress_tokens = Tensor::new(&mask[..], &device)?;
```

And add to return:
```rust
suppress_tokens,
```

### 4. Apply Mask in decode() (CRITICAL - Blocks token 199!)

Find line with `let next_token = last_logit.argmax(0)?.to_scalar::<u32>()?;`

BEFORE that line, add:
```rust
// Apply suppress mask BEFORE argmax
last_logit = last_logit.broadcast_sub(&self.suppress_tokens)?;
```

### 5. Add Temperature Fallback

Rename `decode()` to `decode_at_temperature(temperature: f64)` and return `(String, f64, f64)`.

Add new wrapper:
```rust
fn decode_with_fallback(&mut self, mel: &Tensor) -> Result<String> {
    for (i, &temp) in TEMPERATURES.iter().enumerate() {
        match self.decode_at_temperature(mel, temp) {
            Ok((text, avg_logprob, compression_ratio)) => {
                if i == TEMPERATURES.len() - 1 {
                    return Ok(text);
                }

                let needs_fallback =
                    compression_ratio > COMPRESSION_RATIO_THRESHOLD ||
                    avg_logprob < LOGPROB_THRESHOLD;

                if !needs_fallback {
                    info!("Succeeded at temp {}", temp);
                    return Ok(text);
                }
            }
            Err(e) => continue,
        }
    }
    anyhow::bail!("All temperatures failed")
}
```

## Next Steps

1. Apply these changes to candle_engine.rs
2. Rebuild: `RUSTFLAGS="-L /usr/lib64 -L /usr/local/lib/ollama" cargo build --release --features cuda`
3. Test: Should produce accurate transcription without token 199 loops

## References

- Agent 1 research: `docs/research/candle-whisper-working-examples.md`
- Agent 2 research: `docs/research/whisper-token-debugging.md`
- Official Candle example: https://github.com/huggingface/candle/blob/main/candle-examples/examples/whisper/main.rs
