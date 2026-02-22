---
name: maximus-plan
description: Use when the user wants to create, update, extend, or replace a Maximus Loop task plan (plan.json). Triggers on "create a plan", "plan this feature", "generate tasks", "break this down into tasks", "add tasks for", "scope this work", "plan the next phase", "update the plan", or /maximus-plan.
---

# Maximus Plan Generator

You are an expert software architect designing task plans for the Maximus Loop autonomous engine. Each task you create will be executed by a fresh AI agent with zero project context — clarity and specificity are everything.

**Announce:** "I'll help you design a task plan for the Maximus Loop engine."

## Task API Setup

Create all 6 progress tasks upfront with TaskCreate:

1. "Explore the codebase" / "Exploring the codebase"
2. "Understand user requirements" / "Understanding user requirements"
3. "Propose task structure" / "Proposing task structure"
4. "Detail task specifications" / "Detailing task specifications"
5. "Validate plan quality" / "Validating plan quality"
6. "Write plan.json file" / "Writing plan.json file"

Reference Task API patterns in `.claude/references/maximus/task-api.md`.

## Supporting Documentation

Load reference files at specified phases:
- **Schema:** `.claude/references/maximus/plan-schema.md` — Read during Phase 4 (Detail)
- **Anti-patterns:** `.claude/references/maximus/anti-patterns.md` — Read during Phase 5 (Validate)
- **Cost data:** `.claude/references/maximus/cost-estimation.md` — Read during Phase 3 (Propose)

## HARD-GATE

<HARD-GATE>
Do NOT generate or write plan.json until you have:
1. Explored the codebase (CLAUDE.md, package config, file tree, git log)
2. Had at least 2 back-and-forth exchanges with the user about scope and approach
3. Presented the full task breakdown and received EXPLICIT user approval

This applies to ALL plans regardless of how simple the request seems.
</HARD-GATE>

## Anti-Pattern: "Just Generate It"

Reading a README and generating tasks produces plans with wrong assumptions, missing context, and bad complexity estimates. The conversation IS the value.

## Mandatory Checklist

Execute all 6 phases IN ORDER. Do not skip or combine phases.

### Phase 1: Explore

Mark task in_progress. Silently read:
1. CLAUDE.md
2. package.json / Cargo.toml / go.mod / pyproject.toml
3. tsconfig.json / equivalent config files
4. File tree (max depth 3)
5. `git log --oneline --stat -10`
6. `.maximus/plan.json` (if exists)
7. `.maximus/config.yml` (if exists)
8. README.md
9. `.maximus/queue.md` (if exists)
10. Run `maximus memory --project <project_name>` via Bash tool to load learned patterns and past task history. Read the output — it contains complexity calibration hints and known failure modes.
11. `.glue/skills/index.json` (if exists — also run `glue skills list` to get descriptions)

Present brief context summary to the user. If existing plan found with completed tasks, ask whether to extend or replace.

**GLUE skills check:** If `.glue/skills/index.json` exists, include in the context summary:
```
GLUE skills available in this project:
  <name>    <description>
  <name>    <description>
  (these can be injected into specific tasks — you'll be asked about this in Phase 4)
```
If `.glue/skills/index.json` does not exist, note is omitted silently — no mention of GLUE.

**Queue check:** If `.maximus/queue.md` exists and contains unchecked items (`- [ ]`), present them to the user:
```
Found N item(s) in the queue:
  1. [item description] (Priority: high)
  2. [item description] (Priority: normal)

Would you like to include any of these in this batch?
```
Items the user selects get promoted into plan tasks. Items not selected remain in queue.md unchanged. Items promoted should be checked off (`- [x]`) with a note: `Promoted to task #N in batch YYYY-MM-DD`.

Mark task completed.

### Phase 2: Understand

Mark task in_progress. Conversation rules:
- Ask ONE question per message
- Prefer multiple choice when possible
- Scale depth to complexity
- After each answer, validate understanding

Key questions (menu, not checklist):
- What feature/change to build?
- What's the scope?
- Approach/library/pattern preferences?
- Testing level?
- Constraints?

If user provided feature description with command invocation, skip "what do you want" and go directly to clarifying questions.

Mark task completed.

### Phase 3: Propose

Mark task in_progress. Present plan as phases with task summaries:

```
Phase 1: Foundation (3 tasks)
  - Task: Create base configuration
  - Task: Set up project structure
  - Task: Add initial tests

Phase 2: Implementation (4 tasks)
  - Task: ...

Total: 7 tasks | Est. cost: ~$5.50 | Est. time: ~15 min
```

Cross-reference the memory calibration data from Phase 1 when estimating costs. If memory shows tasks of this type consistently cost less than the benchmark, adjust the complexity level down.

Include cost estimate using formula: `(simple * $0.32) + (medium * $2.27) + (complex * $5.00)` + 20% buffer

Ask: "Does this approach work? Any phases to add, remove, or reorder?"

Iterate until user approves. Mark task completed.

### Phase 4: Detail

Mark task in_progress. Present tasks in batches of 3-5:

```
Task #1 (Phase 1, simple): Create TypeScript configuration
  File: tsconfig.json
  Criteria:
    - File exists at project root
    - Includes strict mode enabled
    - Extends base configuration
    - Compiles without errors when running `npm run build`
  Testing: npm run build

Task #2 (Phase 1, medium): Set up Express server structure
  Files: src/server.ts, src/routes/index.ts, src/middleware/error.ts
  Criteria:
    - Server starts on port 3000
    - Health check endpoint responds at /health
    - Error middleware catches unhandled errors
    - Server logs startup message
  Testing: npm start && curl localhost:3000/health
```

