import { useState, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
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
  const [isExpanded, setIsExpanded] = useState(true);
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [daemonStatus, setDaemonStatus] = useState<DaemonStatus | null>(null);

  // Load collapse state from local storage
  useEffect(() => {
    const saved = localStorage.getItem('systemStatus.collapsed');
    if (saved !== null) {
      setIsExpanded(saved === 'false');
    }
  }, []);

  // Load system info on mount
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

  // Toggle collapsed state
  const handleToggle = () => {
    const newState = !isExpanded;
    setIsExpanded(newState);
    localStorage.setItem('systemStatus.collapsed', String(!newState));
  };

  // Format uptime duration
  const formatUptime = (seconds: number | null): string => {
    if (seconds === null) return '0s';

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m`;
    } else {
      return `${seconds}s`;
    }
  };

  // Format memory
  const formatMemory = (usedGb: number, totalGb: number): string => {
    return `${usedGb.toFixed(1)} GB / ${totalGb.toFixed(1)} GB`;
  };

  return (
    <section className="mt-12">
      {/* Header - clickable to toggle */}
      <button
        onClick={handleToggle}
        className="cursor-pointer select-none flex items-center gap-3 mb-4 w-full text-left bg-transparent border-none p-0 focus-visible:outline-2 focus-visible:outline-blue-500 focus-visible:outline-offset-2 focus-visible:shadow-[0_0_20px_rgba(59,130,246,0.5)] rounded"
        aria-expanded={isExpanded}
        aria-controls="system-status-content"
        aria-label={`System status section, ${isExpanded ? 'expanded' : 'collapsed'}. Click to ${isExpanded ? 'collapse' : 'expand'}.`}
      >
        <SectionHeader title="SYSTEM STATUS" />
        <ChevronDown
          className={`w-4 h-4 text-[var(--accent-primary)] transition-transform duration-200 ${
            isExpanded ? '' : 'rotate-180'
          }`}
          aria-hidden="true"
        />
      </button>

      {/* Content - collapsible */}
      <div
        id="system-status-content"
        className={`overflow-hidden transition-all duration-200 ease-out ${
          isExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
        }`}
        aria-hidden={!isExpanded}
      >
        <div className="p-6 bg-[var(--bg-surface)] border-2 border-[var(--border-default)] rounded space-y-4">
          {/* GPU */}
          <div className="flex justify-between items-center">
            <span className="text-sm text-[var(--text-secondary)] font-ui">
              GPU
            </span>
            <span className="text-sm text-[var(--text-primary)] font-mono">
              {systemInfo?.gpu_available
                ? systemInfo.gpu_name || 'GPU Detected'
                : 'CPU Only'}
            </span>
          </div>

          {/* Memory */}
          <div className="flex justify-between items-center">
            <span className="text-sm text-[var(--text-secondary)] font-ui">
              Memory
            </span>
            <span className="text-sm text-[var(--text-primary)] font-mono">
              {systemInfo ? formatMemory(0, systemInfo.total_ram_gb) : '...'}
            </span>
          </div>

          {/* Daemon Status */}
          <div className="flex justify-between items-center">
            <span className="text-sm text-[var(--text-secondary)] font-ui">
              Daemon
            </span>
            <span className="text-sm font-mono flex items-center gap-2">
              {daemonStatus?.running ? (
                <>
                  <span className="text-[var(--success)]">✓</span>
                  <span className="text-[var(--text-primary)]">Running</span>
                </>
              ) : (
                <>
                  <span className="text-[var(--error)]">✗</span>
                  <span className="text-[var(--text-primary)]">Stopped</span>
                </>
              )}
            </span>
          </div>

          {/* Uptime */}
          <div className="flex justify-between items-center">
            <span className="text-sm text-[var(--text-secondary)] font-ui">
              Uptime
            </span>
            <span className="text-sm text-[var(--text-primary)] font-mono">
              {daemonStatus ? formatUptime(daemonStatus.uptime_secs) : '...'}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
