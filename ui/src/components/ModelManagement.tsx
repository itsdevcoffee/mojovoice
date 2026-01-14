import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, Trash2, Check, Search, Loader2, HardDrive, Package, AlertCircle, X } from 'lucide-react';
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

type Tab = 'library' | 'myModels' | 'downloads';

export default function ModelManagement() {
  const [activeTab, setActiveTab] = useState<Tab>('library');
  const [availableModels, setAvailableModels] = useState<RegistryModel[]>([]);
  const [downloadedModels, setDownloadedModels] = useState<DownloadedModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [familyFilter, setFamilyFilter] = useState<string>('');
  const [quantFilter, setQuantFilter] = useState<string>('');
  const [deleteConfirm, setDeleteConfirm] = useState<DownloadedModel | null>(null);
  const [switching, setSwitching] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<{ modelName: string; error: string } | null>(null);

  const { downloads, startDownload, cancelDownload, isDownloading, activeDownloads } = useModelDownload();

  // Track which downloads have already triggered a refresh (prevent race condition)
  const refreshedDownloads = useRef<Set<string>>(new Set());

  // Load models on mount
  useEffect(() => {
    loadModels();
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

  // Refresh downloaded models after download completes (with deduplication)
  useEffect(() => {
    const completedDownloads = Array.from(downloads.entries())
      .filter(([_, d]) => d.status === 'complete')
      .map(([name]) => name);

    // Only refresh for NEW completions
    const newCompletions = completedDownloads.filter(
      name => !refreshedDownloads.current.has(name)
    );

    if (newCompletions.length > 0) {
      newCompletions.forEach(name => refreshedDownloads.current.add(name));
      invoke<DownloadedModel[]>('list_downloaded_models')
        .then(setDownloadedModels)
        .catch(console.error);

      // Clear tracking after auto-dismiss period (3s + buffer) to allow re-downloads
      setTimeout(() => {
        newCompletions.forEach(name => refreshedDownloads.current.delete(name));
      }, 5000);
    }

    // Check for errors and display them
    const erroredDownload = Array.from(downloads.values()).find(d => d.status === 'error');
    if (erroredDownload && erroredDownload.error) {
      setDownloadError({ modelName: erroredDownload.modelName, error: erroredDownload.error });
    }
  }, [downloads]);

  const handleDownload = async (modelName: string) => {
    // Prevent duplicate downloads
    if (isDownloading(modelName)) {
      return;
    }

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
    } catch (error) {
      console.error('Failed to delete model:', error);
    } finally {
      setDeleting(null);
    }
  };

  // Get unique families and quantizations for filters
  const families = [...new Set(availableModels.map(m => m.family))];
  const quantizations = [...new Set(availableModels.map(m => m.quantization))];

  // Filter available models
  const filteredModels = availableModels.filter(model => {
    const matchesSearch = model.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFamily = !familyFilter || model.family === familyFilter;
    const matchesQuant = !quantFilter || model.quantization === quantFilter;
    return matchesSearch && matchesFamily && matchesQuant;
  });

  // Check if a model is already downloaded
  const isDownloaded = (modelName: string) => {
    return downloadedModels.some(m => m.name === modelName);
  };

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'library', label: 'Model Library', count: availableModels.length },
    { id: 'myModels', label: 'My Models', count: downloadedModels.length },
    { id: 'downloads', label: 'Downloads', count: activeDownloads.length || undefined },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-3xl font-bold text-white mb-2">Model Management</h1>
        <p className="text-gray-400">Browse, download, and manage Whisper models</p>
      </motion.div>

      {/* Tabs */}
      <div className="glass-panel p-2" role="tablist" aria-label="Model management tabs">
        <div className="flex gap-2">
          {tabs.map((tab) => (
            <motion.button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-controls={`${tab.id}-panel`}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200',
                'backdrop-blur-sm border',
                activeTab === tab.id
                  ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400'
                  : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-white'
              )}
            >
              <span className="text-sm font-medium">{tab.label}</span>
              {tab.count !== undefined && (
                <span className={cn(
                  'px-2 py-0.5 rounded-full text-xs',
                  activeTab === tab.id ? 'bg-cyan-500/30' : 'bg-white/10'
                )}>
                  {tab.count}
                </span>
              )}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Download Error Notification */}
      <AnimatePresence>
        {downloadError && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="glass-card p-4 border-red-500/30 bg-red-500/10"
          >
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-red-400 font-medium">Download Failed</p>
                <p className="text-gray-400 text-sm mt-1">
                  {downloadError.modelName}: {downloadError.error}
                </p>
              </div>
              <button
                onClick={() => setDownloadError(null)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        {activeTab === 'library' && (
          <motion.div
            key="library"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            {/* Search and Filters */}
            <div className="glass-card p-4">
              <div className="flex flex-wrap gap-4">
                {/* Search */}
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" aria-hidden="true" />
                  <input
                    type="text"
                    placeholder="Search models..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="glass-input w-full pl-10"
                    aria-label="Search models"
                  />
                </div>

                {/* Family Filter */}
                <select
                  value={familyFilter}
                  onChange={(e) => setFamilyFilter(e.target.value)}
                  className="glass-input min-w-[150px]"
                  aria-label="Filter by model family"
                >
                  <option value="">All Families</option>
                  {families.map(f => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>

                {/* Quantization Filter */}
                <select
                  value={quantFilter}
                  onChange={(e) => setQuantFilter(e.target.value)}
                  className="glass-input min-w-[150px]"
                  aria-label="Filter by quantization"
                >
                  <option value="">All Quantizations</option>
                  {quantizations.map(q => (
                    <option key={q} value={q}>{q}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Model Grid */}
            {loading ? (
              <div className="glass-panel p-12 text-center">
                <Loader2 className="w-8 h-8 text-cyan-400 animate-spin mx-auto mb-2" />
                <p className="text-gray-400">Loading models...</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredModels.map((model) => (
                  <ModelCard
                    key={model.name}
                    model={model}
                    isDownloaded={isDownloaded(model.name)}
                    isDownloading={isDownloading(model.name)}
                    progress={downloads.get(model.name)}
                    onDownload={() => handleDownload(model.name)}
                    onCancel={() => cancelDownload(model.name)}
                  />
                ))}
              </div>
            )}

            {!loading && filteredModels.length === 0 && (
              <div className="glass-panel p-12 text-center">
                <Package className="w-8 h-8 text-gray-500 mx-auto mb-2" />
                <p className="text-gray-400">No models match your filters</p>
              </div>
            )}
          </motion.div>
        )}

        {activeTab === 'myModels' && (
          <motion.div
            key="myModels"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            {loading ? (
              <div className="glass-panel p-12 text-center">
                <Loader2 className="w-8 h-8 text-cyan-400 animate-spin mx-auto mb-2" />
                <p className="text-gray-400">Loading models...</p>
              </div>
            ) : downloadedModels.length === 0 ? (
              <div className="glass-panel p-12 text-center">
                <HardDrive className="w-8 h-8 text-gray-500 mx-auto mb-2" />
                <p className="text-gray-400 mb-4">No models downloaded yet</p>
                <button
                  onClick={() => setActiveTab('library')}
                  className="text-cyan-400 hover:text-cyan-300 text-sm"
                >
                  Browse Model Library
                </button>
              </div>
            ) : (
              <div className="glass-panel overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left p-4 text-gray-400 font-medium">Model</th>
                      <th className="text-left p-4 text-gray-400 font-medium">Size</th>
                      <th className="text-left p-4 text-gray-400 font-medium">Status</th>
                      <th className="text-right p-4 text-gray-400 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {downloadedModels.map((model) => (
                      <tr key={model.filename} className="border-b border-white/5 hover:bg-white/5">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            {model.isActive && (
                              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                            )}
                            <div>
                              <p className="text-white font-medium">{model.name}</p>
                              <p className="text-gray-500 text-sm truncate max-w-[300px]" title={model.path}>
                                {model.filename}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="p-4 text-gray-300">
                          {formatSize(model.sizeMb)}
                        </td>
                        <td className="p-4">
                          {model.isActive ? (
                            <span className="inline-flex items-center gap-1 text-green-400 text-sm">
                              <Check className="w-4 h-4" />
                              Active
                            </span>
                          ) : (
                            <span className="text-gray-500 text-sm">Inactive</span>
                          )}
                        </td>
                        <td className="p-4">
                          <div className="flex justify-end gap-2">
                            {!model.isActive && (
                              <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => handleSwitch(model)}
                                disabled={switching !== null}
                                className={cn(
                                  'px-3 py-1.5 rounded-lg text-sm font-medium',
                                  'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30',
                                  'hover:bg-cyan-500/30 transition-colors',
                                  'disabled:opacity-50 disabled:cursor-not-allowed'
                                )}
                              >
                                {switching === model.filename ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  'Use'
                                )}
                              </motion.button>
                            )}
                            <motion.button
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => setDeleteConfirm(model)}
                              disabled={model.isActive || deleting !== null}
                              className={cn(
                                'px-3 py-1.5 rounded-lg text-sm font-medium',
                                'bg-red-500/20 text-red-400 border border-red-500/30',
                                'hover:bg-red-500/30 transition-colors',
                                'disabled:opacity-50 disabled:cursor-not-allowed'
                              )}
                              title={model.isActive ? 'Cannot delete active model' : 'Delete model'}
                            >
                              <Trash2 className="w-4 h-4" />
                            </motion.button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>
        )}

        {activeTab === 'downloads' && (
          <motion.div
            key="downloads"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            {activeDownloads.length === 0 ? (
              <div className="glass-panel p-12 text-center">
                <Download className="w-8 h-8 text-gray-500 mx-auto mb-2" />
                <p className="text-gray-400">No active downloads</p>
              </div>
            ) : (
              <div className="space-y-4">
                {activeDownloads.map((download) => (
                  <DownloadItem
                    key={download.modelName}
                    progress={download}
                    onCancel={() => cancelDownload(download.modelName)}
                  />
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

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
            aria-describedby="delete-dialog-description"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass-panel p-6 max-w-md mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-full bg-red-500/20">
                  <AlertCircle className="w-6 h-6 text-red-400" aria-hidden="true" />
                </div>
                <div className="flex-1">
                  <h3 id="delete-dialog-title" className="text-lg font-semibold text-white mb-2">Delete Model?</h3>
                  <p id="delete-dialog-description" className="text-gray-400 text-sm mb-4">
                    Are you sure you want to delete <span className="text-white">{deleteConfirm.name}</span>?
                    This will remove {formatSize(deleteConfirm.sizeMb)} from disk.
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setDeleteConfirm(null)}
                      className="flex-1 px-4 py-2 rounded-lg bg-white/10 text-gray-300 hover:bg-white/20 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleDelete(deleteConfirm)}
                      disabled={deleting !== null}
                      className={cn(
                        'flex-1 px-4 py-2 rounded-lg',
                        'bg-red-500/20 text-red-400 border border-red-500/30',
                        'hover:bg-red-500/30 transition-colors',
                        'disabled:opacity-50'
                      )}
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

// Button style helper - avoids nested ternaries
function getButtonStyle(isDownloaded: boolean, isDownloading: boolean): string {
  if (isDownloaded) {
    return 'bg-green-500/20 text-green-400 border border-green-500/30 cursor-default';
  }
  if (isDownloading) {
    return 'bg-cyan-500/10 text-cyan-400/50 border border-cyan-500/20 cursor-wait';
  }
  return 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/30';
}

// Button content component - clearer than nested ternaries
function ButtonContent({ isDownloaded, isDownloading }: { isDownloaded: boolean; isDownloading: boolean }) {
  if (isDownloaded) {
    return (
      <>
        <Check className="w-4 h-4" />
        Downloaded
      </>
    );
  }
  if (isDownloading) {
    return (
      <>
        <Loader2 className="w-4 h-4 animate-spin" />
        Downloading...
      </>
    );
  }
  return (
    <>
      <Download className="w-4 h-4" />
      Download
    </>
  );
}

// Model Card Component
function ModelCard({
  model,
  isDownloaded,
  isDownloading,
  progress,
  onDownload,
  onCancel,
}: {
  model: RegistryModel;
  isDownloaded: boolean;
  isDownloading: boolean;
  progress?: DownloadProgress;
  onDownload: () => void;
  onCancel: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card p-4 flex flex-col"
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-white font-medium">{model.name}</h3>
          <p className="text-gray-500 text-sm">{model.family}</p>
        </div>
        <span className="px-2 py-1 rounded text-xs bg-white/10 text-gray-300">
          {model.quantization}
        </span>
      </div>

      <div className="flex items-center gap-2 text-gray-400 text-sm mb-4">
        <HardDrive className="w-4 h-4" />
        <span>{formatSize(model.sizeMb)}</span>
      </div>

      {/* Progress bar when downloading */}
      {isDownloading && progress && (
        <div className="mb-3">
          <div className="flex justify-between text-xs text-gray-400 mb-1">
            <span>{progress.status === 'verifying' ? 'Verifying...' : 'Downloading...'}</span>
            <span>
              {progress.totalBytes > 0
                ? `${Math.round((progress.downloadedBytes / progress.totalBytes) * 100)}%`
                : '0%'}
            </span>
          </div>
          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-cyan-400"
              initial={{ width: 0 }}
              animate={{
                width: progress.totalBytes > 0
                  ? `${(progress.downloadedBytes / progress.totalBytes) * 100}%`
                  : '0%'
              }}
            />
          </div>
        </div>
      )}

      {/* Show cancel button when downloading, otherwise show download/downloaded button */}
      {isDownloading ? (
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onCancel}
          className={cn(
            'mt-auto w-full py-2 rounded-lg text-sm font-medium',
            'flex items-center justify-center gap-2 transition-colors',
            'bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30'
          )}
        >
          <X className="w-4 h-4" />
          Cancel
        </motion.button>
      ) : (
        <motion.button
          whileHover={{ scale: isDownloaded ? 1 : 1.02 }}
          whileTap={{ scale: isDownloaded ? 1 : 0.98 }}
          onClick={onDownload}
          disabled={isDownloaded}
          className={cn(
            'mt-auto w-full py-2 rounded-lg text-sm font-medium',
            'flex items-center justify-center gap-2 transition-colors',
            getButtonStyle(isDownloaded, false)
          )}
        >
          <ButtonContent isDownloaded={isDownloaded} isDownloading={false} />
        </motion.button>
      )}
    </motion.div>
  );
}

// Download Progress Item
function DownloadItem({ progress, onCancel }: { progress: DownloadProgress; onCancel: () => void }) {
  const percent = progress.totalBytes > 0
    ? (progress.downloadedBytes / progress.totalBytes) * 100
    : 0;
  const speedMBs = progress.speedBps / (1024 * 1024);
  const remainingBytes = progress.totalBytes - progress.downloadedBytes;
  const etaSeconds = progress.speedBps > 0 ? remainingBytes / progress.speedBps : 0;

  return (
    <div className="glass-card p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-white font-medium">{progress.modelName}</h3>
          <p className="text-gray-500 text-sm">
            {progress.status === 'verifying' ? 'Verifying checksum...' : 'Downloading...'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-cyan-400 font-mono text-sm">
            {Math.round(percent)}%
          </span>
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={onCancel}
            className="p-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
            title="Cancel download"
          >
            <X className="w-4 h-4" />
          </motion.button>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="h-2 bg-white/10 rounded-full overflow-hidden mb-3">
        <motion.div
          className={cn(
            'h-full',
            progress.status === 'verifying' ? 'bg-yellow-400' : 'bg-cyan-400'
          )}
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>

      {/* Stats */}
      <div className="flex justify-between text-xs text-gray-400">
        <span>
          {formatBytes(progress.downloadedBytes)} / {formatBytes(progress.totalBytes)}
        </span>
        <span>
          {speedMBs.toFixed(1)} MB/s
          {etaSeconds > 0 && ` - ${formatEta(etaSeconds)}`}
        </span>
      </div>
    </div>
  );
}

// Utility functions
function formatSize(sizeMb: number): string {
  if (sizeMb >= 1024) {
    return `${(sizeMb / 1024).toFixed(1)} GB`;
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
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}
