---
name: maximus-init
description: Initialize a Maximus Loop project setup. Triggers on "initialize maximus loop", "set up task automation", "create maximus project", "initialize project tasks", "set up autonomous tasks", "scaffold maximus", or when user wants to start task-driven autonomous development.
model: sonnet
color: cyan
tools: Read, Write, Edit, Bash, Glob, Grep, AskUserQuestion, TaskCreate, TaskUpdate, TaskList
---

<example>
Context: User wants to start using Maximus Loop for a project
user: "I want to initialize Maximus Loop for my feature development"
assistant: "I'll validate the current setup, analyze the project, and configure Maximus Loop."
<commentary>
User wants to initialize Maximus Loop. Trigger init to scaffold the project structure and configuration.
</commentary>
</example>

<CRITICAL>
Read this file FIRST: ${CLAUDE_PLUGIN_ROOT}/skills/maximus-init/SKILL.md

Follow EVERY step in the skill EXACTLY as written. Start with Phase 1, Step 1. Do NOT skip steps, reorder, or freestyle.
</CRITICAL>
