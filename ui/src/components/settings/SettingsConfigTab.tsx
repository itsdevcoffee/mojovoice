import { useState, useEffect, useRef } from 'react';
import ModelHeroCard from './ModelHeroCard';
import SettingRow from './SettingRow';
import BehaviorChip from './BehaviorChip';
import AdvancedPanel from './AdvancedPanel';
import CustomSelect from '../ui/CustomSelect';
import { invoke } from '../../lib/ipc';

// Mirrors the Rust AppConfig (snake_case — no serde rename_all on these structs)
interface ModelConfig {
  path: string;
  model_id: string;
  draft_model_path: string | null;
  language: string;
  prompt: string | null;
}

interface AudioConfig {
  sample_rate: number;
  timeout_secs: number;
  save_audio_clips: boolean;
  audio_clips_path: string;
  device_name: string | null;
}

interface OutputConfig {
  display_server: string | null;
  append_space: boolean;
  refresh_command: string | null;
}

interface UiConfig {
  scale_preset: string;
  custom_scale: number;
}

interface HistoryConfig {
  max_entries: number | null;
}

interface AppConfig {
  model: ModelConfig;
  audio: AudioConfig;
  output: OutputConfig;
  ui: UiConfig;
  history: HistoryConfig;
}

interface DownloadedModel {
  name: string;
  filename: string;
  path: string;
  sizeMb: number;
  isActive: boolean;
}

interface AudioDevice {
  name: string;
  isDefault: boolean;
  internalName: string | null;
}

/** Fields that require a daemon restart when changed */
const RESTART_FIELDS: Array<keyof ModelConfig | keyof AudioConfig> = [
  'model_id',
  'device_name',
  'sample_rate',
];

function isDaemonRestartRequired(prev: AppConfig, next: AppConfig): boolean {
  return (
    prev.model.model_id !== next.model.model_id ||
    prev.audio.device_name !== next.audio.device_name ||
    prev.audio.sample_rate !== next.audio.sample_rate
  );
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  if (s === 0) return `${m}m`;
  return `${m}m ${s}s`;
}

