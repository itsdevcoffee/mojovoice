# Maximus Loop Config Schema Reference

Authoritative field reference for `.maximus/config.yml`. Derived from `engine/lib/types.ts` Config interface and `engine/lib/config.ts` applyDefaults().

## Top-Level Fields

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `project_name` | string | no | `"Maximus Loop"` | Display name for the project |
| `maximus_version` | string | no | `"1.0.0"` | Config schema version |
| `loop` | object | **yes** | — | Loop execution settings |
| `agent` | object | **yes** | — | Agent spawning settings |
| `tasks` | object | no | see below | Task source configuration |
| `context` | object | no | — | File context for agent |
| `progress` | object | no | see below | Progress tracking configuration |
| `git` | object | no | see below | Git integration settings |
| `review` | object | no | see below | Code review configuration |

## `loop` (required)

| Field | Type | Required | Default | Valid Values |
|-------|------|----------|---------|-------------|
| `max_iterations` | number | **yes** | — | Any integer. `-1` = unlimited |
| `mode` | string | no | `"sequential"` | `"sequential"` or `"parallel"` |
| `auto_commit` | boolean | no | `true` | — |
| `continue_on_error` | boolean | no | `false` | — |

## `agent` (required)

| Field | Type | Required | Default | Valid Values |
|-------|------|----------|---------|-------------|
| `default_model` | string | **yes** | — | `"haiku"`, `"sonnet"`, `"opus"`, or any full model ID |
| `timeout` | number | no | `600` | Seconds (recommended: 600–1200) |
| `max_retries` | number | no | `2` | — |
| `provider` | string | no | `"claude"` | `"claude"` or `"codex"` — selects the agent adapter |
| `escalation` | object | no | — | Model escalation config |

### `agent.escalation` (optional)

| Field | Type | Required | Default | Valid Values |
|-------|------|----------|---------|-------------|
| `enabled` | boolean | **yes** (if section present) | — | — |
| `simple` | string | **yes** (if enabled) | — | `"haiku"`, `"sonnet"`, `"opus"` |
| `medium` | string | **yes** (if enabled) | — | `"haiku"`, `"sonnet"`, `"opus"` |
| `complex` | string | **yes** (if enabled) | — | `"haiku"`, `"sonnet"`, `"opus"` |

## `tasks` (optional)

| Field | Type | Required | Default |
|-------|------|----------|---------|
| `source` | string | no | `".maximus/plan.json"` |
| `auto_mark_done` | boolean | no | `true` |

## `context` (optional)

| Field | Type | Required | Default |
|-------|------|----------|---------|
| `files` | string[] | no | — |

## `progress` (optional)

| Field | Type | Required | Default | Valid Values |
|-------|------|----------|---------|-------------|
| `file` | string | no | `".maximus/progress.md"` | — |
| `format` | string | no | `"markdown"` | `"markdown"` or `"json"` |

## `git` (optional)

| Field | Type | Required | Default |
|-------|------|----------|---------|
| `enabled` | boolean | no | `true` |
| `commit_prefix` | string | no | `"maximus:"` |
| `auto_push` | boolean | no | `false` |

## `review` (optional)

| Field | Type | Required | Default | Valid Values |
|-------|------|----------|---------|-------------|
| `enabled` | boolean | **yes** (if section present) | `false` | — |
| `min_severity` | string | no | `"medium"` | `"low"`, `"medium"`, `"high"` |
| `max_phases` | number | no | `3` | Positive integer |

## Common Mistakes

Agents frequently invent these fields. **None of these exist in the schema:**

| Invented Field | Why It's Wrong |
|----------------|----------------|
| `project:` (nested object) | Use flat `project_name` string |
| `project.name`, `project.root`, `project.description` | Not a nested object — flat `project_name` only |
| `stack:` | Not a config field |
| `verify:` | Not a config field |
| `guardrails:` | Not a config field |
| `conventions:` | Not a config field |
| `description:` | Not a config field |
| `language:` | Not a config field |
| `framework:` | Not a config field |
| `test_command:` | Not a config field |
| `agent.model` | Correct field is `agent.default_model`. Note: `agent.provider` IS a valid field — don't confuse it with model. |
| `loop.iterations` | Correct field is `loop.max_iterations` |
| `git.prefix` | Correct field is `git.commit_prefix` |
| `git.push` | Correct field is `git.auto_push` |

## Example Config

```yaml
project_name: "My Project"

loop:
  max_iterations: -1
  mode: sequential
  auto_commit: true
  continue_on_error: false

agent:
  default_model: sonnet
  timeout: 900
  max_retries: 2
  provider: claude  # optional, defaults to "claude". Use "codex" for OpenAI Codex CLI.
  escalation:
    enabled: true
    simple: haiku
    medium: sonnet
    complex: opus

tasks:
  source: .maximus/plan.json
  auto_mark_done: true

context:
  files:
    - CLAUDE.md

progress:
  file: .maximus/progress.md
  format: markdown

git:
  enabled: true
  commit_prefix: "maximus:"
  auto_push: false
```