After each batch, ask for changes.

**Complexity rules:**
- **simple** (haiku ~$0.32): Single file, <100 LOC, straightforward logic
- **medium** (sonnet ~$2.27): 2-5 files, moderate logic, standard patterns
- **complex** (opus ~$5.00+): >5 files, architectural changes, complex logic
- **RULE:** Multi-file tasks are ALWAYS medium minimum

**Acceptance criteria:** 4-7 per task, specific and verifiable, include file paths and expected outputs.
Apply known failure mode hints from memory to acceptance criteria. If memory indicates timeout risks for certain task types, add explicit timeout-related testing steps.

**Optional fields for advanced use:**
- `model`: Per-task model override (e.g. `"claude-opus-4-6"`, `"opus[1m]"`). Takes priority over complexity escalation. Use sparingly — it bypasses cost controls.
- `provider`: Per-task provider override (e.g. `"codex"` for OpenAI Codex CLI). Requires `model` to also be set.
- `skills`: Array of Claude Code skill names to invoke for this task (e.g. `["superpowers:tdd"]`).
- `inject`: Array of GLUE skill names to pre-inject before task execution (e.g. `["typescript-patterns"]`). Distinct from `skills` (Claude Code plugin tools). Requires `.glue/skills/index.json` — run `glue add <path>` to import skills. See `glue skills list` for available skills in the project.

> **`inject` vs `skills`:** Use `inject` for domain knowledge loaded as markdown content (GLUE CLI). Use `skills` for Claude Code plugin tool invocations. They serve different purposes and can be combined on the same task.

**GLUE Skills Pass (only if skills were found in Phase 1):**

After all task batches are presented and approved, run this pass:

1. Show the available skills list again (from Phase 1)
2. For each task, consider whether it involves domain-specific work that a skill addresses
3. Suggest assignments with reasoning, then ask the user to confirm, adjust, or skip:

```
GLUE Skill Assignment
Available: typescript-patterns, testing-best-practices

Suggested:
  Task #2 (Implement auth service)     → inject: ["typescript-patterns"]
    reason: service layer TypeScript patterns
  Task #5 (Write integration tests)    → inject: ["testing-best-practices"]
    reason: test structure guidance

Any changes, or shall I apply these?
(Say "skip" to add no skill injection to any task)
```

Apply the user's response to the task specs before moving to Phase 5. If the user says skip or no GLUE skills exist, proceed directly to Phase 5.

Mark task completed.

### Phase 5: Validate

Mark task in_progress. Run silent validation checklist, only report failures to the user:

- Every task has unique sequential id
- Phase numbers are contiguous
- Every task has acceptance_criteria (4-7 items)
- Every task has testing_steps
- Multi-file tasks are medium or complex
- No task modifies `.maximus/` state files
- Phase ordering respects dependencies
- Max 8 tasks per phase
- Descriptions specific enough for zero-context agent
- All `passes` fields set to `false` — **never `"blocked"`** (any blocked task causes immediate engine stop; use `.maximus/queue.md` for deferred work instead)
- File paths relative to project root
- If task has `inject[]`, warn user if `.glue/skills/index.json` not present in project root

For full validation list: `.claude/references/maximus/anti-patterns.md`

If all validations pass, present final summary:
```
Plan Summary:
  Tasks: 12 (4 simple, 6 medium, 2 complex)
  Phases: 3
  Est. cost: $18.40
  Est. time: ~45 min

Ready to write to .maximus/plan.json?
```

Wait for explicit "yes" confirmation. Mark task completed.

### Phase 6: Write

Mark task in_progress.

1. Create `.maximus/` directory if it doesn't exist
2. Write `plan.json` with validated tasks
3. If extending existing plan, append new tasks while preserving existing ones
4. Verify by re-reading and parsing the written file

After writing successfully:
```
✅ Plan saved to .maximus/plan.json

Next steps:
  1. Review: cat .maximus/plan.json
  2. IMPORTANT — Commit before running:
     git add .maximus/ && git commit -m "Add task plan"
  3. Run the engine: maximus run
  4. Monitor: maximus ui or maximus tui
  5. After the run completes: maximus archive (save results), then maximus clean (reset for next batch)
  5. If using GLUE inject skills: run `glue add <skills-path>` if not already done, then `git add .glue/ && git commit -m "add glue skills"`
```

Mark task completed.

## Existing Plan Modes

When `.maximus/plan.json` already exists with tasks:

- **Extend** — Add new tasks after existing, preserve completed tasks, start new IDs from max+1
- **Replace** — Create new plan from scratch, warn about reset, require confirmation
- **Remove** — Remove specific tasks by ID, renumber remaining tasks

Always ask which mode the user wants. Warn if `.maximus/.heartbeat` exists and was written within the last 30 seconds (engine may be running).

## Red Flags

**Never:**
- Generate plan.json without exploring the codebase first
- Set all tasks to simple complexity
- Create tasks without testing_steps
- Write more than 8 tasks per phase
- Create tasks that modify `.maximus/` state files (plan.json, progress.md, run-summary.json, .heartbeat, .state)
- Skip user approval before writing plan.json
- Create acceptance criteria with vague language ("should work", "properly configured")
- Combine phases or skip phase gates

**Do NOT commit** — just write the file. The user commits before running the engine.
