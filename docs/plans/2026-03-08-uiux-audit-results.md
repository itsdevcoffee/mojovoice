# mojovoice UI/UX Audit — v0.6.9 Launch Readiness
**Date:** 2026-03-08
**Auditor:** Claude Code subagent
**Files reviewed:** 26 source files across UI components, hooks, stores, and styles

---

## Summary

The mojovoice UI is architecturally sound and implements a coherent "Cyberpunk Terminal" aesthetic with strong component decomposition. However, there are three categories of critical launch blockers: (1) the RecordingHero component is wired to a fixed 5-second test recording instead of real hotkey-driven dictation, (2) no first-run wizard exists at all, and (3) the Model Manager is missing the old spec's 5-dot quality/speed indicators and language badges. The codebase is in a "wired for mock" state — most IPC calls exist and route to real Tauri commands, but the StatusBar maintains its own local polling state separate from the global appStore, and several design-system violations (legacy CSS classes, missing `aria-label`s on sliders, no `prefers-reduced-motion` guard on inline `animate-pulse`) need remediation before launch.

---

## Critical Gaps (P0 — must fix before launch)

| # | Component | Gap | Effort |
|---|-----------|-----|--------|
| 1 | `RecordingHero` | Records for a hardcoded 5-second timeout then calls `stop_recording` — cannot function as real dictation UI. Real flow: press hotkey → daemon records to VAD silence → text appears at cursor. The RecordingHero is purely a "TEST MIC" debug widget, not a production recording control | L |
| 2 | (entire UI) | No first-run wizard exists. Zero screens: no hardware detection, no model recommendation, no guided download, no test-before-exit. A new user who installs mojovoice has no path to a working setup other than reading docs | L |
| 3 | `StatusBar` | Duplicates daemon status polling into its own local `useState` (5-second interval) instead of reading from `appStore.daemonStatus`. App.tsx polls every 2 seconds into the store; StatusBar polls again every 5 seconds independently. Two polling loops, out of sync, different field names (`modelLoaded` vs `model_loaded`, `gpuEnabled` vs `gpu_enabled`) | M |
| 4 | `ModelsPanel` | After a download completes or is cancelled, the model list is NOT refreshed from the backend. `startDownload` just fires the invoke; the model's `is_downloaded` flag remains stale. User sees "Download" button again immediately after completing a download | M |
| 5 | `CommandPalette` | "Clear History" executes immediately with no confirmation dialog — one misclick destroys all transcription history with no undo | S |
| 6 | `useTranscriptionActions` | Undo delete is broken: the `action.onClick` for Undo calls `loadHistory(reloadLimit, 0)` but never re-inserts the deleted entry into the backend. `deleteHistoryEntry` in appStore calls `invoke('delete_history_entry', { id })` which persists the delete — the "undo" just reloads whatever is in the DB (already gone). The optimistic removal + undo pattern is incomplete | M |

---

## High Priority (P1 — should fix before launch)

