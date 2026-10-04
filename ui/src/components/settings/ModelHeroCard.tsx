import CustomSelect from '../ui/CustomSelect';
import { useAppStore } from '../../stores/appStore';

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
  language: string;
  savedModel?: boolean;
  savedLanguage?: boolean;
  /** Called with the model's directory name */
  onModelChange: (filename: string) => void;
  onLanguageChange: (language: string) => void;
}

export default function ModelHeroCard({
  downloadedModels,
  language,
  savedModel,
  savedLanguage,
  onModelChange,
  onLanguageChange,
}: ModelHeroCardProps) {
  const switchingModel = useAppStore((s) => s.switchingModel);
  const modelSwitchError = useAppStore((s) => s.modelSwitchError);
  const setActiveView = useAppStore((s) => s.setActiveView);

  const activeModel = downloadedModels.find((m) => m.isActive);
  const pendingModel = downloadedModels.find((m) => m.filename === switchingModel);
  const hasModels = downloadedModels.length > 0;

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
      {/* Status badge */}
      <div className="absolute top-2.5 right-2.5">
        {switchingModel ? (
          <span className="px-1.5 py-0.5 text-[10px] font-mono bg-blue-500/20 border border-blue-500/30 text-[var(--accent-primary)] uppercase">
            [LOADING]
          </span>
        ) : activeModel ? (
          <span className="px-1.5 py-0.5 text-[10px] font-mono bg-green-500/20 border border-green-500/30 text-green-400 uppercase">
            [ACTIVE]
          </span>
        ) : null}
      </div>

      {/* Model name + specs */}
      {switchingModel ? (
        <div className="mb-3 pr-20" role="status" aria-live="polite">
          <p className="flex items-center gap-2 font-mono text-sm font-semibold text-[var(--text-primary)] leading-tight">
            <span className="inline-block w-3 h-3 border-2 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin" />
            {pendingModel?.name ?? switchingModel}
          </p>
          <p className="font-mono text-[11px] text-[var(--text-tertiary)] mt-0.5">
            Restarting daemon and loading model…
          </p>
        </div>
      ) : activeModel ? (
        <div className="mb-3 pr-20">
          <p className="font-mono text-sm font-semibold text-[var(--text-primary)] leading-tight">
            {activeModel.name}
          </p>
          <p className="font-mono text-[11px] text-[var(--text-tertiary)] mt-0.5">
            {activeModel.sizeMb} MB · whisper
          </p>
        </div>
      ) : hasModels ? (
        <p className="font-mono text-xs text-[var(--text-tertiary)] mb-3 italic pr-20">
          No model selected — pick one below
        </p>
      ) : (
        <div className="mb-3 pr-4">
          <p className="font-mono text-sm font-semibold text-[var(--text-primary)]">
            No model installed
          </p>
          <p className="font-mono text-[11px] text-[var(--text-tertiary)] mt-0.5 mb-2">
            Download a model to start transcribing. Without a GPU, start with base.en or small.
          </p>
          <button
            type="button"
            onClick={() => setActiveView('models')}
            className="
              px-3 py-1.5 font-mono text-xs uppercase tracking-wide
              border-2 border-[var(--accent-primary)] text-[var(--accent-primary)]
              hover:bg-blue-500/10
              focus-visible:outline-2 focus-visible:outline-blue-500 focus-visible:outline-offset-2
              transition-all duration-150
            "
          >
            [DOWNLOAD A MODEL]
          </button>
        </div>
      )}

      {modelSwitchError && !switchingModel && (
        <p className="font-mono text-[11px] text-[var(--error)] mb-2 break-words" role="alert">
          Switch failed: {modelSwitchError}
        </p>
      )}

      <div className="space-y-2">
        {/* Model selector (hidden until a model is installed) */}
        {hasModels && (
          <CustomSelect
            value={switchingModel ?? activeModel?.filename ?? ''}
            onChange={onModelChange}
            options={[
              ...(activeModel || switchingModel ? [] : [{ value: '', label: 'Select a model…' }]),
              ...downloadedModels.map((m) => ({
                value: m.filename,
                label: `${m.name} (${m.sizeMb} MB)`,
              })),
            ]}
            ariaLabel="Select model"
            showSaved={savedModel}
            disabled={switchingModel !== null}
          />
        )}

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
