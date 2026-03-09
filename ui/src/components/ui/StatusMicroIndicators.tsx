import { useState } from 'react';
import { useAppStore } from '../../stores/appStore';

interface PipProps {
  active: boolean;
  label: string;
  tooltip: string;
}

function StatusPip({ active, label, tooltip }: PipProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div
      className="relative"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      onFocus={() => setShowTooltip(true)}
      onBlur={() => setShowTooltip(false)}
    >
      <button
        type="button"
        className="flex items-center gap-1.5 px-2 py-1 rounded focus:outline-none focus-visible:outline-2 focus-visible:outline-blue-500 focus-visible:outline-offset-2"
        aria-label={`${label}: ${tooltip}`}
        tabIndex={0}
      >
        <div
          className={`w-2 h-2 rounded-full ${
            active
              ? 'bg-[var(--success)] shadow-[0_0_6px_rgba(34,197,94,0.6)]'
              : 'bg-[var(--text-tertiary)]'
          }`}
          aria-hidden="true"
        />
        <span className="text-[10px] font-mono uppercase tracking-wide text-[var(--text-tertiary)]">
          {label}
        </span>
      </button>

      {/* Tooltip */}
      {showTooltip && (
        <div
          className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-3 py-1.5 bg-[var(--bg-elevated)] border border-[var(--border-default)] text-xs font-mono text-[var(--text-secondary)] whitespace-nowrap z-50"
          role="tooltip"
        >
          {tooltip}
        </div>
      )}
    </div>
  );
}

export default function StatusMicroIndicators() {
  const { daemonStatus } = useAppStore();

  return (
    <div className="flex items-center gap-1" role="status" aria-label="System status indicators">
      <StatusPip
        active={daemonStatus.running}
        label="SYS"
        tooltip={daemonStatus.running ? 'Daemon: Running' : 'Daemon: Stopped'}
      />
      <StatusPip
        active={daemonStatus.gpuEnabled}
        label="GPU"
        tooltip={
          daemonStatus.gpuEnabled
            ? `GPU: ${daemonStatus.gpuName || 'Enabled'}`
            : 'GPU: Disabled (CPU mode)'
        }
      />
    </div>
  );
}
