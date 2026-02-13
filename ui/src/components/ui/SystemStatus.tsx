import { useState, useEffect } from 'react';
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
  }, []);

  const handleToggle = () => {
    const newState = !isExpanded;
    setIsExpanded(newState);
    localStorage.setItem('systemStatus.collapsed', String(!newState));
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
          ${isExpanded ? 'max-h-[300px] opacity-100 mt-4' : 'max-h-0 opacity-0 mt-0'}
        `}
        style={{ transitionTimingFunction: 'var(--ease-out)' }}
        aria-hidden={!isExpanded}
      >
        <div className="grid grid-cols-3 gap-px bg-[var(--border-default)] border-2 border-[var(--border-default)]">
          {/* CPU */}
          <ReadoutCell
            label="CPU"
            value={systemInfo ? `${systemInfo.cpu_cores} cores` : '…'}
          />

          {/* Memory — with progress bar */}
          <div className="bg-[var(--bg-surface)] p-3 space-y-1.5">
            <span className="block font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--text-tertiary)]">
              Memory
            </span>
            <span className="block font-mono text-xs text-[var(--text-primary)]">
              {systemInfo
                ? `${ramUsedGb.toFixed(1)} / ${ramTotalGb.toFixed(1)} GB`
                : '…'}
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
            value={systemInfo?.platform ?? '…'}
          />

          {/* Uptime */}
          <ReadoutCell
            label="Uptime"
            value={formatUptime(daemonStatus?.uptime_secs ?? null)}
          />
        </div>
      </div>
    </section>
  );
}

/* ── Readout Cell ─────────────────────────────────────────────────────── */

function ReadoutCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[var(--bg-surface)] p-3 space-y-1">
      <span className="block font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--text-tertiary)]">
        {label}
      </span>
      <span className="block font-mono text-xs text-[var(--text-primary)] truncate" title={value}>
        {value}
      </span>
    </div>
  );
}
