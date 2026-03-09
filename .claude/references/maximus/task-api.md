# Task API Reference Card

Quick reference for TaskCreate, TaskUpdate, and TaskList for use in skills and agents.

## TaskCreate

Creates a new task with pending status.

```
TaskCreate:
  subject: "Action title in imperative form"
  description: "What needs to be done"
  activeForm: "Action title in present continuous form"
  metadata:
    key: "optional metadata"
```

| Field | Required | Format | Example |
|-------|----------|--------|---------|
| `subject` | Yes | Imperative (verb-first) | "Write documentation", "Fix bug" |
| `description` | Yes | 1-2 sentences explaining the work | "Create reference card for Task API" |
| `activeForm` | Recommended | Present continuous (verb + -ing) | "Writing documentation", "Fixing bug" |
| `metadata` | No | Key-value object | `{phase: 1, priority: "high"}` |

**Returns:** Task object with auto-generated `taskId`

## TaskUpdate

Updates an existing task's status or properties.

```
TaskUpdate:
  taskId: "task-1"
  status: "in_progress"        # Or: pending, completed, deleted
  subject: "new subject"       # Optional
  activeForm: "new form"       # Optional
  metadata:                    # Optional - merged with existing
    key: "value"
```

| Field | Type | Purpose |
|-------|------|---------|
| `taskId` | string | Required - which task to update |
| `status` | string | `pending` → `in_progress` → `completed` |
| `subject` | string | Update task title (keep imperative form) |
| `activeForm` | string | Update spinner text (keep present continuous) |
| `metadata` | object | Merge additional metadata (set values to null to delete) |

## TaskList

Lists all tasks with summary information.

```
TaskList
```

**Returns:**
- `id` - Task identifier
- `subject` - Task title
- `status` - Current status (pending, in_progress, completed)
- `owner` - Assigned agent/session (empty if available)
- `blockedBy` - List of blocking task IDs

## Status Lifecycle

```
pending → in_progress → completed
  ◻         ◼            ✔
```

**Progression rules:**
- Tasks start as `pending`
- Mark `in_progress` immediately before starting work
- Mark `completed` only when work is fully done
- Cannot move backward (no `completed` → `pending`)

## Naming Conventions

### Subject (Imperative Form)

Use verb-first commands:
- ✓ "Write documentation"
- ✓ "Build authentication"
- ✓ "Fix memory leak"
- ✗ "Writing docs"
- ✗ "Authentication"
- ✗ "Fixing"

### ActiveForm (Present Continuous)

Describe ongoing action:
- ✓ "Writing documentation"
- ✓ "Building authentication"
- ✓ "Fixing memory leak"
- ✗ "Write docs"
- ✗ "Authentication"
- ✗ "Fix"

## Skill Integration Pattern

Create all phase tasks upfront, then work through them sequentially.

**Setup Phase:**
1. Announce the task and phases
2. Use TaskCreate to create all tasks for the phase
3. Each task gets subject (imperative) and activeForm (present continuous)

**Execution Phase:**
1. Mark first task as `in_progress` with TaskUpdate
2. Do the work for that task
3. Mark task as `completed` with TaskUpdate
4. Move to next task - repeat

**Example workflow:**

```markdown
# Phase 1: Planning

Create tasks:
TaskCreate:
  subject: "Analyze requirements"
  description: "Review user needs and constraints"
  activeForm: "Analyzing requirements"

TaskCreate:
  subject: "Document approach"
  description: "Write specification for the work"
  activeForm: "Documenting approach"

Work through tasks:
TaskUpdate: taskId "task-1", status "in_progress"
[do analysis work...]
TaskUpdate: taskId "task-1", status "completed"

TaskUpdate: taskId "task-2", status "in_progress"
[do documentation work...]
TaskUpdate: taskId "task-2", status "completed"
```

## Best Practices

**Task Granularity:**
- Tasks should be completable in 5-30 minutes
- One clear deliverable per task
- Too small: "Add import", "Fix typo"
- Too large: "Build entire feature"

**Descriptions:**
- Be specific: "Create design doc with JWT strategy..."
- Not vague: "Build auth stuff"
- Include acceptance criteria if complex

**Metadata:**
- Store phase numbers: `{phase: 1}`
- Track complexity: `{complexity: "medium"}`
- Document checkpoints: `{checkpoint: "step-3-of-5"}`

**Multi-agent Coordination:**
- Set `owner` field to claim tasks
- Use dependencies (blockedBy) for sequential work
- Check TaskList() to see what's available

## Quick Reference Table

| Operation | Command | Status Before | Status After |
|-----------|---------|----------------|--------------|
| Create task | `TaskCreate` | — | `pending` |
| Start work | `TaskUpdate(..., status: "in_progress")` | `pending` | `in_progress` |
| Complete task | `TaskUpdate(..., status: "completed")` | `in_progress` | `completed` |
| Check all tasks | `TaskList` | — | (read-only) |

## Common Mistakes

❌ **Wrong:** Subject in present continuous
```
TaskCreate:
  subject: "Writing documentation"    # Should be imperative
```

✓ **Right:** Subject in imperative
```
TaskCreate:
  subject: "Write documentation"
  activeForm: "Writing documentation"
```

---

**Version:** 1.0
**Last Updated:** 2026-02-13
