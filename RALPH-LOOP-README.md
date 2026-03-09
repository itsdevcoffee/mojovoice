# Ralph Loop - Autonomous UI/UX Overhaul

**Status:** Ready to run
**Branch:** ui-overhaul-v0.6.0
**Tasks:** 24 tasks across 5 phases
**Estimated Duration:** ~24 iterations (watch time: ~8-12 hours with 3s sleep)

---

## What is Ralph Loop?

Autonomous bash loop that repeatedly calls `claude -p` (non-interactive mode) to implement tasks sequentially. Each iteration:
1. Reads `plan.md` (JSON task list) and `claude-progress.txt` (progress log)
2. Picks next incomplete task
3. Implements it following MojoVoice Style Guide
4. Verifies all acceptance criteria
5. Updates `plan.md` (`"passes": false` → `"passes": true`)
6. Commits changes
7. Exits (loop restarts for next task)

**Memory persists via:** Git commits, plan.md, claude-progress.txt

---

## Files Created

| File | Purpose |
|------|---------|
| `plan.md` | 24 tasks in JSON format with acceptance criteria |
| `PROMPT.md` | Iteration instructions for autonomous agent |
| `claude-progress.txt` | Progress log (agents append summaries) |
| `CLAUDE.md` | Updated with Ralph Loop workflow rules |
| `ralph-loop.sh` | Bash script to run the loop |

---

## Task Breakdown (24 Tasks)

### Phase 1: Foundation (4 tasks)
1. Design token system (CSS variables for colors, typography, spacing)
2. Neubrutalist button component (brutal shadow animation)
3. Terminal section header (pulsing glyph)
4. Neubrutalist card component (thick borders, sharp corners)

### Phase 2: Main Screen (6 tasks)
5. Single-page layout structure (remove old navigation)
6. Giant test recording button (centerpiece)
7. Status bar component (ready indicator + quick controls)
8. Transcription card component (recent items)
9. Recent transcriptions section (last 3-5 items)
10. Collapsible system status section (GPU, memory, daemon)

### Phase 3: Settings Drawer (6 tasks)
11. Slide-in drawer component (right side, 400px)
12. Voice Recognition section (model + language)
13. Recording section (duration slider + audio device)
14. Behavior section (toggles)
15. Advanced section (collapsible, power user settings)
16. Save/Reset actions (bottom of drawer)

### Phase 4: History Modal (3 tasks)
17. Full history modal overlay (centered, 900px wide)
18. Search and filters (real-time search, date/length filters)
19. Export and bulk actions (export JSON, clear all)

### Phase 5: Polish (5 tasks)
20. Keyboard shortcuts (Space, Cmd+,, Cmd+H, Cmd+K, etc.)
21. Micro-interactions (button press, toggle morph, focus glow)
22. Accessibility enhancements (WCAG 2.2 AA, screen readers)
23. Performance optimization (code splitting, virtual scrolling)
24. Manual testing and bug fixes (edge cases, responsive)

---

## How to Run

### Option 1: Using the Script (Recommended)

```bash
cd ~/dev-coffee/repos/dev-voice
./ralph-loop.sh
```

**What it does:**
- Creates `logs/` directory
- Runs iterations continuously
- Logs each iteration to `logs/iteration-[timestamp].log`
- Auto-stops when `<promise>COMPLETE</promise>` detected
- Shows iteration count and timestamps

**To stop:** Press `Ctrl+C`

### Option 2: Manual Command

```bash
cd ~/dev-coffee/repos/dev-voice
mkdir -p logs
while :; do
  claude -p "$(cat PROMPT.md)" --dangerously-skip-permissions 2>&1 | tee "logs/iteration-$(date +%s).log"
  sleep 3
done
```

---

## Monitoring Progress

### Real-time (While Running)

**Watch progress log:**
```bash
tail -f claude-progress.txt
```

