import { useState, useEffect } from 'react';
import { Play, Square, RotateCcw } from 'lucide-react';
import SectionHeader from './SectionHeader';
import { invoke } from '../../lib/ipc';

interface SystemInfo {
  cpu_cores: number;
  total_ram_gb: number;
  gpu_available: boolean;
  gpu_name: string | null;
  gpu_vram_mb: number | null;
  platform: string;
}

interface DaemonStatus {
  running: boolean;
  model_loaded: boolean;
  gpu_enabled: boolean;
  gpu_name: string | null;
  uptime_secs: number | null;
}

export function SystemStatus() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [daemonStatus, setDaemonStatus] = useState<DaemonStatus | null>(null);
  const [daemonAction, setDaemonAction] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('systemStatus.collapsed');
    if (saved !== null) {
      setIsExpanded(saved === 'false');
    }
  }, []);

  useEffect(() => {
    const loadSystemInfo = async () => {
      try {
        const info = await invoke<SystemInfo>('get_system_info');
        setSystemInfo(info);
      } catch (err) {
        console.error('Failed to load system info:', err);
      }
    };

    const loadDaemonStatus = async () => {
      try {
        const status = await invoke<DaemonStatus>('get_daemon_status');
        setDaemonStatus(status);
      } catch (err) {
        console.error('Failed to load daemon status:', err);
      }
    };

    loadSystemInfo();
    loadDaemonStatus();

    // Poll daemon status every 5s
    const interval = setInterval(loadDaemonStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleToggle = () => {
    const newState = !isExpanded;
    setIsExpanded(newState);
    localStorage.setItem('systemStatus.collapsed', String(!newState));
  };

  const handleDaemonAction = async (action: 'start_daemon' | 'stop_daemon' | 'restart_daemon') => {
    try {
      setDaemonAction(action);
      await invoke(action);
      // Refresh status after action
      const status = await invoke<DaemonStatus>('get_daemon_status');
      setDaemonStatus(status);
    } catch (err) {
      console.error(`Failed to ${action}:`, err);
    } finally {
      setDaemonAction(null);
    }
  };

  const formatUptime = (seconds: number | null): string => {
    if (seconds === null || seconds === 0) return '—';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m`;
    return `${seconds}s`;
  };

  const formatVram = (mb: number | null): string => {
    if (mb === null) return '—';
    if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
    return `${mb} MB`;
  };

  const ramUsedGb = 0; // TODO: wire to real usage when available
  const ramTotalGb = systemInfo?.total_ram_gb ?? 0;
  const ramPercent = ramTotalGb > 0 ? (ramUsedGb / ramTotalGb) * 100 : 0;
  const isRunning = daemonStatus?.running ?? false;
  const isModelLoaded = daemonStatus?.model_loaded ?? false;

  return (
    <section className="mt-12">
      <SectionHeader
        title="SYSTEM STATUS"
        isExpanded={isExpanded}
        onToggle={handleToggle}
      />

      {/* Collapsible content */}
      <div
        id="system-status-content"
        className={`
          overflow-hidden transition-all duration-200
          ${isExpanded ? 'max-h-[400px] opacity-100 mt-4' : 'max-h-0 opacity-0 mt-0'}
        `}
        style={{ transitionTimingFunction: 'var(--ease-out)' }}
        aria-hidden={!isExpanded}
      >
        <div className="surface-texture border-2 border-[var(--border-default)]">
          {/* Hardware diagnostic grid */}
          <div className="grid grid-cols-3 gap-px bg-[var(--border-default)]">
            {/* CPU */}
            <ReadoutCell
              label="CPU"
              value={systemInfo ? `${systemInfo.cpu_cores} cores` : '...'}
            />

            {/* Memory — with progress bar */}
            <div className="bg-[var(--bg-surface)] p-3 space-y-1.5 relative z-10">
              <span className="block font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--text-tertiary)]">
                Memory
              </span>
              <span className="block font-mono text-xs text-[var(--text-primary)]">
                {systemInfo
                  ? `${ramUsedGb.toFixed(1)} / ${ramTotalGb.toFixed(1)} GB`
                  : '...'}
              </span>
              {/* Thin bar */}
              <div className="h-[3px] bg-[var(--bg-elevated)] w-full">
                <div
                  className="h-full transition-all duration-300"
                  style={{
                    width: `${Math.max(ramPercent, 2)}%`,
                    backgroundColor:
                      ramPercent > 90
                        ? 'var(--error)'
                        : ramPercent > 70
                          ? 'var(--warning)'
                          : 'var(--accent-primary)',
                  }}
                />
              </div>
            </div>

            {/* GPU */}
            <ReadoutCell
              label="GPU"
              value={
                systemInfo?.gpu_name
                  ?? (daemonStatus?.gpu_name
                    ?? (systemInfo?.gpu_available ? 'Available' : 'None'))
              }
            />

            {/* VRAM */}
            <ReadoutCell
              label="VRAM"
              value={formatVram(systemInfo?.gpu_vram_mb ?? null)}
            />

            {/* Platform */}
            <ReadoutCell
              label="Platform"
              value={systemInfo?.platform ?? '...'}
            />

            {/* Uptime */}
            <ReadoutCell
              label="Uptime"
              value={formatUptime(daemonStatus?.uptime_secs ?? null)}
            />
          </div>

          {/* Daemon control footer */}
          <div className="border-t-2 border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-2.5 flex items-center justify-between relative z-10">
            {/* Status indicators */}
            <div className="flex items-center gap-4">
              {/* Daemon status */}
              <div className="flex items-center gap-2">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isRunning
                      ? 'bg-[var(--success)] shadow-[0_0_4px_rgba(34,197,94,0.6)]'
                      : 'bg-[var(--error)]'
                  }`}
                  aria-hidden="true"
                />
                <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--text-tertiary)]">
                  Daemon
                </span>
                <span className={`font-mono text-[10px] uppercase tracking-[0.1em] ${
                  isRunning ? 'text-[var(--success)]' : 'text-[var(--error)]'
                }`}>
                  {isRunning ? 'Running' : 'Stopped'}
                </span>
              </div>

              {/* Model status */}
              <div className="flex items-center gap-2">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isModelLoaded
                      ? 'bg-[var(--success)] shadow-[0_0_4px_rgba(34,197,94,0.6)]'
                      : 'bg-[var(--text-tertiary)]'
                  }`}
                  aria-hidden="true"
                />
                <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--text-tertiary)]">
                  Model
                </span>
                <span className={`font-mono text-[10px] uppercase tracking-[0.1em] ${
                  isModelLoaded ? 'text-[var(--success)]' : 'text-[var(--text-tertiary)]'
                }`}>
                  {isModelLoaded ? 'Loaded' : 'Not Loaded'}
                </span>
              </div>
            </div>

            {/* Control buttons */}
            <div className="flex items-center gap-1" role="group" aria-label="Daemon controls">
              <DaemonButton
                onClick={() => handleDaemonAction('start_daemon')}
                disabled={isRunning || !!daemonAction}
                loading={daemonAction === 'start_daemon'}
                label="Start daemon"
              >
                <Play size={10} />
                <span>Start</span>
              </DaemonButton>

              <DaemonButton
                onClick={() => handleDaemonAction('stop_daemon')}
                disabled={!isRunning || !!daemonAction}
                loading={daemonAction === 'stop_daemon'}
                variant="danger"
                label="Stop daemon"
              >
                <Square size={10} />
                <span>Stop</span>
              </DaemonButton>

              <DaemonButton
                onClick={() => handleDaemonAction('restart_daemon')}
                disabled={!!daemonAction}
                loading={daemonAction === 'restart_daemon'}
                label="Restart daemon"
              >
                <RotateCcw size={10} />
                <span>Restart</span>
              </DaemonButton>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Readout Cell ─────────────────────────────────────────────────────── */

function ReadoutCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[var(--bg-surface)] p-3 space-y-1 relative z-10">
      <span className="block font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--text-tertiary)]">
        {label}
      </span>
      <span className="block font-mono text-xs text-[var(--text-primary)] truncate" title={value}>
        {value}
      </span>
    </div>
  );
}

/* ── Daemon Control Button ────────────────────────────────────────────── */

interface DaemonButtonProps {
  onClick: () => void;
  disabled: boolean;
  loading: boolean;
  label: string;
  variant?: 'default' | 'danger';
  children: React.ReactNode;
}

function DaemonButton({ onClick, disabled, loading, label, variant = 'default', children }: DaemonButtonProps) {
  const hoverColor = variant === 'danger'
    ? 'hover:border-[var(--error)] hover:text-[var(--error)]'
    : 'hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)]';

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={`
        flex items-center gap-1 px-2 py-1
        font-mono text-[10px] uppercase tracking-[0.05em]
        text-[var(--text-tertiary)]
        border border-[var(--border-default)]
        bg-[var(--bg-void)]
        ${hoverColor}
        disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:border-[var(--border-default)] disabled:hover:text-[var(--text-tertiary)]
        transition-all duration-150
      `}
    >
      {loading ? (
        <span className="inline-block w-2.5 h-2.5 border border-current border-t-transparent rounded-full animate-spin" />
      ) : (
        children
      )}
    </button>
  );
}
