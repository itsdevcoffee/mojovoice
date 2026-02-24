import CustomSelect from '../ui/CustomSelect';

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

interface DownloadedModel {
  name: string;
  filename: string;
  path: string;
  sizeMb: number;
  isActive: boolean;
}

interface ModelHeroCardProps {
  downloadedModels: DownloadedModel[];
  activeModelPath: string;
  language: string;
  savedModel?: boolean;
  savedLanguage?: boolean;
  onModelChange: (path: string) => void;
  onLanguageChange: (language: string) => void;
}

export default function ModelHeroCard({
  downloadedModels,
  activeModelPath,
  language,
  savedModel,
  savedLanguage,
  onModelChange,
  onLanguageChange,
}: ModelHeroCardProps) {
  const activeModel = downloadedModels.find((m) => m.isActive);

  return (
    <div
      className="
        relative p-4 mb-5
        bg-[var(--bg-elevated)]
        border-[3px] border-[var(--accent-primary)]
        shadow-[4px_4px_0px_0px_rgba(0,0,0,1),inset_0_0_20px_rgba(59,130,246,0.06)]
        surface-texture
      "
    >
      {/* [ACTIVE] badge */}
      <div className="absolute top-2.5 right-2.5">
        <span className="px-1.5 py-0.5 text-[10px] font-mono bg-green-500/20 border border-green-500/30 text-green-400 uppercase">
          [ACTIVE]
        </span>
      </div>

      {/* Model name + specs */}
      {activeModel ? (
        <div className="mb-3 pr-20">
          <p className="font-mono text-sm font-semibold text-[var(--text-primary)] leading-tight">
            {activeModel.name}
          </p>
          <p className="font-mono text-[11px] text-[var(--text-tertiary)] mt-0.5">
            {activeModel.sizeMb} MB · whisper
          </p>
        </div>
      ) : (
        <p className="font-mono text-xs text-[var(--text-tertiary)] mb-3 italic pr-20">
          No model loaded
        </p>
      )}

      {/* Model selector */}
      <div className="space-y-2">
        <CustomSelect
          value={activeModelPath}
          onChange={onModelChange}
          options={
            downloadedModels.length === 0
              ? [{ value: '', label: 'No models downloaded' }]
              : downloadedModels.map((m) => ({ value: m.path, label: `${m.name} (${m.sizeMb} MB)` }))
          }
          ariaLabel="Select model"
          showSaved={savedModel}
        />

        {/* Language selector */}
        <CustomSelect
          value={language}
          onChange={onLanguageChange}
          options={LANGUAGE_OPTIONS.map((l) => ({ value: l.code, label: l.name }))}
          ariaLabel="Select language"
          showSaved={savedLanguage}
        />
      </div>
    </div>
  );
}
