import { useState, useEffect } from 'react';
import { Settings as SettingsIcon } from 'lucide-react';
import { Button } from './ui/Button';
import { StatusBar } from './ui/StatusBar';
import SectionHeader from './ui/SectionHeader';
import { TranscriptionCard } from './ui/TranscriptionCard';
import { SystemStatus } from './ui/SystemStatus';
import { Drawer } from './ui/Drawer';
import { invoke } from '../lib/ipc';
import { useAppStore } from '../stores/appStore';

export default function MissionControl() {
  const [isRecording, setIsRecording] = useState(false);
  const [transcription, setTranscription] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Get history data from store
  const { historyEntries, loadHistory, deleteHistoryEntry } = useAppStore();

  // Load recent transcriptions on mount
  useEffect(() => {
    loadHistory(5, 0); // Load last 5 entries
  }, [loadHistory]);

  const handleTestRecording = async () => {
    try {
      setError('');
      setTranscription('');
      setIsRecording(true);

      // Start recording
      await invoke('start_recording');

      // Wait 5 seconds
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Stop recording and get transcription
      const result = await invoke<string>('stop_recording');
      setTranscription(result);

      // Reload history to show new transcription
      loadHistory(5, 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsRecording(false);
    }
  };

  const handleCopyTranscription = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  const handleDeleteTranscription = async (id: string) => {
    await deleteHistoryEntry(id);
  };

  return (
    <div className="min-h-screen bg-[var(--bg-void)] text-[var(--text-primary)]">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-8 max-w-[800px] mx-auto">
        <h1 className="font-mono text-2xl font-bold tracking-wider text-[var(--text-primary)]">
          MOJOVOICE
        </h1>
        <button
          className="p-3 text-[var(--text-secondary)] hover:text-[var(--accent-primary)] transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-blue-500 focus-visible:outline-offset-2 focus-visible:shadow-[0_0_20px_rgba(59,130,246,0.5)]"
          aria-label="Settings"
          onClick={() => setIsSettingsOpen(true)}
        >
          <SettingsIcon className="w-6 h-6" />
        </button>
      </header>

      {/* Main content area */}
      <main className="max-w-[800px] mx-auto px-6 pb-12">
        {/* Giant test recording button */}
        <div className="flex flex-col items-center justify-center mt-16 mb-12">
          <Button
            variant="primary"
            size="lg"
            loading={isRecording}
            onClick={handleTestRecording}
            disabled={isRecording}
            className="w-[280px] h-[120px] text-xl"
          >
            {isRecording ? 'RECORDING...' : '⏺ TEST MIC'}
          </Button>

          {/* Transcription result */}
          {transcription && (
            <div className="mt-8 w-full max-w-[600px]">
              <div className="p-6 bg-[var(--bg-surface)] border-2 border-[var(--border-default)] rounded">
                <p className="text-sm text-[var(--text-tertiary)] font-ui mb-2">
                  Transcription:
                </p>
                <p className="text-base text-[var(--text-primary)] font-ui leading-relaxed">
                  {transcription}
                </p>
              </div>
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="mt-8 w-full max-w-[600px]">
              <div className="p-6 bg-red-500/10 border-2 border-red-500/50 rounded">
                <p className="text-sm text-red-400 font-ui mb-2">
                  Error:
                </p>
                <p className="text-base text-red-300 font-ui leading-relaxed">
                  {error}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Status bar */}
        <StatusBar className="mt-12" />

        {/* Recent Transcriptions Section */}
        <section className="mt-12">
          <SectionHeader title="RECENT TRANSCRIPTIONS" />

          {historyEntries.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-sm text-[var(--text-tertiary)] font-ui">
                No transcriptions yet
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {historyEntries.slice(0, 5).map((entry) => (
                <TranscriptionCard
                  key={entry.id}
                  transcription={entry}
                  onCopy={handleCopyTranscription}
                  onDelete={handleDeleteTranscription}
                />
              ))}

              {/* View All button */}
              <div className="flex justify-center mt-6">
                <button
                  className="px-4 py-2 text-sm font-ui text-[var(--accent-primary)] hover:text-[var(--accent-glow)] transition-colors duration-150"
                  onClick={() => {
                    // TODO: Open history modal (placeholder for task #17)
                    console.log('View All clicked - History modal not yet implemented');
                  }}
                >
                  View All →
                </button>
              </div>
            </div>
          )}
        </section>

        {/* System Status Section */}
        <SystemStatus />
      </main>

      {/* Footer */}
      <footer className="max-w-[800px] mx-auto px-6 py-6 text-center">
        <p className="text-xs text-[var(--text-tertiary)] font-ui">
          Press hotkey to start recording
        </p>
      </footer>

      {/* Settings Drawer */}
      <Drawer isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)}>
        <SettingsContent />
      </Drawer>
    </div>
  );
}

