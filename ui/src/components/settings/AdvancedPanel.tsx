import { isTauri } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { FolderOpen } from 'lucide-react';
import SettingRow from './SettingRow';

/** Text input for a directory path, with a native folder picker */
function PathInput({
  value,
  onChange,
  placeholder,
  className,
  pickerTitle,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  className: string;
  pickerTitle: string;
}) {
  const browse = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        defaultPath: value || undefined,
        title: pickerTitle,
      });
      if (typeof selected === 'string') {
        onChange(selected);
      }
    } catch (err) {
      console.error('Folder picker failed:', err);
    }
  };

  return (
    <div className="flex items-center gap-1.5">
      <div className="relative flex-1 min-w-0">
        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--accent-primary)] font-mono text-xs pointer-events-none">
          &gt;
        </span>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={className}
        />
      </div>
      {/* No native dialog in browser dev mode */}
      {isTauri() && (
        <button
          type="button"
          onClick={browse}
          aria-label={pickerTitle}
          title={pickerTitle}
          className="
            flex items-center gap-1 px-2 py-1 flex-shrink-0
            font-mono text-[10px] uppercase tracking-[0.05em]
            text-[var(--text-tertiary)]
            border border-[var(--border-default)] bg-[var(--bg-void)]
            hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)]
            focus-visible:outline-2 focus-visible:outline-blue-500 focus-visible:outline-offset-2
            transition-all duration-150
          "
        >
          <FolderOpen size={10} />
          <span>Browse</span>
        </button>
      )}
    </div>
  );
}

interface AdvancedPanelProps {
  isExpanded: boolean;
  onToggle: () => void;
  modelPath: string;
  refreshCommand: string;
  saveAudioClips: boolean;
  audioClipsPath: string;
  savedField: string | null;
  onModelPathChange: (v: string) => void;
  onRefreshCommandChange: (v: string) => void;
  onSaveAudioClipsToggle: () => void;
  onAudioClipsPathChange: (v: string) => void;
}

export default function AdvancedPanel({
  isExpanded,
  onToggle,
  modelPath,
  refreshCommand,
  saveAudioClips,
  audioClipsPath,
  savedField,
  onModelPathChange,
  onRefreshCommandChange,
  onSaveAudioClipsToggle,
  onAudioClipsPathChange,
}: AdvancedPanelProps) {
  const inputClass = `
    w-full pl-7 pr-3 py-1.5 bg-[var(--bg-void)] border-2 border-[var(--border-default)]
    text-[var(--text-primary)] font-mono text-xs placeholder:text-[var(--text-tertiary)]
    focus:border-[var(--accent-primary)] focus:outline-none
    focus:shadow-[0_0_20px_rgba(59,130,246,0.3)] transition-all duration-150
  `;

  return (
    <div className="mt-4 border-2 border-dashed border-[var(--border-default)]">
      {/* Toggle header */}
      <button
        onClick={onToggle}
        className="
          w-full flex items-center gap-2 px-3 py-2.5
          bg-transparent border-none cursor-pointer text-left
          hover:bg-[var(--bg-elevated)] transition-colors duration-150
          focus-visible:outline-2 focus-visible:outline-blue-500
          focus-visible:outline-offset-[-2px]
        "
        aria-expanded={isExpanded}
        aria-label={`Advanced settings, ${isExpanded ? 'expanded' : 'collapsed'}`}
      >
        <span
          className={`text-[var(--accent-primary)] text-xs transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
          aria-hidden="true"
        >
          ▸
        </span>
        <span className="font-mono text-xs uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
          ADVANCED
        </span>
        <span className="font-mono text-[10px] text-[var(--text-tertiary)]">
          [{saveAudioClips ? 4 : 3} opts]
        </span>
        {!isExpanded && (
          <span className="ml-auto font-mono text-[10px] text-[var(--text-tertiary)] truncate max-w-[110px]">
            clips: {saveAudioClips ? 'ON' : 'OFF'}
          </span>
        )}
      </button>

      {/* Collapsible content */}
      <div
        className={`
          grid overflow-hidden transition-all duration-200
          ${isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}
        `}
        style={{ transitionTimingFunction: 'var(--ease-out)' }}
        aria-hidden={!isExpanded}
      >
        <div className="min-h-0 px-3 pb-3 space-y-1 border-t border-[var(--border-default)] pt-3">

          {/* model_path */}
          <SettingRow label="model_path" saved={savedField === 'model_path'}>
            <PathInput
              value={modelPath}
              onChange={onModelPathChange}
              placeholder="~/.cache/whisper/..."
              className={inputClass}
              pickerTitle="Choose model folder"
            />
          </SettingRow>

          {/* refresh_cmd */}
          <SettingRow label="refresh_cmd" saved={savedField === 'refresh_cmd'}>
            <div className="relative">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--accent-primary)] font-mono text-xs pointer-events-none">
                $
              </span>
              <input
                type="text"
                value={refreshCommand}
                onChange={(e) => onRefreshCommandChange(e.target.value)}
                placeholder="killall -SIGUSR1 waybar"
                className={inputClass}
              />
            </div>
          </SettingRow>

          {/* save_clips toggle */}
          <SettingRow label="save_clips" saved={savedField === 'save_clips'}>
            <button
              onClick={onSaveAudioClipsToggle}
              role="switch"
              aria-checked={saveAudioClips}
              className={`
                flex items-center gap-1.5 px-2.5 py-1 border-2 font-mono text-xs
                transition-all duration-150
                focus-visible:outline-2 focus-visible:outline-blue-500 focus-visible:outline-offset-2
                ${saveAudioClips
                  ? 'border-blue-500/50 bg-blue-500/10 text-[var(--text-primary)]'
                  : 'border-[var(--border-default)] bg-[var(--bg-elevated)] text-[var(--text-secondary)]'
                }
              `}
            >
              <span className={`inline-block w-2 h-2 rounded-full ${saveAudioClips ? 'bg-green-400' : 'bg-[var(--text-tertiary)]'}`} />
              {saveAudioClips ? '[ON]' : '[OFF]'}
            </button>
          </SettingRow>

          {/* clips_path — only visible when save_clips is ON */}
          {saveAudioClips && (
            <SettingRow label="clips_path" saved={savedField === 'clips_path'}>
              <PathInput
                value={audioClipsPath}
                onChange={onAudioClipsPathChange}
                placeholder="~/mojovoice/clips"
                className={inputClass}
                pickerTitle="Choose audio clips folder"
              />
            </SettingRow>
          )}
        </div>
      </div>
    </div>
  );
}
