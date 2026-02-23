---
name: maximus-queue
description: Use when the user wants to view, add to, promote from, or manage the .maximus/queue.md backlog. Triggers on "show the queue", "add to the queue", "queue this for later", "what's in the queue", "promote from queue", "archive the queue", or /maximus-queue.
---

# Maximus Queue Manager

Manage `.maximus/queue.md` — the shared backlog of ideas, observations, and deferred work.

**Announce:** "I'll manage the queue."

<CRITICAL>
Do NOT launch Explore agents or subagents.
Do NOT delegate to another agent.
Read the files listed explicitly and follow each phase yourself.
</CRITICAL>

---

## Routing

Read `$ARGUMENTS`. Route to the matching operation:

| Arguments | Operation |
|-----------|-----------|
| _(empty)_ or `view` | **View** — show pending items grouped by priority |
| `add` or starts with `add ` | **Add** — append one item to queue.md |
| `promote` | **Promote** — move selected items into plan.json |
| `done` | **Done** — mark one or more items resolved |
| `archive` | **Archive** — move all resolved `[x]` items to archive section |

If the intent is ambiguous, ask with AskUserQuestion before proceeding.

---

## Shared: Read Queue State

Before any operation, read `.maximus/queue.md`.

If the file does not exist:
- For **View**: Output `Queue is empty. Use /maximus-queue add to add your first item.` and stop.
- For **Add**: Proceed — the file will be created.
- For **Promote / Done / Archive**: Output `No queue.md found.` and stop.

Parse items into two lists:
- **pending** — lines matching `^- \[ \]`
- **resolved** — lines matching `^- \[x\]`

Items below a `## Archive` heading are ignored in all operations.

---

## Operation: View

Group pending items by priority. Read each item's `Priority:` field.

Output format:

```
📋 Queue  (N pending)

── HIGH ──────────────────────────────────────────
  1. Title of item
     Category: tui  |  Added: 2026-02-21
     Notes: First line of notes if present.

  2. Another high item
     Category: engine  |  Added: 2026-02-20

── NORMAL ────────────────────────────────────────
  3. Normal priority item
     ...

── LOW ───────────────────────────────────────────
  4. Low priority item
     ...

Run /maximus-queue add to add an item.
Run /maximus-queue promote to move items into plan.json.
```

- Show at most the first line of `Notes:` (truncate after 80 chars with `…`)
- If a section has no items, omit that section header entirely
- Resolved items are NOT shown in view — they belong in the archive

---

## Operation: Add

Collect required fields. Use AskUserQuestion for anything not provided in `$ARGUMENTS`.

**Required:**
1. `title` — imperative, ≤10 words
2. `priority` — `high`, `normal`, or `low`

**Optional (ask only if user seems to have more context):**
- `category` — `ui | engine | cli | tui | episodes | docs | testing | infra`
- `notes` — freeform

### Worktree Check

Before writing, check if the current working directory is inside a Maximus worktree:

```bash
pwd
```

If the path contains `.maximus/worktrees/`, warn the user:

```
⚠️  You're in a worktree. Editing queue.md here will create a merge conflict
    when this branch merges back to main.

    Options:
      (a) Add here anyway (you'll resolve the merge conflict later)
      (b) Open queue.md in the PARENT repo instead
      (c) Cancel
```

Use AskUserQuestion with these three options. If they choose (b), resolve the parent repo
path by walking up from the worktree path and write there instead.

### Write

Append the new item to the `## Items` section (or after the last `- [ ]` / `- [x]` item
before any `## Archive` heading, or at the end if no archive section exists).

Format:

```markdown
- [ ] <title>
  - Added: YYYY-MM-DD
  - Priority: <priority>
  - Category: <category>     ← omit if not provided
  - Notes: <notes>           ← omit if not provided
```

Use today's date for `Added:`.

Confirm: `✅ Added to queue: "<title>"`

---

## Operation: Promote

Promotes selected queue items to `.maximus/plan.json` tasks.

This is a **lightweight** promotion path — it does NOT run the full `/maximus-plan` ceremony.
Use it when the task is already well-understood and you just need it in the plan.

### Step 1: Show pending items (numbered)

Display all pending items with numbers.

### Step 2: Ask which to promote

Use AskUserQuestion:
```
question: "Which items would you like to promote to plan.json?"
header: "Promote items"
multiSelect: true
options: one per pending item (label = title, description = priority + category)
```

### Step 3: Build task objects

For each selected item, construct a minimal task object. Read `.maximus/plan.json` to
determine next `id` and `phase` (extend from last task).

Apply the same complexity rules as `/maximus-add`:
- Single file, clear pattern → `simple`
- 2-5 files or moderate logic → `medium` (DEFAULT)
- >5 files or architectural → `complex`

Show each task in JSON and ask for confirmation before writing.

### Step 4: Write

Append tasks to plan.json. Mark promoted queue items as resolved:

```markdown
- [x] <title>
  - Added: <original date>
  - Priority: <priority>
  - Resolved: YYYY-MM-DD — Promoted to task #N in plan.json
```

Confirm:
```
✅ Promoted N item(s) to plan.json

  Task #N — <title>
  Task #N — <title>

Next: maximus run   (or /maximus-plan to refine further)
```

---

## Operation: Done

Mark one or more items resolved without promoting them to plan.json.
Use when an item was resolved outside the engine (manually fixed, no longer needed, etc.).

### Step 1: Show pending items (numbered)

### Step 2: Ask which to mark done

Use AskUserQuestion. Ask for a brief resolution note (optional).

### Step 3: Write

Replace `- [ ]` with `- [x]` and append:

```markdown
  - Resolved: YYYY-MM-DD — <resolution note or "Resolved manually">
```

Confirm: `✅ Marked N item(s) as done.`

---

## Operation: Archive

Moves all `[x]` resolved items (outside existing `## Archive` section) to an archive
section at the bottom of queue.md. Keeps the active list clean.

Count how many items will be moved, then confirm:

```
Move N resolved item(s) to ## Archive?
This keeps the active list clean. Archived items are never shown by /maximus-queue view.
```

Use AskUserQuestion with Yes / No.

If Yes:
1. Extract all `[x]` items (and their sub-lines) from the active section
2. Append `## Archive` section at end of file (if not already present)
3. Move extracted items under `## Archive`
4. Re-write file

Confirm: `✅ Archived N item(s). Active queue: M pending.`

---

## Schema Reference

For full schema rules, load: `.claude/references/maximus/queue-schema.md`
