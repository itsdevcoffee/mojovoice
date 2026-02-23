interface SettingRowProps {
  label: string;       // monospace key label e.g. "timeout_secs"
  saved?: boolean;     // when true, shows [OK] flash
  children: React.ReactNode;
}

export default function SettingRow({ label, saved, children }: SettingRowProps) {
  return (
    <div className="flex items-center gap-3 py-1.5 min-h-[36px]">
      <span className="w-28 font-mono text-xs text-[var(--text-tertiary)] shrink-0 truncate">
        {label}
      </span>
      <span className="text-[var(--accent-primary)] font-mono text-xs shrink-0">=</span>
      <div className="flex-1 min-w-0">{children}</div>
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
