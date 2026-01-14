import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
    loadConfig();
  }, []);

  // Apply preview scale in real-time
  useEffect(() => {
    if (previewScale !== null) {
      applyScale(previewScale);
    } else if (config) {
      applyScale(getScaleValue(config.ui.scale_preset, config.ui.custom_scale));
    }
  }, [previewScale, config]);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const cfg = await invoke<Config>('get_config');
      setConfig(cfg);
      setOriginalConfig(cfg);
      setPreviewScale(null);
    } catch (error) {
      console.error('Failed to load config:', error);
    } finally {
      setLoading(false);
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
      await invoke('save_config', { config: validatedConfig });

      // Apply scale permanently
      setUIScale(validatedConfig.ui.scale_preset, validatedConfig.ui.custom_scale);
      setPreviewScale(null);

      setSaved(true);

      // Smart restart logic: only show banner if daemon settings changed
      if (hasDaemonSettingsChanged(validatedConfig, originalConfig)) {
        setNeedsRestart(true);
        setRestartSuccess(false);
        setRestartError(null);
      }

      // Update original config to new saved state
      setOriginalConfig(validatedConfig);

      setTimeout(() => setSaved(false), 3000);
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
      loadConfig();
      setPreviewScale(null);
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
          <p className="text-gray-400">Configure hyprvoice behavior</p>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleReset}
            disabled={saving}
            className="glass-button px-4 py-2 text-sm flex items-center gap-2 text-gray-300"
          >
            <RotateCcw className="w-4 h-4" />
            Reset
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleSave}
            disabled={saving}
            className={cn(
              'px-6 py-2 text-sm flex items-center gap-2 rounded-lg transition-all duration-200',
              'backdrop-blur-md border-2 font-medium',
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
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                  <RotateCcw className="w-4 h-4" />
                </motion.div>
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Changes
              </>
            )}
          </motion.button>
        </div>
      </div>

      {/* Settings Sections */}
      <div className="space-y-6">
        {/* Voice Recognition */}
        <SettingsSection title="Voice Recognition">
          <SettingRow label="Model" description="Whisper model for transcription">
            <div className="flex gap-2">
              <select
                value={config.model.model_id}
                onChange={(e) => {
                  if (e.target.value === '__manage__') {
                    handleManageModels();
                    return;
                  }
                  setConfig({ ...config, model: { ...config.model, model_id: e.target.value }});
                }}
                className="glass-input flex-1"
              >
                <option value="openai/whisper-tiny">Tiny (fast, less accurate)</option>
                <option value="openai/whisper-tiny.en">Tiny English-only</option>
                <option value="openai/whisper-base">Base (balanced)</option>
                <option value="openai/whisper-base.en">Base English-only</option>
                <option value="openai/whisper-small">Small (more accurate)</option>
                <option value="openai/whisper-small.en">Small English-only</option>
                <option value="openai/whisper-large-v3-turbo">Large V3 Turbo (recommended)</option>
                <option disabled>---</option>
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

        {/* Advanced (Collapsible) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-panel overflow-hidden"
        >
          <button
            onClick={() => setAdvancedExpanded(!advancedExpanded)}
            className="w-full p-6 flex items-center justify-between text-left hover:bg-white/5 transition-colors"
          >
            <h2 className="text-xl font-semibold text-white">Advanced</h2>
            <motion.div
              animate={{ rotate: advancedExpanded ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronDown className="w-5 h-5 text-gray-400" />
            </motion.div>
          </button>

          <AnimatePresence>
            {advancedExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
              >
                <div className="px-6 pb-6 space-y-6 border-t border-white/10 pt-6">
                  <SettingRow label="Model Path Override" description="Custom path to model file or directory">
                    <PathInput
                      value={config.model.path}
                      onChange={(newPath) => setConfig({ ...config, model: { ...config.model, path: newPath }})}
                      type="any"
                      placeholder="~/.local/share/hyprvoice/models/..."
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
                        placeholder="~/.local/share/hyprvoice/recordings"
                        label="Browse for folder"
                      />
                    </SettingRow>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
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
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-panel p-6"
    >
      <h2 className="text-xl font-semibold text-white mb-6">{title}</h2>
      <div className="space-y-6">{children}</div>
    </motion.div>
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
      <motion.div
        animate={{ x: checked ? 24 : 2 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        className={cn(
          'absolute top-0.5 w-5 h-5 rounded-full',
          checked ? 'bg-cyan-500' : 'bg-gray-400'
        )}
      />
    </button>
  );
}
