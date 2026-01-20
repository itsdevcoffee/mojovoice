import { useState, useEffect } from 'react';
import { Save, RotateCcw, Check, ChevronDown } from 'lucide-react';
import { invoke } from '../lib/ipc';
import { cn } from '../lib/utils';
import { useAppStore } from '../stores/appStore';
import RestartBanner from './RestartBanner';
import PathInput from './PathInput';
import { type ScalePreset, getScaleValue, applyScale, clampScale, isValidPreset, PRESET_OPTIONS } from '../lib/scale';

interface Config {
  model: {
    path: string;
    model_id: string;
    draft_model_path: string | null;
    language: string;
    prompt: string | null;
  };
  audio: {
    sample_rate: number;
    timeout_secs: number;
    save_audio_clips: boolean;
    audio_clips_path: string;
  };
  output: {
    append_space: boolean;
    refresh_command: string | null;
  };
  ui: {
    scale_preset: ScalePreset;
    custom_scale: number;
  };
  history: {
    max_entries: number | null;
  };
}

interface DownloadedModel {
  name: string;
  filename: string;
  path: string;
  sizeMb: number;
  isActive: boolean;
}

// Settings that require daemon restart when changed
const DAEMON_SETTINGS = ['model.model_id', 'model.language', 'model.path', 'audio.sample_rate'];

// Language options with display name and code
const LANGUAGE_OPTIONS = [
  { code: 'auto', name: 'Auto-detect' },
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'ja', name: 'Japanese' },
  { code: 'zh', name: 'Chinese' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'ru', name: 'Russian' },
  { code: 'ko', name: 'Korean' },
  { code: 'it', name: 'Italian' },
  { code: 'nl', name: 'Dutch' },
];

// Helper to get nested value from config
function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((acc, key) => acc?.[key], obj);
}

// Helper to check if daemon settings changed
function hasDaemonSettingsChanged(current: Config, previous: Config): boolean {
  return DAEMON_SETTINGS.some(path => {
    const currentValue = getNestedValue(current, path);
    const previousValue = getNestedValue(previous, path);
    return currentValue !== previousValue;
  });
}

