import { useState, useEffect } from 'react';
import { Button } from './ui/Button';
import SectionHeader from './ui/SectionHeader';
import { invoke } from '../lib/ipc';

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

interface Config {
  model: {
    path: string;
    model_id: string;
    language: string;
    prompt_biasing: string | null;
  };
  audio: {
    sample_rate: number;
    timeout_secs: number;
    save_audio_clips: boolean;
    audio_clips_path: string;
    device_name: string | null;
  };
  output: {
    display_server: string | null;
    append_space: boolean;
    refresh_command: string | null;
  };
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
  is_default: boolean;
  internal_name: string | null;
}

export default function SettingsPanel() {
  const [config, setConfig] = useState<Config | null>(null);
  const [originalConfig, setOriginalConfig] = useState<Config | null>(null);
  const [downloadedModels, setDownloadedModels] = useState<DownloadedModel[]>([]);
  const [audioDevices, setAudioDevices] = useState<AudioDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [advancedExpanded, setAdvancedExpanded] = useState(() => {
    const saved = localStorage.getItem('advancedSettings.collapsed');
    return saved === 'false';
  });

  useEffect(() => {
    const loadSettings = async () => {
      try {
        setLoading(true);
        const cfg = await invoke<Config>('get_config');
        setConfig(cfg);
        setOriginalConfig(JSON.parse(JSON.stringify(cfg)));

        const models = await invoke<DownloadedModel[]>('list_downloaded_models');
        setDownloadedModels(models);

        const devices = await invoke<AudioDevice[]>('list_audio_devices');
        setAudioDevices(devices);
      } catch (error) {
        console.error('Failed to load settings:', error);
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, []);

  const handleModelChange = async (path: string) => {
    if (!config) return;
    try {
      const pathParts = path.split('/');
      const filename = pathParts[pathParts.length - 1];
      await invoke('switch_model', { filename });
      const updatedConfig = await invoke<Config>('get_config');
      setConfig(updatedConfig);
      const models = await invoke<DownloadedModel[]>('list_downloaded_models');
      setDownloadedModels(models);
    } catch (error) {
      console.error('Failed to switch model:', error);
    }
  };

  const handleLanguageChange = async (language: string) => {
    if (!config) return;
    try {
      const updatedConfig = { ...config, model: { ...config.model, language } };
      await invoke('save_config', { config: updatedConfig });
      setConfig(updatedConfig);
    } catch (error) {
      console.error('Failed to update language:', error);
    }
  };

  const handleTimeoutChange = async (timeoutSecs: number) => {
    if (!config) return;
    try {
      const updatedConfig = { ...config, audio: { ...config.audio, timeout_secs: timeoutSecs } };
      await invoke('save_config', { config: updatedConfig });
      setConfig(updatedConfig);
    } catch (error) {
      console.error('Failed to update timeout:', error);
    }
  };

  const handleAudioDeviceChange = async (deviceName: string) => {
    if (!config) return;
    try {
      const updatedConfig = {
        ...config,
        audio: { ...config.audio, device_name: deviceName === '' ? null : deviceName },
      };
      await invoke('save_config', { config: updatedConfig });
      setConfig(updatedConfig);
    } catch (error) {
      console.error('Failed to update audio device:', error);
    }
  };

  const handleAppendSpaceToggle = async () => {
    if (!config) return;
    try {
      const updatedConfig = {
        ...config,
        output: { ...config.output, append_space: !config.output.append_space },
      };
      await invoke('save_config', { config: updatedConfig });
      setConfig(updatedConfig);
    } catch (error) {
      console.error('Failed to toggle append_space:', error);
    }
  };

  const handleModelPathOverrideChange = async (path: string) => {
    if (!config) return;
    try {
      const updatedConfig = {
        ...config,
        model: { ...config.model, path: path.trim() || config.model.path },
      };
      await invoke('save_config', { config: updatedConfig });
      setConfig(updatedConfig);
    } catch (error) {
      console.error('Failed to update model path:', error);
    }
  };

  const handleTechnicalVocabularyChange = async (vocabulary: string) => {
    if (!config) return;
    try {
      const updatedConfig = {
        ...config,
        model: { ...config.model, prompt_biasing: vocabulary.trim() || null },
      };
      await invoke('save_config', { config: updatedConfig });
      setConfig(updatedConfig);
    } catch (error) {
      console.error('Failed to update technical vocabulary:', error);
    }
  };

  const handleRefreshCommandChange = async (command: string) => {
    if (!config) return;
    try {
      const updatedConfig = {
        ...config,
        output: { ...config.output, refresh_command: command.trim() || null },
      };
      await invoke('save_config', { config: updatedConfig });
      setConfig(updatedConfig);
    } catch (error) {
      console.error('Failed to update refresh command:', error);
    }
  };

  const handleSaveAudioClipsToggle = async () => {
    if (!config) return;
    try {
      const updatedConfig = {
        ...config,
        audio: { ...config.audio, save_audio_clips: !config.audio.save_audio_clips },
      };
      await invoke('save_config', { config: updatedConfig });
      setConfig(updatedConfig);
    } catch (error) {
      console.error('Failed to toggle save audio clips:', error);
    }
  };

  const handleAudioClipsPathChange = async (path: string) => {
    if (!config) return;
    try {
      const updatedConfig = {
        ...config,
        audio: { ...config.audio, audio_clips_path: path.trim() || config.audio.audio_clips_path },
      };
      await invoke('save_config', { config: updatedConfig });
      setConfig(updatedConfig);
    } catch (error) {
      console.error('Failed to update audio clips path:', error);
    }
  };

  const toggleAdvancedSection = () => {
    const newState = !advancedExpanded;
    setAdvancedExpanded(newState);
    localStorage.setItem('advancedSettings.collapsed', String(!newState));
  };

  const handleSaveChanges = async () => {
    if (!config) return;
    try {
      setSaving(true);
      setSaveSuccess(false);
      await invoke('save_config', { config });

      setSaveSuccess(true);
      setOriginalConfig(JSON.parse(JSON.stringify(config)));
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error('Failed to save settings:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (!originalConfig) return;
    setConfig(JSON.parse(JSON.stringify(originalConfig)));
  };

  const formatDurationPreview = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes === 0) return `${seconds} seconds`;
    if (remainingSeconds === 0) return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`;
    return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ${remainingSeconds} ${remainingSeconds === 1 ? 'second' : 'seconds'}`;
  };

  if (loading || !config) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-[var(--text-secondary)] font-ui">Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Voice Recognition Section */}
      <section>
        <SectionHeader title="VOICE RECOGNITION" />
        <div className="space-y-6 mt-6">
          <div className="space-y-2">
            <label className="block text-sm font-ui font-medium text-[var(--text-primary)]">Model</label>
            <select
              value={config.model.path}
              onChange={(e) => handleModelChange(e.target.value)}
              className="w-full px-4 py-3 bg-[var(--bg-surface)] border-2 border-[var(--border-default)] text-[var(--text-primary)] font-mono text-sm rounded focus:border-[var(--accent-primary)] focus:outline-none focus:shadow-[0_0_20px_rgba(59,130,246,0.3)] transition-all duration-150"
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
            </select>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-ui font-medium text-[var(--text-primary)]">Language</label>
            <select
              value={config.model.language}
              onChange={(e) => handleLanguageChange(e.target.value)}
              className="w-full px-4 py-3 bg-[var(--bg-surface)] border-2 border-[var(--border-default)] text-[var(--text-primary)] font-mono text-sm rounded focus:border-[var(--accent-primary)] focus:outline-none focus:shadow-[0_0_20px_rgba(59,130,246,0.3)] transition-all duration-150"
            >
              {LANGUAGE_OPTIONS.map((lang) => (
                <option key={lang.code} value={lang.code}>{lang.name}</option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* Recording Section */}
      <section className="pt-8 border-t border-[var(--border-default)]">
        <SectionHeader title="RECORDING" />
        <div className="space-y-6 mt-6">
          <div className="space-y-3">
            <label className="block text-sm font-ui font-medium text-[var(--text-primary)]">Max Duration</label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="10"
                max="300"
                value={config.audio.timeout_secs}
                onChange={(e) => handleTimeoutChange(parseInt(e.target.value))}
                className="flex-1 h-2 bg-gradient-to-r from-blue-500/30 to-slate-700/50 rounded-sm appearance-none cursor-pointer
                  [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:h-6
                  [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-500
                  [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-[var(--bg-void)]
                  [&::-webkit-slider-thumb]:shadow-[0_0_12px_rgba(59,130,246,0.6)]
                  [&::-webkit-slider-thumb]:cursor-grab [&::-webkit-slider-thumb]:transition-all
                  [&::-webkit-slider-thumb]:duration-150
                  [&::-webkit-slider-thumb]:hover:bg-blue-400 [&::-webkit-slider-thumb]:hover:shadow-[0_0_20px_rgba(59,130,246,0.8)]
                  [&::-webkit-slider-thumb]:hover:scale-110
                  [&::-webkit-slider-thumb]:active:cursor-grabbing
                  [&::-moz-range-thumb]:w-6 [&::-moz-range-thumb]:h-6 [&::-moz-range-thumb]:rounded-full
                  [&::-moz-range-thumb]:bg-blue-500 [&::-moz-range-thumb]:border-2
                  [&::-moz-range-thumb]:border-[var(--bg-void)] [&::-moz-range-thumb]:cursor-grab
                  [&::-moz-range-thumb]:transition-all [&::-moz-range-thumb]:duration-150
                  focus:outline-none"
                style={{
                  background: `linear-gradient(to right,
                    rgba(59, 130, 246, 0.3) 0%,
                    rgba(59, 130, 246, 0.3) ${((config.audio.timeout_secs - 10) / (300 - 10)) * 100}%,
                    rgba(51, 65, 85, 0.5) ${((config.audio.timeout_secs - 10) / (300 - 10)) * 100}%,
                    rgba(51, 65, 85, 0.5) 100%)`
                }}
              />
              <input
                type="number"
                min="10"
                max="300"
                value={config.audio.timeout_secs}
                onChange={(e) => {
                  const value = parseInt(e.target.value);
                  if (!isNaN(value) && value >= 10 && value <= 300) {
                    handleTimeoutChange(value);
                  }
                }}
                className="w-20 px-3 py-2 bg-[var(--bg-surface)] border-2 border-[var(--border-default)]
                  text-[var(--text-primary)] font-mono text-sm text-center rounded
                  focus:border-[var(--accent-primary)] focus:outline-none
                  focus:shadow-[0_0_20px_rgba(59,130,246,0.3)] transition-all duration-150"
              />
              <span className="text-sm font-mono text-[var(--text-secondary)] min-w-[60px]">seconds</span>
            </div>
            <p className="text-xs text-[var(--text-tertiary)] font-ui flex items-center gap-2">
              <span>⏱️</span>
              <span>Approximately {formatDurationPreview(config.audio.timeout_secs)}</span>
            </p>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-ui font-medium text-[var(--text-primary)]">Audio Device</label>
            <select
              value={config.audio.device_name || ''}
              onChange={(e) => handleAudioDeviceChange(e.target.value)}
              className="w-full px-4 py-3 bg-[var(--bg-surface)] border-2 border-[var(--border-default)] text-[var(--text-primary)] font-mono text-sm rounded focus:border-[var(--accent-primary)] focus:outline-none focus:shadow-[0_0_20px_rgba(59,130,246,0.3)] transition-all duration-150"
            >
              <option value="">System Default</option>
              {audioDevices.map((device) => (
                <option key={device.internal_name || device.name} value={device.internal_name || device.name}>
                  {device.name}{device.is_default ? ' (Default)' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* Behavior Section */}
      <section className="pt-8 border-t border-[var(--border-default)]">
        <SectionHeader title="BEHAVIOR" />
        <div className="space-y-6 mt-6">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <label className="block text-sm font-ui font-medium text-[var(--text-primary)] cursor-pointer">Add trailing space</label>
              <p className="text-xs text-[var(--text-tertiary)] font-ui mt-1">Automatically add a space after transcribed text</p>
            </div>
            <button
              onClick={handleAppendSpaceToggle}
              className={`
                relative w-14 h-7 rounded-full transition-all duration-200
                ${config.output.append_space
                  ? 'bg-blue-500/20 border-2 border-blue-500/50 shadow-[0_0_16px_rgba(59,130,246,0.2)]'
                  : 'bg-slate-700/50 border-2 border-slate-600/80'
                }
                focus:outline-none focus-visible:outline-2 focus-visible:outline-blue-500
                focus-visible:outline-offset-2 focus-visible:shadow-[0_0_20px_rgba(59,130,246,0.5)]
              `}
              aria-label="Toggle add trailing space"
              aria-checked={config.output.append_space}
              role="switch"
            >
              <div
                className={`
                  absolute top-0.5 left-0.5 w-5 h-5 rounded-full transition-all duration-200
                  ${config.output.append_space
                    ? 'translate-x-7 bg-white shadow-[0_2px_8px_rgba(59,130,246,0.4)]'
                    : 'translate-x-0 bg-slate-300'
                  }
                `}
                style={{ transitionTimingFunction: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)' }}
              />
            </button>
          </div>
        </div>
      </section>

      {/* Advanced Section */}
      <section className="pt-8 border-t border-[var(--border-default)]">
        <SectionHeader
          title="ADVANCED"
          isExpanded={advancedExpanded}
          onToggle={toggleAdvancedSection}
        />

        <div
          id="advanced-settings-content"
          className={`
            overflow-hidden transition-all duration-200
            ${advancedExpanded ? 'max-h-[1000px] opacity-100 mt-6' : 'max-h-0 opacity-0 mt-0'}
          `}
          style={{ transitionTimingFunction: 'var(--ease-out)' }}
          aria-hidden={!advancedExpanded}
        >
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="block text-sm font-ui font-medium text-[var(--text-primary)]">Model Path Override</label>
              <p className="text-xs text-[var(--text-tertiary)] font-ui mb-2">Custom path to Whisper model file (advanced users only)</p>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-500 font-mono text-sm pointer-events-none">&gt;</span>
                <input
                  type="text"
                  value={config.model.path}
                  onChange={(e) => handleModelPathOverrideChange(e.target.value)}
                  placeholder="~/.cache/whisper/models/..."
                  className="w-full pl-8 pr-4 py-3 bg-[var(--bg-surface)] border-2 border-[var(--border-default)]
                    text-[var(--text-primary)] font-mono text-sm rounded placeholder:text-[var(--text-tertiary)]
                    focus:border-[var(--accent-primary)] focus:outline-none focus:shadow-[0_0_20px_rgba(59,130,246,0.3)] transition-all duration-150"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-ui font-medium text-[var(--text-primary)]">Technical Vocabulary</label>
              <p className="text-xs text-[var(--text-tertiary)] font-ui mb-2">Custom words for prompt biasing (comma-separated)</p>
              <textarea
                value={config.model.prompt_biasing || ''}
                onChange={(e) => handleTechnicalVocabularyChange(e.target.value)}
                placeholder="Kubernetes, PostgreSQL, TypeScript..."
                rows={3}
                className="w-full px-4 py-3 bg-[var(--bg-surface)] border-2 border-[var(--border-default)]
                  text-[var(--text-primary)] font-mono text-sm rounded placeholder:text-[var(--text-tertiary)] resize-none
                  focus:border-[var(--accent-primary)] focus:outline-none focus:shadow-[0_0_20px_rgba(59,130,246,0.3)] transition-all duration-150"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-ui font-medium text-[var(--text-primary)]">Status Bar Integration</label>
              <p className="text-xs text-[var(--text-tertiary)] font-ui mb-2">Shell command to refresh status bar after transcription</p>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-500 font-mono text-sm pointer-events-none">$</span>
                <input
                  type="text"
                  value={config.output.refresh_command || ''}
                  onChange={(e) => handleRefreshCommandChange(e.target.value)}
                  placeholder="killall -SIGUSR1 waybar"
                  className="w-full pl-8 pr-4 py-3 bg-[var(--bg-surface)] border-2 border-[var(--border-default)]
                    text-[var(--text-primary)] font-mono text-sm rounded placeholder:text-[var(--text-tertiary)]
                    focus:border-[var(--accent-primary)] focus:outline-none focus:shadow-[0_0_20px_rgba(59,130,246,0.3)] transition-all duration-150"
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <label className="block text-sm font-ui font-medium text-[var(--text-primary)] cursor-pointer">Save Audio Clips</label>
                  <p className="text-xs text-[var(--text-tertiary)] font-ui mt-1">Save recorded audio to disk for debugging</p>
                </div>
                <button
                  onClick={handleSaveAudioClipsToggle}
                  className={`
                    relative w-14 h-7 rounded-full transition-all duration-200
                    ${config.audio.save_audio_clips
                      ? 'bg-blue-500/20 border-2 border-blue-500/50 shadow-[0_0_16px_rgba(59,130,246,0.2)]'
                      : 'bg-slate-700/50 border-2 border-slate-600/80'
                    }
                    focus:outline-none focus-visible:outline-2 focus-visible:outline-blue-500
                    focus-visible:outline-offset-2 focus-visible:shadow-[0_0_20px_rgba(59,130,246,0.5)]
                  `}
                  aria-label="Toggle save audio clips"
                  aria-checked={config.audio.save_audio_clips}
                  role="switch"
                >
                  <div
                    className={`
                      absolute top-0.5 left-0.5 w-5 h-5 rounded-full transition-all duration-200
                      ${config.audio.save_audio_clips
                        ? 'translate-x-7 bg-white shadow-[0_2px_8px_rgba(59,130,246,0.4)]'
                        : 'translate-x-0 bg-slate-300'
                      }
                    `}
                    style={{ transitionTimingFunction: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)' }}
                  />
                </button>
              </div>

              {config.audio.save_audio_clips && (
                <div className="space-y-2 pl-4 border-l-2 border-blue-500/30">
                  <label className="block text-xs font-ui font-medium text-[var(--text-secondary)]">Audio Clips Path</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-500 font-mono text-sm pointer-events-none">&gt;</span>
                    <input
                      type="text"
                      value={config.audio.audio_clips_path}
                      onChange={(e) => handleAudioClipsPathChange(e.target.value)}
                      placeholder="~/mojovoice/clips"
                      className="w-full pl-8 pr-4 py-2 bg-[var(--bg-surface)] border-2 border-[var(--border-default)]
                        text-[var(--text-primary)] font-mono text-sm rounded placeholder:text-[var(--text-tertiary)]
                        focus:border-[var(--accent-primary)] focus:outline-none focus:shadow-[0_0_20px_rgba(59,130,246,0.3)] transition-all duration-150"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Save/Reset Actions */}
      <div className="sticky bottom-0 pt-6 pb-6 bg-[var(--bg-surface)] border-t-2 border-[var(--border-default)] flex items-center justify-between gap-3">
        <Button variant="ghost" size="md" onClick={handleReset} disabled={saving}>
          Reset
        </Button>
        <Button
          variant="primary"
          size="md"
          onClick={handleSaveChanges}
          loading={saving}
          disabled={saving}
          className={`${saveSuccess ? 'border-green-500 bg-green-500/20 text-green-400' : ''} transition-all duration-150`}
        >
          {saveSuccess ? 'Saved!' : 'Save Changes'}
        </Button>
      </div>
    </div>
  );
}
