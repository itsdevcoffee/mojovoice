import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
}

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  ariaLabel?: string;
  showSaved?: boolean;
}

export default function CustomSelect({
  value,
  onChange,
  options,
  ariaLabel,
  showSaved = false,
}: CustomSelectProps) {
  const [open, setOpen] = useState(false);
  const selectedLabel = options.find((o) => o.value === value)?.label ?? value;

  return (
    <div className="relative w-full">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="
          w-full flex items-center justify-between gap-2
          px-3 py-2
          bg-[var(--bg-void)]
          border-2 border-[var(--border-default)]
          hover:border-[var(--accent-primary)]
          focus:border-[var(--accent-primary)]
          focus:shadow-[0_0_20px_rgba(59,130,246,0.3)]
          focus:outline-none
          transition-all duration-150
        "
      >
        <span className="font-mono text-xs text-[var(--text-primary)] truncate">
          {selectedLabel}
        </span>
        <span className="flex items-center gap-1.5 shrink-0">
          <span
            aria-live="polite"
            aria-atomic="true"
            className={`font-mono text-[10px] text-green-400 transition-opacity duration-300 ${showSaved ? 'opacity-100' : 'opacity-0'}`}
          >
            {showSaved ? '[OK]' : ''}
          </span>
          <ChevronDown
            className={`w-3.5 h-3.5 text-[var(--text-tertiary)] transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
          />
        </span>
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />

          {/* Dropdown list */}
          <ul
            role="listbox"
            aria-label={ariaLabel}
            className="
              absolute top-full left-0 right-0 mt-0.5
              bg-[var(--bg-surface)]
              border-2 border-[var(--accent-primary)]
              shadow-[0_0_20px_rgba(59,130,246,0.5)]
              max-h-56 overflow-y-auto
              z-20
              animate-dropdown-slide
            "
          >
            {options.map((opt) => (
              <li key={opt.value} role="option" aria-selected={opt.value === value}>
                <button
                  type="button"
                  onClick={() => { onChange(opt.value); setOpen(false); }}
                  className={`
                    w-full text-left px-3 py-2
                    font-mono text-xs
                    hover:bg-[var(--bg-elevated)]
                    transition-colors duration-150
                    ${opt.value === value
                      ? 'bg-blue-500/20 text-[var(--accent-primary)]'
                      : 'text-[var(--text-primary)]'
                    }
                  `}
                >
                  {opt.label}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
