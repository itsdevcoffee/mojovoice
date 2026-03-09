import { useState, useEffect, useCallback } from 'react';
import { Download, Trash2, X, HardDrive, RefreshCw, Zap } from 'lucide-react';
import SectionHeader from './ui/SectionHeader';
import { invoke } from '../lib/ipc';
import { useModelDownload, type DownloadState } from '../hooks/useModelDownload';

/* ── Types ──────────────────────────────────────────────────────────────── */

interface AvailableModel {
  name: string;
  filename: string;
  size_bytes: number;
  is_downloaded: boolean;
  is_active: boolean;
}

interface StorageInfo {
  available_gb: number;
  total_gb: number;
  models_size_gb: number;
}

/* ── Static model metadata ──────────────────────────────────────────────── */

interface ModelMeta {
  language: 'Multilingual' | 'EN Only';
  speed: number; // 1-5
  quality: number; // 1-5
}

/** Whisper model characteristics keyed by filename (lowercase, no path). */
const MODEL_META: Record<string, ModelMeta> = {
  'large-v3-turbo.bin': { language: 'Multilingual', speed: 4, quality: 5 },
  'large-v3.bin':       { language: 'Multilingual', speed: 2, quality: 5 },
  'large-v2.bin':       { language: 'Multilingual', speed: 2, quality: 5 },
  'medium.bin':         { language: 'Multilingual', speed: 3, quality: 4 },
  'medium.en.bin':      { language: 'EN Only',      speed: 4, quality: 4 },
  'small.bin':          { language: 'Multilingual', speed: 4, quality: 3 },
  'small.en.bin':       { language: 'EN Only',      speed: 5, quality: 3 },
  'base.bin':           { language: 'Multilingual', speed: 5, quality: 2 },
  'base.en.bin':        { language: 'EN Only',      speed: 5, quality: 2 },
  'tiny.bin':           { language: 'Multilingual', speed: 5, quality: 1 },
  'tiny.en.bin':        { language: 'EN Only',      speed: 5, quality: 1 },
};

function getModelMeta(filename: string): ModelMeta {
  const key = filename.toLowerCase().split('/').pop() ?? filename.toLowerCase();
  return MODEL_META[key] ?? { language: 'Multilingual', speed: 3, quality: 3 };
}

/* ── Helpers ──────────────────────────────────────────────────────────────*/