| # | Component | Gap | Effort |
|---|-----------|-----|--------|
| 7 | `ModelsPanel` | Missing 5-dot visual speed/quality indicators per model card (spec requirement). Currently shows only name + size. The CSS classes `.visual-meter`, `.visual-meter-dots`, `.visual-meter-dot-quality`, `.visual-meter-dot-speed` are defined in globals.css but never used | M |
| 8 | `ModelsPanel` | Missing language badges (Multilingual teal / EN Only amber). CSS classes `.language-badge`, `.language-badge-multilingual`, `.language-badge-english` are defined but unused | S |
| 9 | `ModelsPanel` | No "Switch Active Model" flow from within the Models panel. The only model-switch path is Settings → ModelHeroCard dropdown. The Models panel shows which model is active (`is_active` badge) but provides no way to switch to a different downloaded model | M |
| 10 | `StatusBar` | Model dropdown button has `focus:outline-none` with no `focus-visible` replacement — keyboard users get no visible focus indicator on the most prominent interactive element in the dashboard | S |
| 11 | `RecordingHero` | No waveform or audio level visualization during recording. The style guide calls for a "scanning line" loading pattern during processing. Currently the only feedback during recording is a small pulsing green dot and a disabled button | M |
| 12 | `TranscriptionCard` | The style guide (v1.1.0) specifies a metadata footer showing latency ms, confidence %, and model name (`⚡ 1250ms  ✓ 94.5%  large-v3-turbo`). Currently only model name is shown; latency and confidence are absent. The mock data in `ipc.ts` provides `latencyMs` and `confidenceScore` fields but `TranscriptionEntry` interface and component don't surface them | M |
| 13 | `MissionControl` | Space bar shortcut to start/stop recording (listed in style guide keyboard table) is not implemented. The keyboard handler in MissionControl only handles Escape, Cmd+K, Cmd+,, Cmd+H, Cmd+C | S |
| 14 | `HistoryView` | Export-to-JSON uses browser `URL.createObjectURL` + synthetic `<a>` click. Inside Tauri this works in the webview but the file goes to the OS default download folder silently. In Tauri v2 a file save dialog (`dialog::save`) is the correct pattern and gives users control over destination | M |
| 15 | `SettingsPanel` | Loading state displays only "Loading settings..." plain text with no spinner or scan-line animation — inconsistent with the design system's loading patterns | S |
| 16 | `Drawer` | Missing `aria-labelledby="drawer-title"` target — `drawer-title` is declared on the `aria-labelledby` prop but no element has `id="drawer-title"` inside the drawer children (`SettingsPanel` has no visible `<h2>` or title element) | S |

---

## Medium Priority (P2 — nice to have)

| # | Component | Gap | Effort |
|---|-----------|-----|--------|
| 17 | `ModelsPanel` | `max-h-[800px]` hard cap on the collapsible container — if more models are added, content will clip silently. Should be `max-h-none` or a dynamic value | S |
| 18 | `CustomSelect` | No keyboard navigation within the open listbox (arrow keys, Home, End). The style guide spec explicitly requires keyboard navigation. Clicking opens the list; tabbing away doesn't close it; pressing arrow keys does nothing | M |
| 19 | `CustomSelect` | Missing `aria-activedescendant` on trigger button — screen readers cannot announce the focused option while navigating | S |
| 20 | `StatusBar` | The model dropdown (`isModelDropdownOpen`) has no keyboard close on Escape. Clicking backdrop closes it, but keyboard-only users are trapped until they tab away | S |
| 21 | `SystemStatus` | Collapsed by default (`isExpanded` starts `false` unless localStorage has a saved state). This is the least discoverable panel in the UI. First-time users won't see daemon control buttons (Start/Stop/Restart) | S |
| 22 | `HistoryView` | Hard-coded `loadHistory(1000, 0)` on mount — loads up to 1000 entries at once with no pagination. Users with large history will experience long initial loads and full DOM rendering of all cards | L |
| 23 | `MissionControl` | `max-h-[2000px]` on the transcriptions collapsible — animates height via `max-height` which is a reflow-triggering property. Style guide says "DON'T: animate `width`, `height`, `top`, `left`". Should use `grid-rows` trick or `auto` with a ResizeObserver | M |
| 24 | `TranscriptionCard` | The 📝 emoji icon is not design-system compliant. Style guide mandates monospace technical symbols (terminal prompt `▸`, status dot `●`). Emoji rendering is platform-dependent and breaks the cyberpunk terminal aesthetic | S |
| 25 | `CommandPalette` | `handleClearHistory` calls `invoke('clear_history')` directly but does not update the `appStore` historyEntries. After clearing via command palette, the dashboard's recent transcriptions list remains populated until next loadHistory call | S |
| 26 | `HistoryView` | The export does not include latency or confidence data even though those fields exist in mock data. The export schema loses precision | S |
| 27 | `SettingsConfigTab` | The timeout slider is missing the "dual input" pattern from the style guide spec: there is no companion number input for precision entry. User can only drag the slider, not type a specific value | M |
| 28 | `globals.css` | `.model-card-active` uses `rgba(16, 185, 129, 0.4)` (emerald green) for border and glow. Style guide explicitly says "DON'T: Use emerald green (old brand color - replaced)". This is dead CSS that will cause confusion if referenced | S |
| 29 | `globals.css` | `.btn-primary`, `.glass-card`, `.glass-panel`, `.glass-button`, `.glass-input`, `.model-card` are legacy CSS classes from the old design. They use `hsl(var(--primary))` which maps to `#3B82F6` correctly, but they also use `border-radius: 6px` and `transform: scale(1.02)` hover — both violate neubrutalist sharp-corners and brutal-shadow-shift principles. These classes appear to be dead code (not used by any audited component) but their presence could mislead future development | S |

