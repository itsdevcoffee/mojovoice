---
name: maximus-validate
description: Use when the user asks to "validate maximus", "check maximus config", "verify maximus setup", "is my maximus config correct", "is my project ready to run", "lint my config", or before running the engine.
---

# Maximus Validate — Configuration Validator

Validate the Maximus Loop project configuration by running deterministic CLI checks and providing project-aware advisories.

**Announce:** "I'll validate your Maximus Loop configuration and check for potential issues."

## Phase 1: Run CLI Validation

1. Run `maximus validate --json`
2. Parse the JSON result with structure: `{ valid: true|false, checks: [{ name, status, message }], config_summary: { ... } | null }`
3. If all checks pass (no failures): proceed to Phase 2 for advisories
4. If any checks fail: present failures clearly:
```
Validation Failures:
  ✗ [check.message for each failed check]
```
5. If user asks to fix issues, apply targeted fixes. Otherwise, report only.

## Phase 2: Project-Aware Advisories

Only run if Phase 1 passes. Check these 6 things, only report mismatches:

### 1. Timeout vs project size

- Count files: `find . -type f -not -path './node_modules/*' -not -path './.git/*' -not -path './dist/*' -not -path './build/*' -not -path './.next/*' -not -path './vendor/*' | wc -l`
- Small (<100 files): 600s is fine, 900+ may be excessive
- Medium (100-500): 900s recommended
- Large (500+): 1200s recommended
- Report if timeout seems mismatched

### 2. Context files

- Check if `context.files` includes `CLAUDE.md` (if one exists in the project)
- Check if referenced context files actually exist

### 3. Escalation status

- If escalation is disabled but plan has tasks with `complexity_level`, note the mismatch

### 4. Commit prefix vs git log

- First check `git rev-parse --is-inside-work-tree` — skip if not a git repo or has no commits
- Run `git log --oneline -5` and compare against `git.commit_prefix`
- If prefix doesn't match recent commit style, note it (informational only)

### 5. Plan health

- If plan has tasks, report completion status (X/Y completed, Z pending)
- If all tasks are complete, suggest: `maximus archive` → `maximus clean` → `/maximus-plan` for next batch

### 6. Provider configuration

- If `agent.provider` is set in config, check it is a recognized value (`claude` or `codex`)
- If `codex` provider is configured, check that any per-task `provider` overrides also include a `model` field
- Note: the preflight check in the engine will catch CLI availability at runtime, but a config advisory here prevents surprises

Output format for advisories:
```
Advisories:
  • [advisory description]
```
If no advisories: skip this section entirely.

## Phase 3: Present Findings

### Valid with no advisories

```
✓ Configuration is valid

Configuration:
  Project:      [name]
  Model:        [model] (escalation: [status])
  Timeout:      [N]s
  Iterations:   [N]
  Auto-commit:  [yes/no] (prefix: "[prefix]")
  Auto-push:    [yes/no]

Ready to run: maximus run
```

### Valid with advisories

```
✓ Configuration is valid (with advisories)

[Config summary as above]

Advisories:
  • [list]
```

### Invalid

```
✗ Configuration has errors

Failures:
  ✗ [list]

[Advisories if any]

Fix the failures above, then re-run /maximus-validate.
```

## Constraints

- Read-only by default. Do NOT write files unless the user explicitly asks to fix something.
- Always distinguish CLI facts (deterministic) from advisories (skill observations). Never mix them.
- Short output when valid. Don't pad.
- Config schema reference: `.claude/references/maximus/config-schema.md`