export default function SettingsConfigTab() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [savedConfig, setSavedConfig] = useState<AppConfig | null>(null);
  const [downloadedModels, setDownloadedModels] = useState<DownloadedModel[]>([]);
  const [audioDevices, setAudioDevices] = useState<AudioDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [savedField, setSavedField] = useState<string | null>(null);
  const [showRestartBanner, setShowRestartBanner] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [advancedExpanded, setAdvancedExpanded] = useState(() => {
    try {
      return localStorage.getItem('advancedSettings.collapsed') === 'false';
    } catch {
      return false;
    }
  });

  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flashSaved = (field: string) => {
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    setSavedField(field);
    flashTimerRef.current = setTimeout(() => setSavedField(null), 1500);
  };

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        setLoadError(null);
        const [cfg, models, devices] = await Promise.all([
          invoke<AppConfig>('get_config'),
          invoke<DownloadedModel[]>('list_downloaded_models'),
          invoke<AudioDevice[]>('list_audio_devices'),
        ]);
        if (!cancelled) {
          setConfig(cfg);
          setSavedConfig(cfg);
          setDownloadedModels(models);
          setAudioDevices(devices);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to load settings:', err);
          setLoadError('Failed to load settings. Please try again.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    return () => {
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    };
  }, []);

  const saveConfig = async (updated: AppConfig, flashField: string) => {
    try {
      await invoke('save_config', { config: updated });
      if (savedConfig && isDaemonRestartRequired(savedConfig, updated)) {
        setShowRestartBanner(true);
      }
      setSavedConfig(updated);
      setConfig(updated);
      flashSaved(flashField);
    } catch (err) {
      console.error('Failed to save config:', err);
    }
  };

  const handleModelChange = async (path: string) => {
    if (!config) return;
    try {
      const pathParts = path.split('/');
      const filename = pathParts[pathParts.length - 1];
      await invoke('switch_model', { filename });
      const [updatedConfig, updatedModels] = await Promise.all([
        invoke<AppConfig>('get_config'),
        invoke<DownloadedModel[]>('list_downloaded_models'),
      ]);
      if (savedConfig && isDaemonRestartRequired(savedConfig, updatedConfig)) {
        setShowRestartBanner(true);
      }
      setSavedConfig(updatedConfig);
      setConfig(updatedConfig);
      setDownloadedModels(updatedModels);
      flashSaved('model');
    } catch (err) {
      console.error('Failed to switch model:', err);
    }
  };

  const handleLanguageChange = (language: string) => {
    if (!config) return;
    const updated = { ...config, model: { ...config.model, language } };
    saveConfig(updated, 'language');
  };

  const handleTimeoutChange = (timeout_secs: number) => {
    if (!config) return;
    const updated = { ...config, audio: { ...config.audio, timeout_secs } };
    saveConfig(updated, 'timeout');
  };

  const handleAudioDeviceChange = (device_name: string) => {
    if (!config) return;
    const updated = {
      ...config,
      audio: { ...config.audio, device_name: device_name === '' ? null : device_name },
    };
    saveConfig(updated, 'device');
  };

  const handleAppendSpaceToggle = () => {
    if (!config) return;
    const updated = {
      ...config,
      output: { ...config.output, append_space: !config.output.append_space },
    };
    saveConfig(updated, 'append_space');
  };

  const handleModelPathOverrideChange = (path: string) => {
    if (!config) return;
    const updated = {
      ...config,
      model: { ...config.model, path: path.trim() || config.model.path },
    };
    saveConfig(updated, 'model_path');
  };

  const handleRefreshCommandChange = (command: string) => {
    if (!config) return;
    const updated = {
      ...config,
      output: { ...config.output, refresh_command: command.trim() || null },
    };
    saveConfig(updated, 'refresh_cmd');
  };

  const handleSaveAudioClipsToggle = () => {
    if (!config) return;
    const updated = {
      ...config,
      audio: { ...config.audio, save_audio_clips: !config.audio.save_audio_clips },
    };
    saveConfig(updated, 'save_clips');
  };

  const handleAudioClipsPathChange = (path: string) => {
    if (!config) return;
    const updated = {
      ...config,
      audio: { ...config.audio, audio_clips_path: path.trim() || config.audio.audio_clips_path },
    };
    saveConfig(updated, 'clips_path');
  };

  const handleRestartDaemon = async () => {
    setRestarting(true);
    try {
      await invoke('restart_daemon');
      setShowRestartBanner(false);
    } catch (err) {
      console.error('Failed to restart daemon:', err);
    } finally {
      setRestarting(false);
    }
  };

  const toggleAdvancedSection = () => {
    const newState = !advancedExpanded;
    setAdvancedExpanded(newState);
    try {
      localStorage.setItem('advancedSettings.collapsed', String(!newState));
    } catch {
      // ignore storage errors
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-[var(--text-secondary)] font-ui">Loading settings...</p>
      </div>
    );
  }

  if (loadError || !config) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-red-400 font-mono mb-2">{loadError ?? 'Unknown error'}</p>
        <button
          onClick={() => window.location.reload()}
          className="font-mono text-xs text-[var(--accent-primary)] underline"
        >
          Reload
        </button>
      </div>
    );
  }

  // Suppress unused variable warning for RESTART_FIELDS (it's referenced by isDaemonRestartRequired)
  void RESTART_FIELDS;

  return (
    <div>
      {/* ── Restart daemon banner ── */}
      {showRestartBanner && (
        <div
          role="alert"
          className="
            mb-4 px-3 py-2.5 flex items-center gap-3
            bg-amber-500/10 border-2 border-amber-500/40
          "
        >
          <span className="font-mono text-xs text-amber-400 flex-1">
            ⚠ Restart required — model or audio device changed
          </span>
          <button
            onClick={handleRestartDaemon}
            disabled={restarting}
            className="
              px-2.5 py-1 font-mono text-xs border-2 border-amber-500/60
              text-amber-300 hover:bg-amber-500/20 transition-colors duration-150
              focus-visible:outline-2 focus-visible:outline-amber-400
              disabled:opacity-50 disabled:cursor-not-allowed
            "
          >
            {restarting ? '...' : '[RESTART DAEMON]'}
          </button>
          <button
            onClick={() => setShowRestartBanner(false)}
            className="text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] font-mono text-xs"
            aria-label="Dismiss restart notification"
          >
            ✕
          </button>
        </div>
      )}

      {/* ── HERO: Active model + language ── */}
      <ModelHeroCard
        downloadedModels={downloadedModels}
        activeModelPath={config.model.path}
        language={config.model.language}
        savedModel={savedField === 'model'}
        savedLanguage={savedField === 'language'}
        onModelChange={handleModelChange}
        onLanguageChange={handleLanguageChange}
      />

      {/* ── RECORDING ── */}
      <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--text-tertiary)] pt-2 pb-1">
        RECORDING
      </p>

      {/* timeout_secs */}
      <SettingRow label="timeout_secs" saved={savedField === 'timeout'}>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min="10"
            max="300"
            value={config.audio.timeout_secs}
            onChange={(e) => handleTimeoutChange(parseInt(e.target.value))}
            className="
              flex-1 h-1.5 rounded-sm appearance-none cursor-pointer
              [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4
              [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full
              [&::-webkit-slider-thumb]:bg-blue-500
              [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-[var(--bg-void)]
              [&::-webkit-slider-thumb]:shadow-[0_0_8px_rgba(59,130,246,0.6)]
              [&::-webkit-slider-thumb]:cursor-grab [&::-webkit-slider-thumb]:transition-all
              [&::-webkit-slider-thumb]:duration-150
              focus:outline-none
            "
            style={{
              background: `linear-gradient(to right,
                rgba(59,130,246,0.4) 0%,
                rgba(59,130,246,0.4) ${((config.audio.timeout_secs - 10) / (300 - 10)) * 100}%,
                rgba(51,65,85,0.4) ${((config.audio.timeout_secs - 10) / (300 - 10)) * 100}%,
                rgba(51,65,85,0.4) 100%)`
            }}
            aria-label="Recording max duration"
            aria-valuemin={10}
            aria-valuemax={300}
            aria-valuenow={config.audio.timeout_secs}
          />
          <span className="font-mono text-xs text-[var(--text-primary)] shrink-0 w-12 text-right">
            {formatDuration(config.audio.timeout_secs)}
          </span>
        </div>
      </SettingRow>

      {/* device */}
      <SettingRow label="device" saved={savedField === 'device'}>
        <CustomSelect
          value={config.audio.device_name || ''}
          onChange={handleAudioDeviceChange}
          options={[
            { value: '', label: 'System Default' },
            ...audioDevices.map((d) => ({
              value: d.internalName || d.name,
              label: `${d.name}${d.isDefault ? ' (Default)' : ''}`,
            })),
          ]}
          ariaLabel="Audio input device"
        />
      </SettingRow>

      {/* ── OUTPUT ── */}
      <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--text-tertiary)] pt-3 pb-1">
        OUTPUT
      </p>

      <BehaviorChip
        label="append_space"
        value={config.output.append_space}
        saved={savedField === 'append_space'}
        onToggle={handleAppendSpaceToggle}
      />

      {/* ── ADVANCED collapsible ── */}
      <AdvancedPanel
        isExpanded={advancedExpanded}
        onToggle={toggleAdvancedSection}
        modelPath={config.model.path}
        refreshCommand={config.output.refresh_command || ''}
        saveAudioClips={config.audio.save_audio_clips}
        audioClipsPath={config.audio.audio_clips_path}
        savedField={savedField}
        onModelPathChange={handleModelPathOverrideChange}
        onRefreshCommandChange={handleRefreshCommandChange}
        onSaveAudioClipsToggle={handleSaveAudioClipsToggle}
        onAudioClipsPathChange={handleAudioClipsPathChange}
      />

      {/* Auto-save confirmation */}
      <p className="pt-5 font-mono text-[10px] text-[var(--text-tertiary)] text-center">
        ● changes saved automatically
      </p>
    </div>
  );
}
