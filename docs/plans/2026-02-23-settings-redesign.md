# Settings Panel Redesign — Neural Stack + VOCAB Split

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign `SettingsPanel.tsx` with a two-tab layout (`[SETTINGS]` / `[VOCAB]`), a hero card for the active model, dense key=value rows, a compact behavior chip, vertical correction flow in vocabulary, and per-field auto-save — eliminating the broken Save/Reset footer and making the cyberpunk terminal aesthetic pervasive throughout.

**Architecture:** Extract sub-components into `ui/src/components/settings/`. `SettingsPanel.tsx` retains all state/handlers, passes props down. Remove `originalConfig`, `saving`, `saveSuccess` state. Add `flashSaved(fieldKey)` for per-field `[OK]` pulse. Two neubrutalist tab buttons (`[SETTINGS]` / `[VOCAB]`) at the top of the drawer replace the current single vertical scroll.

**Tech Stack:** React, Tailwind CSS v4, Lucide React, Tauri IPC via `invoke`. Dev server: `cd ui && npm run dev` (http://localhost:1420). Visual verification via Playwright MCP, screenshots to `docs/tmp/`.

---

## Design Rationale

**Chosen hybrid:**
- **A3 Neural Stack** → ModelHeroCard: 3px blue border + inner glow + scan-line texture. The most important setting (which model is running) finally has visual dominance.
- **B3 Tabbed Workbench** → Two tabs only: `[SETTINGS]` (configure-once) and `[VOCAB]` (active workspace). Simpler than 3 tabs, still solves the vocabulary burial problem.
- **A1 CONFIG.SYS** → `key = [value]` single-line rows for Recording and Output settings. Dramatically more space-efficient on 336px content width.
- **B2 Mission Briefing** → `append_space` demoted from full section to an inline chip. One toggle does not deserve a section header.
- **B1 Terminal Config** → Auto-save already works; drop Save/Reset entirely. Per-field `[OK]` badge flashes green for 1.5s confirming each change.

---

## New File Structure

```
ui/src/components/
├── SettingsPanel.tsx              ← Refactored: state + handlers, renders tabs
└── settings/                     ← New folder
    ├── SettingRow.tsx             ← key = [value] reusable row
    ├── BehaviorChip.tsx           ← Compact toggle chip
    ├── ModelHeroCard.tsx          ← Hero card: active model + selects
    ├── AdvancedPanel.tsx          ← Collapsible advanced section
    ├── VocabTab.tsx               ← Full vocabulary workspace
    └── SettingsConfigTab.tsx      ← Assembles SETTINGS tab content
```

---

### Task 1: Create `SettingRow` component

The reusable `key = [value]` layout row used throughout the SETTINGS tab.

**Files:**
- Create: `ui/src/components/settings/SettingRow.tsx`

**Step 1: Create the file**

```tsx
// ui/src/components/settings/SettingRow.tsx
interface SettingRowProps {
  label: string;       // monospace key label e.g. "timeout_secs"
  saved?: boolean;     // when true, shows [OK] flash
  children: React.ReactNode;
}

export default function SettingRow({ label, saved, children }: SettingRowProps) {
  return (
    <div className="flex items-center gap-3 py-1.5 min-h-[36px]">
      <span className="w-28 font-mono text-xs text-[var(--text-tertiary)] shrink-0 truncate">
        {label}
      </span>
      <span className="text-[var(--accent-primary)] font-mono text-xs shrink-0">=</span>
      <div className="flex-1 min-w-0">{children}</div>
      <span
        className={`
          font-mono text-[10px] text-green-400 shrink-0 transition-opacity duration-300
          ${saved ? 'opacity-100' : 'opacity-0'}
        `}
        aria-live="polite"
        aria-label={saved ? 'Saved' : ''}
      >
        [OK]
      </span>
    </div>
  );
}
```

**Step 2: Verify file exists**

Run: `ls ui/src/components/settings/`
Expected: `SettingRow.tsx` listed

**Step 3: Commit**

```bash
git add ui/src/components/settings/SettingRow.tsx
git commit -m "feat: add SettingRow key=value layout component"
```

---

### Task 2: Create `BehaviorChip` component

Compact inline toggle chip replacing the full "BEHAVIOR" section header.

**Files:**
- Create: `ui/src/components/settings/BehaviorChip.tsx`

**Step 1: Create the file**

```tsx
// ui/src/components/settings/BehaviorChip.tsx
interface BehaviorChipProps {
  label: string;     // config key e.g. "append_space"
  value: boolean;
  saved?: boolean;
  onToggle: () => void;
}

export default function BehaviorChip({ label, value, saved, onToggle }: BehaviorChipProps) {
  return (
    <div className="flex items-center gap-3 py-1.5">
      <span className="w-28 font-mono text-xs text-[var(--text-tertiary)] shrink-0">{label}</span>
      <span className="text-[var(--accent-primary)] font-mono text-xs shrink-0">=</span>
      <button
        onClick={onToggle}
        role="switch"
        aria-checked={value}
        className={`
          flex items-center gap-1.5 px-2.5 py-1 border-2 font-mono text-xs
          transition-all duration-150
          focus-visible:outline-2 focus-visible:outline-blue-500
          focus-visible:outline-offset-2 focus-visible:shadow-[0_0_20px_rgba(59,130,246,0.5)]
          ${value
            ? 'border-blue-500/50 bg-blue-500/10 text-[var(--text-primary)]'
            : 'border-[var(--border-default)] bg-[var(--bg-elevated)] text-[var(--text-secondary)]'
          }
        `}
      >
        <span
          className={`inline-block w-2 h-2 rounded-full ${value ? 'bg-green-400' : 'bg-[var(--text-tertiary)]'}`}
        />
        {value ? '[ON]' : '[OFF]'}
      </button>
      <span
        className={`
          font-mono text-[10px] text-green-400 shrink-0 transition-opacity duration-300
          ${saved ? 'opacity-100' : 'opacity-0'}
        `}
        aria-live="polite"
        aria-label={saved ? 'Saved' : ''}
      >
        [OK]
      </span>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add ui/src/components/settings/BehaviorChip.tsx
git commit -m "feat: add BehaviorChip compact inline toggle component"
```

---

### Task 3: Create `ModelHeroCard` component

The visually dominant hero card with 3px blue border, inner glow, and `.surface-texture` scan-lines. Contains both the model selector and the language selector.

**Files:**
- Create: `ui/src/components/settings/ModelHeroCard.tsx`

**Step 1: Create the file**

```tsx
// ui/src/components/settings/ModelHeroCard.tsx
const LANGUAGE_OPTIONS = [
  { code: 'auto', name: 'Auto-detect' },
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'ja', name: 'Japanese' },
  { code: 'zh', name: 'Chinese' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'ru', name: 'Russian' },
  { code: 'ko', name: 'Korean' },
  { code: 'it', name: 'Italian' },
  { code: 'nl', name: 'Dutch' },
];

interface DownloadedModel {
  name: string;
  filename: string;
  path: string;
  sizeMb: number;
  isActive: boolean;
}

interface ModelHeroCardProps {
  downloadedModels: DownloadedModel[];
  activeModelPath: string;
  language: string;
  savedModel?: boolean;
  savedLanguage?: boolean;
  onModelChange: (path: string) => void;
  onLanguageChange: (language: string) => void;
}

export default function ModelHeroCard({
  downloadedModels,
  activeModelPath,
  language,
  savedModel,
  savedLanguage,
  onModelChange,
  onLanguageChange,
}: ModelHeroCardProps) {
  const activeModel = downloadedModels.find((m) => m.isActive);

  const selectClass = `
    w-full px-3 py-2 bg-[var(--bg-void)] border-2 border-[var(--border-default)]
    text-[var(--text-primary)] font-mono text-xs
    focus:border-[var(--accent-primary)] focus:outline-none
    focus:shadow-[0_0_20px_rgba(59,130,246,0.3)] transition-all duration-150
  `;

  return (
    <div
      className="
        relative p-4 mb-5
        bg-[var(--bg-elevated)]
        border-[3px] border-[var(--accent-primary)]
        shadow-[4px_4px_0px_0px_rgba(0,0,0,1),inset_0_0_20px_rgba(59,130,246,0.06)]
        surface-texture
      "
    >
      {/* [ACTIVE] badge */}
      <div className="absolute top-2.5 right-2.5">
        <span className="px-1.5 py-0.5 text-[10px] font-mono bg-green-500/20 border border-green-500/30 text-green-400 uppercase">
          [ACTIVE]
        </span>
      </div>

      {/* Model name + specs */}
      {activeModel ? (
        <div className="mb-3 pr-20">
          <p className="font-mono text-sm font-semibold text-[var(--text-primary)] leading-tight">
            {activeModel.name}
          </p>
          <p className="font-mono text-[11px] text-[var(--text-tertiary)] mt-0.5">
            {activeModel.sizeMb} MB · whisper
          </p>
        </div>
      ) : (
        <p className="font-mono text-xs text-[var(--text-tertiary)] mb-3 italic pr-20">
          No model loaded
        </p>
      )}

      {/* Model selector */}
      <div className="space-y-2">
        <div className="relative">
          <select
            value={activeModelPath}
            onChange={(e) => onModelChange(e.target.value)}
            className={selectClass}
            aria-label="Select model"
          >
            {downloadedModels.length === 0 ? (
              <option value="" disabled>No models downloaded</option>
            ) : (
              downloadedModels.map((model) => (
                <option key={model.path} value={model.path}>
                  {model.name} ({model.sizeMb} MB)
                </option>
              ))
            )}
          </select>
          {savedModel && (
            <span className="absolute right-2 top-1/2 -translate-y-1/2 font-mono text-[10px] text-green-400 pointer-events-none">
              [OK]
            </span>
          )}
        </div>

        {/* Language selector */}
        <div className="relative">
          <select
            value={language}
            onChange={(e) => onLanguageChange(e.target.value)}
            className={selectClass}
            aria-label="Select language"
          >
            {LANGUAGE_OPTIONS.map((lang) => (
              <option key={lang.code} value={lang.code}>{lang.name}</option>
            ))}
          </select>
          {savedLanguage && (
            <span className="absolute right-2 top-1/2 -translate-y-1/2 font-mono text-[10px] text-green-400 pointer-events-none">
              [OK]
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add ui/src/components/settings/ModelHeroCard.tsx
git commit -m "feat: add ModelHeroCard hero panel with glow border"
```

---

### Task 4: Create `AdvancedPanel` component

Collapsible panel with dashed border, `[3 opts]` count badge, collapsed summary line, and `SettingRow`-based content.

**Files:**
- Create: `ui/src/components/settings/AdvancedPanel.tsx`

**Step 1: Create the file**

```tsx
// ui/src/components/settings/AdvancedPanel.tsx
import SettingRow from './SettingRow';

interface AdvancedPanelProps {
  isExpanded: boolean;
  onToggle: () => void;
  modelPath: string;
  refreshCommand: string;
  saveAudioClips: boolean;
  audioClipsPath: string;
  savedField: string | null;
  onModelPathChange: (v: string) => void;
  onRefreshCommandChange: (v: string) => void;
  onSaveAudioClipsToggle: () => void;
  onAudioClipsPathChange: (v: string) => void;
}

export default function AdvancedPanel({
  isExpanded,
  onToggle,
  modelPath,
  refreshCommand,
  saveAudioClips,
  audioClipsPath,
  savedField,
  onModelPathChange,
  onRefreshCommandChange,
  onSaveAudioClipsToggle,
  onAudioClipsPathChange,
}: AdvancedPanelProps) {
  const inputClass = `
    w-full pl-7 pr-3 py-1.5 bg-[var(--bg-void)] border-2 border-[var(--border-default)]
    text-[var(--text-primary)] font-mono text-xs placeholder:text-[var(--text-tertiary)]
    focus:border-[var(--accent-primary)] focus:outline-none
    focus:shadow-[0_0_20px_rgba(59,130,246,0.3)] transition-all duration-150
  `;

  return (
    <div className="mt-4 border-2 border-dashed border-[var(--border-default)]">
      {/* Toggle header */}
      <button
        onClick={onToggle}
        className="
          w-full flex items-center gap-2 px-3 py-2.5
          bg-transparent border-none cursor-pointer text-left
          hover:bg-[var(--bg-elevated)] transition-colors duration-150
          focus-visible:outline-2 focus-visible:outline-blue-500
          focus-visible:outline-offset-[-2px]
        "
        aria-expanded={isExpanded}
        aria-label={`Advanced settings, ${isExpanded ? 'expanded' : 'collapsed'}`}
      >
        <span
          className={`text-[var(--accent-primary)] text-xs transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
          aria-hidden="true"
        >
          ▸
        </span>
        <span className="font-mono text-xs uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
          ADVANCED
        </span>
        <span className="font-mono text-[10px] text-[var(--text-tertiary)]">
          [3 opts]
        </span>
        {!isExpanded && (
          <span className="ml-auto font-mono text-[10px] text-[var(--text-tertiary)] truncate max-w-[110px]">
            clips: {saveAudioClips ? 'ON' : 'OFF'}
          </span>
        )}
      </button>

      {/* Collapsible content */}
      <div
        className={`
          overflow-hidden transition-all duration-200
          ${isExpanded ? 'max-h-[400px] opacity-100' : 'max-h-0 opacity-0'}
        `}
        style={{ transitionTimingFunction: 'var(--ease-out)' }}
        aria-hidden={!isExpanded}
      >
        <div className="px-3 pb-3 space-y-1 border-t border-[var(--border-default)] pt-3">

          {/* model_path */}
          <SettingRow label="model_path" saved={savedField === 'model_path'}>
            <div className="relative">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--accent-primary)] font-mono text-xs pointer-events-none">
                &gt;
              </span>
              <input
                type="text"
                value={modelPath}
                onChange={(e) => onModelPathChange(e.target.value)}
                placeholder="~/.cache/whisper/..."
                className={inputClass}
              />
            </div>
          </SettingRow>

          {/* refresh_cmd */}
          <SettingRow label="refresh_cmd" saved={savedField === 'refresh_cmd'}>
            <div className="relative">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--accent-primary)] font-mono text-xs pointer-events-none">
                $
              </span>
              <input
                type="text"
                value={refreshCommand}
                onChange={(e) => onRefreshCommandChange(e.target.value)}
                placeholder="killall -SIGUSR1 waybar"
                className={inputClass}
              />
            </div>
          </SettingRow>

          {/* save_clips toggle */}
          <SettingRow label="save_clips" saved={savedField === 'save_clips'}>
            <button
              onClick={onSaveAudioClipsToggle}
              role="switch"
              aria-checked={saveAudioClips}
              className={`
                flex items-center gap-1.5 px-2.5 py-1 border-2 font-mono text-xs
                transition-all duration-150
                focus-visible:outline-2 focus-visible:outline-blue-500 focus-visible:outline-offset-2
                ${saveAudioClips
                  ? 'border-blue-500/50 bg-blue-500/10 text-[var(--text-primary)]'
                  : 'border-[var(--border-default)] bg-[var(--bg-elevated)] text-[var(--text-secondary)]'
                }
              `}
            >
              <span className={`inline-block w-2 h-2 rounded-full ${saveAudioClips ? 'bg-green-400' : 'bg-[var(--text-tertiary)]'}`} />
              {saveAudioClips ? '[ON]' : '[OFF]'}
            </button>
          </SettingRow>

          {/* clips_path — only visible when save_clips is ON */}
          {saveAudioClips && (
            <SettingRow label="clips_path" saved={savedField === 'clips_path'}>
              <div className="relative">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--accent-primary)] font-mono text-xs pointer-events-none">
                  &gt;
                </span>
                <input
                  type="text"
                  value={audioClipsPath}
                  onChange={(e) => onAudioClipsPathChange(e.target.value)}
                  placeholder="~/mojovoice/clips"
                  className={inputClass}
                />
              </div>
            </SettingRow>
          )}
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add ui/src/components/settings/AdvancedPanel.tsx
git commit -m "feat: add AdvancedPanel collapsible with dashed border and summary"
```

---

### Task 5: Create `VocabTab` component

Full vocabulary workspace: term table with badges, add-term input, and a **vertical** correction editor ("when it hears:" → "it should write:") replacing the current cramped side-by-side layout.

**Files:**
- Create: `ui/src/components/settings/VocabTab.tsx`

**Step 1: Create the file**

```tsx
// ui/src/components/settings/VocabTab.tsx
import { X } from 'lucide-react';
import { Button } from '../ui/Button';

