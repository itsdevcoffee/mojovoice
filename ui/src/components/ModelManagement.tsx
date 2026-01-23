import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Download,
  Trash2,
  Check,
  Search,
  Loader2,
  HardDrive,
  Package,
  AlertCircle,
  X,
  Pause,
  ChevronRight,
  Settings,
  Target,
  MoreVertical,
  Zap,
  Award,
  CircleDot,
} from 'lucide-react';
import { invoke } from '../lib/ipc';
import { cn } from '../lib/utils';
import { useModelDownload, type DownloadProgress } from '../hooks/useModelDownload';

// Types matching Rust backend
interface RegistryModel {
  name: string;
  filename: string;
  sizeMb: number;
  family: string;
  quantization: string;
}

interface DownloadedModel {
  name: string;
  filename: string;
  path: string;
  sizeMb: number;
  isActive: boolean;
}

interface StorageInfo {
  used: number;  // bytes
  free: number;  // bytes
  total: number; // bytes
}

// Filter types
type SizeFilter = 'all' | '<500MB' | '<1GB' | '1-2GB' | '>2GB';

// Get model quality tier based on model name
function getModelTier(name: string): { label: string; speed: string; language: string } {
  // Large models - best quality
  if (name.includes('large-v3-turbo')) {
    return { label: 'Best Quality', speed: 'Fast', language: 'Multilingual' };
  }
  if (name.includes('large')) {
    return { label: 'Best Quality', speed: 'Slower', language: 'Multilingual' };
  }

  // Medium - balanced
  if (name.includes('medium')) {
    return { label: 'Balanced', speed: 'Medium', language: 'Multilingual' };
  }

  // Distil models - optimized
  if (name.includes('distil')) {
    return { label: 'Fast', speed: 'Very Fast', language: name.includes('-en') ? 'English' : 'Multilingual' };
  }

  // Small models
  if (name.includes('small')) {
    return { label: 'Good Quality', speed: 'Fast', language: name.includes('-en') ? 'English' : 'Multilingual' };
  }

  // Tiny/Base - fastest
  if (name.includes('tiny') || name.includes('base')) {
    return { label: 'Fast', speed: 'Very Fast', language: name.includes('-en') ? 'English' : 'Multilingual' };
  }

  // Default
  return { label: 'Standard', speed: 'Medium', language: 'Multilingual' };
}

// Estimate download time based on size (assuming 10 MB/s average connection)
function getEstimatedDownloadTime(sizeMb: number): string {
  const secondsAtTenMBs = sizeMb / 10;
  if (secondsAtTenMBs < 30) return '~30 sec';
  if (secondsAtTenMBs < 60) return '~1 min';
  if (secondsAtTenMBs < 180) return '~2-3 min';
  if (secondsAtTenMBs < 300) return '~3-5 min';
  if (secondsAtTenMBs < 600) return '~5-10 min';
  return '~10-15 min';
}

// Get color class for speed indicator
function getSpeedColor(speed: string): string {
  switch (speed) {
    case 'Very Fast':
      return 'text-success';
    case 'Fast':
      return 'text-primary';
    case 'Medium':
      return 'text-warning';
    case 'Slower':
      return 'text-muted-foreground';
    default:
      return 'text-muted-foreground';
  }
}

// Get icon for quality tier
function getQualityIcon(label: string): React.ReactNode {
  switch (label) {
    case 'Best Quality':
      return <Award className="w-3 h-3 text-success inline-block mr-1" />;
    case 'Balanced':
      return <CircleDot className="w-3 h-3 text-primary inline-block mr-1" />;
    case 'Fast':
    case 'Good Quality':
      return <Zap className="w-3 h-3 text-warning inline-block mr-1" />;
    default:
      return null;
  }
}

// Detect if device supports touch
const isTouchDevice = (): boolean => {
  if (typeof window === 'undefined') return false;
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
};

