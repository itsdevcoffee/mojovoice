---
name: maximus-init
description: Use when the user asks to "set up maximus", "configure maximus", "initialize maximus", "create maximus config", "scaffold maximus", "bootstrap maximus", or "maximus init".
---

# Maximus Init

**Announce:** "I'll validate your current setup, analyze the project, and configure Maximus Loop."

<CRITICAL>
## Task API is MANDATORY — 4 separate tasks

You MUST call TaskCreate to create a NEW, SEPARATE task for EACH phase. This skill produces exactly 4 tasks:

1. TaskCreate → "Detect & validate existing setup"
2. TaskCreate → "Analyze project structure"
3. TaskCreate → "Configure Maximus settings"
4. TaskCreate → "Validate & handoff"

Do NOT reuse a task from a previous phase. Each BEGIN block creates a fresh task. Each END block completes that phase's task. The user sees 4 checkboxes — one per phase.

If you skip Task API calls or reuse tasks across phases, this skill has FAILED.
</CRITICAL>

---

## Phase 1: Detect & Validate

> **BEGIN:** Call TaskCreate (NEW task, do not reuse previous) with subject `"Detect & validate existing setup"`, description `"Run maximus validate --json and determine current state"`, activeForm `"Detecting existing setup"`. Then call TaskUpdate with status `in_progress` for that task.

### Step 1: Run Validation

Run `maximus validate --json`

This is your FIRST action after creating the task. Do NOT read files, explore, or run anything else before this.

### Step 2: Parse Validation Output

Parse the JSON output and check the `directory` check status. This determines which state path to follow.

**State A — No Maximus Setup (directory check has `status: "fail"`)**

No `.maximus/` directory exists.

Announce:
```
No Maximus setup found. I'll analyze the project and create a tailored configuration.
```

Proceed to Phase 2.

**State B — Existing Setup with Errors (directory exists, other checks fail)**

`.maximus/` exists but validation shows failures.

Announce:
```
Existing Maximus setup found with errors:
  [list each check where status is "fail" with its message]
```

Proceed to Phase 2. **CRITICAL:** Do NOT run `maximus init` in Phase 3 — it refuses to re-initialize existing directories. In Phase 3, apply targeted fixes instead.

**State C — Valid Setup (`valid: true`)**

All checks pass. Show the `config_summary` from the JSON:

```
Valid Maximus setup found:
  Project:      [config_summary.project_name]
  Model:        [config_summary.default_model] (escalation: [enabled/disabled])
  Timeout:      [config_summary.timeout]s
  Iterations:   [config_summary.max_iterations]
  Auto-commit:  [yes/no] (prefix: "[config_summary.commit_prefix]")
  Auto-push:    [yes/no]
```

Use AskUserQuestion: "Would you like to change anything?" with options:
- "No, this is good"
- "Yes, I want to change settings"

If user selects "No, this is good":
- Skip to Phase 4 (skip Phases 2 and 3 entirely)

If user selects "Yes, I want to change settings":
- Note what settings to change
- Proceed to Phase 2

> **END:** Call TaskUpdate with status `completed` for the Phase 1 task.

---

## Phase 2: Analyze

> **BEGIN:** Call TaskCreate (NEW task, do not reuse previous) with subject `"Analyze project structure"`, description `"Read package.json, git log, and count files to determine 3 config values"`, activeForm `"Analyzing project structure"`. Then call TaskUpdate with status `in_progress` for that task.

### Step 1: Extract Project Name

Read `package.json` (or `Cargo.toml`, `go.mod`, `pyproject.toml` for other languages).

Extract the `name` field value.

### Step 2: Detect Commit Prefix

Run `git log --oneline -10`

Look for consistent prefixes in commit messages (e.g., "feat:", "fix:", "maximus:").

If a prefix pattern is found, use it. If no consistent pattern exists, default to `"maximus:"`.

### Step 3: Calculate Timeout

Run this exact command in Bash:
```bash
find . -type f -not -path './node_modules/*' -not -path './.git/*' -not -path './dist/*' -not -path './build/*' -not -path './.next/*' -not -path './vendor/*' | wc -l
```

Calculate timeout based on file count:
- Less than 100 files → 600
- 100-500 files → 900
- More than 500 files → 1200

### Step 4: Print Analysis Summary

Print:
```
Project Analysis:
  Name:           [project-name from Step 1]
  Timeout:        [N]s (based on ~[X] files)
  Commit prefix:  "[detected-prefix from Step 2]"
```

<HARD-CONSTRAINT>
Steps 1-3 are the ONLY reads in this phase. Do NOT read, explore, or analyze:
- README, tsconfig, or any config files beyond package.json
- Framework or dependency details
- Project architecture or integrations
- Test configuration or CI setup
- Any file not explicitly listed in Steps 1-3
</HARD-CONSTRAINT>

> **END:** Call TaskUpdate with status `completed` for the Phase 2 task.

---

## Phase 3: Configure

