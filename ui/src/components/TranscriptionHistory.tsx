import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Trash2, Copy, Clock, ChevronDown, ChevronUp, Filter, Loader2, AlertCircle, FileAudio, Check } from 'lucide-react';
import { useAppStore } from '../stores/appStore';
import { cn } from '../lib/utils';

export default function TranscriptionHistory() {
  const {
    historyEntries,
    historyTotal,
    historyLoading,
    historyHasMore,
    historyModels,
    searchQuery,
    modelFilter,
    loadHistory,
    loadMoreHistory,
    deleteHistoryEntry,
    clearHistory,
    setSearchQuery,
    setModelFilter,
  } = useAppStore();

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [localSearch, setLocalSearch] = useState(searchQuery);

  // Load history on mount
  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localSearch !== searchQuery) {
        setSearchQuery(localSearch);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [localSearch, searchQuery, setSearchQuery]);

  const handleCopy = useCallback(async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    await deleteHistoryEntry(id);
    if (expandedId === id) {
      setExpandedId(null);
    }
  }, [deleteHistoryEntry, expandedId]);

  const handleClearAll = useCallback(async () => {
    await clearHistory();
    setShowClearConfirm(false);
    setExpandedId(null);
  }, [clearHistory]);

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return `Today at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else if (diffDays === 1) {
      return `Yesterday at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else if (diffDays < 7) {
      return date.toLocaleDateString([], { weekday: 'long', hour: '2-digit', minute: '2-digit' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
    }
  };

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) {
      return `${seconds}s`;
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  const truncateText = (text: string, maxLength: number = 100) => {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + '...';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Transcription History</h1>
          <p className="text-gray-400">
            {historyTotal === 0 ? 'No transcriptions yet' : `${historyTotal} transcription${historyTotal !== 1 ? 's' : ''}`}
          </p>
        </div>

        {historyTotal > 0 && (
          <div className="relative">
            {showClearConfirm ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center gap-2"
              >
                <span className="text-sm text-gray-400">Clear all?</span>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleClearAll}
                  className="px-3 py-1.5 text-sm bg-red-500/20 border border-red-500 text-red-400 rounded-lg hover:bg-red-500/30"
                >
                  Yes, clear
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowClearConfirm(false)}
                  className="px-3 py-1.5 text-sm bg-white/5 border border-white/20 text-gray-400 rounded-lg hover:bg-white/10"
                >
                  Cancel
                </motion.button>
              </motion.div>
            ) : (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setShowClearConfirm(true)}
                className="glass-button px-4 py-2 text-sm flex items-center gap-2 text-red-400"
              >
                <Trash2 className="w-4 h-4" />
                Clear All
              </motion.button>
            )}
          </div>
        )}
      </div>

      {/* Filters Bar */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-panel p-4"
      >
        <div className="flex flex-wrap gap-4">
          {/* Search Input */}
          <div className="relative flex-1 min-w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Search transcriptions..."
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              className="w-full glass-input pl-10"
            />
          </div>

          {/* Model Filter */}
          {historyModels.length > 0 && (
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <select
                value={modelFilter}
                onChange={(e) => setModelFilter(e.target.value)}
                className="glass-input pl-10 pr-8 appearance-none cursor-pointer min-w-48"
              >
                <option value="">All Models</option>
                {historyModels.map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </motion.div>

      {/* History List */}
      <div className="space-y-3">
        {historyLoading && historyEntries.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="glass-panel p-12 text-center"
          >
            <Loader2 className="w-8 h-8 text-cyan-500 animate-spin mx-auto mb-4" />
            <p className="text-gray-400">Loading history...</p>
          </motion.div>
        ) : historyEntries.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-panel p-12 text-center"
          >
            <AlertCircle className="w-12 h-12 text-gray-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">
              {searchQuery || modelFilter ? 'No matches found' : 'No history yet'}
            </h3>
            <p className="text-gray-400 max-w-md mx-auto">
              {searchQuery || modelFilter
                ? 'Try adjusting your search or filter criteria'
                : 'Start recording to see your transcription history here'}
            </p>
          </motion.div>
        ) : (
          <AnimatePresence mode="popLayout">
            {historyEntries.map((entry, index) => (
              <motion.div
                key={entry.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: index * 0.02 }}
                className="glass-card overflow-hidden"
              >
                {/* Collapsed View */}
                <button
                  onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                  className="w-full p-4 flex items-start justify-between gap-4 text-left hover:bg-white/5 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm leading-relaxed">
                      {expandedId === entry.id ? entry.text : truncateText(entry.text)}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 flex-shrink-0">
                    {/* Duration Badge */}
                    <span className="px-2 py-1 text-xs bg-cyan-500/20 text-cyan-400 rounded-md">
                      {formatDuration(entry.durationMs)}
                    </span>

                    {/* Model Badge */}
                    <span className="px-2 py-1 text-xs bg-purple-500/20 text-purple-400 rounded-md hidden md:inline">
                      {entry.model.replace('whisper-', '').replace('-gguf', '')}
                    </span>

                    {/* Expand Icon */}
                    {expandedId === entry.id ? (
                      <ChevronUp className="w-4 h-4 text-gray-500" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-gray-500" />
                    )}
                  </div>
                </button>

                {/* Expanded Details */}
                <AnimatePresence>
                  {expandedId === entry.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="border-t border-white/10"
                    >
                      <div className="p-4 space-y-4">
                        {/* Metadata Row */}
                        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-400">
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-4 h-4" />
                            {formatTimestamp(entry.timestamp)}
                          </div>
                          {entry.audioPath && (
                            <div className="flex items-center gap-1.5">
                              <FileAudio className="w-4 h-4" />
                              Audio saved
                            </div>
                          )}
                          <span className="px-2 py-0.5 text-xs bg-gray-500/20 text-gray-400 rounded">
                            {entry.model}
                          </span>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2">
                          <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopy(entry.text, entry.id);
                            }}
                            className={cn(
                              'px-3 py-1.5 text-sm rounded-lg flex items-center gap-2 transition-all',
                              copiedId === entry.id
                                ? 'bg-green-500/20 border border-green-500 text-green-400'
                                : 'bg-white/5 border border-white/20 text-gray-300 hover:bg-white/10'
                            )}
                          >
                            {copiedId === entry.id ? (
                              <>
                                <Check className="w-3.5 h-3.5" />
                                Copied!
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                Copy
                              </>
                            )}
                          </motion.button>

                          <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(entry.id);
                            }}
                            className="px-3 py-1.5 text-sm bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg hover:bg-red-500/20 flex items-center gap-2"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Delete
                          </motion.button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </AnimatePresence>
        )}

        {/* Load More Button */}
        {historyHasMore && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center pt-4"
          >
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={loadMoreHistory}
              disabled={historyLoading}
              className="glass-button px-6 py-2 text-sm flex items-center gap-2 mx-auto"
            >
              {historyLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading...
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4" />
                  Load More
                </>
              )}
            </motion.button>
          </motion.div>
        )}
      </div>
    </div>
  );
}
