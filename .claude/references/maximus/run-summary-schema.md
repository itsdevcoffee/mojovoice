# Run Summary Schema Reference

Documentation of TaskSummaryEntry fields from `.maximus/run-summary.json` produced by the Maximus Loop engine.

## File Location

```
.maximus/run-summary.json
```

The engine writes this file after each task execution with a complete summary of task outcomes, costs, and performance metrics.

## Schema Structure

The file is a **bare JSON array** of TaskSummaryEntry objects — no wrapper object:

```json
[
  {
    "taskId": 1,
    "phase": 1,
    "feature": "Add Task API reference doc",
    "model": "haiku",
    "costUsd": 0.32,
    "durationMs": 120000,
    "numTurns": 4,
    "outcome": "pass",
    "timestamp": "2026-02-14T03:30:00Z"
  }
]
```

## TaskSummaryEntry Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `taskId` | number | Yes | Task identifier from plan.json (matches `id` field, always a number) |
| `phase` | number | Yes | Phase number from plan.json (1-based integer) |
| `feature` | string | Yes | Feature title from plan.json, 2-8 words |
| `model` | string | Yes | Model used: `haiku`, `sonnet`, or `opus` (or full model ID) |
| `costUsd` | number | Yes | Total API cost in USD |
| `durationMs` | number | Yes | Task execution time in milliseconds |
| `numTurns` | number | Yes | Number of Claude API calls (turns) during execution |
| `outcome` | string | Yes | Result status: `pass`, `fail`, or `blocked` |
| `timestamp` | string | Yes | ISO 8601 UTC timestamp when task finished |
| `errorMessage` | string | No | Error details if outcome is `fail` or `blocked`. Absent on `pass` outcomes. |

## Field Details

### `taskId`

- Matches `id` field in plan.json
- Used to correlate run-summary entries with plan tasks
- Always a **number** (e.g., `1`, not `"1"`)

### `phase`

- Matches `phase` field in plan.json
- Enables grouping by logical milestone
- Example: Group all phase 1 tasks to review first phase costs

### `feature`

- Copied from plan.json `feature` field for reference
- Short title (2-8 words)
- Example: "Add Task API reference doc"

### `model`

Possible values (short names or full model IDs):
- `haiku` - For simple tasks (complexity_level: simple)
- `sonnet` - For medium tasks (complexity_level: medium)
- `opus` - For complex tasks (complexity_level: complex)
- Also accepts full model IDs like `claude-sonnet-4-6` when per-task `model` override is used

### `costUsd`

- Sum of input tokens + output tokens at model pricing rates
- Includes API overhead but not infrastructure costs
- Example: 0.32 = 32 cents

**Pricing (as of 2026-02):**
- Haiku: Input $0.80/M tokens, Output $4.00/M tokens
- Sonnet: Input $3.00/M tokens, Output $15.00/M tokens
- Opus: Input $15.00/M tokens, Output $75.00/M tokens

### `durationMs`

- Elapsed wall-clock time from task start to completion
- Includes all API calls, tool execution, and parsing
- To detect timed-out tasks: check `durationMs >= 900000` (default 900s timeout). Note: timed-out tasks have outcome `fail`, not a separate `timeout` value.

### `numTurns`

- Count of API calls (Claude messages) during task execution
- Higher turns = more complex problem solving
- Example: 4 turns = 4 API calls

### `outcome`

Status values:

| Outcome | Meaning | Next Step |
|---------|---------|-----------|
| `pass` | Task finished successfully and was verified | Task is marked `passes: true` in plan |
| `fail` | Task failed with error (includes timeouts) | Review errorMessage, may need retry |
| `blocked` | Task blocked due to invalid provider, exceeded retries, or unresolvable state | Review and fix the underlying issue |

### `timestamp`

- ISO 8601 format: `2026-02-14T03:30:00Z`
- UTC timezone always
- Enables time-series analysis and performance trends

### `errorMessage`

- **Absent** (field not present) on `pass` outcomes
- String describing error on `fail` or `blocked` outcomes
- Examples:
  - "Agent timed out after 900s"
  - "Agent exited with code 1"
  - "Invalid provider: codex"

