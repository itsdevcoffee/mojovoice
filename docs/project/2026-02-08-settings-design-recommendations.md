# Settings UI Design Recommendations

**Date:** 2026-02-08
**Status:** Design Specification
**Context:** v0.6.0 UI/UX Overhaul - Settings Reorganization

---

## Executive Summary

Transform the Settings page from a functional but cluttered interface into a **refined, terminal-inspired control panel** that embodies the Dev Coffee brand. This redesign reduces cognitive load (12 visible settings → 4 primary sections), applies sophisticated retro-tech aesthetics, and introduces purposeful visual hierarchy that guides users naturally through configuration.

**Key Aesthetic Direction:** Think oscilloscope UI meets modern glassmorphism—technical precision with atmospheric depth.

---

## Design Philosophy

### The "Hacker's Oscilloscope" Concept

Settings should feel like configuring a precision instrument in a dark workshop. Each section is a measurement panel, each control is a calibrated dial. The interface breathes technical confidence while remaining approachable.

**Core Principles:**
- **Darkness as Foundation** - Let near-black (#030303) absorb visual noise
- **Earned Color** - Emerald green (#10b981) only for active states and critical actions
- **Terminal Precision** - Monospace fonts (JetBrains Mono) for labels and values
- **Depth Through Layers** - Glass panels float above subtle grid patterns
- **Retro-Tech Soul** - Scanlines, bracket frames, and measured glows

---

## Visual Language Updates

### Typography Hierarchy

**Current State:**
```css
body { font-family: system-ui, -apple-system, ... }
h2 { font-size: 1.25rem; } /* Section titles */
label { font-size: 0.875rem; } /* Setting labels */
```

**Recommended Changes:**

```css
/* Section Headers - Uppercase Terminal Style */
.settings-section-title {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 0.6875rem; /* 11px */
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.12em; /* Wide spacing - diagnostic readout */
  color: #10b981; /* Emerald green - earned accent */
  margin-bottom: 1.5rem;
}

/* Setting Labels - Clean, Readable */
.setting-label {
  font-family: 'Geist', -apple-system, sans-serif; /* Modern sans */
  font-size: 0.9375rem; /* 15px - slightly larger for clarity */
  font-weight: 500;
  color: rgba(247, 250, 252, 0.95); /* Soft white */
  letter-spacing: -0.01em;
}

/* Setting Descriptions - Muted Technical */
.setting-description {
  font-family: 'Geist', -apple-system, sans-serif;
  font-size: 0.8125rem; /* 13px */
  font-weight: 400;
  color: #94a3b8; /* Muted gray */
  line-height: 1.5;
  letter-spacing: 0.01em;
}

/* Values/Inputs - Monospace for Data */
.setting-value, .glass-input {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-variant-numeric: tabular-nums; /* Aligned numbers */
}
```

**Rationale:**
- **JetBrains Mono** for headers/values creates "control panel" feel
- **Geist** (or system sans) for body text ensures readability over purity
- **Wide letter-spacing** on headers mimics system diagnostics
- **Tabular numbers** make sliders and values feel precise

---

### Color Application Strategy

**Current Problem:** Teal (#14b8a6) used liberally, diluting impact.

**New Color Rules:**

| Element | Color | Usage | Rationale |
|---------|-------|-------|-----------|
| **Section Titles** | Emerald `#10b981` | Only section headers | Signals importance, creates hierarchy |
| **Active Controls** | Emerald `#10b981` | Active toggles, focused inputs | Shows live state |
| **Inactive Controls** | Border `#2d3748` | Default state | Recedes into darkness |
| **Warning States** | Amber `#f59e0b` | Restart required banner | Demands attention |
| **Labels/Descriptions** | Soft white/muted gray | All text | Comfortable reading |
| **Backgrounds** | Near-black `#030303` | Canvas | Void that lets content breathe |

**Implementation:**

```css
/* Primary Accent - Emerald Green (RESTRICTED USE) */
--accent-emerald: #10b981;
--accent-emerald-glow: rgba(16, 185, 129, 0.3);

/* Backgrounds - Layered Depth */
--bg-void: #030303; /* Base canvas */
--bg-panel: rgba(21, 27, 36, 0.8); /* Glass panels */
--bg-panel-hover: rgba(28, 36, 48, 0.85); /* Hover state */

/* Text - Comfort & Hierarchy */
--text-primary: rgba(247, 250, 252, 0.95); /* Labels */
--text-secondary: #94a3b8; /* Descriptions */
--text-tertiary: #64748b; /* Metadata */
```

---

## Component-Specific Designs

### 1. Section Panels - "Terminal Frames"

**Current:** Basic glass panels with rounded corners.

**Redesign:** Bracket-framed panels that feel like selected terminal windows.

```tsx
// SettingsSection Component Enhancement
function SettingsSection({ title, children }: SettingsSectionProps) {
  return (
    <div className="settings-section">
      {/* Bracket frame corners */}
      <div className="bracket-frame-tl" aria-hidden="true" />
      <div className="bracket-frame-tr" aria-hidden="true" />
      <div className="bracket-frame-bl" aria-hidden="true" />
      <div className="bracket-frame-br" aria-hidden="true" />

      {/* Scanline overlay */}
      <div className="scanline-overlay" aria-hidden="true" />

      {/* Grid background */}
      <div className="grid-pattern" aria-hidden="true" />

      {/* Content */}
      <div className="settings-section-content">
        <h2 className="settings-section-title">
          <span className="title-glyph">▸</span> {title}
        </h2>
        <div className="settings-section-body">{children}</div>
      </div>
    </div>
  );
}
```

**CSS:**

```css
.settings-section {
  position: relative;
  background: linear-gradient(135deg,
    rgba(21, 27, 36, 0.7) 0%,
    rgba(21, 27, 36, 0.85) 100%);
  backdrop-filter: blur(24px);
  border: 1px solid rgba(45, 55, 72, 0.6);
  border-radius: 0; /* Sharp, technical corners */
  padding: 2rem;
  overflow: hidden;
  transition: border-color 300ms ease;
}

.settings-section:hover {
  border-color: rgba(16, 185, 129, 0.3);
}

/* Bracket Frame Corners */
.bracket-frame-tl, .bracket-frame-tr,
.bracket-frame-bl, .bracket-frame-br {
  position: absolute;
  width: 16px;
  height: 16px;
  border: 2px solid rgba(16, 185, 129, 0.4);
  pointer-events: none;
}

.bracket-frame-tl {
  top: -1px;
  left: -1px;
  border-right: none;
  border-bottom: none;
}

.bracket-frame-tr {
  top: -1px;
  right: -1px;
  border-left: none;
  border-bottom: none;
}

.bracket-frame-bl {
  bottom: -1px;
  left: -1px;
  border-right: none;
  border-top: none;
}

.bracket-frame-br {
  bottom: -1px;
  right: -1px;
  border-left: none;
  border-top: none;
}

/* Scanline Overlay - CRT Aesthetic */
.scanline-overlay {
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(
    0deg,
    transparent 0px,
    transparent 2px,
    rgba(255, 255, 255, 0.02) 2px,
    rgba(255, 255, 255, 0.02) 4px
  );
  pointer-events: none;
  opacity: 0.3;
}

/* Grid Pattern - Engineering Diagram */
.grid-pattern {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(16, 185, 129, 0.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(16, 185, 129, 0.03) 1px, transparent 1px);
  background-size: 24px 24px;
  pointer-events: none;
  opacity: 0.4;
}

/* Title Glyph - Terminal Prompt */
.title-glyph {
  display: inline-block;
  margin-right: 0.5rem;
  color: #10b981;
  font-size: 0.875rem;
  animation: pulse-glyph 2s ease-in-out infinite;
}

@keyframes pulse-glyph {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
```

**Visual Effect:**
- Sharp corners with emerald bracket frames (like terminal selection)
- Subtle scanlines evoke CRT monitors without being distracting
- Faint grid suggests engineering precision
- Pulsing glyph adds "active system" feeling

---

### 2. Setting Rows - "Control Readouts"

**Current:** Two-column layout (label | control).

**Redesign:** Enhanced with status indicators and refined spacing.

```tsx
function SettingRow({
  label,
  description,
  children,
  requiresRestart = false
}: SettingRowProps) {
  return (
    <div className="setting-row">
      <div className="setting-row-label">
        <div className="setting-label-line">
          <label className="setting-label">{label}</label>
          {requiresRestart && (
            <span className="restart-indicator" title="Requires daemon restart">
              ⚠
            </span>
          )}
        </div>
        <p className="setting-description">{description}</p>
      </div>
      <div className="setting-row-control">
        {children}
      </div>
    </div>
  );
}
```

**CSS:**

```css
.setting-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 2rem;
  padding: 1rem 0;
  border-bottom: 1px solid rgba(45, 55, 72, 0.3);
  transition: border-color 200ms ease;
}

.setting-row:last-child {
  border-bottom: none;
}

.setting-row:hover {
  border-color: rgba(45, 55, 72, 0.6);
}

.setting-row-label {
  flex: 1;
  min-width: 0; /* Allow text truncation */
}

.setting-label-line {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.25rem;
}

.restart-indicator {
  font-size: 0.75rem;
  color: #f59e0b;
  animation: pulse-warning 2s ease-in-out infinite;
}

@keyframes pulse-warning {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.setting-row-control {
  width: 320px; /* Fixed width for alignment */
  flex-shrink: 0;
}
```

**Benefits:**
- Consistent control width creates visual rhythm
- Restart indicator warns before save
- Hover state subtly highlights active row
- Border separators create clear delineation

---

### 3. Advanced Section - "Diagnostic Panel"

**Current:** Collapsible with ChevronDown icon.

**Redesign:** Emphasized "danger zone" aesthetic with subtle red accent.

```tsx
<div className="settings-section settings-section-advanced">
  <button
    onClick={() => setAdvancedExpanded(!advancedExpanded)}
    className="advanced-section-header"
    aria-expanded={advancedExpanded}
  >
    {/* Bracket corners */}
    <div className="bracket-frame-tl" />
    <div className="bracket-frame-tr" />

    <div className="advanced-header-content">
      <div className="advanced-title-group">
        <span className="advanced-icon" aria-hidden="true">⚙</span>
        <h2 className="settings-section-title">Advanced Configuration</h2>
      </div>
      <span className="advanced-expand-hint">
        {advancedExpanded ? '▼ COLLAPSE' : '▶ EXPAND'}
      </span>
    </div>
  </button>

  {advancedExpanded && (
    <div className="advanced-section-body">
      <div className="advanced-warning">
        <span className="warning-icon">⚠</span>
        <p className="warning-text">
          Changes to these settings can affect system behavior.
          Modify only if you understand the implications.
        </p>
      </div>

      {/* Advanced settings */}
      <div className="settings-section-body">
        {children}
      </div>
    </div>
  )}
</div>
```

**CSS:**

```css
.settings-section-advanced {
  border-color: rgba(239, 68, 68, 0.2);
  background: linear-gradient(135deg,
    rgba(30, 10, 10, 0.4) 0%,
    rgba(21, 27, 36, 0.8) 100%);
}

.settings-section-advanced:hover {
  border-color: rgba(239, 68, 68, 0.4);
}

.advanced-section-header {
  position: relative;
  width: 100%;
  padding: 1.5rem;
  background: transparent;
  border: none;
  cursor: pointer;
  transition: background-color 200ms ease;
}

.advanced-section-header:hover {
  background-color: rgba(239, 68, 68, 0.05);
}

.advanced-header-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.advanced-title-group {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.advanced-icon {
  font-size: 1.25rem;
  color: #ef4444;
  animation: rotate-slow 20s linear infinite;
}

@keyframes rotate-slow {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.advanced-expand-hint {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  color: #64748b;
  transition: color 200ms ease;
}

.advanced-section-header:hover .advanced-expand-hint {
  color: #ef4444;
}

.advanced-section-body {
  padding: 0 1.5rem 1.5rem;
  animation: expand-smooth 300ms ease-out;
}

@keyframes expand-smooth {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.advanced-warning {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 1rem;
  margin-bottom: 1.5rem;
  background-color: rgba(239, 68, 68, 0.08);
  border-left: 3px solid #ef4444;
  border-radius: 4px;
}

.warning-icon {
  font-size: 1.25rem;
  color: #ef4444;
  flex-shrink: 0;
}

.warning-text {
  font-size: 0.8125rem;
  line-height: 1.5;
  color: #94a3b8;
  margin: 0;
}
```

**Visual Effect:**
- Subtle red tint differentiates from safe settings
- Rotating gear icon suggests "system internals"
- Warning banner educates without patronizing
- Smooth expand animation feels premium

---

### 4. Controls - Refined Interactions

#### Dropdowns

**Current:** Basic glass-input styling.

**Redesign:** Monospace values with emerald accent on focus.

```css
select.glass-input {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 0.875rem;
  background-color: rgba(21, 27, 36, 0.6);
  border: 1px solid rgba(45, 55, 72, 0.6);
  border-radius: 6px;
  padding: 0.625rem 2.5rem 0.625rem 1rem;
  color: rgba(247, 250, 252, 0.95);
  transition: all 200ms ease;

  /* Custom dropdown arrow */
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%2310b981' d='M6 9L1 4h10z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 1rem center;
}

select.glass-input:focus {
  border-color: rgba(16, 185, 129, 0.6);
  background-color: rgba(21, 27, 36, 0.9);
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1);
  outline: none;
}

select.glass-input:hover {
  border-color: rgba(16, 185, 129, 0.4);
}
```

#### Sliders

**Current:** Default browser slider.

**Redesign:** Custom track with emerald fill and monospace value display.

```tsx
function Slider({ value, onChange, min, max, unit }: SliderProps) {
  return (
    <div className="slider-control">
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
        className="slider-input"
        style={{
          '--slider-percent': `${((value - min) / (max - min)) * 100}%`
        }}
      />
      <div className="slider-value">
        <span className="slider-value-number">{value}</span>
        <span className="slider-value-unit">{unit}</span>
      </div>
    </div>
  );
}
```

```css
.slider-control {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.slider-input {
  flex: 1;
  height: 6px;
  background: linear-gradient(
    to right,
    rgba(16, 185, 129, 0.3) 0%,
    rgba(16, 185, 129, 0.3) var(--slider-percent),
    rgba(45, 55, 72, 0.5) var(--slider-percent),
    rgba(45, 55, 72, 0.5) 100%
  );
  border-radius: 3px;
  outline: none;
  transition: background 150ms ease;
  -webkit-appearance: none;
}

.slider-input::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 18px;
  height: 18px;
  background: #10b981;
  border: 2px solid rgba(3, 3, 3, 0.8);
  border-radius: 50%;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(16, 185, 129, 0.4);
  transition: all 150ms ease;
}

.slider-input::-webkit-slider-thumb:hover {
  background: #0ea472;
  box-shadow: 0 0 16px rgba(16, 185, 129, 0.6);
  transform: scale(1.1);
}

.slider-value {
  display: flex;
  align-items: baseline;
  gap: 0.25rem;
  min-width: 4rem;
  justify-content: flex-end;
}

.slider-value-number {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.9375rem;
  font-weight: 600;
  color: rgba(247, 250, 252, 0.95);
  font-variant-numeric: tabular-nums;
}

.slider-value-unit {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.75rem;
  font-weight: 400;
  color: #94a3b8;
}
```

#### Toggles

**Current:** Cyan when active.

**Redesign:** Emerald with subtle glow, refined animation.

```css
.toggle {
  position: relative;
  width: 52px;
  height: 28px;
  background-color: rgba(45, 55, 72, 0.5);
  border: 1px solid rgba(45, 55, 72, 0.8);
  border-radius: 14px;
  cursor: pointer;
  transition: all 200ms cubic-bezier(0.4, 0, 0.2, 1);
}

.toggle:hover {
  background-color: rgba(45, 55, 72, 0.7);
}

.toggle-active {
  background-color: rgba(16, 185, 129, 0.2);
  border-color: rgba(16, 185, 129, 0.5);
  box-shadow: 0 0 16px rgba(16, 185, 129, 0.2);
}

.toggle-thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 22px;
  height: 22px;
  background-color: #64748b;
  border-radius: 50%;
  transition: all 250ms cubic-bezier(0.4, 0, 0.2, 1);
}

.toggle-active .toggle-thumb {
  transform: translateX(24px);
  background-color: #10b981;
  box-shadow: 0 2px 8px rgba(16, 185, 129, 0.4);
}
```

---

## Animation Strategy

### Page Load Sequence

Create orchestrated reveal that feels like booting a system:

```tsx
useEffect(() => {
  // Stagger section reveals
  const sections = document.querySelectorAll('.settings-section');
  sections.forEach((section, index) => {
    section.style.animationDelay = `${index * 80}ms`;
    section.classList.add('animate-fade-in-up');
  });
}, []);
```

```css
@keyframes fade-in-up {
  from {
    opacity: 0;
    transform: translateY(16px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-fade-in-up {
  animation: fade-in-up 400ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
```

### Interaction Micro-animations

**Save Button State:**

```css
.btn-save {
  position: relative;
  overflow: hidden;
}

.btn-save::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(
    90deg,
    transparent,
    rgba(255, 255, 255, 0.2),
    transparent
  );
  transform: translateX(-100%);
}

.btn-save:hover::before {
  animation: shimmer-sweep 600ms ease-out;
}

@keyframes shimmer-sweep {
  to { transform: translateX(100%); }
}
```

**Input Focus Glow:**

```css
.glass-input:focus {
  animation: focus-pulse 400ms ease-out;
}

@keyframes focus-pulse {
  0% {
    box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4);
  }
  50% {
    box-shadow: 0 0 0 6px rgba(16, 185, 129, 0.1);
  }
  100% {
    box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1);
  }
}
```

---

## Responsive Considerations

### Tablet (768px - 1024px)

```css
@media (max-width: 1024px) {
  .setting-row {
    flex-direction: column;
    align-items: stretch;
    gap: 1rem;
  }

  .setting-row-control {
    width: 100%;
  }

  .settings-section {
    padding: 1.5rem;
  }
}
```

### Mobile (< 768px)

```css
@media (max-width: 768px) {
  .settings-section-title {
    font-size: 0.625rem; /* Smaller on mobile */
  }

  .bracket-frame-tl, .bracket-frame-tr,
  .bracket-frame-bl, .bracket-frame-br {
    width: 12px;
    height: 12px;
  }

  .grid-pattern {
    opacity: 0.2; /* Reduce visual noise */
  }

  .scanline-overlay {
    display: none; /* Remove on small screens */
  }
}
```

---

## Accessibility

### Screen Reader Enhancements

```tsx
<div className="settings-section" role="region" aria-labelledby="section-voice">
  <h2 id="section-voice" className="settings-section-title">
    <span aria-hidden="true">▸</span> Voice Recognition
  </h2>
  {/* ... */}
</div>
```

### Keyboard Navigation

```css
.setting-row:focus-within {
  background-color: rgba(16, 185, 129, 0.05);
  border-color: rgba(16, 185, 129, 0.3);
}

.glass-input:focus-visible,
.toggle:focus-visible,
.btn-save:focus-visible {
  outline: 2px solid #10b981;
  outline-offset: 2px;
}
```

### Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  .animate-fade-in-up,
  .toggle,
  .toggle-thumb,
  .title-glyph {
    animation: none !important;
    transition: none !important;
  }

  .settings-section {
    opacity: 1;
    transform: none;
  }
}
```

---

## Implementation Priority

### Phase 1: Foundation (Week 1)
1. Update typography system (JetBrains Mono for headers)
2. Implement bracket-frame panels
3. Add scanline and grid overlays
4. Refine color usage (restrict emerald to accents)

### Phase 2: Controls (Week 1-2)
1. Custom slider styling
2. Enhanced toggle animations
3. Dropdown refinements
4. Input focus states

### Phase 3: Advanced Section (Week 2)
1. Collapsible panel with warning banner
2. Danger zone aesthetic
3. Smooth expand/collapse

### Phase 4: Polish (Week 2-3)
1. Page load orchestration
2. Micro-interactions (save button, focus glow)
3. Responsive refinements
4. Accessibility audit

---

## Success Metrics

**Visual:**
- Settings feel "sophisticated" not "cluttered"
- Brand consistency across all components
- Clear hierarchy guides eye naturally

**Functional:**
- Reduced time-to-configure for new users
- Advanced users find power features quickly
- Zero accessibility regressions

**Emotional:**
- Users describe UI as "polished," "professional," "technical"
- Interface reinforces "hacker's tool" positioning
- Pride in showing settings to others

---

## Reference Files

- **Brand Guide:** `docs/context/dev-coffee-brand-style-guide.md`
- **Current Implementation:** `ui/src/components/Settings.tsx`
- **Styling System:** `ui/src/styles/globals.css`
- **Reorganization Plan:** `docs/project/2026-01-14-settings-ui-redesign.md`

---

## Next Steps

1. **Review with user** - Validate aesthetic direction
2. **Create prototype** - Build one section (Voice Recognition) to full spec
3. **Iterate** - Refine based on feel
4. **Systematize** - Extract reusable patterns
5. **Complete rollout** - Apply to all sections

---

*This design transforms Settings from a configuration page into a **control console** that embodies Dev Coffee's "sophisticated hacker" identity. Every detail—from bracket frames to monospace values—reinforces the brand while improving usability.*
