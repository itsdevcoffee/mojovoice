import { useState, useMemo } from 'react';
import { X as XIcon, Filter as FilterIcon } from 'lucide-react';
import { Button } from './ui/Button';
import { TranscriptionCard } from './ui/TranscriptionCard';
import { Modal, ModalHeader, ModalBody, ModalFooter } from './ui/Modal';
import { useAppStore } from '../stores/appStore';
import { useTranscriptionActions } from '../hooks/useTranscriptionActions';

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function HistoryModal({ isOpen, onClose }: HistoryModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [wordCountFilter, setWordCountFilter] = useState<'all' | 'short' | 'medium' | 'long'>('all');
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);
  const [showClearConfirmation, setShowClearConfirmation] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [clearSuccess, setClearSuccess] = useState(false);

  const { historyEntries, clearHistory } = useAppStore();
  const { handleCopy: handleCopyTranscription, handleDelete: handleDeleteTranscription } = useTranscriptionActions(1000);

  const handleExportAll = async () => {
    try {
      setIsExporting(true);
      setExportSuccess(false);

      const exportData = historyEntries.map((entry) => ({
        text: entry.text,
        timestamp: entry.timestamp,
        word_count: entry.text.split(/\s+/).filter(Boolean).length,
        model_used: entry.model,
      }));

      const jsonString = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];
      const filename = `mojovoice-history-${dateStr}.json`;

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 3000);
    } catch (error) {
      console.error('Failed to export history:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const handleClearHistory = async () => {
    try {
      setIsClearing(true);
      setClearSuccess(false);
      await clearHistory();
      setClearSuccess(true);
      setShowClearConfirmation(false);
      setTimeout(() => setClearSuccess(false), 3000);
    } catch (error) {
      console.error('Failed to clear history:', error);
    } finally {
      setIsClearing(false);
    }
  };

  const filteredHistory = useMemo(() => {
    let filtered = [...historyEntries];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((entry) => entry.text.toLowerCase().includes(query));
    }

    if (dateFilter !== 'all') {
      const now = Date.now();
      const oneDayMs = 24 * 60 * 60 * 1000;
      const oneWeekMs = 7 * oneDayMs;
      const oneMonthMs = 30 * oneDayMs;

      filtered = filtered.filter((entry) => {
        const diff = now - new Date(entry.timestamp).getTime();
        switch (dateFilter) {
          case 'today': return diff < oneDayMs;
          case 'week': return diff < oneWeekMs;
          case 'month': return diff < oneMonthMs;
          default: return true;
        }
      });
    }

    if (wordCountFilter !== 'all') {
      filtered = filtered.filter((entry) => {
        const wordCount = entry.text.split(/\s+/).filter(Boolean).length;
        switch (wordCountFilter) {
          case 'short': return wordCount < 20;
          case 'medium': return wordCount >= 20 && wordCount <= 50;
          case 'long': return wordCount > 50;
          default: return true;
        }
      });
    }

    return filtered;
  }, [historyEntries, searchQuery, dateFilter, wordCountFilter]);

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
        <ModalHeader title="TRANSCRIPTION HISTORY" onClose={onClose} />
        <ModalBody>
          <div className="mb-6 space-y-4">
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <input
                  type="text"
                  placeholder="Search transcriptions..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  data-search-input
                  className="w-full px-4 py-3 pr-10 bg-[var(--bg-surface)] border-2 border-[var(--border-default)] text-[var(--text-primary)] font-mono text-sm rounded focus:border-[var(--accent-primary)] focus:outline-none focus:shadow-[0_0_20px_rgba(59,130,246,0.3)] transition-all duration-150"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[var(--text-tertiary)] hover:text-[var(--accent-primary)] transition-colors duration-150"
                    aria-label="Clear search"
                  >
                    <XIcon className="w-4 h-4" />
                  </button>
                )}
              </div>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`
                  px-4 py-3 flex items-center gap-2 border-2 rounded transition-all duration-150
                  ${showFilters
                    ? 'bg-blue-500/20 border-blue-500 text-blue-400 shadow-[0_0_20px_rgba(59,130,246,0.3)]'
                    : 'bg-[var(--bg-surface)] border-[var(--border-default)] text-[var(--text-secondary)] hover:border-blue-500/50 hover:text-blue-400'
                  }
                  focus:outline-none focus-visible:outline-2 focus-visible:outline-blue-500
                  focus-visible:outline-offset-2 focus-visible:shadow-[0_0_20px_rgba(59,130,246,0.5)]
                `}
                aria-label="Toggle filters"
              >
                <FilterIcon className="w-4 h-4" />
                <span className="text-sm font-ui font-medium">Filters</span>
              </button>
            </div>

            {showFilters && (
              <div className="p-4 bg-[var(--bg-elevated)] border-2 border-[var(--border-default)] rounded space-y-4">
                <div className="space-y-2">
                  <label className="block text-xs font-ui font-medium text-[var(--text-secondary)] uppercase tracking-wide">Date Range</label>
                  <div className="flex gap-2">
                    {(['all', 'today', 'week', 'month'] as const).map((range) => (
                      <button
                        key={range}
                        onClick={() => setDateFilter(range)}
                        className={`
                          px-3 py-1.5 text-xs font-ui font-medium uppercase tracking-wide rounded border-2 transition-all duration-150
                          ${dateFilter === range
                            ? 'bg-blue-500/20 border-blue-500 text-blue-400'
                            : 'bg-transparent border-[var(--border-default)] text-[var(--text-tertiary)] hover:border-blue-500/50 hover:text-blue-400'
                          }
                        `}
                      >
                        {range === 'all' ? 'All Time' : range === 'week' ? 'This Week' : range === 'month' ? 'This Month' : 'Today'}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="block text-xs font-ui font-medium text-[var(--text-secondary)] uppercase tracking-wide">Word Count</label>
                  <div className="flex gap-2">
                    {(['all', 'short', 'medium', 'long'] as const).map((range) => (
                      <button
                        key={range}
                        onClick={() => setWordCountFilter(range)}
                        className={`
                          px-3 py-1.5 text-xs font-ui font-medium uppercase tracking-wide rounded border-2 transition-all duration-150
                          ${wordCountFilter === range
                            ? 'bg-blue-500/20 border-blue-500 text-blue-400'
                            : 'bg-transparent border-[var(--border-default)] text-[var(--text-tertiary)] hover:border-blue-500/50 hover:text-blue-400'
                          }
                        `}
                      >
                        {range === 'all' ? 'All' : range === 'short' ? 'Short (<20)' : range === 'medium' ? 'Medium (20-50)' : 'Long (>50)'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between text-xs font-ui text-[var(--text-tertiary)]">
              <span>Showing {filteredHistory.length} of {historyEntries.length} transcriptions</span>
              {(searchQuery || dateFilter !== 'all' || wordCountFilter !== 'all') && (
                <button
                  onClick={() => { setSearchQuery(''); setDateFilter('all'); setWordCountFilter('all'); }}
                  className="text-blue-400 hover:text-blue-300 transition-colors duration-150"
                >
                  Clear filters
                </button>
              )}
            </div>
          </div>

          <div className="space-y-4">
            {filteredHistory.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-sm text-[var(--text-secondary)] font-ui">
                  {historyEntries.length === 0 ? 'No transcriptions yet' : 'No transcriptions match your filters'}
                </p>
              </div>
            ) : (
              filteredHistory.map((entry) => (
                <TranscriptionCard
                  key={entry.id}
                  transcription={entry}
                  onCopy={handleCopyTranscription}
                  onDelete={handleDeleteTranscription}
                />
              ))
            )}
          </div>
        </ModalBody>

        <ModalFooter>
          <Button
            variant="ghost"
            size="md"
            onClick={handleExportAll}
            loading={isExporting}
            disabled={isExporting || historyEntries.length === 0}
            className={`${exportSuccess ? 'text-green-400' : ''} transition-all duration-150`}
          >
            {exportSuccess ? `Exported ${historyEntries.length} transcriptions` : 'Export All'}
          </Button>

          {!showClearConfirmation ? (
            <Button
              variant="ghost"
              size="md"
              onClick={() => setShowClearConfirmation(true)}
              disabled={isClearing || historyEntries.length === 0}
              className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
            >
              {clearSuccess ? 'History cleared' : 'Clear History'}
            </Button>
          ) : (
            <div className="flex items-center gap-3">
              <span className="text-xs text-[var(--text-tertiary)] font-ui">Delete all transcriptions?</span>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => setShowClearConfirmation(false)} disabled={isClearing} className="text-xs">
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleClearHistory}
                  loading={isClearing}
                  disabled={isClearing}
                  className="text-xs bg-red-500 hover:bg-red-600 border-red-600 hover:border-red-700"
                >
                  Confirm
                </Button>
              </div>
            </div>
          )}
        </ModalFooter>
    </Modal>
  );
}