## Usage Examples

### Analyzing Cost by Phase

```javascript
const summary = JSON.parse(fs.readFileSync('.maximus/run-summary.json'));

// Group by phase (summary is a bare array)
const costByPhase = {};
summary.forEach(entry => {
  costByPhase[entry.phase] = (costByPhase[entry.phase] || 0) + entry.costUsd;
});

console.log(costByPhase);
// { 1: 5.23, 2: 8.47, 3: 2.15 }
```

### Finding Failed Tasks

```javascript
const summary = JSON.parse(fs.readFileSync('.maximus/run-summary.json'));
const failed = summary.filter(e => e.outcome !== 'pass');

failed.forEach(task => {
  console.log(`Task #${task.taskId}: ${task.feature}`);
  console.log(`  Error: ${task.errorMessage}`);
  console.log(`  Cost: $${task.costUsd}, Duration: ${task.durationMs}ms`);
});
```

### Calculating Performance Metrics

```javascript
const summary = JSON.parse(fs.readFileSync('.maximus/run-summary.json'));

// Average cost per task
const avgCost = summary.reduce((sum, t) => sum + t.costUsd, 0) / summary.length;

// Average duration
const avgDuration = summary.reduce((sum, t) => sum + t.durationMs, 0) / summary.length;

// Success rate
const successRate = summary.filter(t => t.outcome === 'pass').length / summary.length;

console.log(`Avg cost: $${avgCost.toFixed(2)}`);
console.log(`Avg duration: ${(avgDuration / 1000).toFixed(1)}s`);
console.log(`Success rate: ${(successRate * 100).toFixed(1)}%`);
```

### Identifying Expensive Tasks

```javascript
const summary = JSON.parse(fs.readFileSync('.maximus/run-summary.json'));
const expensive = summary
  .sort((a, b) => b.costUsd - a.costUsd)
  .slice(0, 5);

console.log('Top 5 most expensive tasks:');
expensive.forEach((t, i) => {
  console.log(`${i + 1}. Task #${t.taskId} ($${t.costUsd}): ${t.feature}`);
});
```

### Detecting Timed-Out Tasks

```javascript
const summary = JSON.parse(fs.readFileSync('.maximus/run-summary.json'));
// Timed-out tasks have outcome 'fail' and durationMs near 900,000ms
const timedOut = summary.filter(t => t.outcome === 'fail' && t.durationMs >= 900000);
timedOut.forEach(t => console.log(`Task #${t.taskId} timed out after ${t.durationMs / 1000}s`));
```

## Common Queries

### When would outcome be "blocked"?

When a task can't proceed due to:
- Invalid or unavailable agent provider
- Exceeded max retries with persistent failures
- External service unavailable

### Why might a task fail with long duration?

- Task exceeded the 900s timeout limit (check `durationMs >= 900000`)
- Task is too complex, needs splitting
- Recursive problem-solving loops

### How to interpret numTurns?

- 1-3 turns: Simple, straightforward task
- 4-8 turns: Moderate complexity, some problem-solving
- 9+: Complex task, heavy iteration, consider splitting

## Relationship to plan.json

| Field | From plan.json | Used for | In run-summary |
|-------|----------------|----------|---|
| `taskId` | `id` | Cross-reference | Yes, as **number** |
| `phase` | `phase` | Grouping, validation | Yes |
| `feature` | `feature` | Display, reference | Yes |
| Model | `complexity_level` or `model` override | Selection | Yes, as model name |
| Cost | (calculated) | Analysis | Yes, costUsd |
| Duration | (measured) | Performance | Yes, durationMs |
| Outcome | (actual result) | Status | Yes, `pass`/`fail`/`blocked` |

## Schema Evolution

**Version 1.0.0:**
- Initial release with 10 core fields
- Supports all model types (haiku, sonnet, opus) and full model IDs
- Outcome types: `pass`, `fail`, `blocked`
- File is a bare JSON array (no wrapper object)

---

**Version:** 1.1
**Last Updated:** 2026-02-18
