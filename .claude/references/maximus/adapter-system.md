# Multi-Provider Adapter System

The Maximus Loop engine supports multiple agent CLI providers through an extensible adapter system. This document covers provider configuration, model resolution, preflight checks, and the AgentAdapter interface.

## Overview

The adapter system allows the engine to work with different agent CLI tools (Claude, Codex, or custom providers). Each provider implements a common interface for spawning agents, validating models, and tracking costs.

### Configuration Fields

**Agent-level configuration** (`config.yml` → `agent` section):
- `agent.provider` — Default provider for all tasks (defaults to `"claude"`)
- `agent.default_model` — Default model when escalation is disabled or complexity is unset

**Task-level configuration** (plan.json → task objects):
- `task.provider` — Provider override for this specific task (optional)
- `task.model` — Model override for this specific task (optional, highest priority)

## Model Priority Chain

When resolving which model to use for a task, the engine follows this priority chain:

```
1. task.model (if set)
   ↓
2. escalation[complexity_level] (if escalation.enabled && task.complexity_level set)
   ↓
3. agent.default_model (fallback)
```

### Example

```yaml
# config.yml
agent:
  default_model: sonnet
  escalation:
    enabled: true
    simple: haiku
    medium: sonnet
    complex: opus
```

```json
// plan.json task
{
  "id": 5,
  "complexity_level": "complex",
  "description": "Multi-file refactoring",
  "model": "opus[1m]"  // Explicit override → uses this
}
```

In this example, task #5 uses `opus[1m]` (the explicit `model` field takes absolute priority).

If `task.model` were omitted, it would use `escalation.complex` = `opus`. If escalation were disabled, it would fall back to `agent.default_model` = `sonnet`.

## Supported Providers

| Provider | CLI Command | Required Env Vars | `isValidModel` Pattern |
|----------|-------------|-------------------|------------------------|
| **claude** | `claude` | None (uses subscription auth) | `(haiku\|sonnet\|opus)(\[[\\w]+\])?` or `claude-.*` |
| **codex** | `codex` | `OPENAI_API_KEY` | `codex-.*` or `gpt-\\d+\\.\\d+.*` |

### Model Examples

**Claude:**
- Short names: `haiku`, `sonnet`, `opus`, `opus[1m]`, `sonnet[20250929]`
- Full IDs: `claude-haiku-4-5-20251001`, `claude-sonnet-4-5-20250929`, `claude-opus-4-6`

**Codex:**
- Names: `codex-mini-latest`, `gpt-4.1-mini`, `gpt-5.3-codex`
- Must include version number for GPT models: `gpt-X.Y-...`

## Preflight Checks

Before the engine loop starts, it runs preflight validation on the configured provider. Preflight checks collect **all** errors and warnings without throwing early.

### Claude Adapter Preflight

1. **CLI Availability**
   - Command: `which claude` (via `Bun.which()`)
   - Error if missing: `"Claude CLI is not available. Run: npm install -g @anthropic-ai/claude-code"`

2. **Model Validation**
   - Tests `agent.default_model` against `isValidModel()` pattern
   - Warning (not error) if invalid: `"default_model 'model-xyz' does not match known Claude model patterns"`
   - Same check for `escalation.simple`, `escalation.medium`, `escalation.complex` if escalation is enabled

### Codex Adapter Preflight

1. **CLI Availability**
   - Command: `which codex`
   - Error if missing: `"Codex CLI is not available. Run: npm install -g @openai/codex"`

2. **Model Validation**
   - Tests `agent.default_model` against `isValidModel()` pattern
   - Warning if invalid: `"default_model 'gpt-99' does not match known Codex model patterns"`

3. **Environment Variable Check**
   - Checks `process.env.OPENAI_API_KEY`
   - Error if unset: `"OPENAI_API_KEY environment variable is not set"`

## Cross-Provider Safety Rule

**If `task.provider` differs from `config.agent.provider` AND `task.model` is NOT set, the engine throws an error.**

This prevents ambiguous model resolution when mixing providers. Escalation models are provider-specific (e.g., `escalation.complex: opus` is a Claude model name and won't work with Codex).

### Example Error

```json
// config.yml
agent:
  provider: claude
  default_model: sonnet

// plan.json task
{
  "id": 42,
  "provider": "codex",
  "description": "Use Codex for this task",
  "complexity_level": "complex"
  // NO task.model set
}
```

**Error message:**
```
Task #42 uses provider "codex" but has no model specified. Add a "model" field to the task.
```

**Resolution:**
```json
{
  "id": 42,
  "provider": "codex",
  "model": "gpt-5.3-codex",  // Add explicit model for cross-provider tasks
  "description": "Use Codex for this task"
}
```

## AgentAdapter Interface

All providers implement the `AgentAdapter` interface:

```typescript
export interface AgentAdapter {
  /** Provider identifier (e.g. "claude", "codex") */
  readonly provider: string;

  /** Human-readable name (e.g. "Claude CLI", "Codex CLI") */
  readonly displayName: string;

  /**
   * Resolves the model based on task.model > escalation > default_model priority.
   */
  resolveModel(task: Task, agentConfig: AgentConfig): string;

  /**
   * Spawns the agent CLI as a subprocess.
   * Returns AgentRunResult with cost, token usage, and turn count.
   */
  spawn(options: AdapterSpawnOptions): Promise<AgentRunResult>;

  /**
   * Checks if the CLI is available on the system (e.g. `which claude`).
   */
  isAvailable(): Promise<boolean>;

  /**
   * Validates if a model string is supported by this provider.
   * Accepts short names and full model IDs.
   */
  isValidModel(model: string): boolean;

  /**
   * Runs pre-loop validation checks.
   * Collects ALL warnings and errors before returning.
   * Returns { ok: boolean, warnings: string[], errors: string[] }
   */
  preflight?(agentConfig: AgentConfig): Promise<PreflightResult>;
}
```

### Implementation Notes

- **Cost Tracking**: Each adapter maintains a pricing table (per million tokens) and calculates costs from token usage
- **Stdin Prompt Passing**: Both adapters pass prompts via stdin (not command-line args) to prevent exposure in process argv
- **Event Handling**: Adapters implement custom event logging for their respective CLI output formats
- **Process Isolation**: Spawned agents run in isolated process groups, enabling safe cleanup via `killProcessGroup()`

## Registry and Lookup

Adapters are registered in the adapter registry at engine startup. The engine looks up adapters by provider name:

```typescript
// Get an adapter by provider name
const adapter = getAdapter("claude");

// List all registered providers
const providers = getRegisteredProviders(); // ["claude", "codex"]

// Register a custom adapter
registerAdapter(new CustomCliAdapter());
```

## Future Custom Adapters

To add a new provider (e.g., "anthropic-cli", "custom-agent"):

1. Create a class implementing `AgentAdapter`
2. Implement all required methods (provider, displayName, resolveModel, spawn, isAvailable, isValidModel)
3. Optionally implement `preflight()` for custom validation logic
4. Register via `registerAdapter(new CustomAdapter())`
5. Reference in config/tasks via `provider: "custom"`

Custom adapters follow the same model priority chain and safety rules as built-in providers.
