# MojoVoice Style Guide

**Version:** 1.0.0
**Date:** 2026-02-08
**Status:** Official Design System

---

## Brand Identity

### Core Concept: "Cyberpunk Terminal"

**Philosophy:** Powerful developer tool that looks like a sci-fi terminal from the future. Bold, confident, unapologetically technical. Not a consumer app - this is a precision instrument.

**Emotional Target:**
- Developer opens MojoVoice → "Holy shit, this looks GOOD"
- Feels like a premium power tool, not a generic AI chat
- Instagram-worthy screenshots
- Signals technical competence and attention to detail

**Design Philosophy:**
- **Neubrutalism meets Terminal Aesthetic** - Bold borders, high contrast, intentional rawness
- **Electric energy** - Glowing accents, vibrant interactions
- **Technical precision** - Monospace typography, exact values, engineering grid
- **Buttery smooth** - Premium animations, tactile feedback
- **Accessibility first** - Keyboard navigation, screen reader support, high contrast

---

## Color System

### Primary Palette: "Electric Night"

```css
/* Background Layers - Deep Navy Gradient */
--bg-void: #0A0E1A;           /* Infinite depth (darkest) */
--bg-surface: #151B2E;        /* Elevated surfaces */
--bg-elevated: #1E293B;       /* Hover states, dropdowns */

/* Interactive - Electric Blue */
--accent-primary: #3B82F6;    /* Primary interactive (buttons, links) */
--accent-glow: #60A5FA;       /* Lighter blue for glows */
--accent-active: #2563EB;     /* Pressed/active state */
--accent-muted: #1E40AF;      /* Disabled state */

/* Status Colors - Neon Cyberpunk */
--success: #22C55E;           /* Acid green (recording, active, success) */
--warning: #F59E0B;           /* Amber (warnings, requires attention) */
--error: #EF4444;             /* Hot red (errors, destructive actions) */
--info: #06B6D4;              /* Cyan (info, metadata) */

/* Text Hierarchy */
--text-primary: #F8FAFC;      /* Near white (headings, important text) */
--text-secondary: #CBD5E1;    /* Silver (body text, labels) */
--text-tertiary: #64748B;     /* Muted (metadata, descriptions) */
--text-disabled: #475569;     /* Disabled text */

/* Borders & Dividers */
--border-default: #334155;    /* Standard borders */
--border-focus: #3B82F6;      /* Focused elements */
--border-brutal: #000000;     /* Neubrutalist thick borders */

/* Special Effects */
--glow-primary: 0 0 20px rgba(59, 130, 246, 0.5);
--glow-success: 0 0 20px rgba(34, 197, 94, 0.5);
--shadow-brutal: 4px 4px 0px 0px rgba(0, 0, 0, 1);
--shadow-brutal-hover: 6px 6px 0px 0px rgba(0, 0, 0, 1);
--shadow-brutal-active: 2px 2px 0px 0px rgba(0, 0, 0, 1);
```

### Color Usage Rules