**Check last iteration log:**
```bash
ls -t logs/*.log | head -1 | xargs cat
```

**Check git commits:**
```bash
git log --oneline -10
```

### Summary (After Running)

**Check completed tasks:**
```bash
cat plan.md | grep '"passes": true' | wc -l
```

**Read full progress:**
```bash
cat claude-progress.txt
```

**Review all changes:**
```bash
git diff main..ui-overhaul-v0.6.0
```

---

## What Gets Built

After completion, you'll have:

✅ **Complete design token system** - Electric Night palette, typography, spacing
✅ **Reusable neubrutalist components** - Buttons, cards, section headers
✅ **Single-page Mission Control UI** - No tabs, everything on one screen
✅ **Giant test button** - Centerpiece with brutal shadow animation
✅ **Status bar** - Ready indicator + quick model switching
✅ **Recent transcriptions** - Last 5 items always visible
✅ **System status** - Collapsible GPU/memory/daemon info
✅ **Settings drawer** - Slide-in from right with all config options
✅ **History modal** - Full searchable history with filters
✅ **Keyboard shortcuts** - Cmd+, Cmd+H, Cmd+K, Space, etc.
✅ **Micro-interactions** - Smooth animations, electric glows
✅ **Full accessibility** - WCAG 2.2 AA, screen reader support
✅ **Performance optimized** - Code splitting, virtual scrolling

---

## Design System Reference

**Primary Documents:**
- `docs/context/mojovoice-style-guide.md` - Complete design system
- `docs/project/2026-02-08-settings-design-recommendations.md` - Component specs
- `docs/project/settings-design-mockup.html` - Visual examples

**Color Palette:**
- Deep Navy: #0A0E1A (backgrounds)
- Electric Blue: #3B82F6 (interactive)
- Acid Green: #22C55E (success/recording)

**Typography:**
- JetBrains Mono (headers, values, technical)
- Inter (UI labels, descriptions)

**Aesthetic:**
- Neubrutalism (thick borders, brutal shadows)
- Terminal-inspired (section headers, monospace)
- Cyberpunk (electric glows, neon accents)

---

## Troubleshooting

**Loop stops immediately:**
- Check `plan.md` is valid JSON: `jq . plan.md`
- Check last log: `ls -t logs/*.log | head -1 | xargs cat`

**Task keeps failing:**
- Read iteration log to see error
- Fix blocker manually
- Restart loop (will retry same task)

**Need to pause:**
- Press `Ctrl+C`
- Current progress saved in `plan.md` and git commits
- Resume anytime with `./ralph-loop.sh`

**Need to modify tasks:**
- Edit `plan.md` (add/remove/modify tasks)
- Edit descriptions/criteria, but keep JSON valid
- Restart loop

**UI doesn't compile:**
- Check last commit: `git log -1 --stat`
- Agent should have fixed before committing (but might have missed)
- Fix manually and commit: `git add -A && git commit -m "fix: compilation issue"`
- Restart loop

---

## Expected Timeline

**With 3-second sleep between iterations:**
- 24 tasks × ~20 minutes per task = ~8 hours wall time
- Actual work time: ~4-6 hours (agent processing)
- Sleep time: ~72 seconds total (negligible)

**You can:**
- Run overnight
- Monitor periodically (`tail -f claude-progress.txt`)
- Let it complete fully autonomously

---

## After Completion

**Review the work:**
```bash
git log --oneline --graph
git diff main..ui-overhaul-v0.6.0 --stat
```

**Test the UI:**
```bash
cd ui
npm run dev
# Open http://localhost:1420 (or your configured port)
```

**Create PR:**
```bash
gh pr create --base main --head ui-overhaul-v0.6.0 \
  --title "UI/UX Overhaul: Cyberpunk Terminal Mission Control" \
  --body "$(cat claude-progress.txt)"
```

---

**Ready?** Run `./ralph-loop.sh` and let the autonomous agent build your new UI! 🤖⚡
