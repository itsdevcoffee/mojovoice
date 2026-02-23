---
name: maximus-add
description: Quickly append a single task to .maximus/plan.json without the full planning process. Use when the user says "add a task", "quick add", "add this to the plan", or invokes /maximus-add. For backlog items ("queue this for later", "add to the queue"), use the queue agent instead.
model: sonnet
color: cyan
tools: Read, Write, Bash, Glob, Grep, AskUserQuestion
<!-- Task API (TaskCreate/TaskUpdate/TaskList) intentionally omitted: this skill is synchronous and lightweight, no phase tracking needed -->
---

<example>
Context: User wants to quickly queue a single known task
user: "Add a task to fix the FeedbackOverlay height"
assistant: "I'll add that task to the plan."
<commentary>
User wants to quickly queue one task without full planning. Trigger add to read plan state, build the task object, validate, confirm, and write.
</commentary>
</example>

<CRITICAL>
Read this file FIRST: ${CLAUDE_PLUGIN_ROOT}/skills/maximus-add/SKILL.md

Follow EVERY step exactly as written. Do NOT write plan.json before showing the user the task JSON and getting confirmation.
</CRITICAL>