function formatBytes(bytes: number): string {
  if (bytes >= 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(1)} GB`;
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(0)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

/* ── Dot indicator ────────────────────────────────────────────────────────*/

function DotIndicator({ filled, total = 5, color }: { filled: number; total?: number; color: string }) {
  return (
    <span className="flex items-center gap-[3px]" aria-hidden="true">
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className="inline-block w-[6px] h-[6px]"
          style={{ backgroundColor: i < filled ? color : 'var(--border-default)' }}
        />
      ))}
    </span>
  );
}

/* ── ModelsPanel ──────────────────────────────────────────────────────────*/

export function ModelsPanel() {
  const [isExpanded, setIsExpanded] = useState(true);
  const [models, setModels] = useState<AvailableModel[]>([]);
  const [storageInfo, setStorageInfo] = useState<StorageInfo | null>(null);
  const [deleting, setDeleting] = useState<Set<string>>(new Set());
  const [switching, setSwitching] = useState<Set<string>>(new Set());
  const [refreshing, setRefreshing] = useState(false);

  const refreshDownloadedModels = useCallback(async (completedModelName?: string) => {
    try {
      const downloaded = await invoke<{ name: string; filename: string; is_active: boolean }[]>(
        'list_downloaded_models',
      );
      // Merge downloaded status back into the full model list
      setModels(prev =>
        prev.map(m => {
          const found = downloaded.find(d => d.name === m.name || d.filename === m.filename);
          if (found) return { ...m, is_downloaded: true, is_active: found.is_active };
          // If this is the model that just finished, mark it downloaded
          if (completedModelName && m.name === completedModelName) {
            return { ...m, is_downloaded: true };
          }
          return m;
        }),
      );
    } catch (err) {
      console.error('[ModelsPanel] Failed to refresh downloaded models:', err);
    }
  }, []);

  const { startDownload, cancelDownload, getDownloadState } = useModelDownload(
    refreshDownloadedModels,
  );

  // Restore collapse state
  useEffect(() => {
    const saved = localStorage.getItem('modelsPanel.collapsed');
    if (saved !== null) setIsExpanded(saved === 'false');
  }, []);

  // Initial data load
  useEffect(() => {
    const load = async () => {
      try {
        const [available, storage, downloaded] = await Promise.all([
          invoke<AvailableModel[]>('list_available_models'),
          invoke<StorageInfo>('get_storage_info'),
          invoke<{ name: string; filename: string; is_active: boolean }[]>('list_downloaded_models'),
        ]);
        // Set the full model list first, then reconcile is_downloaded from the
        // dedicated downloaded-models source of truth to correct any stale flags.
        const reconciled = available.map(m => {
          const found = downloaded.find(d => d.name === m.name || d.filename === m.filename);
          if (found) return { ...m, is_downloaded: true, is_active: found.is_active };
          return { ...m, is_downloaded: false };
        });
        setModels(reconciled);
        setStorageInfo(storage);
      } catch (err) {
        console.error('[ModelsPanel] Failed to load data:', err);
      }
    };
    load();
  }, []);

  const handleToggle = () => {
    const next = !isExpanded;
    setIsExpanded(next);
    localStorage.setItem('modelsPanel.collapsed', String(!next));
  };

  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      const [available, storage] = await Promise.all([
        invoke<AvailableModel[]>('list_available_models'),
        invoke<StorageInfo>('get_storage_info'),
      ]);
      setModels(available);
      setStorageInfo(storage);
    } catch (err) {
      console.error('[ModelsPanel] Refresh failed:', err);
    } finally {
      setRefreshing(false);
    }
  };

  const handleDelete = async (modelName: string) => {
    setDeleting(prev => new Set(prev).add(modelName));
    try {
      await invoke('delete_model', { modelName });
      setModels(prev =>
        prev.map(m =>
          m.name === modelName ? { ...m, is_downloaded: false, is_active: false } : m,
        ),
      );
    } catch (err) {
      console.error('[ModelsPanel] Failed to delete model:', err);
    } finally {
      setDeleting(prev => { const n = new Set(prev); n.delete(modelName); return n; });
    }
  };

  const handleSwitch = async (modelName: string) => {
    setSwitching(prev => new Set(prev).add(modelName));
    try {
      await invoke('switch_model', { modelName });
      setModels(prev => prev.map(m => ({ ...m, is_active: m.name === modelName })));
    } catch (err) {
      console.error('[ModelsPanel] Failed to switch model:', err);
    } finally {
      setSwitching(prev => { const n = new Set(prev); n.delete(modelName); return n; });
    }
  };

  const storagePercent =
    storageInfo && storageInfo.total_gb > 0
      ? (storageInfo.models_size_gb / storageInfo.total_gb) * 100
      : 0;

  return (
    <section className="mt-12">
      <SectionHeader title="MODELS" isExpanded={isExpanded} onToggle={handleToggle} />

      <div
        className={`overflow-hidden transition-all duration-200 ${
          isExpanded ? 'max-h-[2000px] opacity-100 mt-4' : 'max-h-0 opacity-0 mt-0'
        }`}
        style={{ transitionTimingFunction: 'var(--ease-out)' }}
        aria-hidden={!isExpanded}
      >
        <div className="surface-texture border-2 border-[var(--border-default)]">

          {/* ── Panel header ─────────────────────────────────────────────── */}
          <div className="bg-[var(--bg-surface)] px-4 py-3 border-b-2 border-[var(--border-default)] relative z-10">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <HardDrive size={12} className="text-[var(--text-tertiary)]" />
                <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
                  Storage
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs text-[var(--text-secondary)]">
                  {storageInfo
                    ? `${storageInfo.models_size_gb.toFixed(1)} GB used · ${storageInfo.available_gb.toFixed(1)} GB available`
                    : '…'}
                </span>
                <button
                  onClick={handleRefresh}
                  disabled={refreshing}
                  aria-label="Refresh model list"
                  title="Refresh"
                  className="
                    flex items-center justify-center w-6 h-6
                    text-[var(--text-tertiary)]
                    border border-[var(--border-default)]
                    bg-[var(--bg-void)]
                    hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)]
                    disabled:opacity-40 disabled:cursor-not-allowed
                    transition-all duration-150
                  "
                >
                  <RefreshCw
                    size={10}
                    className={refreshing ? 'animate-spin' : ''}
                  />
                </button>
              </div>
            </div>

            {/* Storage bar */}
            <div className="h-[3px] bg-[var(--bg-elevated)] w-full">
              <div
                className="h-full transition-all duration-300"
                style={{
                  width: `${Math.max(storagePercent, storageInfo ? 1 : 0)}%`,
                  backgroundColor:
                    storagePercent > 90
                      ? 'var(--error)'
                      : storagePercent > 70
                        ? 'var(--warning)'
                        : 'var(--accent-primary)',
                }}
              />
            </div>
          </div>

          {/* ── Model cards ──────────────────────────────────────────────── */}
          <div className="divide-y-2 divide-[var(--border-default)]">
            {models.length === 0 ? (
              <div className="bg-[var(--bg-surface)] px-4 py-8 text-center relative z-10">
                <span className="font-mono text-xs text-[var(--text-tertiary)]">
                  Loading models…
                </span>
              </div>
            ) : (
              models.map(model => (
                <ModelCard
                  key={model.filename}
                  model={model}
                  downloadState={getDownloadState(model.name)}
                  isDeleting={deleting.has(model.name)}
                  isSwitching={switching.has(model.name)}
                  onDownload={() => startDownload(model.name)}
                  onCancel={() => cancelDownload(model.name)}
                  onDelete={() => handleDelete(model.name)}
                  onSwitch={() => handleSwitch(model.name)}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── ModelCard ────────────────────────────────────────────────────────────*/

interface ModelCardProps {
  model: AvailableModel;
  downloadState: ReturnType<ReturnType<typeof useModelDownload>['getDownloadState']>;
  isDeleting: boolean;
  isSwitching: boolean;
  onDownload: () => void;
  onCancel: () => void;
  onDelete: () => void;
  onSwitch: () => void;
}

function ModelCard({
  model,
  downloadState,
  isDeleting,
  isSwitching,
  onDownload,
  onCancel,
  onDelete,
  onSwitch,
}: ModelCardProps) {
  const meta = getModelMeta(model.filename);
  const isActiveDownload = downloadState?.status === 'downloading';

  return (
    <div
      className="
        group
        bg-[var(--bg-surface)] px-4 py-4 relative z-10
        border-l-2 border-l-transparent
        hover:border-l-[var(--accent-primary)]
        hover:bg-[var(--bg-elevated)]
        hover:shadow-[4px_0_0_0_rgba(59,130,246,0.15)]
        transition-all duration-150
      "
    >
      <div className="flex items-start gap-4">
        {/* ── Left: model info ─────────────────────────────────────────── */}
        <div className="flex-1 min-w-0">
          {/* Name row */}
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <span className="font-mono text-sm font-semibold text-[var(--text-primary)] truncate">
              {model.name}
            </span>

            {/* Active badge */}
            {model.is_active && (
              <span className="
                inline-flex items-center gap-1 px-1.5 py-0.5
                bg-[var(--success)] bg-opacity-15
                border border-[var(--success)] border-opacity-40
                shrink-0
              ">
                <span className="w-1.5 h-1.5 bg-[var(--success)] shadow-[0_0_4px_rgba(34,197,94,0.6)]" />
                <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-[var(--success)]">
                  Active
                </span>
              </span>
            )}

            {/* Language badge */}
            <span
              className="inline-flex items-center px-1.5 py-0.5 border shrink-0"
              style={
                meta.language === 'Multilingual'
                  ? { color: '#14b8a6', borderColor: 'rgba(20,184,166,0.4)', backgroundColor: 'rgba(20,184,166,0.1)' }
                  : { color: '#f59e0b', borderColor: 'rgba(245,158,11,0.4)', backgroundColor: 'rgba(245,158,11,0.1)' }
              }
            >
              <span className="font-mono text-[9px] uppercase tracking-[0.08em]">
                {meta.language}
              </span>
            </span>
          </div>

          {/* Indicators row */}
          <div className="flex items-center gap-4">
            {/* Size */}
            <span className="font-mono text-[10px] text-[var(--text-tertiary)]">
              {formatBytes(model.size_bytes)}
            </span>

            {/* Speed */}
            <div className="flex items-center gap-1.5" title={`Speed: ${meta.speed}/5`}>
              <Zap size={8} className="text-[var(--text-tertiary)]" />
              <DotIndicator filled={meta.speed} color="#3b82f6" />
            </div>

            {/* Quality */}
            <div className="flex items-center gap-1.5" title={`Quality: ${meta.quality}/5`}>
              <span className="font-mono text-[8px] text-[var(--text-tertiary)] uppercase tracking-[0.08em]">Q</span>
              <DotIndicator filled={meta.quality} color="#22c55e" />
            </div>
          </div>
        </div>

        {/* ── Right: action area ───────────────────────────────────────── */}
        <div className="flex-shrink-0 flex items-center gap-2 pt-0.5">
          {isActiveDownload && downloadState ? (
            <DownloadProgress state={downloadState} onCancel={onCancel} modelName={model.name} />
          ) : model.is_downloaded ? (
            <DownloadedActions
              model={model}
              isDeleting={isDeleting}
              isSwitching={isSwitching}
              onDelete={onDelete}
              onSwitch={onSwitch}
            />
          ) : (
            <button
              onClick={onDownload}
              aria-label={`Download ${model.name}`}
              className="
                flex items-center gap-1.5 px-3 py-1.5
                font-mono text-[10px] uppercase tracking-[0.08em]
                text-[var(--text-tertiary)]
                border-2 border-[var(--border-default)]
                bg-transparent
                hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)]
                hover:bg-[rgba(59,130,246,0.06)]
                hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,0.8)]
                active:shadow-none active:translate-x-[1px] active:translate-y-[1px]
                transition-all duration-150
                focus-visible:outline-2 focus-visible:outline-[var(--accent-primary)] focus-visible:outline-offset-2
              "
            >
              <Download size={10} />
              <span>Download</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── DownloadProgress ─────────────────────────────────────────────────────*/

interface DownloadProgressProps {
  state: DownloadState;
  modelName: string;
  onCancel: () => void;
}

function DownloadProgress({ state, modelName, onCancel }: DownloadProgressProps) {
  return (
    <div className="flex items-center gap-2">
      {/* Progress bar + stats */}
      <div className="w-44">
        {/* Bar */}
        <div className="h-[5px] bg-[var(--bg-elevated)] w-full relative overflow-hidden border border-[var(--border-default)]">
          <div
            className="h-full bg-[var(--accent-primary)] transition-all duration-300 relative"
            style={{ width: `${Math.max(state.progress, 2)}%` }}
          >
            {/* Shimmer */}
            <div
              className="absolute inset-0"
              style={{
                background:
                  'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.25) 50%, transparent 100%)',
                animation: 'shimmer 1.5s linear infinite',
              }}
            />
          </div>
        </div>

        {/* Stats line */}
        <div className="flex items-center justify-between mt-1">
          <span className="font-mono text-[9px] text-[var(--text-tertiary)]">
            {state.downloadedMb.toFixed(0)}MB / {state.totalMb > 0 ? `${state.totalMb.toFixed(0)}MB` : '?'}
            {state.speedMbps > 0 && ` · ${state.speedMbps.toFixed(1)} MB/s`}
            {state.etaSecs > 0 && ` · ETA ${state.etaSecs}s`}
          </span>
          <span className="font-mono text-[9px] text-[var(--accent-primary)]">
            {state.progress}%
          </span>
        </div>
      </div>

      {/* Cancel */}
      <button
        onClick={onCancel}
        aria-label={`Cancel download of ${modelName}`}
        title="Cancel download"
        className="
          flex items-center justify-center w-6 h-6
          text-[var(--text-tertiary)]
          border border-[var(--border-default)]
          bg-[var(--bg-void)]
          hover:border-[var(--error)] hover:text-[var(--error)]
          transition-all duration-150
          focus-visible:outline-2 focus-visible:outline-[var(--error)] focus-visible:outline-offset-2
        "
      >
        <X size={10} />
      </button>
    </div>
  );
}

/* ── DownloadedActions ────────────────────────────────────────────────────*/

interface DownloadedActionsProps {
  model: AvailableModel;
  isDeleting: boolean;
  isSwitching: boolean;
  onDelete: () => void;
  onSwitch: () => void;
}

function DownloadedActions({
  model,
  isDeleting,
  isSwitching,
  onDelete,
  onSwitch,
}: DownloadedActionsProps) {
  const baseBtn = `
    flex items-center gap-1.5 px-3 py-1.5
    font-mono text-[10px] uppercase tracking-[0.08em]
    border-2
    hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,0.8)]
    active:shadow-none active:translate-x-[1px] active:translate-y-[1px]
    disabled:opacity-40 disabled:cursor-not-allowed
    disabled:hover:shadow-none disabled:active:translate-x-0 disabled:active:translate-y-0
    transition-all duration-150
    focus-visible:outline-2 focus-visible:outline-offset-2
  `;

  return (
    <div className="flex items-center gap-2">
      {/* Switch button (only when not active) */}
      {!model.is_active && (
        <button
          onClick={onSwitch}
          disabled={isSwitching}
          aria-label={`Switch to ${model.name}`}
          className={`${baseBtn}
            text-[var(--accent-primary)]
            border-[var(--accent-primary)]
            bg-transparent
            hover:bg-[rgba(59,130,246,0.1)]
            focus-visible:outline-[var(--accent-primary)]
          `}
        >
          {isSwitching ? (
            <span className="inline-block w-2.5 h-2.5 border border-current border-t-transparent rounded-full animate-spin" />
          ) : (
            <Zap size={9} />
          )}
          <span>Switch</span>
        </button>
      )}

      {/* Delete button */}
      <button
        onClick={onDelete}
        disabled={isDeleting || model.is_active}
        aria-label={`Delete ${model.name}`}
        title={model.is_active ? 'Cannot delete the active model' : `Delete ${model.name}`}
        className={`${baseBtn}
          text-[var(--text-tertiary)]
          border-[var(--border-default)]
          bg-transparent
          hover:border-[var(--error)] hover:text-[var(--error)]
          hover:bg-[rgba(239,68,68,0.06)]
          disabled:hover:border-[var(--border-default)] disabled:hover:text-[var(--text-tertiary)]
          disabled:hover:bg-transparent
          focus-visible:outline-[var(--error)]
        `}
      >
        {isDeleting ? (
          <span className="inline-block w-2.5 h-2.5 border border-current border-t-transparent rounded-full animate-spin" />
        ) : (
          <Trash2 size={9} />
        )}
        <span>Delete</span>
      </button>
    </div>
  );
}
