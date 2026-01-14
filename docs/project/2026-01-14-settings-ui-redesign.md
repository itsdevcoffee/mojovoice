# Settings UI Redesign

**Date:** 2026-01-14
**Status:** Planning
**Depends On:** Model Management UI

---

## Current State Critique

### Issue 1: Disconnected Model Configuration

**Problem:** Model ID dropdown and Model Path are unrelated

```
Current Flow:
1. User selects "Large V3 Turbo" from dropdown
2. User must still manually provide path to model file
3. Unclear which takes precedence
4. No way to download selected model
```

**User confusion:** "I picked Large V3 Turbo, why do I need a path?"

### Issue 2: Mixed Abstraction Levels

| Setting | Complexity | Target User |
|---------|------------|-------------|
| Recording Timeout | Simple slider | Everyone |
| Append Space | Toggle | Everyone |
| Model Path | File browser | Power users |
| Status Bar Refresh | Shell command | Linux power users |
| Technical Vocabulary | Prompt engineering | Developers |

All shown equally → overwhelming for casual users, cluttered for power users.

### Issue 3: Flat Structure

All 4 sections visible simultaneously:
- Model Configuration (4 settings)
- Audio Configuration (3 settings)
- Output Configuration (2 settings)
- Appearance (3 settings)

**Total:** 12 settings on one scrolling page with no hierarchy.

### Issue 4: Poor Groupings

| Current Section | Setting | Better Home |
|-----------------|---------|-------------|
| Model Config | Language | Voice Recognition |
| Model Config | Technical Vocabulary | Advanced |
| Output Config | Status Bar Refresh | Advanced / Integration |
| Audio Config | Save Audio Clips | Advanced / Debug |

### Issue 5: Missing Features

- No model download/management (must get files externally)
- No audio device selection (uses system default)
- Language is text input (should be dropdown)
- No hotkey configuration
- No microphone test/preview

### Issue 6: UX Problems

- Restart banner shows for ALL changes (even UI scale which is hot-reload)
- No indication which settings need restart vs hot-reload
- Path validation shows no loading state
- No tooltips or contextual help
- Reset confirms but doesn't explain what "loaded values" means

---

## Proposed Redesign

### New Section Structure

```
┌─────────────────────────────────────────────────────────┐
│  Settings                              [Reset] [Save]   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │ 🎙️ Voice Recognition                            │   │
│  │   Model: [Large V3 Turbo ▼] [Manage Models]     │   │
│  │   Language: [English ▼]                         │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │ ⏱️ Recording                                     │   │
│  │   Max Duration: [====●=====] 120s               │   │
│  │   Audio Device: [System Default ▼]              │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │ ✏️ Behavior                                      │   │
│  │   Add trailing space: [●]                       │   │
│  │   Auto-capitalize: [○]  (future)                │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │ 🎨 Appearance                                    │   │
│  │   UI Scale: [S] [M] [L] [Custom]                │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │ ⚙️ Advanced                          [Expand ▼] │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Section Details

#### Voice Recognition (Primary)

| Setting | Type | Notes |
|---------|------|-------|
| Model | Dropdown + Button | Shows downloaded models, "Manage" opens Model Manager |
| Language | Dropdown | Common languages + "Auto-detect" option |

**Key change:** Model dropdown only shows *downloaded* models. "Manage Models" button opens the Model Management UI (separate view or modal).

#### Recording

| Setting | Type | Notes |
|---------|------|-------|
| Max Duration | Slider | 10-300s, shows formatted time |
| Audio Device | Dropdown | Lists available input devices |

**Key change:** Add audio device selection (currently hardcoded to default).

#### Behavior

| Setting | Type | Notes |
|---------|------|-------|
| Add trailing space | Toggle | Current "Append Space" |
| (Future) Auto-capitalize | Toggle | Capitalize first letter |
| (Future) Punctuation hints | Toggle | Add periods at pauses |

#### Appearance

| Setting | Type | Notes |
|---------|------|-------|
| UI Scale | Button group | Small / Medium / Large / Custom |
| Custom Scale | Slider | Only if Custom selected |

**No changes** needed here, current implementation is good.

#### Advanced (Collapsed by Default)

| Setting | Type | Notes |
|---------|------|-------|
| Model Path Override | Path input | For custom/local models |
| Technical Vocabulary | Textarea | Prompt biasing |
| Status Bar Integration | Text input | Shell command |
| Save Audio Clips | Toggle + Path | Debug recordings |
| Sample Rate | Dropdown | 16000 / 22050 / 44100 |

**Key change:** These are hidden until user clicks "Expand". Power users can access; casual users never see them.

---

## Integration with Model Management

### Option A: Separate View (Recommended)

```
Navigation: [Dashboard] [History] [Models] [Settings]
                                    ↑
                              New tab for Model Manager
