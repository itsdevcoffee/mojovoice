import { useEffect, useState } from 'react';

/** Keys that are fine on their own (they don't type text) */
const STANDALONE_KEYS = /^(F([1-9]|1[0-9]|2[0-4])|Pause|ScrollLock|Insert|PrintScreen)$/;

const MODIFIER_CODES = new Set([
  'ControlLeft', 'ControlRight', 'AltLeft', 'AltRight',
  'ShiftLeft', 'ShiftRight', 'MetaLeft', 'MetaRight',
]);

/**
 * Hotkey string in the daemon's format (global-hotkey: modifiers, then a
 * KeyboardEvent.code key name), e.g. "Ctrl+Shift+KeyD" or "F9".
 */
function comboFromEvent(e: KeyboardEvent): string | null {
  if (MODIFIER_CODES.has(e.code)) return null;
  const mods = [
    e.ctrlKey && 'Ctrl',
    e.altKey && 'Alt',
    e.shiftKey && 'Shift',
    e.metaKey && 'Super',
  ].filter(Boolean) as string[];
  return [...mods, e.code].join('+');
}

/** "Ctrl+Shift+KeyD" -> "Ctrl+Shift+D" */
export function formatHotkey(combo: string): string {
  return combo
    .split('+')
    .map((part) => part.replace(/^Key([A-Z])$/, '$1').replace(/^Digit([0-9])$/, '$1'))
    .join('+');
}

interface HotkeyInputProps {
  value: string | null;
  onChange: (combo: string) => void;
  disabled?: boolean;
}

export default function HotkeyInput({ value, onChange, disabled }: HotkeyInputProps) {
  const [capturing, setCapturing] = useState(false);
  const [hint, setHint] = useState('');

  useEffect(() => {
    if (!capturing) return;
    const onKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.code === 'Escape') {
        setCapturing(false);
        setHint('');
        return;
      }
      const combo = comboFromEvent(e);
      if (!combo) return; // still holding modifiers
      const hasModifier = combo.includes('+');
      if (!hasModifier && !STANDALONE_KEYS.test(e.code)) {
        setHint('Add Ctrl, Alt or Shift (or use F1-F24 / Pause) so normal typing still works');
        return;
      }
      setCapturing(false);
      setHint('');
      onChange(combo);
    };
    // Capture phase so the drawer's own shortcuts (e.g. Esc to close) don't fire
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [capturing, onChange]);

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <span
          className={`
            flex-1 px-3 py-2 font-mono text-xs border-2 bg-[var(--bg-void)]
            ${capturing
              ? 'border-[var(--accent-primary)] text-[var(--accent-primary)] animate-pulse'
              : 'border-[var(--border-default)] text-[var(--text-primary)]'}
          `}
          aria-live="polite"
        >
          {capturing ? 'Press a key combination… (Esc to cancel)' : value ? formatHotkey(value) : 'Not set'}
        </span>
        <button
          type="button"
          onClick={() => setCapturing((c) => !c)}
          disabled={disabled}
          className="
            px-3 py-2 font-mono text-[10px] uppercase tracking-[0.05em] shrink-0
            border-2 border-[var(--border-default)] text-[var(--text-secondary)] bg-[var(--bg-elevated)]
            hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)]
            disabled:opacity-50 disabled:cursor-not-allowed
            focus-visible:outline-2 focus-visible:outline-blue-500 focus-visible:outline-offset-2
            transition-all duration-150
          "
        >
          {capturing ? 'Cancel' : 'Change'}
        </button>
      </div>
      {hint && <p className="font-mono text-[10px] text-[var(--warning)]">{hint}</p>}
    </div>
  );
}
