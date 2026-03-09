# Plan Anti-Patterns

These patterns consistently cause task failures, timeouts, or wasted cost. Avoid all of them.

## 1. Tasks Too Broad

**Bad:** "Implement authentication system"
**Good:** Split into: user model, registration endpoint, login endpoint, JWT middleware

A task should be completable by a single agent in one session (5-30 minutes). If it needs more than one commit or touches more than 5 files, split it.

## 2. Vague Acceptance Criteria

**Bad:** "Authentication works correctly"
**Good:** "POST /auth/login with valid credentials returns 200 with JWT token in response body"

Every criterion must be verifiable by running a command or checking a specific output. If you can't test it, it's not a criterion.

## 3. Wrong Complexity Level

**Bad:** Multi-file task marked as `simple`
**Good:** Any task touching 2+ files is `medium` minimum

Haiku (simple) consistently fails on multi-file tasks. This is the single most expensive mistake — a failed haiku attempt costs time and still needs a sonnet retry.

## 4. Open-Ended Documentation Tasks

**Bad:** "Write comprehensive API documentation"
**Good:** "Add JSDoc comments to the 5 exported functions in server/routes/auth.ts"

Open-ended tasks timeout (900s limit). Bound the scope with specific files and word counts.

## 5. Circular Dependencies Between Tasks

**Bad:** Task 3 creates a function that Task 2 imports
**Good:** Foundation tasks (models, utilities) always come before tasks that use them

The engine runs tasks in array order. If Task B depends on Task A's output, Task A must have a lower ID.

## 6. Missing Testing Steps

**Bad:** No `testing_steps` field
**Good:** `["bun test auth/", "curl -X POST http://localhost:3000/auth/register ..."]`

Without testing steps, agents skip verification and commit untested code. Always include at least one runnable command.

## 7. Generic Testing Steps for Complex Tasks

**Bad:**
```json
{
  "complexity_level": "complex",
  "testing_steps": ["bun test"]
}
```
Problem: If ANY unrelated test in the full suite fails, the task fails verification even though the agent's code was correct. This causes false negatives and expensive retries.

**Good:**
```json
{
  "complexity_level": "complex",
  "testing_steps": [
    "bun run typecheck",
    "cd lib/shared/episodes && bun test",
    "bun test"
  ]
}
```
Approach: Specific subsystem testing first (catches real issues), then full suite as regression check.

**Rule:** Testing steps should be scoped to verify the task's changes, not fail because of unrelated code. For complex multi-file tasks, always lead with typecheck, then subsystem tests, then full suite as safety net.

## 8. Tasks Targeting Engine State Files

**Bad:** Task that modifies `.maximus/plan.json`, `.maximus/progress.md`, or `.maximus/run-summary.json`
**Good:** Tasks only modify project source code, never engine state

The engine protects three state files with chmod 444 locks and snapshot-restore before each agent run:
- `.maximus/plan.json` — task plan
- `.maximus/progress.md` — iteration history
- `.maximus/run-summary.json` — cost/performance log

Tasks targeting any of these will fail silently (chmod 444 prevents writes) or be reverted by the snapshot-restore mechanism.

## 9. Overlapping File Targets

**Bad:** Task 5 and Task 6 both modify `server/routes/index.ts`
**Good:** Group related changes to the same file in one task, or ensure they touch different parts

When consecutive tasks modify the same file, the second agent may not see the first agent's changes if there's a conflict. Minimize overlap.