```

**Pros:** Clean separation, room for full model library UI
**Cons:** More navigation

### Option B: Modal from Settings

```
Settings → Voice Recognition → [Manage Models] → Opens Modal
```

**Pros:** Settings remains single source of truth
**Cons:** Modal can feel cramped for download progress

### Option C: Inline Expansion

```
Settings → Voice Recognition → Model dropdown expands to show:
  - Currently downloaded models
  - "Download More..." opens inline panel
```

**Pros:** Least navigation
**Cons:** Settings page becomes very long

### Recommendation: Option A

Model management is a significant feature (downloads, library browsing, deletion). It deserves its own navigation tab. Settings page stays focused on configuration.

**Settings Model Dropdown:**
- Shows only downloaded models
- Last item: "Manage Models →" (navigates to Models tab)

---

## Smart Restart Notifications

### Current Problem

Every save triggers restart banner, even for:
- UI scale (hot-reload, no restart needed)
- Appearance changes (hot-reload)

### Proposed Solution

Categorize settings:

| Category | Settings | Action |
|----------|----------|--------|
| **Hot-reload** | UI scale, appearance | Apply immediately |
| **Daemon restart** | Model, language, audio device | Show restart banner |
| **No action** | Behavior toggles | Save only |

Only show restart banner when daemon settings change:

```typescript
const DAEMON_SETTINGS = ['model', 'language', 'audio_device', 'sample_rate'];

const handleSave = () => {
  const needsRestart = DAEMON_SETTINGS.some(key =>
    config[key] !== previousConfig[key]
  );

  if (needsRestart) {
    setNeedsRestart(true);
  }
};
```

---

## Implementation Steps

### Phase 1: Reorganize Existing Settings

1. Rename sections to match new structure
2. Move settings to appropriate sections
3. Add "Advanced" collapsible section
4. Move Technical Vocabulary, Status Bar, Save Audio to Advanced

### Phase 2: Add Model Manager Tab

1. Implement Model Management UI (separate task doc)
2. Add "Models" to navigation
3. Change Settings model dropdown to show downloaded models only
4. Add "Manage Models →" link in dropdown

### Phase 3: Smart Restart Logic

1. Categorize settings by restart requirement
2. Update save handler to check changes
3. Only show banner for daemon settings

### Phase 4: New Features

1. Audio device selection
2. Language dropdown (instead of text input)
3. Tooltips/help icons for each setting

---

## File Changes

| File | Change |
|------|--------|
| `ui/src/components/Settings.tsx` | Reorganize sections, add Advanced collapse |
| `ui/src/components/Navigation.tsx` | Add Models tab |
| `ui/src/components/models/` | New directory (from Model Management task) |
| `ui/src/stores/appStore.ts` | Add downloaded models state |
| `src-tauri/src/commands/` | Add audio device list command |

---

## Mockup: Before vs After

### Before (Current)

```
┌─ Model Configuration ──────────────────┐
│ Model ID: [dropdown]                   │
│ Language: [text input]                 │
│ Model Path: [path input]               │
│ Technical Vocabulary: [textarea]       │
└────────────────────────────────────────┘
┌─ Audio Configuration ──────────────────┐
│ Recording Timeout: [slider]            │
│ Save Audio Clips: [toggle]             │
│ Audio Clips Path: [path input]         │
└────────────────────────────────────────┘
┌─ Output Configuration ─────────────────┐
│ Append Space: [toggle]                 │
│ Status Bar Refresh: [text input]       │
└────────────────────────────────────────┘
┌─ Appearance ───────────────────────────┐
│ UI Scale: [buttons]                    │
│ Custom Scale: [slider]                 │
│ Preview: [display]                     │
└────────────────────────────────────────┘
```

**Problems:** 4 sections, 12 visible settings, mixed complexity

### After (Proposed)

```
┌─ Voice Recognition ────────────────────┐
│ Model: [Large V3 Turbo ▼] [Manage →]   │
│ Language: [English ▼]                  │
└────────────────────────────────────────┘
┌─ Recording ────────────────────────────┐
│ Max Duration: [slider] 120s            │
│ Audio Device: [Default ▼]              │
└────────────────────────────────────────┘
┌─ Behavior ─────────────────────────────┐
│ Add trailing space: [toggle]           │
└────────────────────────────────────────┘
┌─ Appearance ───────────────────────────┐
│ UI Scale: [S] [M] [L] [Custom]         │
└────────────────────────────────────────┘
┌─ Advanced ──────────────────── [▼] ────┐
│ (collapsed by default)                 │
└────────────────────────────────────────┘
```

**Improvements:**
- 4 primary settings visible (was 12)
- Power user options hidden
- Model management separated
- Clearer section names