interface VocabTerm {
  id: number;
  term: string;
  useCount: number;
  source: string;
  addedAt: number;
}

interface VocabTabProps {
  vocabTerms: VocabTerm[];
  vocabLoading: boolean;
  newTerm: string;
  wrongTerm: string;
  rightTerm: string;
  onNewTermChange: (v: string) => void;
  onWrongTermChange: (v: string) => void;
  onRightTermChange: (v: string) => void;
  onVocabAdd: () => void;
  onVocabRemove: (term: string) => void;
  onVocabCorrect: () => void;
}

export default function VocabTab({
  vocabTerms,
  vocabLoading,
  newTerm,
  wrongTerm,
  rightTerm,
  onNewTermChange,
  onWrongTermChange,
  onRightTermChange,
  onVocabAdd,
  onVocabRemove,
  onVocabCorrect,
}: VocabTabProps) {
  const inputClass = `
    w-full px-3 py-2 bg-[var(--bg-surface)] border-2 border-[var(--border-default)]
    text-[var(--text-primary)] font-mono text-sm placeholder:text-[var(--text-tertiary)]
    focus:border-[var(--accent-primary)] focus:outline-none
    focus:shadow-[0_0_20px_rgba(59,130,246,0.3)] transition-all duration-150
  `;

  return (
    <div className="space-y-6">

      {/* ── TERMS ── */}
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.12em] text-[var(--text-tertiary)] mb-3">
          TERMS
          {vocabTerms.length > 0 && (
            <span className="ml-2 text-[var(--accent-primary)]">[{vocabTerms.length}]</span>
          )}
        </p>

        {vocabLoading ? (
          <p className="text-xs text-[var(--text-tertiary)] font-ui italic">Loading...</p>
        ) : vocabTerms.length === 0 ? (
          <div className="border-2 border-dashed border-[var(--border-default)] p-4 text-center">
            <p className="text-xs text-[var(--text-tertiary)] font-mono italic">no terms yet</p>
          </div>
        ) : (
          <div className="border-2 border-[var(--border-default)] divide-y divide-[var(--border-default)]">
            {vocabTerms.map((vocabTerm) => (
              <div
                key={vocabTerm.id}
                className="flex items-center gap-2 px-3 py-2 hover:bg-[var(--bg-elevated)] transition-colors duration-100"
              >
                <span className="flex-1 font-mono text-sm text-[var(--text-primary)] truncate">
                  {vocabTerm.term}
                </span>
                <span className="shrink-0 px-1.5 py-0.5 text-[10px] font-mono bg-blue-500/10 border border-blue-500/30 text-blue-400">
                  {vocabTerm.useCount}×
                </span>
                <span className={`shrink-0 px-1.5 py-0.5 text-[10px] font-mono border ${
                  vocabTerm.source === 'manual'
                    ? 'bg-green-500/10 border-green-500/30 text-green-400'
                    : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                }`}>
                  {vocabTerm.source}
                </span>
                <button
                  onClick={() => onVocabRemove(vocabTerm.term)}
                  className="shrink-0 p-1 text-[var(--text-tertiary)] hover:text-red-400 transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-blue-500"
                  aria-label={`Remove ${vocabTerm.term}`}
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add term input */}
        <div className="flex items-center gap-2 mt-2">
          <input
            type="text"
            value={newTerm}
            onChange={(e) => onNewTermChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onVocabAdd()}
            placeholder="Add a term..."
            className={inputClass}
          />
          <Button variant="primary" size="sm" onClick={onVocabAdd} disabled={!newTerm.trim()}>
            Add
          </Button>
        </div>
      </div>

      {/* ── CORRECTION — vertical flow ── */}
      <div className="border-t-2 border-[var(--border-default)] pt-6">
        <p className="font-mono text-xs uppercase tracking-[0.12em] text-[var(--text-tertiary)] mb-1">
          CORRECTION
        </p>
        <p className="text-xs text-[var(--text-tertiary)] font-ui mb-4">
          Teach the recognizer preferred spellings
        </p>

        <div className="space-y-1">
          {/* Wrong term */}
          <div>
            <label className="block font-mono text-[10px] text-[var(--text-tertiary)] uppercase tracking-wide mb-1">
              when it hears:
            </label>
            <input
              type="text"
              value={wrongTerm}
              onChange={(e) => onWrongTermChange(e.target.value)}
              placeholder="misspelling or wrong word..."
              className={inputClass}
            />
          </div>

          {/* Arrow visual */}
          <div className="flex items-center justify-center py-0.5" aria-hidden="true">
            <div className="flex flex-col items-center text-[var(--accent-primary)] font-mono text-sm leading-none select-none">
              <span>│</span>
              <span>▼</span>
            </div>
          </div>

          {/* Correct term */}
          <div>
            <label className="block font-mono text-[10px] text-[var(--text-tertiary)] uppercase tracking-wide mb-1">
              it should write:
            </label>
            <input
              type="text"
              value={rightTerm}
              onChange={(e) => onRightTermChange(e.target.value)}
              placeholder="correct spelling..."
              className={inputClass}
            />
          </div>

          <div className="flex justify-end pt-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={onVocabCorrect}
              disabled={!wrongTerm.trim() || !rightTerm.trim()}
            >
              [RECORD FIX]
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add ui/src/components/settings/VocabTab.tsx
git commit -m "feat: add VocabTab with vertical correction flow"
```

---

### Task 6: Create `SettingsConfigTab` component

Assembles the SETTINGS tab: ModelHeroCard → Recording key=value rows → BehaviorChip → AdvancedPanel → auto-save footer.

**Files:**
- Create: `ui/src/components/settings/SettingsConfigTab.tsx`

**Step 1: Create the file**

```tsx
// ui/src/components/settings/SettingsConfigTab.tsx
import ModelHeroCard from './ModelHeroCard';
import SettingRow from './SettingRow';
import BehaviorChip from './BehaviorChip';
import AdvancedPanel from './AdvancedPanel';

interface Config {
  model: { path: string; model_id: string; language: string; prompt: string | null };
  audio: {
    sample_rate: number;
    timeout_secs: number;
    save_audio_clips: boolean;
    audio_clips_path: string;
    device_name: string | null;
  };
  output: { display_server: string | null; append_space: boolean; refresh_command: string | null };
}

interface DownloadedModel {
  name: string;
  filename: string;
  path: string;
  sizeMb: number;
  isActive: boolean;
}

interface AudioDevice {
  name: string;
  is_default: boolean;
  internal_name: string | null;
}

interface SettingsConfigTabProps {
  config: Config;
  downloadedModels: DownloadedModel[];
  audioDevices: AudioDevice[];
  savedField: string | null;
  advancedExpanded: boolean;
  onModelChange: (path: string) => void;
  onLanguageChange: (language: string) => void;
  onTimeoutChange: (secs: number) => void;
  onAudioDeviceChange: (device: string) => void;
  onAppendSpaceToggle: () => void;
  onModelPathOverrideChange: (path: string) => void;
  onRefreshCommandChange: (command: string) => void;
  onSaveAudioClipsToggle: () => void;
  onAudioClipsPathChange: (path: string) => void;
  onAdvancedToggle: () => void;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  if (s === 0) return `${m}m`;
  return `${m}m ${s}s`;
}

export default function SettingsConfigTab({
  config,
  downloadedModels,
  audioDevices,
  savedField,
  advancedExpanded,
  onModelChange,
  onLanguageChange,
  onTimeoutChange,
  onAudioDeviceChange,
  onAppendSpaceToggle,
  onModelPathOverrideChange,
  onRefreshCommandChange,
  onSaveAudioClipsToggle,
  onAudioClipsPathChange,
  onAdvancedToggle,
}: SettingsConfigTabProps) {
  const selectClass = `
    w-full px-3 py-2 bg-[var(--bg-surface)] border-2 border-[var(--border-default)]
    text-[var(--text-primary)] font-mono text-xs
    focus:border-[var(--accent-primary)] focus:outline-none
    focus:shadow-[0_0_20px_rgba(59,130,246,0.3)] transition-all duration-150
  `;

  return (
    <div>
      {/* ── HERO: Active model + language ── */}
      <ModelHeroCard
        downloadedModels={downloadedModels}
        activeModelPath={config.model.path}
        language={config.model.language}
        savedModel={savedField === 'model'}
        savedLanguage={savedField === 'language'}
        onModelChange={onModelChange}
        onLanguageChange={onLanguageChange}
      />

      {/* ── RECORDING ── */}
      <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--text-tertiary)] pt-2 pb-1">
        RECORDING
      </p>

      {/* timeout_secs */}
      <SettingRow label="timeout_secs" saved={savedField === 'timeout'}>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min="10"
            max="300"
            value={config.audio.timeout_secs}
            onChange={(e) => onTimeoutChange(parseInt(e.target.value))}
            className="
              flex-1 h-1.5 rounded-sm appearance-none cursor-pointer
              [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4
              [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full
              [&::-webkit-slider-thumb]:bg-blue-500
              [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-[var(--bg-void)]
              [&::-webkit-slider-thumb]:shadow-[0_0_8px_rgba(59,130,246,0.6)]
              [&::-webkit-slider-thumb]:cursor-grab [&::-webkit-slider-thumb]:transition-all
              [&::-webkit-slider-thumb]:duration-150
              focus:outline-none
            "
            style={{
              background: `linear-gradient(to right,
                rgba(59,130,246,0.4) 0%,
                rgba(59,130,246,0.4) ${((config.audio.timeout_secs - 10) / (300 - 10)) * 100}%,
                rgba(51,65,85,0.4) ${((config.audio.timeout_secs - 10) / (300 - 10)) * 100}%,
                rgba(51,65,85,0.4) 100%)`
            }}
            aria-label="Recording max duration"
            aria-valuemin={10}
            aria-valuemax={300}
            aria-valuenow={config.audio.timeout_secs}
          />
          <span className="font-mono text-xs text-[var(--text-primary)] shrink-0 w-12 text-right">
            {formatDuration(config.audio.timeout_secs)}
          </span>
        </div>
      </SettingRow>

      {/* device */}
      <SettingRow label="device" saved={savedField === 'device'}>
        <select
          value={config.audio.device_name || ''}
          onChange={(e) => onAudioDeviceChange(e.target.value)}
          className={selectClass}
          aria-label="Audio input device"
        >
          <option value="">System Default</option>
          {audioDevices.map((d) => (
            <option key={d.internal_name || d.name} value={d.internal_name || d.name}>
              {d.name}{d.is_default ? ' (Default)' : ''}
            </option>
          ))}
        </select>
      </SettingRow>

      {/* ── OUTPUT ── */}
      <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--text-tertiary)] pt-3 pb-1">
        OUTPUT
      </p>

      <BehaviorChip
        label="append_space"
        value={config.output.append_space}
        saved={savedField === 'append_space'}
        onToggle={onAppendSpaceToggle}
      />

      {/* ── ADVANCED collapsible ── */}
      <AdvancedPanel
        isExpanded={advancedExpanded}
        onToggle={onAdvancedToggle}
        modelPath={config.model.path}
        refreshCommand={config.output.refresh_command || ''}
        saveAudioClips={config.audio.save_audio_clips}
        audioClipsPath={config.audio.audio_clips_path}
        savedField={savedField}
        onModelPathChange={onModelPathOverrideChange}
        onRefreshCommandChange={onRefreshCommandChange}
        onSaveAudioClipsToggle={onSaveAudioClipsToggle}
        onAudioClipsPathChange={onAudioClipsPathChange}
      />

      {/* Auto-save confirmation */}
      <p className="pt-5 font-mono text-[10px] text-[var(--text-tertiary)] text-center">
        ● changes saved automatically
      </p>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add ui/src/components/settings/SettingsConfigTab.tsx
git commit -m "feat: add SettingsConfigTab assembled settings panel"
```

---

### Task 7: Refactor `SettingsPanel.tsx`

Replace the current UI with the two-tab layout. Remove `originalConfig`, `saving`, `saveSuccess`. Add `activeTab`, `savedField`, and `flashSaved`. Wire both tab components. Add `flashSaved(field)` call to every handler.

**Files:**
- Modify: `ui/src/components/SettingsPanel.tsx`

**Step 1: Update the imports and remove unused ones**

Remove `Button` import (no Save/Reset buttons needed).
Add imports for the new sub-components and remove `LANGUAGE_OPTIONS` constant (it moved to `ModelHeroCard.tsx`).

New imports section:
```tsx
import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useToast } from './ui/Toast';
import { invoke } from '../lib/ipc';
import SettingsConfigTab from './settings/SettingsConfigTab';
import VocabTab from './settings/VocabTab';
```

**Step 2: Update state — remove Save/Reset, add tabs + flashSaved**

Remove these state variables:
```tsx
// DELETE these:
const [originalConfig, setOriginalConfig] = useState<Config | null>(null);
const [saving, setSaving] = useState(false);
const [saveSuccess, setSaveSuccess] = useState(false);
```

Add these:
```tsx
const [activeTab, setActiveTab] = useState<'settings' | 'vocab'>('settings');
const [savedField, setSavedField] = useState<string | null>(null);

const flashSaved = (field: string) => {
  setSavedField(field);
  setTimeout(() => setSavedField(null), 1500);
};
```

Also remove this line from `loadSettings`:
```tsx
// DELETE:
setOriginalConfig(JSON.parse(JSON.stringify(cfg)));
```

**Step 3: Add `flashSaved` calls to every handler**

`handleModelChange` — add `flashSaved('model')` after `setDownloadedModels(models)`:
```tsx
const handleModelChange = async (path: string) => {
  if (!config) return;
  try {
    const pathParts = path.split('/');
    const filename = pathParts[pathParts.length - 1];
    await invoke('switch_model', { filename });
    const updatedConfig = await invoke<Config>('get_config');
    setConfig(updatedConfig);
    const models = await invoke<DownloadedModel[]>('list_downloaded_models');
    setDownloadedModels(models);
    flashSaved('model');
  } catch (error) {
    console.error('Failed to switch model:', error);
  }
};
```

For all other handlers, add `flashSaved('<key>')` as the last line before `} catch`:

| Handler | Field key |
|---|---|
| `handleLanguageChange` | `'language'` |
| `handleTimeoutChange` | `'timeout'` |
| `handleAudioDeviceChange` | `'device'` |
| `handleAppendSpaceToggle` | `'append_space'` |
| `handleModelPathOverrideChange` | `'model_path'` |
| `handleRefreshCommandChange` | `'refresh_cmd'` |
| `handleSaveAudioClipsToggle` | `'save_clips'` |
| `handleAudioClipsPathChange` | `'clips_path'` |

**Step 4: Delete `handleSaveChanges`, `handleReset`, and `formatDurationPreview`**

These functions are no longer used. Delete them entirely.

**Step 5: Replace the return statement**

Replace everything from `if (loading || !config)` to the end of the file with:

```tsx
if (loading || !config) {
  return (
    <div className="text-center py-12">
      <p className="text-sm text-[var(--text-secondary)] font-ui">Loading settings...</p>
    </div>
  );
}

return (
  <div>
    {/* Two-tab bar */}
    <div className="flex mb-6" role="tablist" aria-label="Settings sections">
      {(['settings', 'vocab'] as const).map((tab, i) => (
        <button
          key={tab}
          id={`tab-${tab}`}
          role="tab"
          aria-selected={activeTab === tab}
          aria-controls={`tabpanel-${tab}`}
          onClick={() => setActiveTab(tab)}
          className={`
            flex-1 px-4 py-2.5 font-mono text-xs uppercase tracking-[0.12em]
            border-2 border-black transition-all duration-150
            ${i > 0 ? 'border-l-0' : ''}
            focus-visible:outline-2 focus-visible:outline-blue-500
            focus-visible:outline-offset-[-2px]
            ${activeTab === tab
              ? 'bg-[var(--accent-primary)] text-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]'
              : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }
          `}
        >
          {tab === 'settings'
            ? '[SETTINGS]'
            : `[VOCAB${vocabTerms.length > 0 ? ` ${vocabTerms.length}` : ''}]`
          }
        </button>
      ))}
    </div>

    {/* SETTINGS tab panel */}
    <div
      id="tabpanel-settings"
      role="tabpanel"
      aria-labelledby="tab-settings"
      hidden={activeTab !== 'settings'}
    >
      {activeTab === 'settings' && (
        <SettingsConfigTab
          config={config}
          downloadedModels={downloadedModels}
          audioDevices={audioDevices}
          savedField={savedField}
          advancedExpanded={advancedExpanded}
          onModelChange={handleModelChange}
          onLanguageChange={handleLanguageChange}
          onTimeoutChange={handleTimeoutChange}
          onAudioDeviceChange={handleAudioDeviceChange}
          onAppendSpaceToggle={handleAppendSpaceToggle}
          onModelPathOverrideChange={handleModelPathOverrideChange}
          onRefreshCommandChange={handleRefreshCommandChange}
          onSaveAudioClipsToggle={handleSaveAudioClipsToggle}
          onAudioClipsPathChange={handleAudioClipsPathChange}
          onAdvancedToggle={toggleAdvancedSection}
        />
      )}
    </div>

    {/* VOCAB tab panel */}
    <div
      id="tabpanel-vocab"
      role="tabpanel"
      aria-labelledby="tab-vocab"
      hidden={activeTab !== 'vocab'}
    >
      {activeTab === 'vocab' && (
        <VocabTab
          vocabTerms={vocabTerms}
          vocabLoading={vocabLoading}
          newTerm={newTerm}
          wrongTerm={wrongTerm}
          rightTerm={rightTerm}
          onNewTermChange={setNewTerm}
          onWrongTermChange={setWrongTerm}
          onRightTermChange={setRightTerm}
          onVocabAdd={handleVocabAdd}
          onVocabRemove={handleVocabRemove}
          onVocabCorrect={handleVocabCorrect}
        />
      )}
    </div>
  </div>
);
```

**Step 6: Build check**

Run: `cd ui && npm run build 2>&1 | tail -30`
Expected: Exit 0, no TypeScript errors.

Common errors to fix:
- `LANGUAGE_OPTIONS not defined` → it was removed; it's now in `ModelHeroCard.tsx` ✓
- `Button is not used` → remove import ✓
- `originalConfig` referenced somewhere → remove all references ✓
- `handleSaveChanges`/`handleReset` referenced somewhere → remove ✓

**Step 7: Commit**

```bash
git add ui/src/components/SettingsPanel.tsx
git commit -m "feat: refactor SettingsPanel to two-tab layout, remove Save/Reset"
```

---

### Task 8: Visual Verification

Start the dev server and confirm the redesign looks correct.

**Step 1: Start dev server**

Run in background: `cd ui && npm run dev`
Wait for: `VITE ready` in output (usually ~2s)

**Step 2: Open browser, take screenshots**

Using Playwright MCP:
1. Navigate to `http://localhost:1420`
2. Click the settings gear icon (top right of main view)
3. Screenshot the drawer: `docs/tmp/settings-tab-settings.png`
4. Click `[VOCAB N]` tab
5. Screenshot: `docs/tmp/settings-tab-vocab.png`
6. Switch back to `[SETTINGS]`, click the ADVANCED `▸` arrow to expand
7. Screenshot: `docs/tmp/settings-advanced-open.png`

**Step 3: Visual checklist**

Check each screenshot:
- [ ] Tab bar: two buttons with thick black border, active tab solid blue with brutal shadow
- [ ] Hero card: 3px blue border, `[ACTIVE]` badge, model name + size visible, two selects below
- [ ] Settings rows: `key = [value]` alignment, monospace labels, slider is compact
- [ ] `append_space` shows as an inline chip, not a section
- [ ] ADVANCED: dashed border, `[3 opts]` label, `clips: OFF` summary in collapsed state
- [ ] VOCAB tab: term list table with badges, add-term input, vertical correction editor with `when it hears:` / `it should write:` labels and `│ ▼` arrow between them
- [ ] No "Save Changes" or "Reset" buttons anywhere
- [ ] `● changes saved automatically` footer visible at bottom of SETTINGS tab

**Step 4: Kill dev server**

```bash
kill $(lsof -ti:1420) 2>/dev/null || true
```

**Step 5: Final commit**

```bash
git add -A
git commit -m "feat: settings panel redesign complete — neural stack + vocab split"
```

---

## Summary of Changes

| File | Action | Why |
|---|---|---|
| `SettingsPanel.tsx` | Refactored | State only, two-tab UI, no Save/Reset |
| `settings/SettingRow.tsx` | Created | Reusable key=value row |
| `settings/BehaviorChip.tsx` | Created | Compact toggle (replaces full section) |
| `settings/ModelHeroCard.tsx` | Created | Dominant hero card for active model |
| `settings/AdvancedPanel.tsx` | Created | Collapsible with dashed border + summary |
| `settings/VocabTab.tsx` | Created | Full vocabulary workspace |
| `settings/SettingsConfigTab.tsx` | Created | Assembled SETTINGS tab |
