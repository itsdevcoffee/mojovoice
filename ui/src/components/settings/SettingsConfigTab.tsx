import ModelHeroCard from './ModelHeroCard';
import SettingRow from './SettingRow';
import BehaviorChip from './BehaviorChip';
import AdvancedPanel from './AdvancedPanel';
import CustomSelect from '../ui/CustomSelect';

interface Config {
  model: { path: string; model_id: string; language: string; prompt: string | null };
  audio: {
    sample_rate: number;
    timeout_secs: number;
    save_audio_clips: boolean;
    audio_clips_path: string;
    device_name: string | null;
  };
  output: { display_server: string | null; append_space: boolean; refresh_command: string | null };
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

interface SettingsConfigTabProps {
  config: Config;
  downloadedModels: DownloadedModel[];
  audioDevices: AudioDevice[];
  savedField: string | null;
  advancedExpanded: boolean;
  onModelChange: (path: string) => void;
  onLanguageChange: (language: string) => void;
  onTimeoutChange: (secs: number) => void;
  onAudioDeviceChange: (device: string) => void;
  onAppendSpaceToggle: () => void;
  onModelPathOverrideChange: (path: string) => void;
  onRefreshCommandChange: (command: string) => void;
  onSaveAudioClipsToggle: () => void;
  onAudioClipsPathChange: (path: string) => void;
  onAdvancedToggle: () => void;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  if (s === 0) return `${m}m`;
  return `${m}m ${s}s`;
}

export default function SettingsConfigTab({
  config,
  downloadedModels,
  audioDevices,
  savedField,
  advancedExpanded,
  onModelChange,
  onLanguageChange,
  onTimeoutChange,
  onAudioDeviceChange,
  onAppendSpaceToggle,
  onModelPathOverrideChange,
  onRefreshCommandChange,
  onSaveAudioClipsToggle,
  onAudioClipsPathChange,
  onAdvancedToggle,
}: SettingsConfigTabProps) {
  return (
    <div>
      {/* ── HERO: Active model + language ── */}
      <ModelHeroCard
        downloadedModels={downloadedModels}
        activeModelPath={config.model.path}
        language={config.model.language}
        savedModel={savedField === 'model'}
        savedLanguage={savedField === 'language'}
        onModelChange={onModelChange}
        onLanguageChange={onLanguageChange}
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
            onChange={(e) => onTimeoutChange(parseInt(e.target.value))}
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
          onChange={onAudioDeviceChange}
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
        onToggle={onAppendSpaceToggle}
      />

      {/* ── ADVANCED collapsible ── */}
      <AdvancedPanel
        isExpanded={advancedExpanded}
        onToggle={onAdvancedToggle}
        modelPath={config.model.path}
        refreshCommand={config.output.refresh_command || ''}
        saveAudioClips={config.audio.save_audio_clips}
        audioClipsPath={config.audio.audio_clips_path}
        savedField={savedField}
        onModelPathChange={onModelPathOverrideChange}
        onRefreshCommandChange={onRefreshCommandChange}
        onSaveAudioClipsToggle={onSaveAudioClipsToggle}
        onAudioClipsPathChange={onAudioClipsPathChange}
      />

      {/* Auto-save confirmation */}
      <p className="pt-5 font-mono text-[10px] text-[var(--text-tertiary)] text-center">
        ● changes saved automatically
      </p>
    </div>
  );
}