---

## Design System Compliance Issues

### RecordingHero
- Uses `Button` component (correct) but the button itself is a small "TEST MIC" control, not the prominent full-width pulsing ring hero described in the style guide v1.1.0 update. The `animate-pulse-ring` CSS class exists in globals.css but is not used anywhere in RecordingHero
- The recording indicator dot uses `animate-pulse` (Tailwind built-in) not the branded `animate-pulse-ring` keyframe

### TranscriptionCard
- Contains a 📝 emoji which is not design-system compliant (platform-dependent rendering, breaks terminal aesthetic)
- Action buttons (Copy/Delete) correctly implement the brutal shadow shift animation — this is done right
- Uses `surface-texture` class — correct per style guide

### StatusBar
- The model dropdown button uses `border` (1px) not `border-2` (2px) — violates the neubrutalist thick-border standard
- `focus:border-[var(--accent-primary)]` without `focus-visible:` — applies glow on mouse click, exposes the border flash to mouse users (should be `focus-visible:` only per style guide)
- Language and Microphone labels use `font-ui` for the label but `font-mono` for the value — correct per spec

### AdvancedPanel
- The `save_clips` toggle uses a custom button with `role="switch"` instead of a proper iOS-style liquid morph switch. The style guide describes the liquid morph toggle with elastic easing — this is a plain button with a colored dot indicator. Inconsistent with how the style guide defines toggle switches

### globals.css — Stale CSS
- `hsl(var(--primary))` in `.btn-primary` hover glow renders as `rgba(20, 184, 166, 0.3)` — this is teal, the OLD brand color. The variable mapping `--primary: var(--accent-primary)` correctly resolves to `#3B82F6` but the `.glow-primary` class uses hardcoded `rgba(20, 184, 166, 0.3)` (teal). This is a stale reference to the pre-refactor brand color
- `.filter-pill`, `.filter-pill-active` use `border-radius: 9999px` (pill shape) which violates sharp-corners neubrutalist principle
- `.language-badge` uses `border-radius: 9999px` — same issue

### Button Component
- Fully compliant: brutal shadow shift, black border, 150ms transitions, uppercase tracking, focus-visible electric glow. No violations found

### Card Component
- `will-change-auto` is not a valid CSS value (correct values are `auto`, `scroll-position`, `contents`, `transform`, `opacity`). `will-change-auto` is equivalent to `will-change: auto` — harmless but misleading

### Drawer
- Correctly implements focus trap, Escape close, scroll lock, and entry/exit animations. One issue: the close button uses `rounded` class which implies `border-radius` — neubrutalist standard requires sharp corners

### Toast
- Fully compliant with design system. Brutal shadow, correct colors, keyboard dismissal. No violations found

---

## Mock Data / Stub Inventory

The following components render from mock data in browser dev mode (via `ipc.ts` getMockData). These are NOT bugs — the mock system is intentional for browser development. However, each represents a wiring surface that must be validated end-to-end before launch.

