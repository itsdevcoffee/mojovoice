/**
 * UI Scaling Utilities
 *
 * Centralized scale management for the Mojo Voice UI.
 * Provides constants, validation, and helper functions for UI scaling.
 */

export type ScalePreset = 'small' | 'medium' | 'large' | 'custom';

/**
 * Predefined scale values for each preset
 */
export const SCALE_PRESETS: Record<Exclude<ScalePreset, 'custom'>, number> = {
  small: 0.85,
  medium: 1.0,
  large: 1.15,
};

/**
 * Valid scale bounds (50% to 200%)
 */
export const SCALE_BOUNDS = {
  min: 0.5,
  max: 2.0,
} as const;

/**
 * All available preset options
 */
export const PRESET_OPTIONS: readonly ScalePreset[] = ['small', 'medium', 'large', 'custom'] as const;

/**
 * Clamp a scale value to valid bounds
 */
export function clampScale(scale: number): number {
  return Math.max(SCALE_BOUNDS.min, Math.min(SCALE_BOUNDS.max, scale));
}

/**
 * Check if a string is a valid scale preset
 */
export function isValidPreset(preset: string): preset is ScalePreset {
  return PRESET_OPTIONS.includes(preset as ScalePreset);
}

/**
 * Get the effective scale value for a given preset and custom scale
 */
export function getScaleValue(preset: ScalePreset, customScale: number): number {
  if (preset === 'custom') {
    return clampScale(customScale);
  }
  return SCALE_PRESETS[preset];
}

/**
 * Apply a scale value to the document root CSS variable
 */
export function applyScale(scale: number): void {
  const clampedScale = clampScale(scale);
  document.documentElement.style.setProperty('--ui-scale', clampedScale.toString());
}
