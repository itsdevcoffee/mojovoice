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

  const selectClass = `
    w-full px-3 py-2 bg-[var(--bg-void)] border-2 border-[var(--border-default)]
    text-[var(--text-primary)] font-mono text-xs
    focus:border-[var(--accent-primary)] focus:outline-none
    focus:shadow-[0_0_20px_rgba(59,130,246,0.3)] transition-all duration-150
  `;

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
        <div className="relative">
          <select
            value={activeModelPath}
            onChange={(e) => onModelChange(e.target.value)}
            className={selectClass}
            aria-label="Select model"
          >
            {downloadedModels.length === 0 ? (
              <option value="" disabled>No models downloaded</option>
            ) : (
              downloadedModels.map((model) => (
                <option key={model.path} value={model.path}>
                  {model.name} ({model.sizeMb} MB)
                </option>
              ))
            )}
          </select>
          <span
            aria-live="polite"
            aria-atomic="true"
            className={`absolute right-2 top-1/2 -translate-y-1/2 font-mono text-[10px] text-green-400 pointer-events-none transition-opacity duration-300 ${savedModel ? 'opacity-100' : 'opacity-0'}`}
          >
            {savedModel ? '[OK]' : ''}
          </span>
        </div>

        {/* Language selector */}
        <div className="relative">
          <select
            value={language}
            onChange={(e) => onLanguageChange(e.target.value)}
            className={selectClass}
            aria-label="Select language"
          >
            {LANGUAGE_OPTIONS.map((lang) => (
              <option key={lang.code} value={lang.code}>{lang.name}</option>
            ))}
          </select>
          <span
            aria-live="polite"
            aria-atomic="true"
            className={`absolute right-2 top-1/2 -translate-y-1/2 font-mono text-[10px] text-green-400 pointer-events-none transition-opacity duration-300 ${savedLanguage ? 'opacity-100' : 'opacity-0'}`}
          >
            {savedLanguage ? '[OK]' : ''}
          </span>
        </div>
      </div>
    </div>
  );
}
