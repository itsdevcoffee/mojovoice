import React, { useState, useEffect } from 'react';
import { ChevronDown, Play } from 'lucide-react';
import { invoke } from '../../lib/ipc';

interface DaemonStatus {
  running: boolean;
  modelLoaded: boolean;
  gpuEnabled: boolean;
  gpuName?: string;
  uptimeSecs?: number;
}

interface AppConfig {
  model: {
    path: string;
    modelId: string;
    language: string;
  };
  audio: {
    deviceName?: string;
  };
}

interface DownloadedModel {
  name: string;
  filename: string;
  path: string;
  sizeMb: number;
  isActive: boolean;
}

interface StatusBarProps {
  className?: string;
}

export const StatusBar: React.FC<StatusBarProps> = ({ className = '' }) => {
  const [daemonStatus, setDaemonStatus] = useState<DaemonStatus>({
    running: false,
    modelLoaded: false,
    gpuEnabled: false,
  });
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [downloadedModels, setDownloadedModels] = useState<DownloadedModel[]>([]);
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);

  // Load daemon status and config on mount
  useEffect(() => {
    loadStatus();
    loadConfig();
    loadModels();

    // Poll status every 5 seconds
    const interval = setInterval(() => {
      loadStatus();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const loadStatus = async () => {
    try {
      const status = await invoke<DaemonStatus>('get_daemon_status');
      setDaemonStatus(status);
    } catch (error) {
      console.error('Failed to load daemon status:', error);
    }
  };

  const loadConfig = async () => {
    try {
      const cfg = await invoke<AppConfig>('get_config');
      setConfig(cfg);
    } catch (error) {
      console.error('Failed to load config:', error);
    }
  };

  const loadModels = async () => {
    try {
      const models = await invoke<DownloadedModel[]>('list_downloaded_models');
      setDownloadedModels(models);
    } catch (error) {
      console.error('Failed to load models:', error);
    }
  };

  const handleModelSwitch = async (filename: string) => {
    try {
      await invoke('switch_model', { filename });
      await loadConfig();
      setIsModelDropdownOpen(false);
    } catch (error) {
      console.error('Failed to switch model:', error);
    }
  };

  const [isStarting, setIsStarting] = useState(false);
  const handleStartDaemon = async () => {
    try {
      setIsStarting(true);
      await invoke('start_daemon');
      await loadStatus();
    } catch (error) {
      console.error('Failed to start daemon:', error);
    } finally {
      setIsStarting(false);
    }
  };

  // Extract model display name from config
  const currentModelName = config?.model.modelId || 'No model loaded';
  const currentLanguage = config?.model.language || 'auto';
  const currentMicrophone = config?.audio.deviceName || 'Default';

  return (
    <div
      className={`
        p-4 px-6
        bg-[var(--bg-surface)]
        border-2 border-[var(--border-default)]
        flex items-center justify-between
        gap-6
        ${className}
      `.trim()}
    >
      {/* Left: Status indicator */}
      <div className="flex items-center gap-2">
        {daemonStatus.running ? (
          <>
            <span className="text-[var(--success)] text-lg">●</span>
            <span className="text-[var(--success)] font-mono text-sm uppercase tracking-wide">
              READY
            </span>
          </>
        ) : (
          <>
            <span className="text-[var(--error)] text-lg">●</span>
            <span className="text-[var(--error)] font-mono text-sm uppercase tracking-wide">
              OFFLINE
            </span>
            <button
              onClick={handleStartDaemon}
              disabled={isStarting}
              className="
                ml-1 flex items-center gap-1
                font-mono text-xs uppercase tracking-wide
                text-[var(--accent-primary)]
                hover:text-[var(--accent-glow)]
                disabled:opacity-50 disabled:cursor-not-allowed
                transition-colors duration-150
                focus-visible:outline-2 focus-visible:outline-blue-500 focus-visible:outline-offset-2
              "
              aria-label="Start daemon"
            >
              {isStarting ? (
                <span className="inline-block w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Play size={10} />
                  <span>[START]</span>
                </>
              )}
            </button>
          </>
        )}
      </div>

      {/* Center: Model dropdown */}
      <div className="relative flex-1 max-w-xs">
        <button
          onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
          className="
            w-full
            flex items-center justify-between gap-2
            px-3 py-2
            bg-[var(--bg-void)]
            border border-[var(--border-default)]
            hover:border-[var(--accent-primary)]
            focus:border-[var(--accent-primary)]
            focus:shadow-[0_0_20px_rgba(59,130,246,0.3)]
            focus:outline-none
            transition-all duration-150
          "
        >
          <span className="font-mono text-sm text-[var(--text-primary)] truncate">
            {currentModelName}
          </span>
          <ChevronDown
            className={`w-4 h-4 text-[var(--text-tertiary)] transition-transform duration-150 ${
              isModelDropdownOpen ? 'rotate-180' : ''
            }`}
          />
        </button>

        {/* Dropdown menu */}
        {isModelDropdownOpen && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-10"
              onClick={() => setIsModelDropdownOpen(false)}
            />

            {/* Dropdown content */}
            <div
              className="
                absolute top-full left-0 right-0 mt-1
                bg-[var(--bg-surface)]
                border-2 border-[var(--accent-primary)]
                shadow-[0_0_20px_rgba(59,130,246,0.5)]
                max-h-64 overflow-y-auto
                z-20
                animate-dropdown-slide
              "
            >
              {downloadedModels.length > 0 ? (
                downloadedModels.map((model) => (
                  <button
                    key={model.filename}
                    onClick={() => handleModelSwitch(model.filename)}
                    className={`
                      w-full text-left
                      px-3 py-2
                      font-mono text-sm
                      hover:bg-[var(--bg-elevated)]
                      transition-colors duration-150
                      ${
                        model.filename === config?.model.path
                          ? 'bg-blue-500/20 text-[var(--accent-primary)]'
                          : 'text-[var(--text-primary)]'
                      }
                    `}
                  >
                    {model.name}
                  </button>
                ))
              ) : (
                <div className="px-3 py-2 text-sm text-[var(--text-tertiary)] font-ui">
                  No models downloaded
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Right: Language and Microphone */}
      <div className="flex items-center gap-6">
        {/* Language */}
        <div className="flex flex-col items-end">
          <span className="text-xs text-[var(--text-tertiary)] font-ui uppercase tracking-wide">
            Language
          </span>
          <span className="text-sm text-[var(--text-primary)] font-mono">
            {currentLanguage}
          </span>
        </div>

        {/* Microphone */}
        <div className="flex flex-col items-end">
          <span className="text-xs text-[var(--text-tertiary)] font-ui uppercase tracking-wide">
            Microphone
          </span>
          <span className="text-sm text-[var(--text-primary)] font-mono truncate max-w-[150px]">
            {currentMicrophone}
          </span>
        </div>
      </div>
    </div>
  );
};
