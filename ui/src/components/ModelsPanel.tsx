import { useState, useEffect } from 'react';
import { Download, Trash2, X, HardDrive } from 'lucide-react';
import SectionHeader from './ui/SectionHeader';
import { invoke } from '../lib/ipc';
import { useModelDownload } from '../hooks/useModelDownload';

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

function formatBytes(bytes: number): string {
  if (bytes >= 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(1)} GB`;
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(0)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

function formatSpeed(bps: number): string {
  if (bps >= 1_048_576) return `${(bps / 1_048_576).toFixed(1)} MB/s`;
  if (bps >= 1024) return `${(bps / 1024).toFixed(0)} KB/s`;
  return `${bps} B/s`;
}

export function ModelsPanel() {
  const [isExpanded, setIsExpanded] = useState(true);
  const [models, setModels] = useState<AvailableModel[]>([]);
  const [storageInfo, setStorageInfo] = useState<StorageInfo | null>(null);
  const [deleting, setDeleting] = useState<Set<string>>(new Set());

  const { startDownload, cancelDownload, isDownloading, getProgress } = useModelDownload();

  useEffect(() => {
    const saved = localStorage.getItem('modelsPanel.collapsed');
    if (saved !== null) {
      setIsExpanded(saved === 'false');
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const [available, storage] = await Promise.all([
          invoke<AvailableModel[]>('list_available_models'),
          invoke<StorageInfo>('get_storage_info'),
        ]);
        setModels(available);
        setStorageInfo(storage);
      } catch (err) {
        console.error('Failed to load models data:', err);
      }
    };
    load();
  }, []);

  const handleToggle = () => {
    const newState = !isExpanded;
    setIsExpanded(newState);
    localStorage.setItem('modelsPanel.collapsed', String(!newState));
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
      console.error('Failed to delete model:', err);
    } finally {
      setDeleting(prev => {
        const next = new Set(prev);
        next.delete(modelName);
        return next;
      });
    }
  };

  const storagePercent =
    storageInfo && storageInfo.total_gb > 0
      ? (storageInfo.models_size_gb / storageInfo.total_gb) * 100
      : 0;

  return (
    <section className="mt-12">
      <SectionHeader
        title="MODELS"
        isExpanded={isExpanded}
        onToggle={handleToggle}
      />

      <div
        className={`
          overflow-hidden transition-all duration-200
          ${isExpanded ? 'max-h-[800px] opacity-100 mt-4' : 'max-h-0 opacity-0 mt-0'}
        `}
        style={{ transitionTimingFunction: 'var(--ease-out)' }}
        aria-hidden={!isExpanded}
      >
        <div className="surface-texture border-2 border-[var(--border-default)]">
          {/* Storage info bar */}
          <div className="bg-[var(--bg-surface)] px-3 py-3 border-b-2 border-[var(--border-default)] relative z-10">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <HardDrive size={12} className="text-[var(--text-tertiary)]" />
                <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--text-tertiary)]">
                  Storage
                </span>
              </div>
              <span className="font-mono text-xs text-[var(--text-secondary)]">
                {storageInfo
                  ? `${storageInfo.models_size_gb.toFixed(1)} GB used / ${storageInfo.available_gb.toFixed(1)} GB free`
                  : '...'}
              </span>
            </div>
            <div className="h-[3px] bg-[var(--bg-elevated)] w-full">
              <div
                className="h-full transition-all duration-300"
                style={{
                  width: `${Math.max(storagePercent, 1)}%`,
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

          {/* Model rows */}
          <div className="divide-y-2 divide-[var(--border-default)]">
            {models.map(model => (
              <ModelRow
                key={model.filename}
                model={model}
                isDownloading={isDownloading(model.name)}
                progress={getProgress(model.name)}
                isDeleting={deleting.has(model.name)}
                onDownload={() => startDownload(model.name)}
                onCancel={() => cancelDownload(model.name)}
                onDelete={() => handleDelete(model.name)}
              />
            ))}
            {models.length === 0 && (
              <div className="bg-[var(--bg-surface)] px-3 py-6 text-center relative z-10">
                <span className="font-mono text-xs text-[var(--text-tertiary)]">
                  Loading models...
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Model Row ─────────────────────────────────────────────────────────── */

interface ModelRowProps {
  model: AvailableModel;
  isDownloading: boolean;
  progress: ReturnType<ReturnType<typeof useModelDownload>['getProgress']>;
  isDeleting: boolean;
  onDownload: () => void;
  onCancel: () => void;
  onDelete: () => void;
}

function ModelRow({
  model,
  isDownloading,
  progress,
  isDeleting,
  onDownload,
  onCancel,
  onDelete,
}: ModelRowProps) {
  const downloadPercent =
    progress && progress.totalBytes > 0
      ? (progress.downloadedBytes / progress.totalBytes) * 100
      : 0;

  return (
    <div className="bg-[var(--bg-surface)] px-3 py-3 flex items-center gap-3 relative z-10">
      {/* Model info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-[var(--text-primary)] truncate">
            {model.name}
          </span>
          {model.is_active && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-[var(--success)] bg-opacity-15 border border-[var(--success)] border-opacity-40">
              <span className="w-1 h-1 bg-[var(--success)] shadow-[0_0_4px_rgba(34,197,94,0.6)]" />
              <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-[var(--success)]">
                Active
              </span>
            </span>
          )}
        </div>
        <span className="font-mono text-[10px] text-[var(--text-tertiary)]">
          {formatBytes(model.size_bytes)}
        </span>
      </div>

      {/* Action area */}
      <div className="flex-shrink-0">
        {isDownloading && progress ? (
          /* Downloading state: progress bar + cancel */
          <div className="flex items-center gap-2">
            <div className="w-32">
              <div className="h-[6px] bg-[var(--bg-elevated)] w-full relative overflow-hidden">
                <div
                  className="h-full bg-[var(--accent-primary)] transition-all duration-300 relative"
                  style={{ width: `${Math.max(downloadPercent, 2)}%` }}
                >
                  <div
                    className="absolute inset-0"
                    style={{
                      background:
                        'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.2) 50%, transparent 100%)',
                      animation: 'shimmer 1.5s infinite',
                    }}
                  />
                </div>
              </div>
              <div className="flex justify-between mt-0.5">
                <span className="font-mono text-[9px] text-[var(--text-tertiary)]">
                  {formatBytes(progress.downloadedBytes)} / {formatBytes(progress.totalBytes)}
                </span>
                <span className="font-mono text-[9px] text-[var(--text-tertiary)]">
                  {formatSpeed(progress.speedBps)}
                </span>
              </div>
            </div>
            <button
              onClick={onCancel}
              aria-label={`Cancel download of ${model.name}`}
              className="
                flex items-center justify-center w-6 h-6
                text-[var(--text-tertiary)]
                border border-[var(--border-default)]
                bg-[var(--bg-void)]
                hover:border-[var(--error)] hover:text-[var(--error)]
                transition-all duration-150
              "
            >
              <X size={10} />
            </button>
          </div>
        ) : model.is_downloaded ? (
          /* Downloaded state: delete button */
          <button
            onClick={onDelete}
            disabled={isDeleting || model.is_active}
            aria-label={`Delete ${model.name}`}
            title={model.is_active ? 'Cannot delete the active model' : `Delete ${model.name}`}
            className="
              flex items-center gap-1 px-2 py-1
              font-mono text-[10px] uppercase tracking-[0.05em]
              text-[var(--text-tertiary)]
              border border-[var(--border-default)]
              bg-[var(--bg-void)]
              hover:border-[var(--error)] hover:text-[var(--error)]
              disabled:opacity-40 disabled:cursor-not-allowed
              disabled:hover:border-[var(--border-default)] disabled:hover:text-[var(--text-tertiary)]
              transition-all duration-150
            "
          >
            {isDeleting ? (
              <span className="inline-block w-2.5 h-2.5 border border-current border-t-transparent rounded-full animate-spin" />
            ) : (
              <Trash2 size={10} />
            )}
            <span>Delete</span>
          </button>
        ) : (
          /* Not downloaded state: download button */
          <button
            onClick={onDownload}
            aria-label={`Download ${model.name}`}
            className="
              flex items-center gap-1 px-2 py-1
              font-mono text-[10px] uppercase tracking-[0.05em]
              text-[var(--text-tertiary)]
              border border-[var(--border-default)]
              bg-[var(--bg-void)]
              hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)]
              transition-all duration-150
            "
          >
            <Download size={10} />
            <span>Download</span>
          </button>
        )}
      </div>
    </div>
  );
}