> **BEGIN:** Call TaskCreate (NEW task, do not reuse previous) with subject `"Configure Maximus settings"`, description `"Run maximus init, then edit 3 config values from Phase 2"`, activeForm `"Configuring Maximus settings"`. Then call TaskUpdate with status `in_progress` for that task.

### Step 1: Initialize Directory

**For State A only (no existing setup):**

Run `maximus init` with no flags and no arguments.

Never use `mkdir`. Never add flags — `maximus init --help` will execute init instead of showing help.

**For State B (existing setup with errors):**

Skip this step entirely. The `.maximus/` directory already exists, and `maximus init` refuses to re-initialize existing directories.

### Step 2: Read Default Configuration

Read `.maximus/config.yml` to see the current/default values.

### Step 3: Update Project Name

Use Edit tool to change `project_name` to the value from Phase 2, Step 1.

### Step 4: Update Timeout

Use Edit tool to change the `timeout` value under the `agent:` section to the value from Phase 2, Step 3 (600, 900, or 1200).

### Step 5: Update Commit Prefix

Use Edit tool to change `commit_prefix` under the `git:` section to the value from Phase 2, Step 2.

**CONSTRAINT:** These are the ONLY 3 values you modify. Do NOT change any other fields. Do NOT add fields. Do NOT use Write tool on config.yml — only use Edit.

### Step 6: Initialize Plan File

Write `.maximus/plan.json` with:
```json
{
  "version": "1.0.0",
  "tasks": []
}
```

If the file already exists, read it first then overwrite it.

### Step 7: User Confirmation (BLOCKING)

Present the 3 modified values:
```
Configuration:
  Project name:   [value from Step 3]
  Timeout:        [value from Step 4]s
  Commit prefix:  "[value from Step 5]"
```

Use AskUserQuestion: "Does this configuration look correct?" with options:
- "Yes, looks good"
- "No, I want to change something"

If user selects "No, I want to change something":
- Ask what to change
- Apply changes using Edit tool
- Re-confirm with another AskUserQuestion
- Repeat until user approves

Do NOT proceed past this step until user selects "Yes, looks good".

> **END:** Call TaskUpdate with status `completed` for the Phase 3 task after user confirms.

---

## Phase 4: Validate & Handoff

> **BEGIN:** Call TaskCreate (NEW task, do not reuse previous) with subject `"Validate & handoff"`, description `"Run final validation and present next steps"`, activeForm `"Validating final configuration"`. Then call TaskUpdate with status `in_progress` for that task.

### Step 1: Final Validation

Run `maximus validate --json`

### Step 2: Handle Validation Result

**If `valid: true`:**

Print:
```
Maximus Loop is configured for [project-name]

Configuration saved to:
  .maximus/config.yml — Engine settings
  .maximus/plan.json — Empty task list (ready for planning)
  .maximus/progress.md — Iteration tracker

Next Steps:
  1. Commit setup:
     git add .maximus/ .gitignore
     git commit -m "[prefix] Initialize Maximus Loop"
  2. Create your first task plan:
     Run /maximus-plan to design tasks for your feature
  3. After each run completes:
     maximus archive  — save results to .maximus/archive/
     maximus clean    — reset runtime state for the next batch
```

**If invalid:**

Show failures from the validation output.

Attempt to fix the issues (max 2 retries):
1. Identify the failing check
2. Apply targeted fix using Edit tool
3. Run `maximus validate --json` again
4. If still invalid, repeat once more (max 2 total attempts)

If still invalid after 2 attempts:
- Show the persistent failures
- Ask the user for help: "I've attempted to fix these issues but validation still fails. Could you help me understand what needs to change?"

> **END:** Call TaskUpdate with status `completed` for the Phase 4 task.

---

## Alternate Paths

This skill has three possible execution paths determined in Phase 1, Step 2:

### State A: No Existing Setup
**Trigger:** `directory` check has `status: "fail"` in validation JSON

**Path:** Phase 1 → Phase 2 → Phase 3 (with `maximus init` in Step 1) → Phase 4

**Description:** Fresh initialization. Creates `.maximus/` directory, analyzes project, configures settings, validates.

### State B: Existing Setup with Errors
**Trigger:** `.maximus/` exists but other validation checks fail

**Path:** Phase 1 → Phase 2 → Phase 3 (skip `maximus init` in Step 1) → Phase 4

**Description:** Repair mode. Skips `maximus init` (refuses to re-initialize), analyzes project, applies targeted fixes to existing config, validates.

**Critical difference:** Step 1 is skipped because `maximus init` will fail on existing directories.

### State C: Valid Existing Setup
**Trigger:** `valid: true` in validation JSON and user selects "No, this is good"

**Path:** Phase 1 → Phase 4 (Phases 2 and 3 skipped entirely)

**Description:** Configuration already valid. Skips analysis and configuration, jumps directly to validation and handoff.

**Critical difference:** If user wants changes, treat as State B and proceed through all phases.