| Component / Hook | Mock Command | Mock Data Notes |
|-----------------|--------------|-----------------|
| `StatusBar` | `get_daemon_status` | Returns `running: false` — real field name is `running` (matches DaemonStatus in StatusBar) but appStore uses camelCase `modelLoaded`/`gpuEnabled` while raw IPC returns snake_case. The `setDaemonStatus` in appStore casts with `as any` — brittle |
| `StatusBar` | `get_config` | Mock uses `model.modelId` but the Config interface in SettingsPanel uses `model.model_id`. Field name mismatch between StatusBar's local AppConfig interface and SettingsPanel's Config interface |
| `StatusBar` | `list_downloaded_models` | Mock returns `sizeMb` field. SettingsPanel also uses `sizeMb`. Consistent |
| `SystemStatus` | `get_system_info` | Mock returns all fields including `gpu_vram_mb: null`. Real backend must implement `get_system_info` Tauri command |
| `SystemStatus` | `get_daemon_status` | Uses snake_case (`model_loaded`, `gpu_enabled`) — different from appStore's camelCase DaemonStatus interface. SystemStatus has its own local DaemonStatus interface |
| `ModelsPanel` | `list_available_models` | Mock returns 5 models with `size_bytes`, `is_downloaded`, `is_active`. This is a different shape from `list_downloaded_models` (which uses `sizeMb`, `isActive`). Two separate IPC commands for two separate use cases — correct |
| `ModelsPanel` | `get_storage_info` | Mock returns `available_gb`, `total_gb`, `models_size_gb` |
| `SettingsPanel` | `get_config` | Mock uses `model.prompt_biasing` but SettingsPanel.Config interface uses `model.prompt`. Field name differs between mock and type interface |
| `SettingsPanel` | `list_downloaded_models` | Same as StatusBar mock |
| `SettingsPanel` | `list_audio_devices` | Mock returns `{ name, isDefault }` but AudioDevice interface also includes `internalName: string | null`. Mock is missing `internalName` |
| `CommandPalette` | `list_downloaded_models` | Same mock |
| `appStore.loadHistory` | `get_transcription_history` | Mock returns entries with `latencyMs` and `confidenceScore` but TranscriptionEntry interface in appStore does NOT include these fields. Data is silently dropped |
| `RecordingHero` | `start_recording` / `stop_recording` | Mock returns `{ success: true }` for start, but `stop_recording` should return the transcribed text string. Mock returns `{ success: true }` for stop_recording — the RecordingHero expects `invoke<string>('stop_recording')` which would receive `{ success: true }` object, not a string |

---

## Accessibility Issues

| # | Component | Issue | Severity |
|---|-----------|-------|----------|
| 1 | `SettingsConfigTab` (timeout slider) | `<input type="range">` has `aria-label="Recording max duration"` but is missing `aria-valuetext` to describe the formatted value ("2m 30s"). Screen readers will announce raw numbers (150) not the formatted label | Medium |
| 2 | `StatusBar` (model dropdown) | Trigger button missing `aria-label` — the visible text is the current model name which is meaningful, but the button has no accessible name when the model name is truncated | Low |
| 3 | `StatusBar` (model dropdown) | Open dropdown list items are plain `<button>` elements not `role="option"` inside a `role="listbox"` — the CustomSelect gets this right with proper listbox semantics, but StatusBar's inline dropdown does not | Medium |
| 4 | `StatusMicroIndicators` (StatusPip) | Each pip is a `<button>` inside a `<div>` with both `onMouseEnter/Leave` on the div and `onFocus/Blur` on the div. The tooltip has `role="tooltip"` but there is no `aria-describedby` on the button pointing to the tooltip id | Low |
| 5 | `TranscriptionCard` | The expand/collapse `<div>` uses `role="button"` and `tabIndex={0}` — should be a proper `<button>` element. `role="button"` on a div requires manually handling all keyboard events that `<button>` gets for free | Medium |
| 6 | `CustomSelect` (open listbox) | No `aria-activedescendant` tracking. No keyboard navigation (arrow keys do nothing inside the open list). Users must tab to items | High |
| 7 | `HistoryView` (filter radio groups) | Buttons with `role="radio"` and `aria-checked` correctly. However they are plain `<button>` elements — `role="radio"` on a button requires the parent `role="radiogroup"` which IS present — technically correct but non-standard | Low |
| 8 | `Drawer` | `aria-labelledby="drawer-title"` references a non-existent element ID. No element in the drawer has `id="drawer-title"` | Medium |
| 9 | `RecordingHero` | During recording, only a small `aria-hidden` dot provides visual feedback. The recording state change is announced via button text ("RECORDING...") which is inside a loading spinner that says "Loading" not "Recording". Screen reader users hear "Loading" instead of the recording state | High |
| 10 | `MissionControl` | Footer text "Press hotkey to start recording" gives no information about WHAT the hotkey is. No keyboard shortcut reference visible to the user (the Cmd+, title tooltip on the settings button is the only hotkey hint visible) | Medium |
| 11 | `globals.css` | The blanket `animation-duration: 0.01ms` for `prefers-reduced-motion` is correct in principle but completely kills ALL transitions including focus rings and toast enter/exit which may confuse users who rely on reduced motion for focus tracking (the focus ring glow is also a transition) | Low |

