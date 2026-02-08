# Modern Form Control Design Patterns (2026)

**Research Date:** February 8, 2026
**Purpose:** Comprehensive analysis of modern form control design patterns for MojoVoice UI enhancement
**Scope:** Buttons, dropdowns, sliders, toggles, text inputs, focus states, animations, and accessibility

---

## Table of Contents

1. [Button Designs](#button-designs)
2. [Dropdown & Select Components](#dropdown--select-components)
3. [Slider & Range Input Designs](#slider--range-input-designs)
4. [Toggle Switch Designs](#toggle-switch-designs)
5. [Text Input & Textarea Designs](#text-input--textarea-designs)
6. [Focus States & Accessibility](#focus-states--accessibility)
7. [Hover & Active States](#hover--active-states)
8. [Animations & Micro-Interactions](#animations--micro-interactions)
9. [Component Libraries & Design Systems](#component-libraries--design-systems)
10. [Recommendations for MojoVoice](#recommendations-for-mojovoice)

---

## Button Designs

### Button Variants & Types

Modern button designs in 2026 emphasize clear visual hierarchy through multiple variants:

**Primary Buttons:** High-contrast, solid backgrounds for main actions
- Use saturated brand colors with sufficient contrast (4.5:1 minimum)
- Typically the only primary button visible per screen section
- Reserved for primary calls-to-action (submit, save, continue)

**Secondary Buttons:** Medium emphasis for alternative actions
- Often outlined or ghost style with transparent backgrounds
- Used for "Cancel", "Back", or secondary options
- Maintain visual weight below primary buttons

**Ghost Buttons:** Minimal visual weight
- Transparent backgrounds with subtle borders
- Clean, minimalist appearance
- Best for tertiary actions or when focusing on surrounding content
- Work well in dense interfaces to reduce visual noise

**Pill Buttons:** Rounded edges for friendly aesthetics
- Fully rounded borders (`border-radius: 9999px`)
- Approachable feel, ideal for tags, filters, or onboarding
- Popular in consumer-facing applications

**Icon Buttons:** Action buttons with icons only
- Minimum 44x44px touch target size (mobile)
- Must include accessible labels (aria-label or sr-only text)
- Common for toolbars, media controls, and compact interfaces

### Button States

Every button should implement these essential states:

1. **Default:** Resting state, clearly identifiable as interactive
2. **Hover:** Subtle visual feedback on cursor movement (desktop only)
3. **Active:** Visual confirmation during click/tap
4. **Focus:** Keyboard navigation indicator (see [Focus States](#focus-states--accessibility))
5. **Disabled:** Reduced opacity (typically 0.5-0.6) and no pointer events
6. **Loading:** Shows progress indicator, prevents duplicate submissions

### Animation Best Practices

**Refined Button Animations** (2026 Standard):
- Subtle scaling, color shifts, or shape changes confirm user input
- Animation duration: 200-500ms (long enough to notice, short enough to maintain flow)
- Use `transform` and `opacity` for GPU-accelerated performance
- Avoid animating `width`, `height`, or complex color changes that trigger layout recalculations

**Example patterns:**
- Slight scale on active state: `transform: scale(0.98)`
- Color transition on hover: `transition: background-color 200ms ease`
- Ripple effect from click origin (Material Design pattern)
- Micro-bounce or elastic easing for playful brands

### Accessibility Considerations

- Use semantic `<button>` elements, not `<div>` with click handlers
- Include ARIA roles only when necessary (native buttons have implicit roles)
- Ensure disabled buttons are announced properly to screen readers
- Respect `prefers-reduced-motion` for users with vestibular disorders

### Mobile vs. Desktop Differences

**Mobile:** Touch interactions eliminate hover states
- Active, disabled, and loading states remain essential
- Minimum 44x44px touch targets (Apple HIG, Material Design)
- Adequate spacing between adjacent buttons (8px minimum)

**Desktop:** Full state support
- Hover and focus states critical for navigation feedback
- Consider keyboard shortcuts for frequently-used actions
- Cursor changes (`cursor: pointer`) reinforce interactivity

---

## Dropdown & Select Components

### Component Types

Modern dropdown implementations fall into three main categories:

**1. Standard Dropdown**
- Single selection from a list
- Typically native `<select>` with custom styling or fully custom components
- Best for 5-15 options

**2. Multi-Select**
- Allows selecting multiple options
- Selected items displayed as "chips" or tags
- Often includes "Select All" / "Clear All" actions
- Essential for filters, permissions, categories

**3. Combo Box (Searchable Select)**
- Combines dropdown with text input for filtering
- Critical for lists with 15+ items
- Supports both keyboard typing and arrow key navigation
- Examples: country selector, user search, tag picker

### Design Best Practices

**Visual Hierarchy:**
- Dropdown trigger should resemble a button with clear affordance (caret icon)
- Selected value(s) must be clearly visible in the trigger
- Menu appears below input if space permits, otherwise above
- Active/selected options highlighted with background color or checkmark

**Interaction Patterns:**
- Click trigger to open/close menu
- Arrow keys navigate options
- Enter/Space selects focused option
- Escape closes menu without selection
- Type-ahead filtering when search is enabled

**Scalability & Performance:**
- Lazy loading or pagination for large datasets (100+ items)
- Virtual scrolling for smooth rendering of thousands of options
- Debounced search input (300ms typical) to reduce API calls

### Multi-Select Specific Patterns

**Chip Display:**
- Selected items shown as individual removable chips
- Each chip includes label and close (×) button
- Chips wrap to multiple lines or scroll horizontally
- Consider max-height with scrolling for many selections

**Selection Management:**
- "Select All" checkbox in menu header
- "Clear All" option or button
- Selected count indicator: "3 items selected"
- Optional limit on maximum selections

### Searchable Dropdown Features

**When to Add Search:**
- List reaches ~15 items or more
- Users likely know what they're looking for
- Options have descriptive text (not just icons/numbers)

**Search UX:**
- Autofocus search input when menu opens
- Highlight matching text in results
- Show "No results" state with clear messaging
- Consider fuzzy matching for typo tolerance

### Accessibility Requirements

**Keyboard Navigation:**
- Tab to focus trigger
- Enter/Space to open menu
- Arrow keys to navigate options
- Enter/Space to select
- Escape to close without selecting

**ARIA Attributes:**
```html
<button
  aria-haspopup="listbox"
  aria-expanded="false"
  aria-controls="dropdown-menu"
>
  Select option
</button>
<ul id="dropdown-menu" role="listbox">
  <li role="option" aria-selected="false">Option 1</li>
</ul>
```

**Screen Reader Support:**
- Announce current selection
- Announce number of results when filtering
- Announce "X of Y" when navigating options

### Component Library Examples

**Material UI (React):** `multiple` prop enables multi-select
**Carbon Design System:** States include enabled, hover, focus, error, warning, disabled, skeleton, read-only
**Mantine:** Auto-positioning based on available viewport space
**Semantic UI:** Built-in search functionality for large lists

### Mobile Considerations

**Touch Targets:**
- Dropdown trigger: minimum 44px height
- Menu options: minimum 44px touch targets
- Adequate spacing between options (8-12px)

**Native vs. Custom:**
- Consider native `<select>` on mobile for better OS integration
- Custom dropdowns should match platform conventions
- Test with screen readers on actual devices

---

## Slider & Range Input Designs

### When to Use Sliders

**Ideal Use Cases:**
- Approximate values more important than precision (volume, brightness)
- Price range filtering (min/max dual sliders)
- Media playback scrubbing
- Color/value adjustments with live preview
- Settings with continuous ranges (sensitivity, speed)

**When to Avoid:**
- Precise numeric input required → use text input instead
- Binary choices → use toggle or checkbox
- Small number of discrete options → use radio buttons or segmented control

### Design Best Practices

**Visual Feedback Requirements:**

1. **Current Value Display**
   - Show numeric value, percentage, or icon representation
   - Position near thumb or in fixed location
   - Update in real-time during drag
   - Examples: "75%", "$50-$200", "3.5 stars"

2. **Track & Fill**
   - Inactive portion: muted color (gray)
   - Active/filled portion: primary or accent color
   - Clear visual distinction between filled and unfilled
   - Technique: `linear-gradient` controlled via CSS custom properties

3. **Handle/Thumb Design**
   - Minimum 44px width for mobile usability
   - Larger than track thickness for easy grabbing
   - Visual depth (shadow, border) to suggest draggability
   - Active state: slightly larger or color change
   - Focus state: prominent outline (see accessibility section)

### Advanced Slider Patterns

**Dual-Handle Range Sliders** (min/max):
- Two independently draggable thumbs
- Filled track between handles
- Prevent thumbs from crossing
- Common for price filters (Airbnb example)
- Display both values: "Minimum: $50 | Maximum: $200"

**Stepped Sliders:**
- Discrete increments instead of continuous
- Visual indicators (dots/ticks) at each step
- Snap to nearest step on release
- Set appropriate `step` attribute (10-20% of total range)
- Example: star rating (0.5 increments)

**Sliders with Preset Buttons:**
- Combine slider with quick-access buttons
- Example: Spotify playback speed (0.5x, 1x, 1.5x, 2x presets + slider)
- Provides both precision and convenience

### Interaction Patterns

**Input Methods:**
- Drag handle with mouse or touch
- Click anywhere on track to jump to value
- Arrow keys for fine adjustments (when focused)
- Optional: text input field for precise values

**Live Preview:**
- Update dependent content in real-time
- Examples: color picker showing new color, price filter updating results
- Debounce expensive operations (300-500ms)
- Consider "Apply" button for heavy computations

### Notable Examples from Research

**Airbnb Price Filter:**
- Dual-handle slider with color-filled active range
- Real-time results update as you drag
- Min/Max price inputs alongside slider
- Responsive to both slider and text input changes

**Amplitude Pricing Slider:**
- Real-time updates across three metrics: MTUs, cost per MTU, total monthly price
- Demonstrates value of live feedback

**Adobe Photoshop Color Picker:**
- Multiple color model sliders (HSB, RGB, CMYK, HEX)
- Live preview showing "new" vs. "current" color side-by-side
- Immediate visual feedback for professional workflows

### Accessibility Requirements

**Keyboard Controls:**
```
Left/Down Arrow: Decrease value
Right/Up Arrow: Increase value
Home: Minimum value
End: Maximum value
Page Up/Down: Larger increments (optional)
```

**ARIA Attributes:**
```html
<input
  type="range"
  role="slider"
  aria-valuemin="0"
  aria-valuemax="100"
  aria-valuenow="50"
  aria-label="Volume"
/>
```

**Additional Considerations:**
- Clearly labeled endpoints ("Less expensive" / "More expensive")
- Optional `data-text-unit` for screen reader context ("dollars", "percent")
- Visible focus indicator on thumb (3:1 contrast minimum)
- Consider providing text input alternative for precision

### Custom Styling Techniques (2026)

**Modern CSS Approach:**
```css
/* Use CSS custom properties for dynamic fill */
input[type="range"] {
  --value: 50;
  --min: 0;
  --max: 100;
  background: linear-gradient(
    to right,
    var(--primary-color) 0%,
    var(--primary-color) calc((var(--value) - var(--min)) / (var(--max) - var(--min)) * 100%),
    var(--track-color) calc((var(--value) - var(--min)) / (var(--max) - var(--min)) * 100%),
    var(--track-color) 100%
  );
}
```

**Thumb Customization:**
- Box-shadow for depth and focus states
- `border-radius` for shape (circular or rounded square)
- `transform` for hover/active animations (scale, translate)
- Vendor prefixes still needed for cross-browser compatibility

### Common Mistakes to Avoid

1. Missing context or labels (users don't know what they're adjusting)
2. Too many sliders on one screen (overwhelming)
3. Ignoring accessibility (no keyboard support, missing ARIA)
4. No undo/reset functionality
5. Inconsistent interaction patterns across application
6. Handle too small for mobile (less than 44px)

---

## Toggle Switch Designs

### Definition & Use Cases

A toggle switch is a digital on/off control for choosing between two mutually exclusive options. Unlike checkboxes or radio buttons, toggles imply **immediate action**—like a physical light switch.

**When to Use Toggles:**
- Settings that apply instantly (Dark mode, Notifications, WiFi)
- Binary states with immediate feedback
- Mobile interfaces where space is limited
- User preferences that don't require form submission

**When NOT to Use Toggles:**
- Inside forms with a Submit button (creates confusion about when changes apply)
- For multiple related options (use checkboxes instead)
- When action isn't immediate (use checkbox with submit)
- For actions requiring confirmation (use button or dialog)

### Design Guidelines (Nielsen Norman Group Standards)

**Visual Design Requirements:**

1. **Immediate Recognition**
   - Should resemble a slider control at first glance
   - Track + handle combination
   - Handle position indicates state (left = off, right = on)

2. **State Indication**
   - High-contrast colors to signal ON vs OFF
   - Movement animation when toggling (position change)
   - Optional: Color change (track and/or handle)
   - Optional: State labels within or beside toggle ("ON" / "OFF")

3. **Cultural Considerations**
   - Avoid relying solely on color (red ≠ "on" universally)
   - Consider cultural reading direction (RTL languages)
   - Combine color with position and labels

**Label Best Practices:**

- **Be concise and direct:** "Email notifications" not "Do you want to receive email notifications?"
- **Describe the ON state:** Label should make sense when you say it aloud with "on/off" appended
- **Avoid questions:** Use scannable, imperative language
- **Non-neutral language:** Make the action/state clear

**Examples:**
- ✅ Good: "Dark mode", "Auto-save", "Email notifications"
- ❌ Poor: "Enable dark mode?", "Would you like auto-save?", "Notifications settings"

### Modern Visual Trends (2026)

**Rolling Ball Toggle:**
- Round handle that rolls from one side to other
- Rotation animation applied to the handle itself
- CSS `transform: rotate()` for smooth motion
- Popular for playful or consumer-facing interfaces

**Liquid Toggle:**
- Fluid-like animation effect when switching
- Button appears to melt, stretch, or ripple
- Achieved with SVG morphing or advanced CSS
- Best for high-end or creative applications
- Performance consideration: use CSS `transform` and `opacity`

**Rocker Switch:**
- Mimics physical rocker switch design
- Pivoting switch body rocks from one end to other
- 3D appearance with shadows and gradients
- Familiar to users from physical devices

**Minimalist Toggle:**
- Simple circle sliding on a track
- Flat design with subtle shadows
- Focus on clarity over decoration
- Fastest performance, easiest to implement

### Interaction Patterns

**Input Methods:**
- Click/tap anywhere on toggle to switch state
- Drag handle to switch (optional, but expected on mobile)
- Space bar when focused (keyboard accessibility)

**Animation Duration:**
- 200-300ms for state transition
- Use easing functions: `ease-in-out` or `cubic-bezier`
- Respect `prefers-reduced-motion` media query

**Feedback:**
- Immediate visual change (no delay)
- Optional: Haptic feedback on mobile
- Optional: Sound effect (mute/unmute, click)
- Toast notification if state change affects other UI

### Platform-Specific Considerations

**iOS:**
- Toggle in ON position moves to **right**
- Green fill by default for ON state
- Native UISwitch component widely recognized

**Android:**
- Toggle placement may vary (Material Design evolving)
- Uses thumb that slides along track
- State color customizable per app theme

**Web:**
- No native HTML toggle element (using checkboxes styled as toggles)
- Should match user's OS conventions when possible
- Provide consistent experience across your app

### Accessibility Requirements

**Keyboard Support:**
- Tab to focus toggle
- Space to toggle state
- Enter also acceptable for toggling
- Clear focus indicator (see [Focus States](#focus-states--accessibility))

**Screen Reader Support:**
```html
<label>
  <input
    type="checkbox"
    role="switch"
    aria-checked="false"
  />
  <span class="toggle-visual"></span>
  Email notifications
</label>
```

**ARIA Best Practices:**
- Use `role="switch"` to distinguish from checkboxes
- `aria-checked` instead of native `checked` attribute when using custom markup
- `aria-label` or visible label required
- Announce state changes to screen readers

### Consistency Requirements

**Application-wide Standards:**
- Use toggles consistently throughout your app
- Don't mix toggles and checkboxes for similar functions
- Maintain same size, animation, and behavior
- Document toggle usage in your design system

### Common Mistakes to Avoid

1. Using toggles in forms that require submission
2. Unclear labels (questions instead of statements)
3. No immediate feedback when toggling
4. State not visually obvious (color only, no position)
5. Toggle too small for touch targets (minimum 44x44px)
6. Missing disabled state when toggle unavailable

---

## Text Input & Textarea Designs

### Input Field Patterns

**Standard Text Input:**
- Single-line text entry
- Border or underline to define field boundaries
- Minimum 44px height for mobile touch targets
- Adequate padding for comfortable reading (12-16px horizontal)

**Textarea:**
- Multi-line text entry
- Minimum 3-4 rows visible
- Resizable (allow vertical resize, disable horizontal)
- Consider auto-expanding based on content
- Character counter for length-limited fields

### Labeling Strategies

**Static Labels (Traditional):**
- Label positioned above input field
- Always visible, never obscured
- Best for accessibility and clarity
- More vertical space required
- Recommended by WCAG and accessibility experts

**Floating Labels (Material Design):**
- Placeholder text that "floats" above field when focused or filled
- Saves vertical space
- Modern, clean aesthetic
- Introduced by Google's Material Design guidelines
- Best practice: ensure sufficient contrast and size when floating

**Inline Labels (Placeholder Text):**
- Label disappears when user types
- Least accessible option
- Avoid for critical fields (users forget what they're entering)
- OK for simple, obvious fields like search boxes

**Label Best Practices:**
- Keep labels concise and direct
- Use sentence case, not title case
- Describe what information is expected
- Avoid questions in labels
- Include optional/required indicators

### Input States

**1. Default (Empty):**
- Neutral border color (gray)
- Placeholder text if appropriate (muted color, 0.6-0.7 opacity)
- Cursor changes to text input (I-beam) on hover

**2. Focus:**
- Highlighted border (primary color, increased thickness)
- Optional: Glow or shadow effect
- Remove placeholder text or keep depending on pattern
- Floating label moves up (if using floating pattern)

**3. Filled:**
- User has entered content
- Validation indicator (checkmark if valid, nothing if neutral)
- Floating label remains in elevated position

**4. Error:**
- Red border (ensure 4.5:1 contrast)
- Error message below field (specific, actionable)
- Error icon for visual reinforcement
- Announced to screen readers

**5. Success/Valid:**
- Green checkmark or border (optional)
- Success message if appropriate
- Don't overdo validation feedback (can be distracting)

**6. Disabled:**
- Grayed out appearance (0.5-0.6 opacity)
- Cursor becomes default (not text input)
- Clear visual distinction from enabled state

**7. Read-only:**
- Similar to disabled but may have higher contrast
- User can focus and select text but not edit
- Used for displaying pre-filled data

### Floating Labels Implementation

**Benefits:**
- Uses less vertical space
- Clean, modern aesthetic
- Maintains context (label visible after typing)
- Good for mobile forms with limited screen space

**Accessibility Concerns:**
- Can be harder to implement accessibly than static labels
- Ensure label remains readable when floating (size, contrast)
- Animation should respect `prefers-reduced-motion`
- Some screen reader users prefer static labels

**CSS Implementation:**
```css
.input-wrapper {
  position: relative;
}

.floating-label {
  position: absolute;
  left: 16px;
  top: 16px;
  transition: all 200ms ease;
  pointer-events: none;
}

input:focus ~ .floating-label,
input:not(:placeholder-shown) ~ .floating-label {
  top: -8px;
  font-size: 12px;
  background: white;
  padding: 0 4px;
}
```

**Bootstrap 5 Implementation:**
- Native floating labels support in Bootstrap 5.0+
- Accessible and tested implementation
- CSS/SCSS library available

### Input Enhancement Patterns

**Autofill & Autocomplete:**
- Implement HTML autocomplete attributes (`autocomplete="email"`)
- Dramatically reduces typing burden
- Browsers provide secure autofill for common fields
- Predictive text for known values

**Input Masking:**
- Format input as user types (phone numbers, credit cards, dates)
- Provide visual guidance for expected format
- Example: `(555) 123-4567` auto-formatted from `5551234567`
- Use libraries or native `inputmode` attribute

**Inline Validation:**
- Real-time feedback as users type
- Debounce validation checks (300-500ms after typing stops)
- Show errors only after user leaves field or after debounce
- Don't show errors while user is actively typing
- Provide specific, actionable error messages

**Search Input Enhancements:**
- Search icon within input (left side)
- Clear button (× icon) when input has text
- Dropdown suggestions as user types
- Keyboard navigation (arrows to select suggestion, Enter to submit)
- "Recent searches" when focused

### Mobile-Specific Patterns

**Input Types:**
- Use semantic input types for mobile keyboards:
  - `type="email"` → email keyboard with @
  - `type="tel"` → numeric dialpad
  - `type="number"` → number keyboard
  - `type="url"` → URL keyboard with .com
  - `type="date"` → native date picker

**Mobile Optimizations:**
- Larger text size (16px minimum to prevent zoom on iOS)
- Adequate touch targets (44x44px minimum)
- Clear field button for easy text removal
- Date pickers, sliders, toggles preferred over typing

### Accessibility Requirements

**Required Attributes:**
```html
<label for="email">Email address</label>
<input
  type="email"
  id="email"
  name="email"
  autocomplete="email"
  aria-describedby="email-help"
  aria-required="true"
/>
<div id="email-help">We'll never share your email.</div>
```

**Focus Management:**
- Clear focus indicator (see [Focus States](#focus-states--accessibility))
- Tab order follows logical flow
- Error messages announced to screen readers
- Required fields clearly marked (not color alone)

**ARIA for Validation:**
```html
<input
  type="email"
  aria-invalid="true"
  aria-errormessage="email-error"
/>
<div id="email-error" role="alert">
  Please enter a valid email address.
</div>
```

### Form Design Best Practices (2026)

**Simplicity & Structure:**
- Keep forms concise—only essential fields
- Single-column layouts reduce errors and improve completion
- Group related fields logically
- Use progressive disclosure for complex forms

**Visual Design:**
- Consistent branding (colors, fonts, spacing)
- Strategic whitespace prevents overcrowding
- Maintain 4.5:1 contrast ratio minimum for text
- Intuitive icons to guide users

**Trust & Security:**
- Clearly communicate privacy policies
- Display security measures (SSL, encryption)
- CAPTCHA alternatives (simple checkboxes, honeypot fields)
- Immediate confirmation messages on submission

**Mobile-First Approach:**
- 53%+ of traffic is mobile
- Touch-friendly inputs with adequate sizing
- Mobile-optimized controls (date pickers, sliders, toggles)
- Avoid tiny text or cramped layouts

---

## Focus States & Accessibility

### WCAG Requirements (2026)

Focus indicators are **required** for WCAG compliance. Removing or hiding them violates **Success Criterion 2.4.7: Focus Visible (Level A)**.

**Key WCAG Criteria:**

**SC 2.4.7 - Focus Visible (Level A):**
- "Any keyboard operable user interface has a mode of operation where the keyboard focus indicator is visible"
- Minimum requirement for accessibility compliance
- Cannot be disabled or removed

**SC 1.4.11 - Non-Text Contrast (Level AA):**
- Focus indicators require "a contrast ratio of at least 3:1 against adjacent color(s)"
- Applies to component states including focus

**SC 2.4.13 - Focus Appearance (Level AAA):**
Two conditions must be met:
1. Focus indicator must be "at least as large as the area of a 2 CSS pixel thick perimeter"
2. Contrast ratio of "at least 3:1 between the same pixels in the focused and unfocused states"

**SC 2.4.11 & 2.4.12 - Focus Not Obscured (Level AA & AAA):**
- Focused elements must remain visible
- Cannot be hidden behind other content (modals, sticky headers)

### Design Requirements

**Minimum Area Standards:**

✅ **Solid outline:** 2px thickness meets minimum area
✅ **Dashed outline:** 4px thickness required to compensate for gaps
⚠️ **Inner outlines:** May need 3px+ thickness depending on positioning

**Contrast Positioning:**

The location of your focus indicator determines which colors it must contrast against:

- **Outside the component:** Contrast with background colors only
- **Inside the component:** Contrast with component's background
- **Along the border:** Contrast with BOTH internal and external backgrounds

### Universal Focus Indicator Solution

The most reliable cross-browser, cross-theme solution uses a **black-and-white outline combination**:

```css
:focus-visible {
  outline: 3px solid black;
  box-shadow: 0 0 0 6px white;
}
```

**Why this works:**
- Provides sufficient contrast against virtually any background
- Black outline visible on light backgrounds
- White shadow visible on dark backgrounds
- 3px + 6px = 9px total indicator area (exceeds 2px minimum)
- Works in both light and dark themes

### Implementation Best Practices

**Use `:focus-visible` instead of `:focus`:**

The `:focus-visible` selector displays indicators only for keyboard navigation, hiding them from mouse users—matching modern browser behavior.

```css
/* Modern approach */
button:focus-visible {
  outline: 2px solid var(--focus-color);
  outline-offset: 2px;
}

/* Backwards compatibility (if needed) */
button:focus {
  outline: 2px solid var(--focus-color);
  outline-offset: 2px;
}
button:focus:not(:focus-visible) {
  outline: none; /* Remove for mouse clicks */
}
```

**Common Patterns:**

**Offset Outline (Recommended):**
```css
.button:focus-visible {
  outline: 2px solid purple;
  outline-offset: 2px;
}
```
- Creates space between component and indicator
- Prevents overlap with component borders
- Easier to see on complex backgrounds

**Box Shadow Alternative:**
```css
.input:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgba(66, 153, 225, 0.5);
}
```
- Softer appearance with transparency
- Can create glow effect
- Ensure sufficient contrast even with alpha

**Combined Approach:**
```css
.card:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
  box-shadow: 0 0 8px rgba(var(--primary-rgb), 0.3);
}
```
- Outline ensures accessibility
- Shadow adds visual polish
- Best of both worlds

### Platform-Specific Examples

**Wise Design System:**
- 2px outline with 2px offset
- Saturated purple color for high visibility
- 3:1 contrast ratio against backgrounds
- Consistent across all interactive elements

**U.S. Web Design System:**
- Focus indicators on all interactive components
- High contrast against any background
- Follows Section 508 compliance requirements

**Scotland Design System:**
- Yellow focus indicators (high contrast)
- 3px solid outline
- Offset pattern for clear separation

### Testing Checklist

✅ **Outline thickness:** Minimum 2px solid or 4px dashed
✅ **Contrast ratio:** At least 3:1 against adjacent colors
✅ **Visibility:** Indicator appears only on keyboard focus (`:focus-visible`)
✅ **Obstruction:** Focused element remains fully visible
✅ **Browser testing:** Chrome, Firefox, Safari, Edge
✅ **Screen reader testing:** NVDA, JAWS, VoiceOver
✅ **Keyboard navigation:** Tab, Shift+Tab, Arrow keys work correctly

### WCAG 3.0 Updates (January 2026)

The W3C published an Editor's Draft of **WCAG 3.0** on January 5, 2026:

- Moves beyond page-centric WCAG 2.x model
- Explicitly targets modern web applications
- Focuses on interactive components, media/VR, authoring tools
- Outcome-based approach rather than strict technical rules
- App-level testing methodology

**Impact on form controls:**
- Greater emphasis on component-level accessibility
- More focus on real-world user outcomes
- Testing interactive patterns, not just static content

### Common Focus Indicator Mistakes

❌ **Removing default outlines** without replacement
❌ **Low contrast** indicators (less than 3:1)
❌ **Thin outlines** (less than 2px solid)
❌ **Focus hidden** by other UI elements
❌ **Using `:focus` instead of `:focus-visible`** (shows on mouse clicks)
❌ **Inconsistent indicators** across the application
❌ **Color-only indicators** without sufficient contrast

### Browser Default Status

**Important Note:** Default browser focus indicators are exempt from WCAG contrast requirements, but they often fail real-world usability tests. Custom indicators are recommended to ensure:

- Consistency across browsers
- Compatibility with your site's color scheme
- Sufficient visibility for users with low vision
- Brand alignment and professional appearance

---

## Hover & Active States

### Button State Design (2026 Best Practices)

Every interface should implement these essential states for buttons and interactive elements:

**State Hierarchy:**
1. **Default** → Resting state
2. **Hover** → Cursor movement feedback (desktop only)
3. **Focus** → Keyboard navigation indicator
4. **Active** → Click/tap confirmation
5. **Disabled** → Unavailable state

### Hover State Design

**Purpose:**
- Provide immediate feedback that element is interactive
- Invite user to click
- Desktop-only state (no touch screens)

**Visual Techniques:**

**Color Shift:**
- Lighten or darken background by 10-20%
- Increase saturation for vibrancy
- Shift hue slightly for subtle effect
```css
.button {
  background: hsl(220, 70%, 50%);
}
.button:hover {
  background: hsl(220, 80%, 55%); /* More saturated, slightly lighter */
}
```

**Shadow Effects:**
- Add or increase box-shadow for depth
- Subtle elevation suggests pressability
```css
.button:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}
```

**Scale Transform:**
- Slight enlargement (1.02-1.05x scale)
- Suggests element coming forward
```css
.button:hover {
  transform: scale(1.05);
}
```

**Opacity Changes:**
- Reduce opacity slightly for ghost buttons
- Increase opacity for semi-transparent elements

**Cursor Changes:**
- `cursor: pointer` for clickable elements
- `cursor: grab` for draggable elements
- `cursor: zoom-in` for zoomable images

### Active State Design

**Purpose:**
- Confirm click/tap was registered
- Provide tactile feedback in digital interface
- Reduces accidental repeat taps

**Visual Techniques:**

**Scale Down:**
- Slight compression (0.95-0.98x scale)
- Mimics physical button press
```css
.button:active {
  transform: scale(0.98);
}
```

**Color Darkening:**
- Darker shade than hover state
- Suggests depth/pressure
```css
.button:active {
  background: hsl(220, 70%, 40%); /* Darker than default and hover */
}
```

**Shadow Reduction:**
- Decrease shadow to suggest pressed-down state
```css
.button:active {
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}
```

**Border/Inset Changes:**
- Inner shadow for pressed appearance
```css
.button:active {
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.2);
}
```

### Animation Timing & Performance

**Transition Duration Guidelines:**
- **Hover transitions:** 150-250ms
  - Quick enough to feel responsive
  - Slow enough to see the change

- **Active transitions:** 100-150ms
  - Instant feedback critical
  - Shorter than hover for immediate confirmation

**Easing Functions:**
```css
/* Hover: ease-out (quick start, slow finish) */
.button {
  transition: all 200ms ease-out;
}

/* Active: ease-in (slow start, quick finish) */
.button:active {
  transition: all 100ms ease-in;
}

/* Combined smooth motion */
.button {
  transition: transform 200ms cubic-bezier(0.4, 0, 0.2, 1);
}
```

**Performance Optimization:**

✅ **Animate these properties (GPU-accelerated):**
- `transform` (scale, translate, rotate)
- `opacity`
- `filter` (use sparingly)

❌ **Avoid animating these (triggers layout recalculation):**
- `width` / `height`
- `padding` / `margin`
- `top` / `left` / `bottom` / `right`
- `background-position`

**Modern Best Practice:**
```css
.button {
  /* Use transform for performance */
  transition: transform 200ms ease, opacity 200ms ease;
}
.button:hover {
  transform: translateY(-2px);
  opacity: 0.9;
}
```

### Consistent Transitions

**Design System Approach:**
Employ consistent transitions across the application. Example flow:

```css
/* Smooth state progression */
.button {
  background: var(--button-bg);
  transform: scale(1);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  transition: all 200ms ease;
}

.button:hover {
  background: var(--button-bg-hover);
  transform: scale(1.02);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
}

.button:active {
  background: var(--button-bg-active);
  transform: scale(0.98);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
}
```

**Benefits:**
- Predictable user experience
- Professional polish
- Easier to maintain in design system
- Users learn interaction patterns

### Mobile vs. Desktop Considerations

**Mobile (Touch Interfaces):**
- ❌ NO hover states (no cursor)
- ✅ Active states critical
- ✅ Disabled states essential
- ✅ Loading states for async actions
- Consider ripple effect (Material Design) for touch feedback

**Desktop (Mouse + Keyboard):**
- ✅ All states required
- ✅ Hover provides pre-click feedback
- ✅ Focus for keyboard navigation
- ✅ Active confirms click

**Responsive Approach:**
```css
/* Desktop only hover effects */
@media (hover: hover) and (pointer: fine) {
  .button:hover {
    background: var(--button-bg-hover);
  }
}

/* Touch devices: skip hover, go straight to active */
@media (hover: none) and (pointer: coarse) {
  .button:active {
    background: var(--button-bg-active);
  }
}
```

### Accessibility with Hover/Active States

**ARIA Attributes:**
```html
<!-- Button state changes -->
<button
  aria-pressed="false"
  aria-disabled="false"
  aria-busy="false"
>
  Submit
</button>
```

**Reduced Motion:**
```css
/* Respect user preferences */
@media (prefers-reduced-motion: reduce) {
  .button {
    transition: none;
  }
}
```

**Color Contrast:**
- Ensure all states meet 4.5:1 contrast (text)
- Ensure 3:1 contrast for component states (borders, backgrounds)
- Test hover/active states with color contrast tools

### Common Hover/Active Mistakes

❌ **Hover too subtle** → users don't realize element is interactive
❌ **Hover too dramatic** → distracting, unprofessional
❌ **Active state same as hover** → no click confirmation
❌ **Long transition duration** → feels sluggish (>300ms)
❌ **Animating expensive properties** → janky performance
❌ **Hover effects on mobile** → breaks touch experience
❌ **No `cursor: pointer`** → misses affordance cue
❌ **Inconsistent across app** → confusing experience

### Examples from Popular Design Systems

**Material Design (2026):**
- Ripple effect on tap/click (emanates from touch point)
- Subtle elevation change on hover (shadow increase)
- State overlay system (hover, focus, active overlays with opacity)

**Ant Design:**
- Color shift on hover (primary color at 80% opacity)
- Slight darken on active
- Loading state with spinner replacing content

**Tailwind CSS Utilities:**
```html
<button class="
  bg-blue-500
  hover:bg-blue-600
  active:bg-blue-700
  transform
  hover:scale-105
  active:scale-95
  transition
  duration-200
">
  Click me
</button>
```

**Shadcn/ui Pattern:**
- Subtle color transitions
- Consistent across all components
- Respects theme (light/dark)
- Focus-visible for keyboard navigation

---

## Animations & Micro-Interactions

### Definition & Purpose

**Micro-interactions** are small, specific moments with a single purpose:
- Provide feedback
- Guide behavior
- Indicate change

**Examples:**
- Button that changes color when pressed
- Card that expands to reveal information
- Slider that updates a value display
- Toggle that slides smoothly between states

### Design Principles (2026 Best Practices)

**1. Timing & Duration**

Ideal duration: **200-500ms**
- Long enough to be noticed
- Short enough to maintain flow
- Exceptions: Loading states (longer OK), exit animations (faster)

**Critical Timing Rules:**
- **Instant feedback:** 0-100ms (button press acknowledgment)
- **Quick interaction:** 100-200ms (hover effects, toggles)
- **Standard transition:** 200-300ms (panel expansion, color changes)
- **Moderate animation:** 300-500ms (page transitions, drawer slides)
- **Slow animation:** 500ms+ (only for emphasis or loading states)

**2. Purpose & Restraint**

> "Microinteractions are an exercise in restraint, in doing as much as possible with as little as possible."

**Guidelines:**
- Every interaction should serve a clear function
- Users feel guided, not distracted
- Don't add motion purely for visual flair
- Less is more: subtle beats flashy

**3. Feedback Mechanisms**

Feedback confirms system recognizes user action:

**Visual Feedback:**
- Color change
- Size change (scale)
- Position shift
- Opacity change
- Icon transformation

**Auditory Feedback:**
- Click sounds
- Success chimes
- Error alerts
- Notification pings

**Haptic Feedback (Mobile):**
- Vibrations on button press
- Subtle tap confirmation
- Error/success patterns

**Movement:**
- Element slides into view
- Page transitions
- Drawer animations
- Scroll-triggered effects

### Form Control Specific Micro-Interactions

**Form Submission:**
- Progress indicators (spinners, progress bars)
- Success animations (checkmark, confetti)
- Error shakes (input field wiggle)
- Disabled state while processing

**Button Interactions:**
- Subtle enlargement on press (1.02x scale)
- Color shift on hover
- Ripple effect from click origin (Material Design)
- Loading state with spinner

**Input Fields:**
- Label float animation (200-300ms)
- Validation checkmark fade-in
- Error message slide down
- Character counter update
- Password visibility toggle rotation

**Toggles:**
- Handle slide from one side to other (200-300ms)
- Track color transition
- Optional: handle rotation or scale
- State label fade

**Sliders:**
- Thumb scale on grab (1.1-1.2x)
- Value tooltip appear/disappear
- Track fill color update in real-time
- Snap animation to step increments

**Dropdowns:**
- Menu slide down/up (250ms)
- Selected option highlight
- Checkmark appearance in multi-select
- Chip add/remove animations

### Critical Pitfalls to Avoid

❌ **Overly complex animations**
- Too many properties animating at once
- Distracting from core task
- Performance issues

❌ **Inconsistent motion styles**
- Different easing functions across app
- Varying durations for similar actions
- Mixed animation patterns

❌ **Ignoring accessibility preferences**
- Not respecting `prefers-reduced-motion`
- Motion-heavy interfaces exclude users with vestibular disorders

❌ **Motion purely for visual flair**
- Animations without functional purpose
- Slowing down user tasks
- Annoying on repeated use

❌ **Forgetting to test under real conditions**
- Animations that work on dev machine but janky on low-end devices
- Not testing with slow network (loading states)
- Not testing with keyboard navigation

### Accessibility: Reduced Motion

**CRITICAL:** Respect user preferences for reduced motion.

```css
/* Default: full animations */
.element {
  transition: transform 300ms ease;
}

/* Reduced motion: instant or minimal animation */
@media (prefers-reduced-motion: reduce) {
  .element {
    transition: none;
  }

  /* OR minimal essential animation */
  .element {
    transition: opacity 150ms ease;
  }
}
```

**When to disable animations:**
- User has enabled "Reduce motion" in OS settings
- Complex, spinning, or rotating animations
- Parallax scrolling effects
- Auto-playing carousels

**What to keep:**
- Essential state changes (color, opacity fade)
- Focus indicators
- Loading states (can simplify to static spinner)

### Emerging Trends (2026)

**AI Integration:**
- Predictive micro-interactions based on user behavior
- Contextual animations that adapt to usage patterns
- Smart loading states that estimate completion time

**Voice & Gesture Controls:**
- Micro-interactions triggered by voice commands
- Gesture-based animations (swipe, pinch, rotate)
- Expanding beyond traditional click/tap

**Personalization:**
- User-configurable animation speeds
- Adaptive motion based on device performance
- Learning user preferences over time

**Advanced Form Interactions:**
- Multi-step form progress animations
- Smart field suggestions with smooth transitions
- Conditional field appearance/disappearance
- Real-time collaborative editing indicators

### Performance Best Practices

**GPU-Accelerated Properties:**
```css
/* Fast (uses GPU) */
.element {
  transform: translateX(100px);
  opacity: 0.5;
}

/* Slow (triggers layout recalculation) */
.element {
  left: 100px;
  background-position: 50% 50%;
}
```

**Will-Change Property:**
```css
/* Hint to browser for optimization */
.element {
  will-change: transform, opacity;
}

/* Remove after animation completes */
.element.animated {
  will-change: auto;
}
```

**RequestAnimationFrame:**
For JavaScript animations, use `requestAnimationFrame()` for smooth 60fps:

```javascript
function animate() {
  // Update animation state
  element.style.transform = `translateX(${position}px)`;

  if (animating) {
    requestAnimationFrame(animate);
  }
}
```

### Testing Checklist

✅ **Performance:** 60fps on target devices (no jank)
✅ **Timing:** Duration appropriate for action (200-500ms)
✅ **Purpose:** Animation serves functional purpose
✅ **Consistency:** Similar actions have similar animations
✅ **Accessibility:** `prefers-reduced-motion` implemented
✅ **Mobile:** Touch interactions have appropriate feedback
✅ **Edge cases:** Loading, error, empty states animated
✅ **Browser support:** Works across target browsers

### Notable Examples

**Spotify Playback Speed:**
- Combines preset buttons with slider
- Smooth slider thumb animation
- Value updates in real-time
- Both precision and convenience

**Material Design Ripple:**
- Emanates from click/touch origin
- Circular expansion animation
- Provides spatial feedback
- Duration: ~300ms

**Airbnb Price Filter:**
- Dual slider handles
- Real-time results update
- Smooth dragging animation
- Debounced search (300ms)

**Toggle Switches:**
- Handle slides across track (200-300ms)
- Color transition synchronized
- Optional haptic feedback on mobile
- Immediate state change (no delay)

---

## Component Libraries & Design Systems

### Leading Component Libraries (2026)

Based on comprehensive market research, here are the top component libraries for building modern form controls:

### Full Design Systems

**1. Material UI (MUI)**
- **Philosophy:** Google's Material Design implemented in React
- **Strengths:**
  - Comprehensive form components (text fields, checkboxes, radio buttons, selects)
  - Mature, battle-tested (widely used in production)
  - Extensive documentation and community support
  - Built-in theming system
- **Form Features:**
  - Floating labels
  - Input adornments (icons, buttons)
  - Helper text and error states
  - Validation integration
- **Best For:** Enterprise applications, data-heavy interfaces
- **Website:** https://mui.com/material-ui/

**2. Ant Design (AntD)**
- **Philosophy:** Enterprise-focused design system from Alibaba
- **Strengths:**
  - Rich form components optimized for admin panels
  - Powerful tables, forms, data visualization
  - Strong TypeScript support
  - Internationalization built-in
- **Form Features:**
  - Form.Item wrapper for validation
  - Complex nested forms
  - Dynamic field arrays
  - Advanced validation rules
- **Best For:** Backend systems, dashboards, admin interfaces
- **Website:** https://ant.design/

**3. Carbon Design System (IBM)**
- **Philosophy:** IBM's design language for enterprise products
- **Strengths:**
  - Accessibility-first approach
  - Comprehensive state system (hover, focus, error, warning, disabled, skeleton, read-only)
  - Dark/light theme support
  - Strong documentation
- **Form Features:**
  - Dropdown variants (standard, multiselect, combo box)
  - Inline validation
  - Skeleton loading states
  - Section 508 compliant
- **Best For:** Enterprise software, government applications
- **Website:** https://carbondesignsystem.com/

### Headless & Unstyled Primitives

**4. Radix UI**
- **Philosophy:** Low-level primitives for building design systems
- **Strengths:**
  - Unstyled, fully customizable
  - Accessibility built-in (ARIA, keyboard navigation)
  - Composable components
  - No CSS opinions
- **Form Features:**
  - Form primitive (recently added)
  - Label, Field, Error message components
  - Focus management
  - Validation support
- **Best For:** Custom design systems, full control over styling
- **Website:** https://www.radix-ui.com/
- **Note:** Foundation for Shadcn/ui

**5. Base UI**
- **Philosophy:** Unstyled components from MUI team
- **Strengths:**
  - Separated from Material Design styling
  - Performance-focused
  - TypeScript-first
  - Collaboration with Radix team
- **Form Features:**
  - Input, Select, Slider components
  - Hook-based API
  - WAI-ARIA compliant
- **Best For:** Teams wanting MUI quality without Material Design opinions
- **Website:** https://mui.com/base-ui/

### Copy-Paste & Tailwind-First

**6. Shadcn/ui** ⭐ (Highly Recommended for 2026)
- **Philosophy:** Components you own, not an NPM dependency
- **Strengths:**
  - Copy-paste components directly into your project
  - Built on Radix UI + Tailwind CSS
  - Full customization (you own the code)
  - Beautiful default styling
  - 106k+ GitHub stars
- **Form Features:**
  - Input, Textarea, Checkbox, Radio, Select
  - Field component for accessible forms
  - Input Group for addons and buttons
  - React Hook Form integration
  - Zod validation examples
- **Recent Updates (2026):**
  - February 2026: Unified Radix UI package (single dependency)
  - January 2026: Base UI support (choose Radix or Base UI)
  - Full documentation for both libraries
- **Best For:** Modern React apps, full customization needs, Tailwind users
- **Website:** https://ui.shadcn.com/

**7. Daisy UI**
- **Philosophy:** Tailwind CSS transformed into full design system
- **Strengths:**
  - Pre-styled Tailwind components
  - Theme system with 30+ themes
  - Pure CSS (no JavaScript required for styling)
  - Small bundle size
- **Form Features:**
  - Input, Textarea, Select, Checkbox, Radio, Toggle, Range
  - Form control sizing variants
  - Color variants
  - Disabled and error states
- **Best For:** Rapid prototyping, Tailwind projects, minimal JavaScript
- **Website:** https://daisyui.com/

### Enterprise & Feature-Rich

**8. Next UI**
- **Philosophy:** Modern design system for Next.js applications
- **Strengths:**
  - 210+ plug-and-play components
  - Optimized for Next.js
  - Beautiful default styling
  - TypeScript support
- **Form Features:**
  - Input with variants (bordered, underlined, faded)
  - Autocomplete component
  - Date picker, time picker
  - Form validation helpers
- **Best For:** Next.js applications, rapid development
- **Website:** https://nextui.org/

**9. Mantine**
- **Philosophy:** Fully-featured React component library
- **Strengths:**
  - 100+ components
  - Form library included (`@mantine/form`)
  - Hooks library
  - Rich ecosystem
- **Form Features:**
  - MultiSelect with search
  - DatePicker, TimeInput
  - Auto-positioning dropdowns
  - Built-in form validation
- **Best For:** Full-stack React apps, comprehensive component needs
- **Website:** https://mantine.dev/

**10. Grommet**
- **Philosophy:** Design system focused on usability and theming
- **Strengths:**
  - Intuitive components
  - Extensive theming capabilities
  - Accessibility-focused
  - Responsive by default
- **Form Features:**
  - Form component with validation
  - FormField wrapper
  - Rich input types
  - Inline error messages
- **Best For:** Design-system-first projects, heavy theming needs
- **Website:** https://v2.grommet.io/

### Government & Standards-Based

**11. U.S. Web Design System (USWDS)**
- **Philosophy:** Design system for U.S. federal government websites
- **Strengths:**
  - Section 508 compliance
  - WCAG AAA standards
  - Extensive accessibility documentation
  - Mobile-first
- **Form Features:**
  - Range slider with data attributes for screen readers
  - Form controls with built-in validation
  - Clear error messaging
  - Helper text patterns
- **Best For:** Government projects, maximum accessibility requirements
- **Website:** https://designsystem.digital.gov/

### Comparison Matrix

| Library | Styling Approach | Accessibility | TypeScript | Best Use Case |
|---------|-----------------|---------------|------------|---------------|
| **Material UI** | Styled (Material Design) | ✅ Good | ✅ Excellent | Enterprise apps |
| **Ant Design** | Styled (Ant Design) | ✅ Good | ✅ Excellent | Admin panels |
| **Carbon** | Styled (Carbon Design) | ✅✅ Excellent | ✅ Excellent | Enterprise/Gov |
| **Radix UI** | Unstyled primitives | ✅✅ Excellent | ✅ Excellent | Custom design systems |
| **Base UI** | Unstyled hooks | ✅✅ Excellent | ✅ Excellent | Custom designs |
| **Shadcn/ui** | Copy-paste (Tailwind) | ✅✅ Excellent | ✅ Excellent | Modern React apps |
| **Daisy UI** | Tailwind classes | ✅ Good | ⚠️ Limited | Rapid prototyping |
| **Next UI** | Styled (Next.js) | ✅ Good | ✅ Excellent | Next.js apps |
| **Mantine** | Styled (Emotion) | ✅ Good | ✅ Excellent | Full-stack apps |
| **USWDS** | Styled (vanilla CSS) | ✅✅ Excellent | ⚠️ N/A | Government sites |

### Key Considerations for 2026

**Developer Requirements (2026 Standards):**
- ✅ Strong TypeScript support
- ✅ First-class WCAG accessibility
- ✅ Dark and light mode theming
- ✅ Server-side rendering compatibility
- ✅ Top-tier performance (bundle size, runtime)

**Trending Approach:**
Many developers now combine:
- **Headless primitives** (Radix or Base UI) for functionality
- **Copy-paste library** (Shadcn/ui) for beautiful defaults
- **Tailwind CSS** for utility-first styling

**Why this works:**
- You own the code (no dependency lock-in)
- Accessibility built-in from primitives
- Full customization control
- Modern developer experience

---

## Recommendations for MojoVoice

Based on comprehensive research of modern form control design patterns, here are specific recommendations for enhancing MojoVoice's UI:

### 1. Adopt a Modern Component Strategy

**Recommended Approach: Shadcn/ui + Radix UI**

**Rationale:**
- **Ownership:** Copy-paste components means full control and customization
- **Accessibility:** Radix UI primitives have built-in WCAG compliance
- **Modern:** Aligns with 2026 best practices (February 2026 unified package)
- **Rust/Tauri Compatible:** React components work seamlessly with Tauri's webview
- **No Dependency Lock-in:** You own the code, can modify freely

**Implementation Steps:**
1. Initialize Shadcn/ui in the `ui/` directory
2. Copy form components (Button, Input, Select, Slider, Toggle)
3. Customize with MojoVoice brand colors and spacing
4. Extend as needed for audio-specific controls

### 2. Button Design Recommendations

**Primary Action Button (Transcribe, Process):**
```css
/* High-contrast, clear call-to-action */
background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
color: white;
padding: 12px 24px;
border-radius: 8px;
font-weight: 600;
transition: transform 200ms ease, box-shadow 200ms ease;

&:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 16px rgba(102, 126, 234, 0.3);
}

&:active {
  transform: translateY(0);
  box-shadow: 0 4px 8px rgba(102, 126, 234, 0.3);
}
```

**Secondary Buttons (Cancel, Settings):**
- Ghost style with border
- Muted colors (gray-600)
- Same size and padding as primary for consistency

**Icon Buttons (Play, Pause, Stop):**
- Minimum 44x44px touch targets
- Circular or rounded square
- Clear icon with tooltip on hover (desktop)
- Active state with subtle scale

**Loading State:**
- Disable pointer events
- Show spinner inside button
- Maintain button size (don't collapse)
- Opacity 0.7 to indicate disabled

### 3. Slider Design for Audio Controls

**Volume, Playback Speed, Sensitivity:**

**Visual Design:**
- Track: 6px height, rounded ends
- Inactive: gray-300 (light) / gray-700 (dark)
- Active fill: gradient matching primary brand colors
- Thumb: 20px circle, white with subtle shadow
- Focus ring: 3px purple outline with 2px offset

**Value Display:**
- Real-time numeric value above thumb (tooltip style)
- Fade in on drag, fade out 1s after release
- Percentage for volume (0-100%)
- Multiplier for speed (0.5x - 2.0x)

**Interaction:**
- Click track to jump to value
- Drag thumb for fine control
- Arrow keys for precise adjustments (±1%)
- Debounce actual audio changes (100ms) while updating visual immediately

**Example: Playback Speed Slider**
```typescript
// Preset buttons + slider combination (Spotify pattern)
[0.5x] [0.75x] [1.0x] [1.25x] [1.5x] [2.0x]
         [========|==========] 1.25x
```

### 4. Toggle Switches for Settings

**Use Cases in MojoVoice:**
- CUDA enabled/disabled
- Auto-save transcripts
- Speaker diarization on/off
- Dark mode toggle

**Design Pattern:**
- Modern rolling ball toggle
- Track: 48px wide × 24px tall, rounded pill
- Handle: 20px circle with 2px margin
- Animation: 200ms ease-in-out
- Colors:
  - OFF: gray-300 track, white handle
  - ON: purple-600 track, white handle
  - Position: left = off, right = on

**Accessibility:**
```html
<label>
  <input type="checkbox" role="switch" aria-checked="false" />
  <span class="sr-only">Enable CUDA acceleration</span>
  <span class="toggle-visual" aria-hidden="true"></span>
  <span>CUDA Acceleration</span>
</label>
```

### 5. Dropdown/Select Components

**Model Selection Dropdown:**
- Searchable for large model lists
- Group models by size (tiny, base, small, medium, large)
- Display model details on hover (parameters, speed estimate)
- Selected model highlighted with checkmark
- Keyboard navigation (arrow keys, type-ahead)

**Language Selection:**
- Combo box pattern (searchable)
- Recent languages at top
- Flag icons for visual recognition
- Auto-detect option

**Implementation:**
```tsx
<Select>
  <SelectTrigger>
    <SelectValue placeholder="Select model..." />
  </SelectTrigger>
  <SelectContent>
    <SelectGroup>
      <SelectLabel>Large Models</SelectLabel>
      <SelectItem value="large-v3-turbo">
        Whisper Large V3 Turbo
        <span className="text-sm text-muted">Fastest, 809M params</span>
      </SelectItem>
    </SelectGroup>
  </SelectContent>
</Select>
```

### 6. Text Input & File Path Fields

**Input Design:**
- Floating labels for clean appearance
- 48px height for comfortable touch targets
- Border: 1px solid gray-300, increases to 2px on focus
- Focus color: purple-600 with subtle glow
- Error state: red-500 border with error message below

**File Path Input Pattern:**
- Input field + Browse button combination
- Browse button: ghost style, icon + text
- Auto-complete for file paths if possible
- Validation: check file exists, show green checkmark

**Example: Model Path Input**
```tsx
<div className="input-group">
  <Input
    type="text"
    placeholder="Path to model file"
    aria-label="Model file path"
  />
  <Button variant="ghost" onClick={openFilePicker}>
    <FolderIcon /> Browse
  </Button>
</div>
```

### 7. Focus States (Critical for Accessibility)

**Universal Focus Indicator:**
```css
*:focus-visible {
  outline: 2px solid hsl(264, 70%, 50%); /* Purple brand color */
  outline-offset: 2px;
  border-radius: inherit;
}

/* High contrast mode support */
@media (prefers-contrast: high) {
  *:focus-visible {
    outline: 3px solid currentColor;
    outline-offset: 3px;
  }
}
```

**Component-Specific Focus:**
- Buttons: outline + subtle shadow
- Inputs: colored border (2px instead of 1px) + glow
- Sliders: prominent ring around thumb
- Toggles: ring around entire toggle
- Dropdowns: ring around trigger button

### 8. Animation & Micro-Interactions

**Timing Standards:**
- Button hover: 150ms
- Toggle switch: 200ms
- Dropdown open: 250ms
- Slider drag: instant visual, 100ms debounce for action
- Modal open: 300ms
- Success/error animations: 400ms

**Key Micro-Interactions:**

**Transcription Start:**
1. Button press animation (scale 0.98)
2. Transform to loading state (spinner)
3. Progress bar appears below
4. Pulse animation on processing indicator

**File Upload Success:**
1. Checkmark fade in (200ms)
2. File name appears with slide-up (250ms)
3. Subtle green glow around file card (300ms fade)

**Error Handling:**
1. Input field shake (3 quick oscillations, 400ms total)
2. Red border transition (200ms)
3. Error message slide down (250ms)
4. Error icon fade in (200ms)

**Respect User Preferences:**
```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

### 9. Dark Mode Considerations

**Color System:**
- Define CSS custom properties for all colors
- Use semantic naming (`--color-primary`, `--color-background`)
- Test all form controls in both themes
- Ensure 4.5:1 contrast in both modes

**Dark Mode Specifics:**
- Input backgrounds: dark-800 (not pure black)
- Borders: lighter in dark mode (gray-600 vs gray-300)
- Focus indicators: brighter/more saturated in dark mode
- Shadows: more subtle or use glow instead

### 10. Mobile Responsiveness

**Touch Targets:**
- All interactive elements: minimum 44x44px
- Spacing between buttons: 8px minimum
- Slider thumbs: 44px touch area (visual can be smaller)

**Mobile-Specific Patterns:**
- Native file pickers (not custom)
- Native date/time pickers if applicable
- Larger text inputs (16px font to prevent zoom on iOS)
- Bottom sheet for dropdowns (instead of popovers)

**Responsive Breakpoints:**
```css
/* Mobile first */
.container {
  padding: 16px;
}

/* Tablet and up */
@media (min-width: 768px) {
  .container {
    padding: 24px;
  }
}

/* Desktop */
@media (min-width: 1024px) {
  .container {
    padding: 32px;
  }
}
```

### 11. Performance Optimization

**Lazy Loading:**
- Load component libraries only when needed
- Code-split heavy components (color pickers, date pickers)
- Use Tauri's asset optimization

**Animation Performance:**
- Use `transform` and `opacity` only
- Avoid animating layout properties
- `will-change` for known animations
- Remove `will-change` after animation

**Bundle Size:**
- Tree-shake component libraries
- Use Shadcn/ui copy-paste to include only what you need
- Minimize CSS-in-JS runtime if possible

### 12. Accessibility Checklist for MojoVoice

**Must-Have:**
- ✅ All interactive elements keyboard accessible
- ✅ Focus indicators on all focusable elements (2px minimum, 3:1 contrast)
- ✅ ARIA labels on icon-only buttons
- ✅ Error messages associated with inputs (`aria-describedby`)
- ✅ Color contrast 4.5:1 for text, 3:1 for UI components
- ✅ Reduced motion support
- ✅ Screen reader testing (NVDA on Windows, Orca on Linux)

**Nice-to-Have:**
- ⭐ Keyboard shortcuts for common actions (Ctrl+O for open file)
- ⭐ Skip links for keyboard users
- ⭐ Live regions for status updates (`aria-live="polite"`)
- ⭐ High contrast mode support

### 13. Implementation Roadmap

**Phase 1: Foundation (Week 1-2)**
1. Install and configure Shadcn/ui
2. Implement design tokens (colors, spacing, typography)
3. Create base button components (primary, secondary, ghost, icon)
4. Implement universal focus indicators
5. Test keyboard navigation

**Phase 2: Form Controls (Week 3-4)**
1. Build/customize text inputs with floating labels
2. Implement file picker pattern
3. Create dropdown/select components for model/language selection
4. Add validation and error states
5. Test with screen readers

**Phase 3: Audio-Specific Controls (Week 5-6)**
1. Custom slider for volume, speed, sensitivity
2. Toggle switches for settings
3. Playback controls (play, pause, stop buttons)
4. Progress indicators for transcription
5. Waveform visualization (if applicable)

**Phase 4: Polish & Accessibility (Week 7-8)**
1. Implement all micro-interactions and animations
2. Add loading states and skeletons
3. Dark mode testing and refinement
4. Mobile responsive testing
5. Full accessibility audit
6. Performance optimization

### 14. Code Examples for Common Patterns

**Accessible Button with Loading State:**
```tsx
<Button
  onClick={handleTranscribe}
  disabled={isProcessing}
  aria-busy={isProcessing}
>
  {isProcessing ? (
    <>
      <Spinner className="mr-2" aria-hidden="true" />
      Processing...
    </>
  ) : (
    'Start Transcription'
  )}
</Button>
```

**Custom Slider Component:**
```tsx
<div className="slider-wrapper">
  <Label htmlFor="volume">Volume: {volume}%</Label>
  <Slider
    id="volume"
    min={0}
    max={100}
    step={1}
    value={[volume]}
    onValueChange={(val) => setVolume(val[0])}
    aria-label="Volume control"
  />
</div>
```

**Accessible Toggle:**
```tsx
<div className="flex items-center space-x-2">
  <Switch
    id="cuda"
    checked={cudaEnabled}
    onCheckedChange={setCudaEnabled}
    aria-describedby="cuda-description"
  />
  <Label htmlFor="cuda">CUDA Acceleration</Label>
</div>
<p id="cuda-description" className="text-sm text-muted">
  Use GPU for faster processing (requires CUDA toolkit)
</p>
```

### 15. Design Resources & References

**Design Inspiration:**
- [Dribbble Form Controls](https://dribbble.com/tags/form_controls) - 14+ modern designs
- [CodePen Form Collection](https://codepen.io/collection/jRDzOA) - Interactive demos
- [Awwwards](https://www.awwwards.com/) - Award-winning web designs

**Component Libraries to Reference:**
- [Shadcn/ui](https://ui.shadcn.com/) - Primary recommendation
- [Radix UI](https://www.radix-ui.com/) - Unstyled primitives
- [U.S. Web Design System](https://designsystem.digital.gov/) - Accessibility standards

**Accessibility Guides:**
- [Sara Soueidan: Focus Indicators](https://www.sarasoueidan.com/blog/focus-indicators/)
- [Nielsen Norman: Toggle Guidelines](https://www.nngroup.com/articles/toggle-switch-guidelines/)
- [WCAG 2.4.13 Focus Appearance](https://www.wcag.com/designers/2-4-13-focus-appearance/)

**Color Contrast Tools:**
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [Coolors](https://coolors.co/contrast-checker)
- [Adobe Color Accessibility](https://color.adobe.com/create/color-accessibility)

**Performance Testing:**
- [Lighthouse](https://developers.google.com/web/tools/lighthouse) - Audit accessibility and performance
- [Chrome DevTools Performance](https://developer.chrome.com/docs/devtools/performance/) - Animation profiling

---

## Summary & Key Takeaways

### Top Insights for Modern Form Controls (2026)

**1. Accessibility is Non-Negotiable**
- Focus indicators required (2px minimum, 3:1 contrast)
- Keyboard navigation essential
- ARIA attributes when semantic HTML insufficient
- Screen reader testing critical
- Respect `prefers-reduced-motion`

**2. Animation Best Practices**
- Duration: 200-500ms sweet spot
- Use `transform` and `opacity` for performance
- Every animation should serve a purpose
- Reduced motion support mandatory

**3. Component Library Trends**
- Headless primitives (Radix, Base UI) gaining popularity
- Copy-paste approach (Shadcn/ui) trending over NPM dependencies
- Developers prioritizing customization and ownership
- TypeScript support expected, not optional

**4. Design Patterns**
- **Buttons:** Clear state hierarchy, subtle animations, consistent styling
- **Sliders:** Real-time feedback, 44px thumbs, dual handles for ranges
- **Toggles:** Immediate action, position + color indication, clear labels
- **Inputs:** Floating labels popular, inline validation, mobile-optimized
- **Dropdowns:** Searchable for 15+ items, keyboard navigation, proper ARIA

**5. Mobile Considerations**
- 44x44px minimum touch targets
- No hover states (touch interfaces)
- Native controls often better UX
- Larger text (16px+ to prevent zoom)

**6. Performance Matters**
- GPU-accelerated properties only
- Lazy load heavy components
- Tree-shake libraries
- Test on low-end devices

**7. Modern Stack Recommendation**
- **Shadcn/ui** for beautiful, customizable components
- **Radix UI** for accessible primitives
- **Tailwind CSS** for utility-first styling
- **React Hook Form** + **Zod** for validation

### For MojoVoice Specifically

**Priority Implementations:**
1. ✅ **Focus indicators** - Critical for accessibility, quick win
2. ✅ **Button states** - Professional polish, better UX feedback
3. ✅ **Custom sliders** - Audio controls need precision and visual appeal
4. ✅ **Dark mode** - Essential for audio editing applications
5. ✅ **Keyboard shortcuts** - Power users expect them

**Avoid These Pitfalls:**
- ❌ Removing default focus outlines without replacement
- ❌ Animation durations > 500ms (feels sluggish)
- ❌ Toggle switches in forms with Submit buttons
- ❌ Sliders without numeric value display
- ❌ Hover effects on mobile/touch devices

**Long-term Benefits:**
- Improved accessibility → wider user base
- Professional design → increased trust and adoption
- Better UX → reduced support burden
- Component system → faster feature development

---

## Sources

### Design Inspiration & Trends
- [How to Design UI Forms in 2026: Your Best Guide | IxDF](https://www.interaction-design.org/literature/article/ui-form-design)
- [UI Design Trends 2026: 15 Patterns Shaping Modern Websites - Landdding](https://landdding.com/blog/ui-design-trends-2026)
- [Frontend Design Patterns That Actually Work in 2026](https://www.netguru.com/blog/frontend-design-patterns)
- [Top UI Design Trends & Inspiration for 2026](https://www.bookmarkify.io/blog/inspiration-ui-design)
- [Dribbble Form Controls](https://dribbble.com/tags/form_controls)
- [Dribbble Form UI](https://dribbble.com/tags/form-ui)

### Component Libraries
- [15 Best React UI Libraries for 2026](https://www.builder.io/blog/react-component-libraries-2026)
- [Best 19 React UI Component Libraries in 2026](https://prismic.io/blog/react-component-libraries)
- [14 Best React UI Component Libraries in 2026 | Untitled UI](https://www.untitledui.com/blog/react-component-libraries)
- [7 Hottest Animated UI Component Libraries of 2025](https://designerup.co/blog/copy-and-paste-ui-component-libraries/)
- [The Foundation for your Design System - shadcn/ui](https://ui.shadcn.com/)
- [February 2026 - Unified Radix UI Package - shadcn/ui](https://ui.shadcn.com/docs/changelog/2026-02-radix-ui)
- [Shadcn UI Best Practices for 2026](https://medium.com/write-a-catalyst/shadcn-ui-best-practices-for-2026-444efd204f44)

### Accessibility
- [A guide to designing accessible, WCAG-conformant focus indicators](https://www.sarasoueidan.com/blog/focus-indicators/)
- [Accessibility for Design Engineers: WCAG 2.2 Guide](https://inhaq.com/blog/accessibility-for-design-engineers-building-inclusive-uis.html)
- [Wise Design - Focus states](https://wise.design/foundations/focus-states)
- [Ultimate Guide to Accessible Form Design | UXPin](https://www.uxpin.com/studio/blog/ultimate-guide-to-accessible-form-design/)
- [2.4.13 Focus Appearance (Level AAA) - WCAG](https://www.wcag.com/designers/2-4-13-focus-appearance/)
- [W3C publishes WCAG 3.0 Editor's Draft (05 Jan 2026)](https://progosling.com/en/dev-digest/2026-02/wcag-3-editor-draft-jan-2026)
- [Understanding Success Criterion 2.4.13: Focus Appearance | W3C](https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance.html)

### Slider Design
- [40 Slider UI Examples That Work (And Why)](https://www.eleken.co/blog-posts/slider-ui)
- [35 Best Interactive Range Slider CSS Designs 2026](https://uicookies.com/range-slider-css/)
- [CSS Range Sliders Examples 2026 - Avada](https://blog.avada.io/css/range-sliders)
- [76 CSS Range Slider Examples](https://www.frontendplanet.com/css-range-slider-examples/)
- [Range slider | U.S. Web Design System](https://designsystem.digital.gov/components/range-slider/)

### Toggle Switches
- [Toggle-Switch Guidelines - NN/G](https://www.nngroup.com/articles/toggle-switch-guidelines/)
- [35 Best CSS Toggle Templates 2026](https://uicookies.com/css-toggles/)
- [Toggle button design: the full run through - Justinmind](https://www.justinmind.com/ui-design/toggle-button-patterns-examples)
- [Toggle UX: Tips on Getting it Right](https://www.eleken.co/blog-posts/toggle-ux)
- [Toggle Button Design (Best Practices Per UX Research) | UXtweak](https://www.uxtweak.com/research/toggle-button-design/)

### Text Inputs
- [10 Best Floating Label Solutions For Better Form UX](https://www.jqueryscript.net/blog/best-floating-label.html)
- [Floating labels · Bootstrap v5.3](https://getbootstrap.com/docs/5.3/forms/floating-labels/)
- [Float Labels with CSS | CSS-Tricks](https://css-tricks.com/float-labels-css/)
- [Floating vs. Static Labels: Which are More Accessible?](https://userway.org/blog/floating-vs-static-labels/)

### Dropdowns & Selects
- [Dropdown Menu UI: Best Practices and Real-World Examples](https://www.eleken.co/blog-posts/dropdown-menu-ui)
- [Dropdown – Carbon Design System](https://carbondesignsystem.com/components/dropdown/usage/)
- [React Select component - Material UI](https://mui.com/material-ui/react-select/)
- [MultiSelect | Mantine](https://mantine.dev/core/multi-select/)
- [Multi Select Dropdown — Usability Meets Scalability](https://medium.com/@karthiban/multi-select-dropdown-usability-meets-scalability-d803f6911a32)

### Button States & Hover Effects
- [Button States Explained (2026) | DesignRush](https://www.designrush.com/best-designs/websites/trends/button-states)
- [Button State Design: 20 Best Examples for UI Designers in 2025](https://www.mockplus.com/blog/post/button-state-design)
- [Designing button states: Tutorial and best practices - LogRocket](https://blog.logrocket.com/ux-design/designing-button-states/)
- [The 55 Best CSS Button Hover Effects You Can Use Too](https://www.sliderrevolution.com/resources/css-button-hover-effects/)
- [57 CSS Button Hover Effects](https://freefrontend.com/css-button-hover-effects/)

### Micro-Interactions
- [UI/UX Evolution 2026: Micro-Interactions & Motion](https://primotech.com/ui-ux-evolution-2026-why-micro-interactions-and-motion-matter-more-than-ever/)
- [5 Micro-Interaction Design Rules for Apps in 2026](https://dev.to/devin-rosario/5-micro-interaction-design-rules-for-apps-in-2026-48nb)
- [Motion Design & Micro-Interactions: What Users Expect in 2026](https://www.techqware.com/blog/motion-design-micro-interactions-what-users-expect)
- [10 Best Micro-interaction Examples to Improve UX (2026)](https://www.designstudiouiux.com/blog/micro-interactions-examples/)
- [The Role of Micro-interactions in Modern UX | IxDF](https://www.interaction-design.org/literature/article/micro-interactions-ux)

### Code Examples & Demos
- [Form Designs - a Collection by Team CodePen](https://codepen.io/collection/jRDzOA)
- [Pens tagged 'forms' on CodePen](https://codepen.io/tag/forms)
- [50+ CSS Form Examples From CodePen 2018](https://freebiesupply.com/blog/css-forms-from-codepen/)

---

**Document Version:** 1.0
**Last Updated:** February 8, 2026
**Next Review:** March 2026 (monitor for new WCAG 3.0 updates and emerging component libraries)
