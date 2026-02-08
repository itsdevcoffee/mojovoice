# Voice Recognition Section - UI Overhaul v0.6.0

**Date:** 2026-02-08
**Status:** Review
**Agent:** Buzzminson
**Branch:** ui-overhaul-v0.6.0

---

## Summary

Implement Voice Recognition section as proof-of-concept for "Hacker's Oscilloscope" design system. This establishes reusable patterns for all other settings sections.

## Requirements

- Apply bracket frame corners (emerald green, 16px)
- Add scanline overlay (subtle CRT effect)
- Add grid pattern (engineering diagram aesthetic)
- Section title: JetBrains Mono, 11px, uppercase, emerald green
- Pulsing glyph (▸) animation
- Monospace fonts on dropdown values
- Emerald glow on focus states
- Hover effects with emerald accents

## Planned Tasks

### Phase 1: CSS Foundation
- [x] Add design system classes to globals.css
- [x] Bracket frame corners (.bracket-frame-*)
- [x] Scanline overlay (.scanline-overlay)
- [x] Grid pattern (.grid-pattern)
- [x] Section title styles (.settings-section-title, .title-glyph)
- [x] Setting row styles (.setting-row-after)
- [x] Enhanced dropdown/input styles with emerald accents

### Phase 2: Component Structure
- [x] Refactor SettingsSection component
- [x] Add bracket frame divs
- [x] Add scanline and grid overlays
- [x] Update section title with pulsing glyph
- [x] Apply new classes to Voice Recognition section
- [x] Update SettingRow component
- [x] Update dropdown classes to settings-input-enhanced

### Phase 3: Polish
- [x] Implementation complete - ready for testing

## Completed Tasks

- Created tracking document
- Read design specifications
- Read visual mockup
- Read current Settings.tsx implementation
- Read current globals.css

## Changes Made

### Files Modified
- `/home/maskkiller/dev-coffee/repos/dev-voice/ui/src/styles/globals.css` - Added new design system classes:
  - `.settings-section` - Panel with gradient, blur, bracket frames support
  - `.bracket-frame-*` - Corner brackets (top-left, top-right, bottom-left, bottom-right)
  - `.scanline-overlay` - CRT scanline effect (2px repeating, 2% opacity)
  - `.grid-pattern` - Engineering diagram grid (24px, emerald 3% opacity)
  - `.settings-section-content` - Content wrapper above overlays
  - `.settings-section-title` - JetBrains Mono, 11px, uppercase, emerald
  - `.title-glyph` - Pulsing animation (2s cycle)
  - `.setting-row-after` - Enhanced setting row with hover states
  - `.setting-label-after` - Label/description typography
  - `.setting-control-after` - Fixed width control area (320px)
  - `.settings-input-enhanced` - Monospace inputs with emerald accents
  - `.toggle-enhanced` - Enhanced toggle with emerald glow
  - Updated `@media (prefers-reduced-motion: reduce)` to disable glyph animation

- `/home/maskkiller/dev-coffee/repos/dev-voice/ui/src/components/Settings.tsx` - Refactored Voice Recognition section:
  - Updated `SettingsSection` component with bracket frames, scanlines, grid, pulsing glyph
  - Updated `SettingRow` component to use new design system classes
  - Changed dropdown classes from `glass-input` to `settings-input-enhanced` in Voice Recognition section

## Problems & Roadblocks

None yet.

## Key Decisions

1. **Color Restriction:** Emerald green (#10b981) ONLY for section titles and focus/active states
2. **Typography:** JetBrains Mono for section titles and input values, system sans for labels/descriptions
3. **Atmospheric Depth:** Scanlines at 2% opacity, grid at 3% opacity to avoid distraction
4. **Reusable Pattern:** Build component structure that can be applied to Recording, Behavior, Appearance, History sections

## Testing Instructions

1. Start dev server: `cd ui && npm run dev`
2. Navigate to Settings view
3. Verify Voice Recognition section has:
   - Emerald bracket corners (16px, visible on all 4 corners)
   - Subtle scanline overlay (horizontal lines, barely visible)
   - Grid pattern (24px squares, emerald tint)
   - Section title: uppercase, emerald green, JetBrains Mono
   - Pulsing ▸ glyph (smooth animation, 2s cycle)
   - Monospace fonts on Model/Language dropdowns
   - Emerald border glow on dropdown focus/hover
4. Test interactions:
   - Hover over section - border should glow emerald
   - Focus on dropdown - emerald ring should appear
   - Hover on setting row - border should intensify
5. Verify accessibility:
   - Tab navigation works smoothly
   - Focus indicators are visible
   - Screen reader labels intact

## Backburner

None yet.

## Session Log

- 2026-02-08 10:00: Created tracking doc, reviewed design specs
- 2026-02-08 10:15: Implemented CSS foundation - all design system classes added to globals.css
- 2026-02-08 10:30: Refactored SettingsSection and SettingRow components
- 2026-02-08 10:35: Applied new design to Voice Recognition section (proof-of-concept complete)
- 2026-02-08 10:40: Ready for browser testing
