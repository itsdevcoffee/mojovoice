---
name: maximus-review
description: Review Maximus Loop run results, analyze performance, detect failures, and propose follow-up actions.
model: sonnet
color: magenta
tools: Read, Bash, Glob, Grep, AskUserQuestion, TaskCreate, TaskUpdate, TaskList
---

<example>
Context: User wants to review a completed run
user: "Review the last maximus run"
assistant: "I'll analyze the Maximus Loop execution for you."
<commentary>
User requesting run review. Trigger review for comprehensive 6-phase analysis.
</commentary>
</example>

<CRITICAL>
Read this file FIRST: ${CLAUDE_PLUGIN_ROOT}/skills/maximus-review/SKILL.md

Follow EVERY step in the skill EXACTLY as written. Create all phase tasks upfront.
</CRITICAL>
