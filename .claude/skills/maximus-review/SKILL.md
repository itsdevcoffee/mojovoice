---
name: maximus-review
description: Use when the user wants to review Maximus Loop results, analyze run performance, or check execution status. Triggers on "review the run", "analyze maximus results", "check status", "how is the run going", "show me the summary", "what's the progress", or when the user wants post-execution analysis with cost/performance insights.
---

# Maximus Review — Run Analyzer

Post-run analysis and intelligent status checking for Maximus Loop executions. Provides two modes: full review (default) for comprehensive analysis, and quick status (--quick flag) for fast progress checks.

**Announce:** "I'll analyze the Maximus Loop execution for you."

## Supporting Documentation

Load reference files as needed:
- **Run Summary Schema:** `.claude/references/maximus/run-summary-schema.md` — Load during Phase 2
- **Cost Estimation:** `.claude/references/maximus/cost-estimation.md` — Load during Phase 3
- **Auto-Annotate:** `.claude/references/maximus/auto-annotate.md` — **REQUIRED** — Load at the start of Phase 6 before proposing any next steps

## Operating Modes

**Full Review Mode (Default):**
Use when user wants comprehensive analysis. Triggers: "review the run", "analyze results", "/maximus-review"

**Quick Status Mode (--quick):**
Use when user wants fast check. Triggers: "check status", "how is it going", "--quick flag"

## Full Review Mode: 6-Phase Analysis

Create all 6 phase tasks upfront with TaskCreate, then execute sequentially.

### Phase 1: Read Progress

- TaskCreate: "Read progress metadata" / "Reading progress metadata"
- Read `.maximus/progress.md`
- Parse YAML frontmatter: current_iteration, total_tasks, completed_tasks, status
- Extract latest iteration entry
- Note blockers or errors
- Mark completed

### Phase 2: Read Run Summary

- TaskCreate: "Load run summary data" / "Loading run summary data"
- Read `.maximus/run-summary.json`
- Parse TaskSummaryEntry fields (reference: `.claude/references/maximus/run-summary-schema.md`)
- Note: file is a bare JSON array, not a wrapped object. Parse with `JSON.parse(content)` directly.
- Build outcome summary: pass, fail, blocked
- To detect timed-out tasks: filter by `outcome === 'fail' && durationMs >= 900000`
- Mark completed

### Phase 3: Analyze Patterns

- TaskCreate: "Identify failure patterns" / "Analyzing patterns and anomalies"
- Load `.claude/references/maximus/cost-estimation.md` for benchmarks
- Failure analysis: count by outcome, group by error type, detect retry patterns
- Cost analysis: cost per complexity, compare to expected benchmarks:
  - Simple (haiku): Expected ~$0.32, flag if >$0.50
  - Medium (sonnet): Expected ~$2.27, flag if >$3.50
  - Complex (opus): Expected ~$5.00, flag if >$8.00
- Complexity mismatch detection:
  - Haiku tasks with >1 file changed → should be medium (2+ files = medium minimum)
  - Haiku tasks with numTurns >8 → likely too complex for simple
  - Timed-out tasks (outcome === 'fail' && durationMs >= 900000) → task too complex, should be split
- Performance patterns: average duration per complexity, outlier detection
- Mark completed

### Phase 4: Review Code (Optional)

- TaskCreate: "Review code changes" / "Reviewing code changes"
- Ask user: "Would you like me to review the code changes made during this run?"
- If yes: git diff analysis for changed files, check for common issues
- If no: skip
- Mark completed

### Phase 5: Generate Report

- TaskCreate: "Generate findings report" / "Generating findings report"
- Output structured report with sections:
  - Summary (total tasks, completed, failed, cost, duration, success rate)
  - Cost Breakdown table (by complexity)
  - Issues with severity levels:
    - Critical: timeouts, repeated failures >2 attempts, cost >3x expected
    - Warning: cost >1.5x expected, high turn counts, complexity mismatches
    - Info: optimization opportunities
  - Top 5 Most Expensive Tasks
  - Failed Tasks Detail
  - Recommendations
- Mark completed

### Phase 6: Propose Follow-up

- TaskCreate: "Propose follow-up actions" / "Proposing follow-up actions"

**REQUIRED — do this FIRST before any next steps:**
Load `.claude/references/maximus/auto-annotate.md` then ask the user:

> "Would you like to give feedback on this run's episode quality for MemRL training?"

**If NO:** Run via Bash: `maximus annotate --auto --project <project_name>`
Display the output (how many corrections written and their types).
This uses the LLM judge automatically (source: llm, confidence: 0.7).

**If YES:** Run via Bash: `maximus annotate --auto --interactive --project <project_name>`
Walk through the interactive confirmation flow with the user one episode at a time.
Human-confirmed corrections have confidence: 0.95 — higher-quality MemRL training signal.

Then always run: `maximus pattern-update --project <project_name>` and display the pattern summary.

**After annotation, suggest the post-run workflow:**
- Suggest: retry failed tasks with complexity adjustments, split timeouts, extend plan with tests
- Present as actionable next steps:
  1. `maximus archive` — save results to `.maximus/archive/` before cleaning
  2. `maximus clean` — reset runtime state for the next batch
  3. `/maximus-plan` — plan the next batch (will check queue.md automatically)
- **Queue:** For observations that aren't ready for a full task yet (minor bugs noticed, future ideas, things to investigate), suggest adding them to `.maximus/queue.md`:
  ```
  # To capture a quick observation for later:
  Add to .maximus/queue.md:
  - [ ] Your observation here
    - Added: YYYY-MM-DD
    - Priority: normal
  ```
  Items in queue.md are surfaced automatically when you next run `/maximus-plan`.
- Ask: "Would you like me to help implement any of these suggestions?"
- If yes, use `/maximus-plan` to extend
- Mark completed

## Quick Status Mode

When triggered with --quick or status phrases. NO Task API, just read-only:

1. Read progress.md frontmatter
2. Read run-summary.json
3. Calculate: completion %, total cost, average duration, ETA, warnings
4. Output concise summary:

```
Maximus Loop Status

Progress: 7/10 tasks (70%)
Cost: $12.45 (Est. total: ~$17.50)
ETA: ~8 minutes remaining

Status: ✓ Running smoothly

Warnings:
- 1 task timed out (Task #5)

Use '/maximus-review' for full analysis.
```

No follow-up actions. Read-only and concise.

## Error Handling

- Missing progress.md: "No progress file found. Has the engine run yet?" Suggest /maximus-plan
- Missing run-summary.json: "No run summary found." Can still read progress.md
- Active run (.heartbeat <30s old): "Engine is currently running. Status may be incomplete."

## Best Practices

**Do:**
- Create all 6 tasks upfront in Full Review mode
- Mark tasks in_progress immediately before starting
- Mark tasks completed immediately after finishing
- Use Quick Status for fast checks
- Provide actionable recommendations

**Don't:**
- Skip Task API in Full Review mode
- Modify .maximus/plan.json or progress.md (engine-managed)
- Generate reports in Quick Status mode
