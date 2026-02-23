---
name: maximus-add
description: Use when the user wants to quickly add a single task to the plan without full planning. Triggers on "add a task", "quick add", "append a task", "add this to the plan", or /maximus-add. For backlog items ("queue this for later", "add to the queue"), use the queue skill instead.
---

# Maximus Add — Quick Task Appender

Quickly add a single task to `.maximus/plan.json` without the full planning ceremony. For when you know exactly what you want and just need it queued.

**Announce:** "I'll add that task to the plan."

## Step 1: Read Current Plan State

Read `.maximus/plan.json`.

Three possible states:

**A) File doesn't exist OR tasks array is empty:**
Skip to Step 3. Mode = `create`. New task gets `id: 1`, `phase: 1`.

**B) Plan exists with at least one `passes: false` task:**
Skip to Step 3. Mode = `extend`. Only extending is allowed — there's unfinished work in the plan.

**C) Plan exists and ALL tasks have `passes: true`:**
Use the AskUserQuestion tool with exactly this configuration:

```
question: "All existing tasks are complete. What would you like to do?"
header: "Plan mode"
options:
  - label: "Extend"
    description: "Append the new task after the existing completed tasks"
  - label: "Replace"
    description: "Start fresh — remove completed tasks and begin a new plan with just this task"
```

Set mode based on their answer.

## Step 2: Determine Next ID and Phase

**Extend mode:**
- `id` = max existing task ID + 1
- `phase` = last task's phase number (new task joins the last phase)

**Replace mode:**
- `id` = 1
- `phase` = 1

**Create mode:**
- `id` = 1
- `phase` = 1

## Step 3: Build the Task Object

Use the user's description (from `$ARGUMENTS` or the conversation) to fill in the fields.

**Infer complexity:**
- `simple` — single file, <100 LOC change, clear pattern to follow
- `medium` — 2–5 files, moderate logic (DEFAULT when unsure)
- `complex` — >5 files, architectural changes, external APIs

**Infer category** from the work type:
`feature`, `bugfix`, `refactor`, `ui`, `config`, `api`, `testing`, `documentation`

**Infer skills array:**
Check `.claude/skills/` to see what skills exist in this project. Then apply these heuristics:
- UI / visual / component work → `"frontend-design:frontend-design"`
- New feature needing tests → `"superpowers:tdd"` or `"superpowers:test-driven-development"`
- Debugging or root cause analysis → `"superpowers:systematic-debugging"`
- If the user's description explicitly mentions a skill → add it to `skills` array

**CRITICAL:** If the description says "invoke the X skill" or "use the X skill", you MUST put it in the `skills` array — do NOT just mention it in the description text. The engine only guarantees skill invocation via the `skills` array field, not via description text. Format: `"skill-directory:skill-name"` (e.g. `["frontend-design:frontend-design"]`).

If no skill clearly applies, omit the `skills` field entirely.

**Write description** as 2–3 sentences specific enough for a zero-context agent. Include:
- What file(s) to touch
- What the current state is (if relevant)
- What the expected end state is

**Write acceptance_criteria** — 4 to 7 items, each specific and verifiable. Reference exact file paths and expected outputs. Never use vague language like "works correctly."

**Write testing_steps** — at least 1 runnable shell command. Scope tsc checks to touched files only:
```bash
npx tsc --noEmit 2>&1 | grep -E "FileA|FileB" | grep -v node_modules
```

## Step 4: Validate (Silent)

Run these checks internally. Only surface failures to the user:

- [ ] `id` is a number, unique, sequential (no gaps from existing IDs)
- [ ] `phase` is contiguous with existing phases
- [ ] `acceptance_criteria` has 4–7 items
- [ ] `testing_steps` has at least 1 item
- [ ] Multi-file task is `medium` or `complex` (never `simple`)
- [ ] Task does not target `.maximus/` state files (plan.json, progress.md, run-summary.json)
- [ ] `passes` is set to `false`
- [ ] Description is specific enough for a zero-context agent (no vague scope)

If any check fails, tell the user what's wrong and ask them to clarify before writing.

## Step 5: Show and Confirm

Show the task object as formatted JSON and ask:

> "Does this look right? I'll write it to plan.json."

If the user requests changes, apply them and re-validate before writing.

## Step 6: Write

**Extend / Create mode:** Read the existing plan (or start with `{"version":"1.0.0","tasks":[]}`) and append the new task to the `tasks` array. Write back.

**Replace mode:** Write a fresh plan with only the new task.

Verify by re-reading and confirming the task appears correctly.

Output:
```
✅ Task #N added to .maximus/plan.json

Next steps:
  git add .maximus/plan.json && git commit -m "maximus: add task - <feature name>"
  maximus run
```
