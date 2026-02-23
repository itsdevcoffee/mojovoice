interface BehaviorChipProps {
  label: string;     // config key e.g. "append_space"
  value: boolean;
  saved?: boolean;
  onToggle: () => void;
}

export default function BehaviorChip({ label, value, saved, onToggle }: BehaviorChipProps) {
  return (
    <div className="flex items-center gap-3 py-1.5">
      <span className="w-28 font-mono text-xs text-[var(--text-tertiary)] shrink-0">{label}</span>
      <span className="text-[var(--accent-primary)] font-mono text-xs shrink-0">=</span>
      <button
        onClick={onToggle}
        role="switch"
        aria-checked={value}
        className={`
          flex items-center gap-1.5 px-2.5 py-1 border-2 font-mono text-xs
          transition-all duration-150
          focus-visible:outline-2 focus-visible:outline-blue-500
          focus-visible:outline-offset-2 focus-visible:shadow-[0_0_20px_rgba(59,130,246,0.5)]
          ${value
            ? 'border-blue-500/50 bg-blue-500/10 text-[var(--text-primary)]'
            : 'border-[var(--border-default)] bg-[var(--bg-elevated)] text-[var(--text-secondary)]'
          }
        `}
      >
        <span
          className={`inline-block w-2 h-2 rounded-full ${value ? 'bg-green-400' : 'bg-[var(--text-tertiary)]'}`}
        />
        {value ? '[ON]' : '[OFF]'}
      </button>
      <span
        className={`
          font-mono text-[10px] text-green-400 shrink-0 transition-opacity duration-300
          ${saved ? 'opacity-100' : 'opacity-0'}
        `}
        aria-live="polite"
        aria-atomic="true"
      >
        {saved ? '[OK]' : ''}
      </span>
    </div>
  );
}