export default function ModelManagement() {
  const [availableModels, setAvailableModels] = useState<RegistryModel[]>([]);
  const [downloadedModels, setDownloadedModels] = useState<DownloadedModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sizeFilter, setSizeFilter] = useState<SizeFilter>('all');
  const [deleteConfirm, setDeleteConfirm] = useState<DownloadedModel | null>(null);
  const [switching, setSwitching] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<{ modelName: string; error: string } | null>(null);
  const [showAllInstalled, setShowAllInstalled] = useState(false);
  const [storageInfo, setStorageInfo] = useState<StorageInfo | null>(null);
  const [isTouch, setIsTouch] = useState(false);
  const [showHint, setShowHint] = useState(true);

  const { downloads, startDownload, cancelDownload, isDownloading, activeDownloads } = useModelDownload();

  // Track which downloads have already triggered a refresh
  const refreshedDownloads = useRef<Set<string>>(new Set());

  // Load models on mount
  useEffect(() => {
    loadModels();
    loadStorageInfo();
    setIsTouch(isTouchDevice());

    // Hide hint after 3 seconds
    const hintTimer = setTimeout(() => setShowHint(false), 3000);
    return () => clearTimeout(hintTimer);
  }, []);

  const loadModels = async () => {
    try {
      setLoading(true);
      const [available, downloaded] = await Promise.all([
        invoke<RegistryModel[]>('list_available_models'),
        invoke<DownloadedModel[]>('list_downloaded_models'),
      ]);
      setAvailableModels(available);
      setDownloadedModels(downloaded);
    } catch (error) {
      console.error('Failed to load models:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStorageInfo = async () => {
    try {
      const info = await invoke<StorageInfo>('get_storage_info');
      setStorageInfo(info);
    } catch (error) {
      // Storage info is optional, fail silently
      console.debug('Storage info not available:', error);
    }
  };

  // Refresh downloaded models after download completes
  useEffect(() => {
    const completedDownloads = Array.from(downloads.entries())
      .filter(([_, d]) => d.status === 'complete')
      .map(([name]) => name);

    const newCompletions = completedDownloads.filter(
      name => !refreshedDownloads.current.has(name)
    );

    if (newCompletions.length > 0) {
      newCompletions.forEach(name => refreshedDownloads.current.add(name));
      invoke<DownloadedModel[]>('list_downloaded_models')
        .then(setDownloadedModels)
        .catch(console.error);
      loadStorageInfo();

      setTimeout(() => {
        newCompletions.forEach(name => refreshedDownloads.current.delete(name));
      }, 5000);
    }

    const erroredDownload = Array.from(downloads.values()).find(d => d.status === 'error');
    if (erroredDownload && erroredDownload.error) {
      setDownloadError({ modelName: erroredDownload.modelName, error: erroredDownload.error });
    }
  }, [downloads]);

  const handleDownload = async (modelName: string) => {
    if (isDownloading(modelName)) return;

    try {
      setDownloadError(null);
      await startDownload(modelName);
    } catch (error) {
      console.error('Failed to start download:', error);
      setDownloadError({ modelName, error: String(error) });
    }
  };

  const handleSwitch = async (model: DownloadedModel) => {
    try {
      setSwitching(model.filename);
      await invoke('switch_model', { filename: model.filename });
      await loadModels();
    } catch (error) {
      console.error('Failed to switch model:', error);
    } finally {
      setSwitching(null);
    }
  };

  const handleDelete = async (model: DownloadedModel) => {
    try {
      setDeleting(model.filename);
      await invoke('delete_model', { filename: model.filename });
      setDeleteConfirm(null);
      await loadModels();
      loadStorageInfo();
    } catch (error) {
      console.error('Failed to delete model:', error);
    } finally {
      setDeleting(null);
    }
  };

  // Filter available models (exclude already downloaded)
  const filteredAvailableModels = useMemo(() => {
    const downloadedNames = new Set(downloadedModels.map(m => m.name));

    return availableModels.filter(model => {
      // Exclude already downloaded
      if (downloadedNames.has(model.name)) return false;

      // Search filter
      const matchesSearch =
        model.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        model.family.toLowerCase().includes(searchQuery.toLowerCase()) ||
        model.quantization.toLowerCase().includes(searchQuery.toLowerCase());

      // Size filter
      let matchesSize = true;
      if (sizeFilter === '<500MB') matchesSize = model.sizeMb < 500;
      else if (sizeFilter === '<1GB') matchesSize = model.sizeMb >= 500 && model.sizeMb < 1024;
      else if (sizeFilter === '1-2GB') matchesSize = model.sizeMb >= 1024 && model.sizeMb < 2048;
      else if (sizeFilter === '>2GB') matchesSize = model.sizeMb >= 2048;

      return matchesSearch && matchesSize;
    });
  }, [availableModels, downloadedModels, searchQuery, sizeFilter]);

  // Filter installed models by search
  const filteredInstalledModels = useMemo(() => {
    if (!searchQuery) return downloadedModels;

    return downloadedModels.filter(model =>
      model.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [downloadedModels, searchQuery]);

  // Installed models to display
  const visibleInstalled = showAllInstalled ? filteredInstalledModels : filteredInstalledModels.slice(0, 6);
  const hasMoreInstalled = filteredInstalledModels.length > 6;
  const hiddenCount = filteredInstalledModels.length - 6;

  // Storage warning levels
  const storagePercent = storageInfo ? (storageInfo.used / storageInfo.total) * 100 : 0;
  const storageWarning = storagePercent >= 90 ? 'critical' : storagePercent >= 70 ? 'warning' : 'normal';

  // Show downloads section only when there are active downloads
  const showDownloadsSection = activeDownloads.length > 0;

  return (
    <div className="space-y-8 max-w-container mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold text-foreground">Models</h1>
        </div>
        <div className="flex items-center gap-3">
          <button className="btn-ghost p-2" aria-label="Settings">
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </motion.div>

      {/* Download Error Notification */}
      <AnimatePresence>
        {downloadError && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="glass-card border-destructive/30 bg-destructive/10"
          >
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-destructive font-medium">Download Failed</p>
                <p className="text-muted-foreground text-sm mt-1">
                  {downloadError.modelName}: {downloadError.error}
                </p>
              </div>
              <button
                onClick={() => setDownloadError(null)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Downloads Section - Only visible when active */}
      <AnimatePresence>
        {showDownloadsSection && (
          <motion.section
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="glass-panel">
              <div className="section-header">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 text-primary animate-spin" />
                  <span className="section-title">
                    Downloading ({activeDownloads.length})
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button className="btn-ghost text-xs">
                    Pause All
                  </button>
                  <button className="btn-ghost text-xs text-destructive">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                {activeDownloads.map((download) => (
                  <DownloadProgressBar
                    key={download.modelName}
                    progress={download}
                    onCancel={() => cancelDownload(download.modelName)}
                  />
                ))}
              </div>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {/* Search */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="relative max-w-md"
      >
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search models..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="glass-input w-full pl-10"
          aria-label="Search models"
        />
      </motion.div>

      {/* Installed Section */}
      {loading ? (
        <div className="glass-panel text-center py-12">
          <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto mb-2" />
          <p className="text-muted-foreground">Loading models...</p>
        </div>
      ) : downloadedModels.length > 0 ? (
        <section aria-labelledby="installed-models-heading">
          <div className="section-header">
            <h2 id="installed-models-heading" className="section-title">
              Installed ({downloadedModels.length})
            </h2>
            {hasMoreInstalled && (
              <button
                onClick={() => setShowAllInstalled(!showAllInstalled)}
                className="btn-ghost text-sm flex items-center gap-1 text-primary hover:text-primary-hover font-medium"
              >
                {showAllInstalled ? 'Show Less' : `+${hiddenCount} more`}
                <ChevronRight className={cn(
                  "w-4 h-4 transition-transform duration-200",
                  showAllInstalled && "rotate-90"
                )} />
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
            <AnimatePresence mode="popLayout">
              {visibleInstalled.map((model, index) => (
                <InstalledModelCard
                  key={model.filename}
                  model={model}
                  index={index}
                  onActivate={() => handleSwitch(model)}
                  onDelete={() => setDeleteConfirm(model)}
                  isSwitching={switching === model.filename}
                  isTouch={isTouch}
                  showHint={showHint && index === 0 && !model.isActive}
                />
              ))}
            </AnimatePresence>
          </div>
        </section>
      ) : (
        <section className="glass-panel text-center py-12">
          <Target className="w-8 h-8 text-muted-tertiary mx-auto mb-2" />
          <p className="text-muted-foreground mb-1">No models installed yet</p>
          <p className="text-muted-tertiary text-sm">Browse available models below</p>
        </section>
      )}

      {/* Available Models Section */}
      <section aria-labelledby="available-models-heading">
        <div className="section-header">
          <h2 id="available-models-heading" className="section-title">
            Available Models ({filteredAvailableModels.length})
          </h2>
          <div className="flex items-center gap-2 flex-wrap" role="radiogroup" aria-label="Filter by size">
            <span className="text-muted-tertiary text-xs uppercase tracking-wide mr-1" id="size-filter-label">Size:</span>
            {(['all', '<500MB', '<1GB', '1-2GB', '>2GB'] as SizeFilter[]).map(size => (
              <FilterPill
                key={size}
                active={sizeFilter === size}
                onClick={() => setSizeFilter(size)}
              >
                {size === 'all' ? 'All' : size}
              </FilterPill>
            ))}
          </div>
        </div>

        {filteredAvailableModels.length === 0 ? (
          <div className="glass-panel text-center py-12">
            <Package className="w-8 h-8 text-muted-tertiary mx-auto mb-2" />
            <p className="text-muted-foreground mb-2">No models match your filters</p>
            <button
              onClick={() => {
                setSearchQuery('');
                setSizeFilter('all');
              }}
              className="text-primary hover:text-primary-hover text-sm transition-colors"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
            {filteredAvailableModels.map((model, index) => (
              <AvailableModelCard
                key={model.name}
                model={model}
                index={index}
                isDownloading={isDownloading(model.name)}
                progress={downloads.get(model.name)}
                onDownload={() => handleDownload(model.name)}
                onCancel={() => cancelDownload(model.name)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Storage Indicator */}
      {storageInfo && (
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className={cn(
            "glass-panel",
            storageWarning === 'critical' && "border-destructive/50 bg-destructive/5",
            storageWarning === 'warning' && "border-warning/50 bg-warning/5"
          )}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <HardDrive className={cn(
                "w-5 h-5",
                storageWarning === 'critical' ? "text-destructive" :
                storageWarning === 'warning' ? "text-warning" :
                "text-success"
              )} />
              <div>
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "text-base font-medium transition-colors duration-200",
                    storageWarning === 'critical' ? "text-destructive" :
                    storageWarning === 'warning' ? "text-warning" :
                    "text-success"
                  )}>
                    {formatBytes(storageInfo.used)} / {formatBytes(storageInfo.total)}
                  </span>
                  <span className={cn(
                    "text-xs font-medium px-2 py-0.5 rounded-full transition-all duration-200",
                    storageWarning === 'critical' && "bg-destructive/20 text-destructive",
                    storageWarning === 'warning' && "bg-warning/20 text-warning",
                    storageWarning === 'normal' && "bg-success/20 text-success"
                  )}>
                    {Math.round(storagePercent)}%
                  </span>
                </div>
                <span className="text-sm text-muted-foreground">
                  {formatBytes(storageInfo.free)} free
                </span>
              </div>
            </div>
            {storageWarning !== 'normal' && (
              <div className="flex items-center gap-2">
                <AlertCircle className={cn(
                  "w-4 h-4",
                  storageWarning === 'critical' ? "text-destructive" : "text-warning"
                )} />
                <span className={cn(
                  "text-xs font-medium",
                  storageWarning === 'critical' ? "text-destructive" : "text-warning"
                )}>
                  {storageWarning === 'critical' ? 'Storage Critical' : 'Low Storage'}
                </span>
              </div>
            )}
          </div>
          <div className={cn(
            "storage-bar transition-all duration-300",
            storageWarning === 'critical' && "storage-bar-critical",
            storageWarning === 'warning' && "storage-bar-warning"
          )}>
            <div
              className={cn(
                "storage-bar-fill transition-all duration-300",
                storageWarning === 'critical' && "bg-gradient-to-r from-destructive to-destructive/80",
                storageWarning === 'warning' && "bg-gradient-to-r from-warning to-warning/80",
                storageWarning === 'normal' && "bg-gradient-to-r from-success to-primary"
              )}
              style={{ width: `${Math.min(storagePercent, 100)}%` }}
            />
          </div>
        </motion.section>
      )}

      {/* Delete Confirmation Dialog */}
      <AnimatePresence>
        {deleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
            onClick={() => setDeleteConfirm(null)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-dialog-title"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass-panel max-w-md mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-full bg-destructive/20">
                  <AlertCircle className="w-6 h-6 text-destructive" />
                </div>
                <div className="flex-1">
                  <h3 id="delete-dialog-title" className="text-lg font-semibold text-foreground mb-2">
                    Delete Model?
                  </h3>
                  <p className="text-muted-foreground text-sm mb-4">
                    Are you sure you want to delete <span className="text-foreground font-medium">{deleteConfirm.name}</span>?
                    This will remove {formatSize(deleteConfirm.sizeMb)} from disk.
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setDeleteConfirm(null)}
                      className="flex-1 btn-ghost py-2 border border-border"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleDelete(deleteConfirm)}
                      disabled={deleting !== null}
                      className="flex-1 btn-danger py-2 disabled:opacity-50"
                    >
                      {deleting ? (
                        <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                      ) : (
                        'Delete'
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// Sub-Components
// ============================================================================

function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "filter-pill focus-ring",
        active && "filter-pill-active"
      )}
      role="radio"
      aria-checked={active}
      tabIndex={0}
    >
      {children}
    </button>
  );
}

function InstalledModelCard({
  model,
  index,
  onActivate,
  onDelete,
  isSwitching,
  isTouch = false,
  showHint = false,
}: {
  model: DownloadedModel;
  index: number;
  onActivate: () => void;
  onDelete: () => void;
  isSwitching: boolean;
  isTouch?: boolean;
  showHint?: boolean;
}) {
  const tier = getModelTier(model.name);
  const speedColor = getSpeedColor(tier.speed);
  const qualityIcon = getQualityIcon(tier.label);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      className={cn(
        "model-card model-card-installed group relative",
        model.isActive && "model-card-active",
        !model.isActive && "model-card-inactive"
      )}
    >
      {/* Action menu indicator (top-right corner) - persistent for discoverability */}
      {!model.isActive && (
        <motion.div
          initial={{ opacity: isTouch ? 0.6 : 0.4 }}
          animate={showHint ? {
            opacity: [0.4, 0.8, 0.4],
            scale: [1, 1.1, 1]
          } : {}}
          transition={showHint ? {
            duration: 1.5,
            repeat: 2,
            delay: 1
          } : {}}
          className={cn(
            "absolute top-3 right-3 transition-all duration-200",
            isTouch ? "opacity-60" : "opacity-40 group-hover:opacity-100"
          )}
        >
          <MoreVertical className="w-4 h-4 text-muted-foreground" />
        </motion.div>
      )}

      {/* Model ID - PRIMARY */}
      <div className="flex items-center gap-2 mb-2">
        <span className={cn(
          "status-dot",
          model.isActive ? "status-dot-active animate-pulse-dot" : "status-dot-inactive"
        )} />
        <span className="text-model-name truncate flex-1">{model.name}</span>
      </div>

      {/* Model tier info - SECONDARY */}
      <div className="mb-3 space-y-1">
        <p className="text-metadata truncate flex items-center">
          {qualityIcon}
          {tier.label} • {tier.language}
        </p>
        <p className={cn("text-size flex items-center gap-1", speedColor)}>
          <Zap className="w-3 h-3" />
          {tier.speed}
        </p>
      </div>

      {/* Size - TERTIARY */}
      <p className="text-size mt-auto mb-2">{formatSize(model.sizeMb)}</p>

      {/* Accent bar */}
      <div className={cn(
        "accent-bar mb-2",
        model.isActive ? "accent-bar-success" : "bg-border"
      )} />

      {/* Status + Actions */}
      <div className="flex items-center justify-between">
        {/* Only show "Active" badge, not "Inactive" */}
        {model.isActive ? (
          <span className="text-label px-2 py-1 rounded-md bg-success/20 border border-success/30 text-label-active animate-pulse-badge">
            Active
          </span>
        ) : (
          <div /> {/* Spacer */}
        )}

        {/* Action buttons */}
        <div className={cn(
          "flex items-center gap-1 transition-opacity duration-200",
          isTouch ? "opacity-60" : "opacity-0 group-hover:opacity-100"
        )}>
          {!model.isActive && (
            <>
              <button
                onClick={onActivate}
                disabled={isSwitching}
                className="btn-ghost p-1.5 text-xs hover:bg-primary/20 hover:text-primary rounded transition-all duration-150 hover:scale-110"
                title="Activate this model"
                aria-label="Activate this model"
              >
                {isSwitching ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
              </button>
              <button
                onClick={onDelete}
                className="btn-ghost p-1.5 text-xs hover:bg-destructive/20 hover:text-destructive rounded transition-all duration-150 hover:scale-110"
                title="Delete model"
                aria-label="Delete model"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function AvailableModelCard({
  model,
  index,
  isDownloading,
  progress,
  onDownload,
  onCancel,
}: {
  model: RegistryModel;
  index: number;
  isDownloading: boolean;
  progress?: DownloadProgress;
  onDownload: () => void;
  onCancel: () => void;
}) {
  const percent = progress && progress.totalBytes > 0
    ? (progress.downloadedBytes / progress.totalBytes) * 100
    : 0;

  const tier = getModelTier(model.name);
  const estimatedTime = getEstimatedDownloadTime(model.sizeMb);
  const speedColor = getSpeedColor(tier.speed);
  const qualityIcon = getQualityIcon(tier.label);

  // Don't show "Full" quantization badge - it adds no value
  const showQuantBadge = model.quantization !== 'Full';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.03, 0.3), duration: 0.3 }}
      className="model-card model-card-available group"
    >
      {/* Model ID - PRIMARY */}
      <div className="mb-2">
        <span className="text-model-name truncate block">{model.name}</span>
      </div>

      {/* Model tier info - SECONDARY */}
      <div className="mb-3 space-y-1">
        <p className="text-metadata truncate flex items-center">
          {qualityIcon}
          {tier.label} • {tier.language}
        </p>
        <p className={cn("text-size flex items-center gap-1", speedColor)}>
          <Zap className="w-3 h-3" />
          {tier.speed}
        </p>
      </div>

      {/* Size + Download time - TERTIARY */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-size font-medium">{formatSize(model.sizeMb)}</span>
          {/* Always show download time estimate */}
          <span className="text-[10px] text-muted-tertiary">{estimatedTime}</span>
        </div>
        {showQuantBadge && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted/50 text-muted-foreground uppercase">
            {model.quantization}
          </span>
        )}
      </div>

      {/* Progress bar when downloading */}
      {isDownloading && progress && (
        <div className="mb-3">
          <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
            <span>{progress.status === 'verifying' ? 'Verifying' : 'Downloading'}</span>
            <span className="font-medium text-primary">{Math.round(percent)}%</span>
          </div>
          <div className="progress-bar h-1.5">
            <div
              className="progress-bar-fill"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
      )}

      {/* Action button - OUTLINED style with enhanced hover */}
      {isDownloading ? (
        <button
          onClick={onCancel}
          className="btn-danger w-full flex items-center justify-center gap-2 py-2 text-sm transition-all duration-150"
        >
          <X className="w-4 h-4" />
          Cancel
        </button>
      ) : (
        <button
          onClick={onDownload}
          className="btn-primary flex items-center justify-center gap-2 transition-all duration-150 hover:scale-[1.02]"
        >
          <Download className="w-4 h-4" />
          Download
        </button>
      )}
    </motion.div>
  );
}

function DownloadProgressBar({
  progress,
  onCancel,
}: {
  progress: DownloadProgress;
  onCancel: () => void;
}) {
  const percent = progress.totalBytes > 0
    ? (progress.downloadedBytes / progress.totalBytes) * 100
    : 0;
  const speedMBs = progress.speedBps / (1024 * 1024);
  const remainingBytes = progress.totalBytes - progress.downloadedBytes;
  const etaSeconds = progress.speedBps > 0 ? remainingBytes / progress.speedBps : 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-model-name">{progress.modelName}</span>
          <span className="text-progress text-muted-foreground ml-2">
            {progress.status === 'verifying' ? 'Verifying...' : ''}
          </span>
        </div>
        <span className="text-model-name text-primary">
          {Math.round(percent)}%
        </span>
      </div>

      <div className="progress-bar">
        <motion.div
          className="progress-bar-fill"
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>

      <div className="flex items-center justify-between">
        <span className="text-progress text-muted-foreground">
          {formatBytes(progress.downloadedBytes)} / {formatBytes(progress.totalBytes)}
          <span className="mx-2">•</span>
          {speedMBs.toFixed(1)} MB/s
          {etaSeconds > 0 && (
            <>
              <span className="mx-2">•</span>
              {formatEta(etaSeconds)}
            </>
          )}
        </span>

        <div className="flex items-center gap-2">
          <button
            className="btn-ghost text-xs flex items-center gap-1"
            title="Pause download"
          >
            <Pause className="w-3 h-3" />
            Pause
          </button>
          <button
            onClick={onCancel}
            className="btn-ghost text-xs text-destructive flex items-center gap-1"
            title="Cancel download"
          >
            <X className="w-3 h-3" />
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Utility Functions
// ============================================================================

function formatSize(sizeMb: number): string {
  if (sizeMb >= 1024) {
    return `${(sizeMb / 1024).toFixed(2)} GB`;
  }
  return `${sizeMb} MB`;
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function formatEta(seconds: number): string {
  if (seconds < 60) {
    return `${Math.round(seconds)}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  }
  return `${minutes}m ${secs.toString().padStart(2, '0')}s`;
}
