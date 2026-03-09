# Handling Git Worktrees in Maximus Loop

This reference defines the standard for using git worktrees with the Maximus Loop engine.
Load this file when reasoning about worktree setup, multi-batch isolation, or merge workflows.

---

## Standard Path Convention

All Maximus worktrees live at:

```
.maximus/worktrees/[type/name]
```

Examples:
```
.maximus/worktrees/feat/auth-system
.maximus/worktrees/chore/theme-cleanup
.maximus/worktrees/fix/login-bug
```

This path is **gitignored** (covered by `.maximus/.gitignore`'s `*` rule), so worktree
contents never pollute the parent repo's git status.

Naming follows conventional commit prefixes: `feat/`, `fix/`, `chore/`, `refactor/` + descriptor.

---

## CLI Commands

```bash
# Create a new worktree (interactive prompt if no name given)
maximus worktree create feat/my-feature

# List all Maximus worktrees with status, task counts, cost
maximus worktree list

# Detailed status of one worktree (heartbeat, tasks, config, last activity)
maximus worktree status feat/my-feature

# Safety-gated removal (checks uncommitted changes, incomplete tasks, archive)
maximus worktree remove feat/my-feature
```

`maximus worktree create` handles all setup automatically:
1. Runs `git worktree add .maximus/worktrees/[name] -b [name]`
2. Copies parent `.maximus/config.yml` into the worktree's `.maximus/`
3. Writes empty `plan.json` to the worktree's `.maximus/`
4. Runs `bun install` if `package.json` is present
5. Warns about any `.env*` files in the parent root that aren't in the worktree

---

## What's in a Worktree vs What's Not

When `git worktree add` creates a new worktree, it checks out the tracked files from the
branch. Understanding what's present and what's missing is critical for agent task planning.

### Present in the worktree (tracked files)
- All source code files (TypeScript, config, docs)
- `.claude/` directory — skills, references, commands (plugin files are tracked)
- `.glue/` directory — GLUE skills are tracked and available for `inject:`
- `.maximus/config.yml` — copied by `maximus worktree create`
- `.maximus/queue.md` — shared backlog (tracked)
- `package.json`, `bun.lockb` — dependency manifests

### NOT present in the worktree (gitignored)
- `node_modules/` — **must run `bun install`** before any tasks that build or test
- `.env`, `.env.local`, `.env.*` — secrets/credentials not copied
- `.maximus/plan.json` — batch state (gitignored; created by `/maximus-plan` or `maximus worktree create`)
- `.maximus/progress.md` — runtime artifact (engine creates on first run)
- `.maximus/logs/` — runtime agent logs
- `.maximus/.heartbeat`, `.maximus/.kill`, `.maximus/.state` — runtime signals

**Key implication:** Any task that runs tests, builds, or uses dependencies will fail unless
`bun install` ran first. `maximus worktree create` does this automatically. If a task agent
finds no `node_modules`, the worktree was likely created manually without the command.

---

## plan.json and progress.md Are Gitignored

`plan.json` and `progress.md` are **not tracked by git** (removed from `.maximus/.gitignore`
in Feb 2026). This was intentional:

**Why:** Both files are batch runtime state. Tracking them caused merge conflicts every time
a worktree branch was merged back to `main` — each branch had completely different batch tasks.

**How history is preserved:** `maximus archive` saves both files to
`.maximus/archive/batch-[timestamp]/` which IS tracked. All batch history lives in archives.

**For task agents:** Never assume `plan.json` exists in a fresh worktree. `maximus worktree create`
initializes it. If running `maximus init` manually, it also creates plan.json.

---

## Pre-flight Checklist Before Running the Engine

Before `maximus run` in a worktree, verify:

- [ ] `bun install` has run (check `node_modules/` exists)
- [ ] `.env*` files copied if any tasks need API keys or credentials
- [ ] `plan.json` exists and has tasks (from `/maximus-plan` output)
- [ ] `config.yml` reflects correct project name, model, and timeout for this batch
- [ ] No active `.maximus/.heartbeat` in this worktree (another engine isn't already running)

---

## plan.json Is Gitignored — No Commit Needed or Possible

`plan.json` is listed in `.maximus/.gitignore` and **cannot be committed**.
Running `git add .maximus/plan.json` will always fail with "path is ignored by .gitignore".

This is intentional — `plan.json` is batch runtime state, not project config.
The engine reads it from disk at runtime. No git tracking is needed.
`maximus archive` saves a copy to `.maximus/archive/batch-[timestamp]/plan.json` for history.

**For task agents or planning skills writing plan.json in a worktree:**
- Write directly to `[worktree-path]/.maximus/plan.json` using the Write tool
- Do NOT attempt `git add` or `git commit` on plan.json — it will always fail
- The file is ready for `maximus run` immediately after writing

---

## Merge and Cleanup Workflow

After a worktree batch completes:

```bash
# 1. Archive and clean from inside the worktree
cd .maximus/worktrees/[name]
maximus archive
maximus clean

# 2. Merge from the main repo root
cd /path/to/main/repo
git merge [branch-name]
# plan.json and progress.md are gitignored — they will NOT appear in the merge at all.
# Only actual source code changes land in the merge diff.

# 3. Remove the worktree
maximus worktree remove [name]
# OR manually:
git worktree remove --force .maximus/worktrees/[name]
git branch -D [branch-name]
```

**Merge conflicts:** Since `plan.json` and `progress.md` are gitignored, merges now only
conflict on real code files. If two worktrees touched the same source file, resolve normally.

---

## Agent Isolation — CRITICAL

Task agents running inside a worktree **must only modify files within the worktree directory**.

If you are a task agent and you see this context block in your prompt:

```
⚠️ WORKTREE CONTEXT
Running in isolated worktree: .maximus/worktrees/[name]
Branch: [branch-name]
Do NOT modify files outside this directory.
Do NOT cd to parent paths (../../).
Do NOT push to origin unless explicitly instructed.
All git commits go to branch [branch-name] only.
```

You MUST respect this isolation. Changes to the parent repo are invisible to other worktrees
and will cause confusion when merging.

---

## Skills and GLUE Injection in Worktrees

Because `.claude/` and `.glue/` are tracked files, they ARE available in worktrees:

- `skills: ["superpowers:tdd"]` in plan.json tasks → works, skill file is present
- `inject: ["typescript-patterns"]` in plan.json tasks → works, `.glue/` is present

The one exception: if a skill or GLUE package was added to the parent repo AFTER the worktree
branch was created, it won't be visible in the worktree until you run `git pull` or `git rebase`.

---

## queue.md in Worktrees

`.maximus/queue.md` is a **git-tracked** file — it is present in every worktree (it's part
of the branch checkout). This creates a conflict risk that you must be aware of.

### The Problem

If two worktrees both modify `queue.md` (e.g., adding items or checking off promotions)
and then merge back to `main`, git will produce a merge conflict on the file. This is
avoidable with the right discipline.

### Rules

**Task agents MUST NOT modify `queue.md`.**

Agents running inside a worktree are scoped to implementing their assigned task. They
have no reason to touch the shared backlog. If an agent prompt includes queue.md write
operations, that is scope creep — reject it.

**The `/maximus-queue` skill detects worktree context automatically.**

When you run `/maximus-queue add` from inside a worktree, the skill checks `pwd` for the
`.maximus/worktrees/` path prefix and warns you before writing:

```
⚠️  You're in a worktree. Editing queue.md here will create a merge conflict
    when this branch merges back to main.

    Options:
      (a) Add here anyway (you'll resolve the merge conflict later)
      (b) Open queue.md in the PARENT repo instead
      (c) Cancel
```

Option (b) is usually the right choice — it writes to the parent repo's queue.md
without leaving the worktree context.

### Recommended Pattern

- **Discover something worth queuing while in a worktree?**
  Run `/maximus-queue add` and choose option (b) to write to the parent repo.

- **Never let task agents modify queue.md.** If they do, revert the change before merging.

- **When reviewing a worktree batch with `/maximus-review`:**
  The review skill may suggest adding items to queue.md. Do this from the parent repo
  after merging, not from inside the worktree.

---

## Parallel Worktrees (Future)

Running multiple engines in parallel worktrees is architecturally possible but **not yet safe**
due to concurrent episode DB writes. See:

- `docs/review/parallel-batches-maximus.md` — engine-level concerns
- `docs/review/parallel-batches-episodes.md` — MemRL/episodes concerns (Wolfie)

Until those are resolved, run one worktree engine at a time.
