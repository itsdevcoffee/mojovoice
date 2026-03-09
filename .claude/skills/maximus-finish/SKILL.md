---
name: maximus-finish
description: Use when a Maximus Loop batch is complete and you need to wrap up the worktree — archive, clean, then choose merge/PR/keep/discard. Triggers on "finish the worktree", "wrap up the batch", "merge the worktree", "close out this batch", "done with the batch", or /maximus-finish.
---

# Maximus Finish — Worktree Wrap-up

Guides completion of a Maximus Loop batch running in an isolated git worktree.
Handles archive, clean, and the merge/PR/discard decision in one flow.

**Announce:** "I'll wrap up this Maximus batch and help you integrate the work."

---

## Phase 1: Detect Context

Run via Bash: `pwd && git branch --show-current && git worktree list --porcelain`

**Check 1 — Are we in a Maximus worktree?**

The current working directory must contain `.maximus/worktrees/` in its path.
If not, print:

```
This skill is for Maximus worktree batches.
You don't appear to be in a worktree directory.

Current directory: [pwd]

If you want to wrap up a specific worktree, cd into it first:
  cd .maximus/worktrees/[name]
  /maximus-finish

For non-worktree batch wrap-up: maximus archive && maximus clean
```

Stop here. Do not continue.

**Check 2 — Get key values from the worktree list:**
- Branch name: `git branch --show-current`
- Worktree short name: strip `.maximus/worktrees/` prefix from `pwd`
- Repo root: the `worktree` entry in `git worktree list --porcelain` that is NOT the current path (the main repo entry)

**Check 3 — Is the batch actually done?**

Read `.maximus/plan.json` and check if all tasks have `passes: true`.

If incomplete tasks exist:
```
⚠️  Batch not complete — [N] task(s) still pending.

Options:
  - Continue running: maximus run
  - Finish anyway (will leave incomplete tasks in the worktree branch)

Finish anyway?
```

Use AskUserQuestion with "Yes, finish anyway" / "No, let me keep running" options.
If No → stop.

---

## Phase 2: Archive and Clean

**Check if already archived:**
Run `ls .maximus/archive/ 2>/dev/null | head -1`

If no archive directory exists AND `.maximus/run-summary.json` exists:

Run: `maximus archive`
Then: `maximus clean`

If archive already exists (user already ran these): skip — just confirm with a note.

If no run-summary.json exists (nothing was run): skip archive, run `maximus clean` only.

---

## Phase 3: Present Options

Run `cat .maximus/archive/*/summary.json 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(f\"{d.get('tasksCompleted','?')}/{d.get('tasksTotal','?')} tasks, \${d.get('totalCostUsd',0):.2f}\")" 2>/dev/null || echo "batch complete"` to get a cost summary for the options display.

Present exactly these 4 options using AskUserQuestion:

```
Batch complete ([summary]). How would you like to integrate this work?
```

Options:
- **Merge to main locally** — merge branch into main and remove this worktree
- **Push and create PR** — push branch for review, keep worktree alive
- **Keep worktree alive** — I'll run more batches or handle integration later
- **Discard this work** — permanently delete this branch and worktree

---

## Phase 4: Execute Choice

### Option 1: Merge to main locally

1. Run from the repo root:
   ```bash
   cd [repo-root]
   git merge [branch-name]
   ```

2. If merge has conflicts — surface them and stop:
   ```
   ❌ Merge conflict in: [files]
   Resolve conflicts manually, then:
     git add [files]
     git commit
     maximus worktree remove [name]
   ```

3. If merge succeeds — run a lightweight sanity check:
   ```bash
   bun run typecheck 2>&1 | tail -5
   ```
   Report pass/fail but do not block on typecheck failures (the engine already ran per-task testing).

4. Remove the worktree:
   ```bash
   maximus worktree remove [name]
   ```
   If that fails (e.g. the remove command doesn't exist yet): fall back to:
   ```bash
   git worktree remove --force [worktree-path]
   git branch -D [branch-name]
   ```

5. Print:
   ```
   ✔ Merged [branch-name] → main
   ✔ Worktree removed
   ```

---

### Option 2: Push and create PR

1. Push the branch:
   ```bash
   git push -u origin [branch-name]
   ```

2. Build a PR body from the archive summary — read `.maximus/archive/*/summary.json` and `plan.json` for task list. Create PR:
   ```bash
   gh pr create \
     --title "[branch-name]: [short description from plan tasks]" \
     --body "$(cat <<'EOF'
   ## Maximus Loop Batch

   **Branch:** [branch-name]
   **Tasks:** [N completed / N total]
   **Cost:** $[X.XX]
   **Duration:** [Xs]

   ## Tasks Completed
   [bullet list of task features from plan.json]

   ## Test Plan
   - [ ] Run `bun run typecheck` — no new type errors
   - [ ] Run `cd engine && bun test` — no regressions
   - [ ] Manual verification of changed functionality
   EOF
   )"
   ```

3. Print the PR URL.

4. Keep the worktree alive — the PR review may require follow-up commits.
   Print:
   ```
   ✔ PR created: [url]
   ℹ  Worktree preserved at [path] for follow-up work.
   When the PR merges, run:
     maximus worktree remove [name]
   ```

---

### Option 3: Keep worktree alive

Print:
```
ℹ  Worktree preserved at [worktree-path]
   Branch: [branch-name]

To run more tasks: cd [worktree-path] && maximus run
To plan the next batch: cd [worktree-path] && /maximus-plan
To finish later: cd [worktree-path] && /maximus-finish
```

Stop — no cleanup.

---

### Option 4: Discard this work

**First, show what will be deleted:**
```
This will permanently delete:
  Branch: [branch-name]
  Commits: [git log --oneline [main]..[branch] output]
  Worktree: [path]

Type 'discard' to confirm.
```

Wait for the user to literally type "discard". If anything else → abort.

If confirmed:
```bash
maximus worktree remove [name]
```
If that fails:
```bash
git worktree remove --force [worktree-path]
git branch -D [branch-name]
```

Print: `✔ Worktree [name] discarded.`

---

## Quick Reference

| Option | Archive | Merge | Push | PR | Keep Worktree | Delete Branch |
|--------|---------|-------|------|----|---------------|---------------|
| 1. Merge locally | ✓ | ✓ | — | — | — | ✓ |
| 2. Push + PR | ✓ | — | ✓ | ✓ | ✓ | — |
| 3. Keep alive | ✓ | — | — | — | ✓ | — |
| 4. Discard | ✓ | — | — | — | — | ✓ (force) |

## Red Flags

**Never:**
- Delete a worktree or branch without showing the user what will be lost
- Force-push
- Run the full test suite (the engine already did per-task testing — typecheck only)
- Proceed with discard without the literal "discard" confirmation

**Always:**
- Archive before any cleanup (data preservation)
- Show the branch name and path before any destructive action
- Leave the worktree alive for Option 2 (PR review may need follow-up commits)
