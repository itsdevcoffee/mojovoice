# queue.md Schema Reference

`.maximus/queue.md` is the shared backlog for ideas, observations, and deferred work that
aren't ready for the current batch. It is a **git-tracked markdown checklist**, read
automatically by `/maximus-plan` (Phase 1) to surface items for promotion.

---

## File Location

```
.maximus/queue.md
```

This file is **tracked by git** — it is part of the project's shared history and is visible
in all worktrees. See the worktree guidance section in `handling-worktrees.md` for rules
about modifying it from a worktree context.

---

## Item Schema

### Required Fields

```markdown
- [ ] Short title in imperative form (≤10 words)
  - Added: YYYY-MM-DD
  - Priority: high | normal | low
```

### Optional Fields

```markdown
  - Category: ui | engine | cli | tui | episodes | docs | testing | infra
  - Notes: Freeform text. Use `|` for multi-line YAML-style blocks.
  - Blocked by: Description of what must happen first
  - Updated: YYYY-MM-DD
```

### Resolved Item

When promoted or closed, replace `[ ]` with `[x]` and add a `Resolved` line:

```markdown
- [x] Short title
  - Added: YYYY-MM-DD
  - Priority: high
  - Resolved: YYYY-MM-DD — one-line summary of what happened
```

---

## Full Example

```markdown
# Maximus Queue

## Items

- [ ] Add `--dry-run` flag to `maximus run`
  - Added: 2026-02-22
  - Priority: normal
  - Category: cli
  - Notes: Preview which tasks would run and their estimated cost without actually
    spawning agents. Useful for sanity-checking a plan before a long batch.

- [ ] TUI agent-output screen mishandles Goose events
  - Added: 2026-02-21
  - Priority: high
  - Category: tui
  - Notes: Shows raw event type names instead of formatted [TOOL]/[TEXT]/[RESULT].
    See engine/lib/adapters/goose-cli.ts for the correct format.
  - Blocked by: Goose adapter event normalization (Resolved 2026-02-20)

- [x] Implement `maximus kill` command
  - Added: 2026-02-18
  - Priority: high
  - Resolved: 2026-02-18 — Implemented cli/kill.ts with kill-signal polling via
    .maximus/.kill file. Promoted to task #69 in Phase 19.
```

---

## Priority Guidelines

| Priority | When to use |
|----------|-------------|
| `high` | Actively causes problems or blocks important work |
| `normal` | Should be done but not urgent |
| `low` | Nice to have, low impact, or speculative |

---

## Category Guidelines

| Category | Covers |
|----------|--------|
| `ui` | React dashboard (app/) |
| `engine` | Core loop engine (engine/) |
| `cli` | Terminal commands (cli/) |
| `tui` | Terminal UI (tui/) |
| `episodes` | Episode capture system (lib/shared/episodes/) |
| `docs` | Documentation only |
| `testing` | Test coverage, test infrastructure |
| `infra` | Build, CI, deployment, tooling |

---

## Promotion Rules

When `/maximus-plan` promotes an item to a plan task, mark it resolved:

```markdown
- [x] Short title
  - Added: YYYY-MM-DD
  - Priority: high
  - Resolved: YYYY-MM-DD — Promoted to task #N in [batch/context description]
```

Items NOT selected during a planning session remain unchanged (`- [ ]`) and will be
presented again the next time `/maximus-plan` runs.

---

## Archive Section

When the active list becomes long, use `/maximus-queue archive` (or manually move items)
to place resolved items under a separate `## Archive` heading at the bottom of the file.
The archive section is never read by `/maximus-plan` — only `## Items` (or the flat list
before any `## Archive` heading) is scanned for unchecked items.

```markdown
## Archive

- [x] Old resolved item ...
- [x] Another resolved item ...
```

---

## What queue.md Is NOT

- **Not a substitute for `passes: "blocked"`** — setting `passes: "blocked"` in plan.json
  causes an immediate engine stop. Queue items are separate from the engine's task state.
- **Not a plan** — items in queue.md have no `id`, `phase`, or `acceptance_criteria`. They
  are informal notes that become plan tasks only after promotion through `/maximus-plan`.
- **Not agent-writable from worktrees** — task agents running in worktrees must not modify
  queue.md. See `handling-worktrees.md`.
