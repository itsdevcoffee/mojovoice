# Auto-Annotate Reference

The auto-annotate system labels episode quality for MemRL training using an LLM judge,
with optional human confirmation.

## Source Types

| source | Written by | Confidence |
|--------|-----------|------------|
| `human` | `maximus annotate` (manual interactive flow) | 1.0 |
| `human_confirmed_llm` | `--auto --interactive` (human approved LLM draft) | 0.95 |
| `llm` | `--auto` (fully automatic, no human) | 0.7 |

## Commands

```bash
# Fully automatic — LLM writes corrections directly
maximus annotate --auto --project "My Project"

# Interactive — LLM proposes, human confirms each
maximus annotate --auto --interactive --project "My Project"

# Manual — human classifies from scratch (no LLM)
maximus annotate --project "My Project"
```

## Measuring Judge Accuracy

After 10+ runs, query how often humans agree with the LLM judge:

```sql
SELECT
  source,
  COUNT(*) as count,
  ROUND(AVG(confidence), 2) as avg_confidence
FROM corrections
GROUP BY source;
```

As human agreement rises toward 90%+, consider raising the LLM default confidence from 0.7.

## How Pattern Weighting Works

Corrections feed into `maximus pattern-update`. Each correction's influence on
pattern confidence is weighted by `correction.confidence × SOURCE_WEIGHT[source]`:

- human: 1.0 × 1.0 = **1.00** effective weight
- human_confirmed_llm: 0.95 × 0.95 = **0.90** effective weight
- llm: 0.7 × 0.7 = **0.49** effective weight

LLM-only labels have roughly half the pull of human labels on learned patterns.

## Retroactive Upgrades

After reviewing auto-generated corrections, you can upgrade LLM labels to human-confirmed:

```sql
UPDATE corrections
SET source = 'human_confirmed_llm', confidence = 0.95, updated_at = datetime('now')
WHERE source = 'llm'
  AND episode_uid IN ('project:taskId:timestamp1', 'project:taskId:timestamp2');
```

## Integration with maximus-review

Phase 6 of `/maximus-review` automatically asks:
> "Would you like to give feedback on this run's episode quality?"

- **No** → runs `maximus annotate --auto` automatically
- **Yes** → runs `maximus annotate --auto --interactive` for human confirmation

`maximus pattern-update` always runs after annotation to extract learned patterns.