**DO:**
- Use electric blue (#3B82F6) for ALL interactive elements
- Use acid green (#22C55E) for recording/active states ONLY
- Use deep navy backgrounds for atmospheric depth
- Use thick black borders (#000000) for neubrutalist elements
- Use glows on focus/hover for electric energy

**DON'T:**
- Use emerald green (old brand color - replaced)
- Use purple/pink gradients (generic AI app)
- Use pure black (#000000) for backgrounds (too harsh)
- Use subtle, low-contrast colors (accessibility)
- Overuse status colors (reserve for actual status)

---

## Typography

### Font Stack

```css
/* Monospace - Technical Content */
--font-mono: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;

/* Sans-serif - UI Content */
--font-ui: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
```

### Type Scale

```css
--text-xs: 0.75rem;     /* 12px - Metadata, status badges */
--text-sm: 0.875rem;    /* 14px - Labels, secondary text */
--text-base: 1rem;      /* 16px - Body text, inputs */
--text-lg: 1.125rem;    /* 18px - Emphasis, card titles */
--text-xl: 1.25rem;     /* 20px - Section headers */
--text-2xl: 1.5rem;     /* 24px - Page titles */
--text-3xl: 1.875rem;   /* 30px - Display text */
```

### Font Usage Rules

**JetBrains Mono (Monospace):**
- Section headers (uppercase, wide letter-spacing)
- All numeric values (duration, size, counts)
- Transcribed text display
- File paths, model names
- Code-like content
- Terminal prompts (>, $, [OK])

**Inter (UI Sans-serif):**
- Button labels
- Descriptions and help text
- Navigation items
- Form labels
- Paragraph content

### Typography Patterns

**Section Headers:**
```css
font-family: var(--font-mono);
font-size: var(--text-xs);      /* 12px */
font-weight: 600;
text-transform: uppercase;
letter-spacing: 0.12em;          /* Wide spacing */
color: var(--accent-primary);    /* Electric blue */
```

**Body Text:**
```css
font-family: var(--font-ui);
font-size: var(--text-base);     /* 16px */
font-weight: 400;
line-height: 1.6;
color: var(--text-secondary);    /* Silver */
```

**Monospace Values:**
```css
font-family: var(--font-mono);
font-variant-numeric: tabular-nums;  /* Aligned numbers */
font-weight: 500;
color: var(--text-primary);      /* Near white */
```

---

## Spacing System

### Base Unit: 4px

```css
--space-1: 0.25rem;   /* 4px */
--space-2: 0.5rem;    /* 8px */
--space-3: 0.75rem;   /* 12px */
--space-4: 1rem;      /* 16px */
--space-5: 1.25rem;   /* 20px */
--space-6: 1.5rem;    /* 24px */
--space-8: 2rem;      /* 32px */
--space-10: 2.5rem;   /* 40px */
--space-12: 3rem;     /* 48px */
--space-16: 4rem;     /* 64px */
```

### Spacing Usage

- **Tight:** 4-8px (within components)
- **Default:** 12-16px (between elements)
- **Comfortable:** 24-32px (between sections)
- **Spacious:** 48-64px (page margins)

---

## Component Library

### Technology Stack

```json
{
  "components": "React Aria Components",
  "styling": "Tailwind CSS v4",
  "animation": "Motion (Framer Motion)",
  "forms": "React Hook Form",
  "icons": "Lucide React"
}
```

**Why React Aria Components:**
- Best-in-class accessibility (Adobe-backed)
- Completely unstyled (full design control)
- Active maintenance (Radix alternative)
- Keyboard navigation built-in
- Battle-tested by Adobe, Microsoft, Atlassian

---

## Component Patterns

### 1. Buttons

#### Primary Button (Neubrutalist)

**Visual:** Solid background, thick black border, brutal shadow

```tsx
<button className="
  px-6 py-3
  bg-blue-600 text-white
  border-2 border-black
  shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]
  hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]
  hover:translate-x-[-2px] hover:translate-y-[-2px]
  active:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]
  active:translate-x-[2px] active:translate-y-[2px]
  transition-all duration-150
  font-semibold uppercase tracking-wide
  font-[family-name:var(--font-ui)]
">
  Start Recording
</button>
```

**States:**
- **Default:** 4px shadow offset
- **Hover:** 6px shadow, button shifts -2px
- **Active:** 2px shadow, button shifts +2px
- **Disabled:** 50% opacity, no shadow
- **Loading:** Pulse animation + spinner

#### Secondary Button (Outlined)

```tsx
<button className="
  px-6 py-3
  bg-transparent text-blue-500
  border-2 border-blue-500
  hover:bg-blue-500 hover:text-white
  hover:shadow-[0_0_20px_rgba(59,130,246,0.5)]
  transition-all duration-150
  font-semibold uppercase tracking-wide
">
  Cancel
</button>
```

#### Ghost Button (Minimal)

```tsx
<button className="
  px-4 py-2
  bg-transparent text-slate-400
  hover:bg-slate-800 hover:text-slate-100
  transition-all duration-150
  font-medium
">
  Learn More
</button>
```

### 2. Dropdowns / Selects

**Pattern:** React Aria Select + custom styling

**Visual:** Electric blue border on focus, searchable for 5+ items

```tsx
// Closed state
border: 2px solid #334155
background: #151B2E

// Open state
border: 2px solid #3B82F6
box-shadow: 0 0 20px rgba(59, 130, 246, 0.5)
```

**Features:**
- Keyboard navigation (arrow keys, Enter, Escape)
- Search filtering (type to filter)
- Virtual scrolling (50+ items)
- Sections with headers
- Disabled options (muted)

**Accessibility:**
- `role="combobox"` + `aria-expanded`
- `aria-activedescendant` for keyboard nav
- `aria-label` for screen readers

### 3. Sliders (Dual Input Pattern)

**Pattern:** Slider + number input + real-time preview

**Layout:**
```
┌─────────────────────────────────────┐
│ Recording Duration                  │  <-- Label
│ ●═══════════○──────────────────     │  <-- Slider (visual)
│ [120] seconds                       │  <-- Number input (precision)
│ ⏱️  Approximately 2 minutes          │  <-- Preview (context)
└─────────────────────────────────────┘
```

**Styling:**
```css
/* Track */
height: 6px;
background: linear-gradient(
  to right,
  #3B82F6 0%,
  #3B82F6 var(--value-percent),
  #334155 var(--value-percent),
  #334155 100%
);
border-radius: 3px;

/* Thumb */
width: 24px;
height: 24px;
background: #3B82F6;
border: 2px solid #0A0E1A;
border-radius: 50%;
box-shadow: 0 0 12px rgba(59, 130, 246, 0.6);
cursor: grab;

/* Thumb (dragging) */
cursor: grabbing;
box-shadow: 0 0 20px rgba(59, 130, 246, 0.8);
transform: scale(1.1);
```

**Accessibility:**
- `role="slider"` + `aria-valuemin/max/now`
- Keyboard control (arrow keys, Home, End)
- Touch-friendly (44px minimum target)

### 4. Toggle Switches (Liquid Morph)

**Pattern:** iOS-style switch with liquid animation

**Visual:** Thumb morphs like liquid metal when toggling

```tsx
// Container
<div className="
  w-14 h-7
  bg-slate-700
  border-2 border-slate-600
  rounded-full
  relative
  cursor-pointer
  transition-all duration-200
  data-[state=on]:bg-blue-600
  data-[state=on]:border-blue-500
  data-[state=on]:shadow-[0_0_20px_rgba(59,130,246,0.5)]
">
  {/* Thumb with liquid morph */}
  <div className="
    absolute top-0.5 left-0.5
    w-5 h-5
    bg-slate-300
    rounded-full
    transition-all duration-200 ease-[cubic-bezier(0.68,-0.55,0.265,1.55)]
    data-[state=on]:translate-x-7
    data-[state=on]:bg-white
  "/>
</div>
```

**Animation:** Elastic easing creates "liquid morph" effect
```css
transition: all 200ms cubic-bezier(0.68, -0.55, 0.265, 1.55);
```

**States:**
- **Off:** Gray background, muted thumb
- **On:** Blue background with glow, white thumb
- **Disabled:** 50% opacity, no cursor

**Accessibility:**
- `role="switch"` + `aria-checked`
- Keyboard toggle (Space, Enter)
- Label association

### 5. Text Inputs (Terminal-Inspired)

**Visual:** Monospace font, terminal prompt, status indicator

```tsx
<div className="relative">
  {/* Floating label */}
  <label className="
    absolute -top-2 left-3
    px-1 bg-slate-900
    text-xs text-slate-400
    font-[family-name:var(--font-ui)]
  ">
    Model Path
  </label>

  {/* Input with terminal prompt */}
  <input className="
    w-full px-4 py-3 pl-8
    bg-slate-900/50
    border-2 border-slate-700
    rounded
    font-[family-name:var(--font-mono)] text-slate-100
    placeholder:text-slate-500
    focus:border-blue-500
    focus:shadow-[0_0_20px_rgba(59,130,246,0.3)]
    focus:outline-none
    transition-all duration-150
  " />

  {/* Terminal prompt */}
  <span className="
    absolute left-3 top-1/2 -translate-y-1/2
    text-blue-500 font-mono
  ">
    &gt;
  </span>

  {/* Status indicator */}
  <div className="
    absolute right-3 top-1/2 -translate-y-1/2
    flex items-center gap-1
    text-xs
  ">
    <span className="text-green-500">✓</span>
    <span className="text-slate-400">Valid</span>
  </div>
</div>
```

**States:**
- **Default:** Slate border
- **Focus:** Blue border + electric glow
- **Error:** Red border + error message below
- **Success:** Green checkmark + success message
- **Disabled:** Muted, no interaction

---

## Animation Standards

### Timing Functions

```css
/* Standard Durations */
--duration-instant: 100ms;   /* Tooltips, immediate feedback */
--duration-fast: 150ms;      /* Hover states, button press */
--duration-normal: 250ms;    /* Transitions, dropdowns */
--duration-slow: 400ms;      /* Context changes, modals */

/* Easing Curves */
--ease-out: cubic-bezier(0.16, 1, 0.3, 1);            /* Default (snappy) */
--ease-elastic: cubic-bezier(0.68, -0.55, 0.265, 1.55); /* Playful bounce */
--ease-smooth: cubic-bezier(0.4, 0, 0.2, 1);          /* Material-like */
```

### Animation Principles

**DO:**
- Use `transform` and `opacity` only (GPU-accelerated)
- Keep micro-interactions under 250ms
- Use spring physics for natural movement (Motion library)
- Honor `prefers-reduced-motion`
- Add playful touches (liquid toggle, brutal shadow shift)

**DON'T:**
- Animate `width`, `height`, `top`, `left` (causes reflow)
- Go over 500ms for any single animation
- Animate everything (use purposefully)
- Ignore accessibility (motion preferences)

### Signature Animations

**Button Press (Brutal Shadow Shift):**
```css
/* Default */
box-shadow: 4px 4px 0px 0px rgba(0, 0, 0, 1);

/* Hover */
box-shadow: 6px 6px 0px 0px rgba(0, 0, 0, 1);
transform: translate(-2px, -2px);

/* Active */
box-shadow: 2px 2px 0px 0px rgba(0, 0, 0, 1);
transform: translate(2px, 2px);
```

**Toggle Switch (Liquid Morph):**
```css
transition: all 200ms cubic-bezier(0.68, -0.55, 0.265, 1.55);
/* Elastic easing creates bounce effect */
```

**Focus Ring (Electric Glow):**
```css
outline: 2px solid #3B82F6;
outline-offset: 2px;
box-shadow: 0 0 20px rgba(59, 130, 246, 0.5);
```

**Loading State (Scanning Line):**
```
Processing ━━━━━━━━━━━━━━━━ ▶
           ^^^^ blue glow moves left-to-right
```

---

## Layout Patterns

### Grid System

**Base Grid:** 4px unit

```css
display: grid;
grid-template-columns: repeat(12, 1fr);
gap: var(--space-6);  /* 24px */
```

### Spacing Rules

- **Card padding:** 24px (--space-6)
- **Section spacing:** 48px (--space-12)
- **Element spacing:** 16px (--space-4)
- **Tight spacing:** 8px (--space-2)

### Container Widths

```css
--container-sm: 640px;   /* Single column content */
--container-md: 768px;   /* Forms, settings */
--container-lg: 1024px;  /* Dashboard, main views */
--container-xl: 1280px;  /* Wide layouts */
```

---

## Visual Elements

### 1. Section Headers (Terminal Prompt)

```
▸ VOICE RECOGNITION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Implementation:**
```tsx
<div className="flex items-center gap-2 mb-6">
  <span className="
    text-blue-500 text-sm
    animate-pulse
  ">
    ▸
  </span>
  <h2 className="
    font-mono text-xs uppercase tracking-[0.12em]
    text-blue-500 font-semibold
  ">
    Voice Recognition
  </h2>
  <div className="flex-1 h-px bg-gradient-to-r from-blue-500 to-transparent" />
</div>
```

### 2. Cards (Framed Terminals)

**Visual:** Thick borders, sharp corners, terminal aesthetic

```tsx
<div className="
  p-6
  bg-slate-900
  border-2 border-slate-700
  relative
  hover:border-blue-500
  hover:shadow-[0_0_20px_rgba(59,130,246,0.3)]
  transition-all duration-200
">
  {/* Optional: Status badge top-right */}
  <div className="
    absolute top-2 right-2
    px-2 py-0.5
    bg-green-500/20 text-green-400
    border border-green-500/50
    rounded
    text-xs font-mono uppercase
  ">
    [ACTIVE]
  </div>

  {/* Card content */}
  <h3 className="text-lg font-semibold text-slate-100 mb-2">
    Large V3 Turbo
  </h3>
  <p className="text-sm text-slate-400">
    1.5 GB • English
  </p>
</div>
```

### 3. Status Badges

**Patterns:**

```tsx
// Active (green)
<span className="
  px-2 py-0.5
  bg-green-500/20 text-green-400
  border border-green-500/50
  rounded text-xs font-mono uppercase
">
  [ACTIVE]
</span>

// Recording (green glow)
<span className="
  px-2 py-0.5
  bg-green-500 text-black
  shadow-[0_0_12px_rgba(34,197,94,0.6)]
  rounded text-xs font-mono uppercase font-semibold
  animate-pulse
">
  ● REC
</span>

// Warning (amber)
<span className="
  px-2 py-0.5
  bg-amber-500/20 text-amber-400
  border border-amber-500/50
  rounded text-xs font-mono uppercase
">
  [WARN]
</span>

// Error (red)
<span className="
  px-2 py-0.5
  bg-red-500/20 text-red-400
  border border-red-500/50
  rounded text-xs font-mono uppercase
">
  [ERROR]
</span>

// Info (cyan)
<span className="
  px-2 py-0.5
  bg-cyan-500/20 text-cyan-400
  border border-cyan-500/50
  rounded text-xs font-mono uppercase
">
  [INFO]
</span>
```

### 4. Focus States (Universal)

**All interactive elements:**

```css
focus-visible:outline-2
focus-visible:outline-blue-500
focus-visible:outline-offset-2
focus-visible:shadow-[0_0_20px_rgba(59,130,246,0.5)]
```

**Why universal:**
- Accessibility first (keyboard users)
- Impossible to miss
- Brand signature (electric glow)
- Works on dark backgrounds

### 5. Loading States

**Scanning Line (preferred):**

```tsx
<div className="flex items-center gap-2 text-blue-500">
  <span className="font-mono text-sm">Processing</span>
  <div className="relative w-32 h-1 bg-slate-700 rounded overflow-hidden">
    <div className="
      absolute inset-y-0 w-8
      bg-gradient-to-r from-transparent via-blue-500 to-transparent
      shadow-[0_0_12px_rgba(59,130,246,0.8)]
      animate-[scan_2s_ease-in-out_infinite]
    " />
  </div>
</div>

<style>
  @keyframes scan {
    0% { left: -2rem; }
    100% { left: 100%; }
  }
</style>
```

**Spinner (fallback):**

```tsx
<div className="
  w-5 h-5
  border-2 border-slate-700 border-t-blue-500
  rounded-full
  animate-spin
" />
```

---

## Accessibility

### WCAG 2.2 Level AA Requirements

**Color Contrast:**
- Text: 7:1 minimum (AAA)
- UI components: 3:1 minimum (AA)
- Status colors tested for colorblind users

**Keyboard Navigation:**
- Tab order logical and visible
- Focus states always visible (no `:focus` without `:focus-visible`)
- Shortcuts documented and customizable
- Escape closes modals/dropdowns

**Screen Reader Support:**
- Semantic HTML (`<button>`, `<nav>`, `<main>`)
- ARIA labels on all interactive elements
- Live regions for dynamic content
- Status announcements

**Motion:**
- Respect `prefers-reduced-motion`
- Provide static alternatives
- No auto-play videos/animations

**Touch Targets:**
- Minimum 44x44px (mobile-friendly)
- Adequate spacing between targets
- No accidental triggers

### Accessibility Checklist

- [ ] All interactive elements have visible focus states
- [ ] Color is not the only indicator (use icons + text)
- [ ] Keyboard navigation works without mouse
- [ ] Screen reader announces all content correctly
- [ ] Motion respects user preferences
- [ ] Touch targets are 44x44px minimum
- [ ] Contrast ratios meet WCAG 2.2 AA standards
- [ ] Forms have clear labels and error messages

---

## Performance

### Performance Budget

```json
{
  "initialLoad": {
    "css": "<100KB",
    "js": "<200KB",
    "fonts": "<100KB"
  },
  "metrics": {
    "firstPaint": "<1s",
    "timeToInteractive": "<2s on 3G",
    "fps": "60fps constant"
  }
}
```

### Optimization Rules

**DO:**
- Code splitting (lazy load routes)
- Tree shaking (remove unused code)
- Image optimization (WebP, lazy loading)
- Font subsetting (only needed glyphs)
- GPU acceleration (`transform`, `opacity` only)
- Virtual scrolling (long lists)

**DON'T:**
- Load all components upfront
- Use layout-shifting animations
- Block rendering with JS
- Load unnecessary fonts
- Animate expensive properties

---

## File Structure

### Design Tokens

```
ui/src/styles/
├── tokens/
│   ├── colors.css          # Color variables
│   ├── typography.css      # Font scales, families
│   ├── spacing.css         # Spacing scale
│   ├── animation.css       # Durations, easings
│   └── shadows.css         # Shadow tokens
├── components/
│   ├── buttons.css         # Button variants
│   ├── inputs.css          # Form controls
│   ├── cards.css           # Card patterns
│   └── utilities.css       # Helper classes
└── globals.css             # Master stylesheet
```

---

## Brand Voice

### Writing Style

**DO:**
- Write in active voice ("Start recording" not "Recording can be started")
- Use technical terms (developers appreciate precision)
- Be direct and confident ("Record" not "Maybe try recording?")
- Use sentence case for UI text
- Keep button labels short (1-2 words)

**DON'T:**
- Use marketing speak ("Revolutionize your workflow!")
- Overexplain ("Click this button to start the recording process...")
- Use passive voice ("The recording was started...")
- Write in ALL CAPS (except status badges like [ACTIVE])

### Microcopy Examples

**Good:**
- "Start Recording" (clear, direct)
- "No models installed" (honest, informative)
- "Recording failed. Check microphone permissions." (actionable)

**Bad:**
- "Click here to begin the amazing voice recording experience!" (marketing speak)
- "Oops! Something went wrong :(" (unprofessional)
- "Please start recording" (passive, unnecessary "please")

---

## Examples Gallery

### Component Showcase

See `/docs/project/settings-design-mockup.html` for live interactive examples.

### Reference Implementations

**Buttons:** [shadcn/ui Button](https://ui.shadchn.com/docs/components/button)
**Dropdowns:** [React Aria Select](https://react-spectrum.adobe.com/react-aria/Select.html)
**Toggles:** [React Aria Switch](https://react-spectrum.adobe.com/react-aria/Switch.html)
**Terminal UI:** [Warp Terminal](https://www.warp.dev)
**Dev Tools:** [Raycast](https://www.raycast.com)

---

## Version History

**v1.1.0 (2026-02-13):**
- Added RecordingHero component (pulsing ring animation, aria-live region)
- Added StatusMicroIndicators component (header status pips with tooltips)
- Added CommandPalette component (cmdk-based, Cmd+K)
- Added TranscriptionCard metadata footer (latency, confidence, model)
- Added Card hover lift effect (brutal shadow shift)
- Added surface-texture scan-line overlay class
- Added pulse-ring CSS keyframe animation
- Added --glow-inner-blue and --shadow-brutal-lift tokens
- Updated SystemStatus to minimal (Memory + Uptime only)
- Documented component decomposition architecture

**v1.0.0 (2026-02-08):**
- Initial style guide
- Cyberpunk Terminal concept defined
- Complete design system established
- All component patterns documented

---

## Component Architecture (v0.6.0+)

### Decomposed Layout

MissionControl.tsx is the thin orchestrator (~205 lines). All features are extracted into focused components with lazy loading:

```
MissionControl.tsx (orchestrator)
├── RecordingHero          ← Recording button + pulsing ring animation
├── StatusBar              ← Daemon status, model, language, mic
├── StatusMicroIndicators  ← Header SYS/GPU colored pips
├── TranscriptionCard[]    ← Recent transcriptions with metadata footer
├── SystemStatus           ← Collapsible Memory + Uptime panel
├── SettingsPanel (lazy)   ← Full settings form in slide-out Drawer
├── HistoryModal (lazy)    ← Searchable/filterable history with export/clear
└── CommandPalette (lazy)  ← Cmd+K command bar (cmdk library)
```

### New CSS Classes

**`.surface-texture`** — Adds subtle scan-line overlay via `::before` pseudo-element:
```css
.surface-texture::before {
  background: repeating-linear-gradient(
    0deg, transparent, transparent 2px,
    rgba(59, 130, 246, 0.03) 2px, rgba(59, 130, 246, 0.03) 3px
  );
}
```

**`.animate-pulse-ring`** — Pulsing ring animation for recording state:
```css
@keyframes pulse-ring {
  0% { transform: scale(1); opacity: 0.6; }
  100% { transform: scale(1.5); opacity: 0; }
}
```

### New Design Tokens

```css
--glow-inner-blue: inset 0 0 12px rgba(59, 130, 246, 0.1);
--shadow-brutal-lift: 8px 8px 0px 0px rgba(0, 0, 0, 1);
```

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Space | Start/stop recording |
| Cmd/Ctrl+K | Open command palette |
| Cmd/Ctrl+H | Open history modal |
| Cmd/Ctrl+, | Open settings drawer |
| Cmd/Ctrl+C | Copy last transcription (when not in input) |
| Escape | Close topmost overlay |

### TranscriptionCard Metadata Footer

Cards display optional inference metadata below the text:
```
⚡ 1250ms  ✓ 94.5%  large-v3-turbo
```
- Monospace font, `var(--text-tertiary)` color
- `border-t-2 border-[var(--border-default)]` separator
- Fields only render when present (graceful degradation)

---

**This is the MojoVoice design system. Every design decision should reference this document. No compromises. All signal.**