export default function Settings() {
  const { isRecording, setUIScale, setActiveView } = useAppStore();
  const [config, setConfig] = useState<Config | null>(null);
  const [originalConfig, setOriginalConfig] = useState<Config | null>(null);
  const [downloadedModels, setDownloadedModels] = useState<DownloadedModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [needsRestart, setNeedsRestart] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [restartSuccess, setRestartSuccess] = useState(false);
  const [restartError, setRestartError] = useState<string | null>(null);
  const [previewScale, setPreviewScale] = useState<number | null>(null);
  const [advancedExpanded, setAdvancedExpanded] = useState(false);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      console.time('Settings:init');
      try {
        setLoading(true);
        console.time('Settings:get_config');
        const cfg = await invoke<Config>('get_config');
        console.timeEnd('Settings:get_config');

        if (!mounted) return;

        // Ensure history config has expected structure
        const safeConfig: Config = {
          ...cfg,
          history: cfg.history ?? { max_entries: 500 },
        };

        setConfig(safeConfig);
        setOriginalConfig(safeConfig);

        // Load models after a brief delay (non-blocking)
        setTimeout(async () => {
          if (!mounted) return;
          try {
            console.time('Settings:list_downloaded_models');
            const models = await invoke<DownloadedModel[]>('list_downloaded_models');
            console.timeEnd('Settings:list_downloaded_models');
            if (mounted) setDownloadedModels(models);
          } catch (err) {
            console.error('Failed to load models:', err);
          }
        }, 50);
      } catch (error) {
        console.error('Failed to load config:', error);
      } finally {
        if (mounted) setLoading(false);
        console.timeEnd('Settings:init');
      }
    };

    init();
    return () => { mounted = false; };
  }, []);

  // Apply preview scale in real-time (with safety checks)
  useEffect(() => {
    if (previewScale !== null) {
      applyScale(previewScale);
    } else if (config?.ui) {
      applyScale(getScaleValue(config.ui.scale_preset, config.ui.custom_scale));
    }
  }, [previewScale, config?.ui?.scale_preset, config?.ui?.custom_scale]);

  const loadDownloadedModels = async () => {
    try {
      const models = await invoke<DownloadedModel[]>('list_downloaded_models');
      setDownloadedModels(models);
    } catch (error) {
      console.error('Failed to load downloaded models:', error);
    }
  };

  const reloadConfig = async () => {
    try {
      const cfg = await invoke<Config>('get_config');
      setConfig(cfg);
      setOriginalConfig(cfg);
      setPreviewScale(null);
      await loadDownloadedModels();
    } catch (error) {
      console.error('Failed to reload config:', error);
    }
  };

  const handleSave = async () => {
    if (!config || !originalConfig) return;

    // Validate and clamp scale values before saving
    const validatedConfig = {
      ...config,
      ui: {
        scale_preset: isValidPreset(config.ui.scale_preset) ? config.ui.scale_preset : 'medium',
        custom_scale: clampScale(config.ui.custom_scale),
      },
    };

    try {
      setSaving(true);

      // Check if model changed - use switch_model which handles path, model_id, and restart
      const modelChanged = validatedConfig.model.path !== originalConfig.model.path;

      if (modelChanged) {
        // Extract filename from path for switch_model
        const pathParts = validatedConfig.model.path.split('/');
        const filename = pathParts[pathParts.length - 1];

        // Save other config changes first (excluding model path since switch_model handles it)
        const configWithoutModelChange = {
          ...validatedConfig,
          model: { ...validatedConfig.model, path: originalConfig.model.path },
        };
        await invoke('save_config', { config: configWithoutModelChange });

        // Now switch model (this updates path, model_id, saves, and restarts daemon)
        await invoke('switch_model', { filename });

        // Reload config to get the updated model_id from switch_model
        const updatedConfig = await invoke<Config>('get_config');
        setConfig(updatedConfig);
        setOriginalConfig(updatedConfig);

        // Model switch already restarted daemon, show success
        setRestartSuccess(true);
        setNeedsRestart(false);
        setTimeout(() => setRestartSuccess(false), 3000);
      } else {
        // No model change, just save normally
        await invoke('save_config', { config: validatedConfig });

        // Smart restart logic: only show banner if other daemon settings changed
        if (hasDaemonSettingsChanged(validatedConfig, originalConfig)) {
          setNeedsRestart(true);
          setRestartSuccess(false);
          setRestartError(null);
        }

        setOriginalConfig(validatedConfig);
      }

      // Apply scale permanently
      setUIScale(validatedConfig.ui.scale_preset, validatedConfig.ui.custom_scale);
      setPreviewScale(null);

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);

      // Reload downloaded models to update active status
      loadDownloadedModels();
    } catch (error) {
      console.error('Failed to save config:', error);
      alert(`Failed to save: ${error}`);
    } finally {
      setSaving(false);
    }
  };

  const handleRestart = async () => {
    if (isRecording) {
      setRestartError('Cannot restart while recording. Stop first.');
      return;
    }

    try {
      setRestarting(true);
      setRestartError(null);
      await invoke('restart_daemon');
      setRestartSuccess(true);
      setNeedsRestart(false);

      // Auto-dismiss success message after 3 seconds
      setTimeout(() => {
        setRestartSuccess(false);
      }, 3000);
    } catch (error) {
      console.error('Failed to restart daemon:', error);
      setRestartError(String(error));
    } finally {
      setRestarting(false);
    }
  };

  const handleDismissBanner = () => {
    setNeedsRestart(false);
    setRestartSuccess(false);
    setRestartError(null);
  };

  const handleReset = () => {
    if (confirm('Reset all settings to loaded values?')) {
      reloadConfig();
    }
  };

  const handleManageModels = () => {
    setActiveView('models');
  };

  if (loading || !config) {
    return (
      <div className="glass-panel p-12 text-center">
        <div className="text-gray-400">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Restart Banner */}
      <RestartBanner
        show={needsRestart || restartSuccess || restartError !== null}
        isRecording={isRecording}
        restarting={restarting}
        success={restartSuccess}
        error={restartError}
        onRestart={handleRestart}
        onDismiss={handleDismissBanner}
      />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Settings</h1>
          <p className="text-gray-400">Configure Mojo Voice behavior</p>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3">
          <button
            onClick={handleReset}
            disabled={saving}
            className="glass-button px-4 py-2 text-sm flex items-center gap-2 text-gray-300 hover:scale-[1.02] active:scale-[0.98] transition-transform"
          >
            <RotateCcw className="w-4 h-4" />
            Reset
          </button>

          <button
            onClick={handleSave}
            disabled={saving}
            className={cn(
              'px-6 py-2 text-sm flex items-center gap-2 rounded-lg transition-all duration-200',
              'backdrop-blur-md border-2 font-medium hover:scale-[1.02] active:scale-[0.98]',
              saved
                ? 'bg-green-500/20 border-green-500 text-green-400'
                : 'bg-cyan-500/20 border-cyan-500 text-cyan-400 hover:bg-cyan-500/30'
            )}
          >
            {saved ? (
              <>
                <Check className="w-4 h-4" />
                Saved!
              </>
            ) : saving ? (
              <>
                <RotateCcw className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Changes
              </>
            )}
          </button>
        </div>
      </div>

      {/* Settings Sections */}
      <div className="space-y-6">
        {/* Voice Recognition */}
        <SettingsSection title="Voice Recognition">
          <SettingRow label="Model" description="Whisper model for transcription">
            <div className="flex gap-2">
              <select
                value={config.model.path}
                onChange={(e) => {
                  if (e.target.value === '__manage__') {
                    handleManageModels();
                    return;
                  }
                  // Find the selected model to update both path and model_id
                  const selectedModel = downloadedModels.find(m => m.path === e.target.value);
                  if (selectedModel) {
                    setConfig({
                      ...config,
                      model: {
                        ...config.model,
                        path: selectedModel.path,
                      }
                    });
                  }
                }}
                className="glass-input flex-1"
              >
                {downloadedModels.length === 0 ? (
                  <option value="" disabled>No models downloaded</option>
                ) : (
                  downloadedModels.map((model) => (
                    <option key={model.path} value={model.path}>
                      {model.name} ({model.sizeMb} MB){model.isActive ? ' ✓' : ''}
                    </option>
                  ))
                )}
                <option disabled>───────────</option>
                <option value="__manage__">Manage Models...</option>
              </select>
            </div>
          </SettingRow>

          <SettingRow label="Language" description="Transcription language">
            <select
              value={config.model.language}
              onChange={(e) => setConfig({ ...config, model: { ...config.model, language: e.target.value }})}
              className="glass-input"
            >
              {LANGUAGE_OPTIONS.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.name}
                </option>
              ))}
            </select>
          </SettingRow>
        </SettingsSection>

        {/* Recording */}
        <SettingsSection title="Recording">
          <SettingRow label="Max Duration" description="Maximum recording duration">
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="10"
                max="300"
                value={config.audio.timeout_secs}
                onChange={(e) => setConfig({ ...config, audio: { ...config.audio, timeout_secs: parseInt(e.target.value) }})}
                className="flex-1"
              />
              <span className="text-white font-mono text-sm w-12">{config.audio.timeout_secs}s</span>
            </div>
          </SettingRow>

          <SettingRow label="Audio Device" description="Input device for recording">
            <select
              className="glass-input"
              disabled
              title="Audio device selection coming soon"
            >
              <option>System Default</option>
            </select>
          </SettingRow>
        </SettingsSection>

        {/* Behavior */}
        <SettingsSection title="Behavior">
          <SettingRow label="Add trailing space" description="Append space after transcribed text">
            <Toggle
              checked={config.output.append_space}
              onChange={(checked) => setConfig({ ...config, output: { ...config.output, append_space: checked }})}
            />
          </SettingRow>
        </SettingsSection>

        {/* Appearance */}
        <SettingsSection title="Appearance">
          <SettingRow label="UI Scale" description="Interface size preset">
            <div className="flex gap-2">
              {PRESET_OPTIONS.map((preset) => (
                <button
                  key={preset}
                  onClick={() => {
                    setConfig({ ...config, ui: { ...config.ui, scale_preset: preset } });
                    setPreviewScale(getScaleValue(preset, config.ui.custom_scale));
                  }}
                  className={cn(
                    'px-4 py-2 rounded-lg border transition-all duration-200 capitalize',
                    config.ui.scale_preset === preset
                      ? 'bg-cyan-500/20 border-cyan-500 text-cyan-400'
                      : 'bg-white/5 border-white/20 text-gray-400 hover:bg-white/10'
                  )}
                >
                  {preset}
                </button>
              ))}
            </div>
          </SettingRow>

          {config.ui.scale_preset === 'custom' && (
            <SettingRow label="Custom Scale" description="Fine-tune the UI size (50% to 200%)">
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="0.5"
                  max="2.0"
                  step="0.05"
                  value={clampScale(config.ui.custom_scale)}
                  onChange={(e) => {
                    const newScale = clampScale(parseFloat(e.target.value));
                    setConfig({ ...config, ui: { ...config.ui, custom_scale: newScale } });
                    setPreviewScale(newScale);
                  }}
                  className="flex-1"
                />
                <span className="text-white font-mono text-sm w-16">
                  {Math.round(clampScale(config.ui.custom_scale) * 100)}%
                </span>
              </div>
            </SettingRow>
          )}
        </SettingsSection>

        {/* History */}
        <SettingsSection title="History">
          <SettingRow label="Maximum Entries" description="Limit stored transcription history">
            <div className="flex items-center gap-3">
              <Toggle
                checked={config.history.max_entries === null}
                onChange={(unlimited) => {
                  setConfig({
                    ...config,
                    history: {
                      max_entries: unlimited ? null : 500,
                    },
                  });
                }}
              />
              <span className="text-gray-400 text-sm">No limit</span>
            </div>
          </SettingRow>

          {config.history.max_entries !== null && (
            <SettingRow label="Entry Limit" description="Maximum transcriptions to keep (min: 5)">
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="5"
                  max="10000"
                  value={config.history.max_entries}
                  onChange={(e) => {
                    const value = parseInt(e.target.value) || 5;
                    setConfig({
                      ...config,
                      history: {
                        max_entries: Math.max(5, value),
                      },
                    });
                  }}
                  className="glass-input w-28 text-center"
                />
                <span className="text-gray-400 text-sm">entries</span>
              </div>
            </SettingRow>
          )}
        </SettingsSection>

        {/* Advanced (Collapsible) */}
        <div className="glass-panel overflow-hidden">
          <button
            onClick={() => setAdvancedExpanded(!advancedExpanded)}
            className="w-full p-6 flex items-center justify-between text-left hover:bg-white/5 transition-colors"
          >
            <h2 className="text-xl font-semibold text-white">Advanced</h2>
            <ChevronDown className={cn(
              "w-5 h-5 text-gray-400 transition-transform duration-200",
              advancedExpanded && "rotate-180"
            )} />
          </button>

          {advancedExpanded && (
            <div className="px-6 pb-6 space-y-6 border-t border-white/10 pt-6">
              <SettingRow label="Model Path Override" description="Custom path to model file or directory">
                <PathInput
                  value={config.model.path}
                  onChange={(newPath) => setConfig({ ...config, model: { ...config.model, path: newPath }})}
                  type="any"
                  placeholder="~/.local/share/mojovoice/models/..."
                  label="Browse for model"
                />
              </SettingRow>

              <SettingRow label="Technical Vocabulary" description="Custom prompts to bias transcription">
                <textarea
                  value={config.model.prompt || ''}
                  onChange={(e) => setConfig({ ...config, model: { ...config.model, prompt: e.target.value || null }})}
                  className="glass-input font-mono text-xs h-20"
                  placeholder="async, await, kubernetes, docker, typescript..."
                />
              </SettingRow>

              <SettingRow label="Status Bar Integration" description="Command to update Waybar/Polybar">
                <input
                  type="text"
                  value={config.output.refresh_command || ''}
                  onChange={(e) => setConfig({ ...config, output: { ...config.output, refresh_command: e.target.value || null }})}
                  className="glass-input font-mono text-xs"
                  placeholder="pkill -RTMIN+8 waybar"
                />
              </SettingRow>

              <SettingRow label="Save Audio Clips" description="Save recordings to disk for debugging">
                <Toggle
                  checked={config.audio.save_audio_clips}
                  onChange={(checked) => setConfig({ ...config, audio: { ...config.audio, save_audio_clips: checked }})}
                />
              </SettingRow>

              {config.audio.save_audio_clips && (
                <SettingRow label="Audio Clips Path" description="Directory to save WAV files">
                  <PathInput
                    value={config.audio.audio_clips_path}
                    onChange={(newPath) => setConfig({ ...config, audio: { ...config.audio, audio_clips_path: newPath }})}
                    type="directory"
                    placeholder="~/.local/share/mojovoice/recordings"
                    label="Browse for folder"
                  />
                </SettingRow>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface SettingsSectionProps {
  title: string;
  children: React.ReactNode;
}

function SettingsSection({ title, children }: SettingsSectionProps) {
  return (
    <div className="glass-panel p-6">
      <h2 className="text-xl font-semibold text-white mb-6">{title}</h2>
      <div className="space-y-6">{children}</div>
    </div>
  );
}

interface SettingRowProps {
  label: string;
  description: string;
  children: React.ReactNode;
}

function SettingRow({ label, description, children }: SettingRowProps) {
  return (
    <div className="flex items-start justify-between gap-6">
      <div className="flex-1">
        <label className="text-white font-medium text-sm block mb-1">{label}</label>
        <p className="text-gray-400 text-xs">{description}</p>
      </div>
      <div className="w-80">{children}</div>
    </div>
  );
}

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
}

function Toggle({ checked, onChange }: ToggleProps) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={cn(
        'relative w-12 h-6 rounded-full transition-all duration-200',
        'backdrop-blur-md border',
        checked
          ? 'bg-cyan-500/30 border-cyan-500'
          : 'bg-white/10 border-white/20'
      )}
    >
      <div
        className={cn(
          'absolute top-0.5 w-5 h-5 rounded-full transition-transform duration-200',
          checked ? 'bg-cyan-500 translate-x-6' : 'bg-gray-400 translate-x-0.5'
        )}
      />
    </button>
  );
}
