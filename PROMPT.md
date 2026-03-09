# UI/UX Overhaul Iteration Prompt

You are implementing the MojoVoice UI/UX overhaul on branch `ui-overhaul-v0.6.0`.

## Context Files (Read First)

1. **claude-progress.txt** - Progress log from previous iterations
2. **plan.md** - JSON task list with acceptance criteria
3. **docs/context/mojovoice-style-guide.md** - Complete design system
4. **docs/project/2026-02-08-settings-design-recommendations.md** - Detailed component specs

Check git log:
```bash
git log --oneline -10
```

Verify app state (if UI initialized):
```bash
cd ui && npm run dev
# Check that it starts without errors (Ctrl+C to stop)
```

## Your Task

Pick the SINGLE highest-priority task from plan.md where `"passes": false`.

Implement ONLY that one task completely according to its acceptance criteria.

## Implementation Steps

1. **Read the task** - Understand description and ALL acceptance criteria
2. **Check dependencies** - Ensure previous tasks are complete (passes: true)
3. **Implement** - Write code following MojoVoice Style Guide exactly
4. **Verify** - Test that ALL acceptance criteria are met
5. **Update plan.md** - Change `"passes": false` to `"passes": true` ONLY if verified
6. **Log progress** - Append to claude-progress.txt with timestamp and summary
7. **Commit** - Git commit with message: `feat: [feature name from task]`

## Critical Rules

- ✅ **ONE task per iteration** - Do not attempt multiple tasks
- ✅ **Verify before marking complete** - Test every acceptance criterion
- ✅ **Never edit task descriptions** - Only change the `passes` field
- ✅ **Keep code compilable** - Every commit should build successfully
- ✅ **Follow style guide** - Match MojoVoice Style Guide specifications exactly
- ✅ **Test functionality** - Don't just write code, verify it works
- ❌ **No assumptions** - If acceptance criteria unclear, use best judgment from style guide
- ❌ **No shortcuts** - Complete every acceptance criterion
- ❌ **No multiple tasks** - Seriously, just one

## Design System Compliance

Every component you create MUST follow:
- **Colors:** Electric Night palette (deep navy + electric blue + acid green)
- **Typography:** JetBrains Mono (headers/values) + Inter (UI text)
- **Buttons:** Neubrutalist (thick borders, brutal shadow shift)
- **Cards:** 2px borders, sharp corners, hover glow
- **Inputs:** Terminal-inspired, monospace, electric blue focus
- **Animations:** 150-250ms, GPU-accelerated, honor reduced motion
- **Spacing:** 4px base unit (use --space-* tokens)

## Verification Commands

```bash
# Check if UI compiles
cd ui && npm run build

# Run dev server
cd ui && npm run dev

# Check for TypeScript errors
cd ui && npx tsc --noEmit

# Check for console errors in browser
# Open browser DevTools, check console
```

## Progress Logging Format

Append to `claude-progress.txt`:

```
## Iteration [N] - [Date/Time]
Task: [Task ID and feature name]
Status: [Complete/Blocked/Needs Review]
Changes:
- File 1: Description of changes
- File 2: Description of changes
Verification: [How you verified acceptance criteria]
Commit: [commit hash]
```

## Completion Signal

If ALL tasks in plan.md have `"passes": true`, output:

```
<promise>COMPLETE</promise>
```

This signals the loop can stop.

## If Blocked

If you cannot complete a task:
1. Document the blocker in claude-progress.txt
2. Do NOT mark task as passing
3. Do NOT attempt other tasks
4. Output reason and exit

The human will review and provide guidance.

---

**Now: Read plan.md, pick the next incomplete task, and implement it. ONE task only.**
