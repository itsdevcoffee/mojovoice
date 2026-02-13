# Industrial Terminal Redesign - Handoff

**Date:** 2026-02-13
**Branch:** `gemini-ui-overhaul-v0.6.0/attempt-1`
**Status:** Complete

---

## Summary

Evolved the MojoVoice UI from a 1413-line monolith (`MissionControl.tsx`) into a decomposed, feature-rich "Industrial Terminal" interface. Added command palette, metadata-rich transcription cards, status micro-indicators, and recording hero with pulsing animation. All work preserves the Electric Night neubrutalist aesthetic.

## What Changed

### New Files (6)
| File | Purpose |
|------|---------|
| `ui/src/components/SettingsPanel.tsx` | Extracted settings form (~780 lines from MissionControl) |
| `ui/src/components/HistoryModal.tsx` | Extracted history modal with search/filter/export/clear |
| `ui/src/components/CommandPalette.tsx` | Cmd+K command bar using cmdk v1.1.1 |
| `ui/src/components/ui/RecordingHero.tsx` | Recording button with pulsing ring animation |
| `ui/src/components/ui/StatusMicroIndicators.tsx` | Header SYS/GPU colored pips |
| `docs/handoff/2026-02-13-industrial-terminal-redesign.md` | This file |

### Modified Files (7)
| File | Changes |
|------|---------|
| `ui/src/components/MissionControl.tsx` | Decomposed from 1413 to ~205 lines (thin orchestrator) |
| `ui/src/components/ui/TranscriptionCard.tsx` | Added metadata footer (latency, confidence, model) |
| `ui/src/components/ui/Card.tsx` | Added hover lift effect with brutal shadow |
| `ui/src/components/ui/SystemStatus.tsx` | Simplified to Memory + Uptime only |
| `ui/src/stores/appStore.ts` | Extended TranscriptionEntry with latencyMs, confidenceScore |
| `ui/src/lib/ipc.ts` | Extended mock data, fixed pre-existing TS error |
| `ui/src/styles/globals.css` | New tokens, scan-line texture, pulse-ring animation |

### Deleted Files (8)
Dead components (all were commented out in App.tsx):
- Dashboard.tsx, Settings.tsx, Navigation.tsx, TranscriptionHistory.tsx
- RestartBanner.tsx, ModelManagement.tsx, DevTools.tsx, PathInput.tsx

## Architecture

```
MissionControl.tsx (orchestrator, ~205 lines)
├── RecordingHero          ← Self-contained recording with state
├── StatusBar              ← Existing status display
├── StatusMicroIndicators  ← New header pips (SYS/GPU)
├── TranscriptionCard[]    ← Enhanced with metadata footer
├── SystemStatus           ← Simplified (Memory + Uptime)
├── SettingsPanel (lazy)   ← Full settings in Drawer
├── HistoryModal (lazy)    ← Searchable history in Modal
└── CommandPalette (lazy)  ← cmdk command bar
```

All extracted components are lazy-loaded with `React.lazy()` + `Suspense` for code splitting.

## Keyboard Shortcuts

| Shortcut | Action | Notes |
|----------|--------|-------|
| Space | Start/stop recording | Unchanged |
| Cmd/Ctrl+K | Open command palette | **Reassigned** (was: search history) |
| Cmd/Ctrl+H | Open history modal | Unchanged |
| Cmd/Ctrl+, | Open settings drawer | Unchanged |
| Cmd/Ctrl+C | Copy last transcription | Only when not in input field |
| Escape | Close topmost overlay | Priority: palette > history > settings |

## Design Tokens Added

```css
--glow-inner-blue: inset 0 0 12px rgba(59, 130, 246, 0.1);
--shadow-brutal-lift: 8px 8px 0px 0px rgba(0, 0, 0, 1);
```

New CSS classes: `.surface-texture`, `.animate-pulse-ring`

## Bugs Fixed During Implementation

1. **Pre-existing TS error in ipc.ts:** `getMockData` didn't accept `args` parameter but referenced it in switch cases
2. **Mock data shape mismatch:** `list_downloaded_models` returned wrong shape, causing "undefined MB" in command palette
3. **cmdk Radix warnings:** Refactored from `Command.Dialog` to plain `Command` with custom overlay to avoid DialogTitle/Description warnings

## Verification

- `npx tsc --noEmit` passes
- `npm run build` produces proper code-split chunks
- Browser dev mode renders all states correctly
- Screenshots captured in `docs/tmp/`: idle-state, card-hover, command-palette, settings-drawer, history-modal
- All keyboard shortcuts functional
- Accessibility: aria-labels, focus management, reduced-motion, role="dialog"

## Known Limitations

- RecordingHero pulsing animation is CSS-only (not reactive to actual microphone input volume)
- Command palette model list comes from `list_downloaded_models` IPC (requires downloaded models)
- StatusMicroIndicators read from Zustand store (daemon must be polled for real status)