---

## What's Working Well

**Architecture & Code Quality:**
- MissionControl is a clean 252-line orchestrator with all heavy panels lazy-loaded — excellent code splitting
- The `useModelDownload` hook correctly uses Tauri event listeners (`listen('download-progress')`) for real-time progress, with proper cleanup on unmount and memory-safe timeout tracking
- `useTranscriptionActions` correctly uses an undo-aware toast pattern with optimistic UI updates
- The `invoke` wrapper in `ipc.ts` automatically logs all IPC calls to the appStore for devtools visibility — excellent DX
- `Drawer` has a complete focus trap implementation with Tab/Shift+Tab cycling, scroll lock, and focus restoration on close

**Design System Adherence (where applied):**
- `Button` component is a textbook implementation of the brutal shadow animation spec (4px → 6px → 2px, hover translate)
- `Toast` component fully complies: brutal shadow, correct semantic colors, countdown fuse bar for undo toasts, aria-live regions
- `StatusMicroIndicators` correctly reads from appStore and shows SYS/GPU pips with tooltips
- `VocabTab` is clean, accessible, and uses the correct font system throughout
- Section headers (`▸ TITLE ━━━━━`) pattern is consistently implemented via `SectionHeader` component
- `HistoryView` search/filter UI is functional and uses correct design system patterns (filter buttons as radio groups, date/word-count filter chips)
- `globals.css` correctly implements `@media (prefers-reduced-motion: reduce)` with specific overrides for each animation class
- Design tokens in `:root` are complete and correct — all Electric Night palette values match the style guide spec exactly
- `surface-texture` CSS class is correctly implemented and used on Cards, ModelsPanel, SystemStatus

**Navigation:**
- Cmd+K (command palette), Cmd+, (settings), Cmd+H (history), Cmd+C (copy last), Escape (dismiss topmost) all implemented
- Back-to-dashboard nav from Models and History sub-views works correctly
- Command palette loads real downloaded models via IPC and supports model switching and history actions

---

## Appendix: Interface Mismatches Between Components

These are silent data-loss or incorrect-data bugs caused by inconsistent type definitions:

1. **DaemonStatus field naming:** appStore uses `{ running, modelLoaded, gpuEnabled, gpuName }` (camelCase). SystemStatus uses `{ running, model_loaded, gpu_enabled, gpu_name, uptime_secs }` (snake_case). StatusBar uses `{ running, modelLoaded, gpuEnabled, gpuName, uptimeSecs }` (camelCase but different from SystemStatus). The `setDaemonStatus` cast is `as any` in App.tsx — no type safety.

2. **TranscriptionEntry missing fields:** `latencyMs` and `confidenceScore` exist in mock data and the style guide says to show them in TranscriptionCard's metadata footer, but they are not in the TypeScript interface in appStore or TranscriptionCard. These are silently dropped.

3. **Config field `prompt` vs `prompt_biasing`:** SettingsPanel.Config defines `model.prompt: string | null` but the IPC mock returns `model.prompt_biasing`. Whichever field the real Rust backend uses, there is a mismatch.

4. **`stop_recording` return type:** RecordingHero calls `invoke<string>('stop_recording')` expecting a string transcription. The mock returns `{ success: true }`. If the real backend returns the same shape as the mock, the transcription will display `[object Object]`.
