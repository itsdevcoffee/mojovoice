# Cost Estimation Reference

Cost data from real Maximus Loop execution across 28 tasks.

## Per-Task Cost by Complexity

| Complexity | Model | Avg Cost | Avg Duration | Avg Turns |
|-----------|-------|----------|-------------|-----------|
| simple | haiku | $0.32 | 110s | 25 |
| medium | sonnet | $2.27 | 310s | 40 |
| complex | opus | $5.00+ | 500s+ | 50+ |

## Cost Multiplier

The jump from simple to medium is **~7x cost**. From simple to complex is **~15x cost**. Getting complexity classification right is the single biggest lever for cost control.

## Estimation Formula

```
estimated_cost = (simple_count * 0.32) + (medium_count * 2.27) + (complex_count * 5.00)
estimated_time_minutes = (simple_count * 2) + (medium_count * 5) + (complex_count * 9)
```

Add 20% buffer for retries and verification overhead.

## Example Estimates

| Plan Size | Mix | Est. Cost | Est. Time |
|-----------|-----|-----------|-----------|
| 5 tasks | 3s + 2m | $5.50 | 16 min |
| 10 tasks | 5s + 4m + 1c | $15.68 | 29 min |
| 15 tasks | 7s + 6m + 2c | $23.86 | 42 min |
| 20 tasks | 10s + 8m + 2c | $31.36 | 56 min |

## Cost Optimization Tips

1. **Maximize simple tasks** — Single-file changes with clear patterns should always be simple
2. **Avoid complex unless necessary** — Most tasks can be split to avoid complex
3. **Haiku can't do multi-file** — But don't over-promote either. If it's truly single-file, keep it simple
4. **Retries cost double** — A failed simple + retry costs more than getting medium right the first time