// Language options
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
  };
  audio: {
    sample_rate: number;
    timeout_secs: number;
    save_audio_clips: boolean;
    audio_clips_path: string;
    device_name: string | null;
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

function SettingsContent() {
  const [config, setConfig] = useState<Config | null>(null);
  const [downloadedModels, setDownloadedModels] = useState<DownloadedModel[]>([]);
  const [audioDevices, setAudioDevices] = useState<AudioDevice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        setLoading(true);
        // Load config
        const cfg = await invoke<Config>('get_config');
        setConfig(cfg);

        // Load downloaded models
        const models = await invoke<DownloadedModel[]>('list_downloaded_models');
        setDownloadedModels(models);

        // Load audio devices
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
      // Extract filename from path for switch_model
      const pathParts = path.split('/');
      const filename = pathParts[pathParts.length - 1];

      // Switch model (this updates path, model_id, saves, and restarts daemon)
      await invoke('switch_model', { filename });

      // Reload config to get the updated model_id
      const updatedConfig = await invoke<Config>('get_config');
      setConfig(updatedConfig);

      // Reload models to update active status
      const models = await invoke<DownloadedModel[]>('list_downloaded_models');
      setDownloadedModels(models);
    } catch (error) {
      console.error('Failed to switch model:', error);
    }
  };

  const handleLanguageChange = async (language: string) => {
    if (!config) return;

    try {
      // Update config with new language
      const updatedConfig = {
        ...config,
        model: {
          ...config.model,
          language,
        },
      };

      await invoke('save_config', { config: updatedConfig });
      setConfig(updatedConfig);
    } catch (error) {
      console.error('Failed to update language:', error);
    }
  };

  const handleTimeoutChange = async (timeoutSecs: number) => {
    if (!config) return;

    try {
      // Update config with new timeout
      const updatedConfig = {
        ...config,
        audio: {
          ...config.audio,
          timeout_secs: timeoutSecs,
        },
      };

      await invoke('save_config', { config: updatedConfig });
      setConfig(updatedConfig);
    } catch (error) {
      console.error('Failed to update timeout:', error);
    }
  };

  const handleAudioDeviceChange = async (deviceName: string) => {
    if (!config) return;

    try {
      // Update config with new audio device (empty string = null/default)
      const updatedConfig = {
        ...config,
        audio: {
          ...config.audio,
          device_name: deviceName === '' ? null : deviceName,
        },
      };

      await invoke('save_config', { config: updatedConfig });
      setConfig(updatedConfig);
    } catch (error) {
      console.error('Failed to update audio device:', error);
    }
  };

  // Helper function to format duration preview
  const formatDurationPreview = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    if (minutes === 0) {
      return `${seconds} seconds`;
    } else if (remainingSeconds === 0) {
      return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`;
    } else {
      return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ${remainingSeconds} ${remainingSeconds === 1 ? 'second' : 'seconds'}`;
    }
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
          {/* Model Dropdown */}
          <div className="space-y-2">
            <label className="block text-sm font-ui font-medium text-[var(--text-primary)]">
              Model
            </label>
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

          {/* Language Dropdown */}
          <div className="space-y-2">
            <label className="block text-sm font-ui font-medium text-[var(--text-primary)]">
              Language
            </label>
            <select
              value={config.model.language}
              onChange={(e) => handleLanguageChange(e.target.value)}
              className="w-full px-4 py-3 bg-[var(--bg-surface)] border-2 border-[var(--border-default)] text-[var(--text-primary)] font-mono text-sm rounded focus:border-[var(--accent-primary)] focus:outline-none focus:shadow-[0_0_20px_rgba(59,130,246,0.3)] transition-all duration-150"
            >
              {LANGUAGE_OPTIONS.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* Recording Section */}
      <section className="pt-8 border-t border-[var(--border-default)]">
        <SectionHeader title="RECORDING" />

        <div className="space-y-6 mt-6">
          {/* Max Duration Slider */}
          <div className="space-y-3">
            <label className="block text-sm font-ui font-medium text-[var(--text-primary)]">
              Max Duration
            </label>

            {/* Slider and number input container */}
            <div className="flex items-center gap-4">
              {/* Visual slider */}
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

              {/* Number input */}
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

              {/* Unit label */}
              <span className="text-sm font-mono text-[var(--text-secondary)] min-w-[60px]">
                seconds
              </span>
            </div>

            {/* Preview text */}
            <p className="text-xs text-[var(--text-tertiary)] font-ui flex items-center gap-2">
              <span>⏱️</span>
              <span>Approximately {formatDurationPreview(config.audio.timeout_secs)}</span>
            </p>
          </div>

          {/* Audio Device Dropdown */}
          <div className="space-y-2">
            <label className="block text-sm font-ui font-medium text-[var(--text-primary)]">
              Audio Device
            </label>
            <select
              value={config.audio.device_name || ''}
              onChange={(e) => handleAudioDeviceChange(e.target.value)}
              className="w-full px-4 py-3 bg-[var(--bg-surface)] border-2 border-[var(--border-default)] text-[var(--text-primary)] font-mono text-sm rounded focus:border-[var(--accent-primary)] focus:outline-none focus:shadow-[0_0_20px_rgba(59,130,246,0.3)] transition-all duration-150"
            >
              <option value="">System Default</option>
              {audioDevices.map((device) => (
                <option
                  key={device.internal_name || device.name}
                  value={device.internal_name || device.name}
                >
                  {device.name}{device.is_default ? ' (Default)' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* Placeholder for future sections */}
      <div className="pt-8 border-t border-[var(--border-default)]">
        <p className="text-xs text-[var(--text-tertiary)] font-ui text-center">
          Additional settings sections will be implemented in upcoming tasks.
        </p>
      </div>
    </div>
  );
}
