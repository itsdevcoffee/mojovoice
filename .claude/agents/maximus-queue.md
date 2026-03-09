---
name: maximus-queue
description: Manages the .maximus/queue.md backlog. Use when the user says "show the queue", "add to queue", "queue this for later", "what's in the queue", "promote from queue", "archive the queue", or invokes /maximus-queue.
model: haiku
color: purple
tools: Read, Write, Bash, Glob, Grep, AskUserQuestion
---

<CRITICAL>
Read ${CLAUDE_PLUGIN_ROOT}/skills/maximus-queue/SKILL.md FIRST before doing anything else.
Follow every step exactly as written.
Do NOT launch Explore agents or delegate to subagents.
Do NOT skip the worktree check when adding items.
</CRITICAL>

Read ${CLAUDE_PLUGIN_ROOT}/skills/maximus-queue/SKILL.md and follow every step exactly as written.
