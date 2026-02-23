import { useState, useMemo, useEffect } from 'react';
import { X as XIcon, Filter as FilterIcon, Download, Trash2, Search } from 'lucide-react';
import { TranscriptionCard } from './ui/TranscriptionCard';
import { Button } from './ui/Button';
import { useAppStore } from '../stores/appStore';
import { useTranscriptionActions } from '../hooks/useTranscriptionActions';

export function HistoryView() {
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [wordCountFilter, setWordCountFilter] = useState<'all' | 'short' | 'medium' | 'long'>('all');
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);
  const [showClearConfirmation, setShowClearConfirmation] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [clearSuccess, setClearSuccess] = useState(false);

  const { historyEntries, loadHistory, clearHistory } = useAppStore();
  const { handleCopy: handleCopyTranscription, handleDelete: handleDeleteTranscription } = useTranscriptionActions(1000);

  // Load all history on mount
  useEffect(() => {
    loadHistory(1000, 0);
  }, [loadHistory]);

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

  const hasActiveFilters = searchQuery || dateFilter !== 'all' || wordCountFilter !== 'all';

  const clearAllFilters = () => {
    setSearchQuery('');
    setDateFilter('all');
    setWordCountFilter('all');
  };

  return (
    <section className="mt-4">
      {/* Header */}
      <div className="flex items-end justify-between mb-6">
        <div>
          <h2 className="font-mono text-lg font-bold tracking-wider text-[var(--text-primary)] uppercase">
            Transcription History
          </h2>
          <p className="font-mono text-xs text-[var(--text-tertiary)] mt-1 tracking-wide">
            {historyEntries.length} {historyEntries.length === 1 ? 'entry' : 'entries'} total
          </p>
        </div>
      </div>

      {/* Search + Filter Toggle */}
      <div className="mb-4 space-y-3">
        <div className="flex gap-3">
          {/* Search bar */}
          <div className="flex-1 relative">
            <Search
              size={14}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] pointer-events-none"
            />
            <input
              type="text"
              placeholder="Search transcriptions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              data-search-input
              className="
                w-full pl-10 pr-10 py-3
                bg-[var(--bg-surface)]
                border-2 border-[var(--border-default)]
                text-[var(--text-primary)] font-mono text-sm
                focus:border-[var(--accent-primary)] focus:outline-none
                focus:shadow-[0_0_20px_rgba(59,130,246,0.3)]
                transition-all duration-150
                placeholder:text-[var(--text-tertiary)]
              "
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

          {/* Filter toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`
              px-4 py-3 flex items-center gap-2 border-2 transition-all duration-150
              ${showFilters
                ? 'bg-blue-500/20 border-[var(--accent-primary)] text-[var(--accent-primary)] shadow-[0_0_20px_rgba(59,130,246,0.3)]'
                : 'bg-[var(--bg-surface)] border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--accent-primary)]/50 hover:text-[var(--accent-primary)]'
              }
              focus:outline-none focus-visible:outline-2 focus-visible:outline-blue-500
              focus-visible:outline-offset-2 focus-visible:shadow-[0_0_20px_rgba(59,130,246,0.5)]
            `}
            aria-label="Toggle filters"
            aria-expanded={showFilters}
          >
            <FilterIcon className="w-4 h-4" />
            <span className="text-sm font-mono uppercase tracking-wide">Filters</span>
          </button>
        </div>

        {/* Filter panel */}
        {showFilters && (
          <div className="p-4 bg-[var(--bg-surface)] border-2 border-[var(--border-default)] space-y-4">
            {/* Date range */}
            <div className="space-y-2">
              <label
                id="date-filter-label"
                className="block text-[10px] font-mono font-medium text-[var(--text-tertiary)] uppercase tracking-[0.1em]"
              >
                Date Range
              </label>
              <div className="flex gap-2" role="radiogroup" aria-labelledby="date-filter-label">
                {(['all', 'today', 'week', 'month'] as const).map((range) => (
                  <button
                    key={range}
                    onClick={() => setDateFilter(range)}
                    role="radio"
                    aria-checked={dateFilter === range}
                    className={`
                      px-3 py-1.5 text-xs font-mono font-medium uppercase tracking-wide border-2 transition-all duration-150
                      ${dateFilter === range
                        ? 'bg-blue-500/20 border-[var(--accent-primary)] text-[var(--accent-primary)]'
                        : 'bg-transparent border-[var(--border-default)] text-[var(--text-tertiary)] hover:border-[var(--accent-primary)]/50 hover:text-[var(--accent-primary)]'
                      }
                    `}
                  >
                    {range === 'all' ? 'All Time' : range === 'week' ? 'This Week' : range === 'month' ? 'This Month' : 'Today'}
                  </button>
                ))}
              </div>
            </div>

            {/* Word count */}
            <div className="space-y-2">
              <label
                id="wordcount-filter-label"
                className="block text-[10px] font-mono font-medium text-[var(--text-tertiary)] uppercase tracking-[0.1em]"
              >
                Word Count
              </label>
              <div className="flex gap-2" role="radiogroup" aria-labelledby="wordcount-filter-label">
                {(['all', 'short', 'medium', 'long'] as const).map((range) => (
                  <button
                    key={range}
                    onClick={() => setWordCountFilter(range)}
                    role="radio"
                    aria-checked={wordCountFilter === range}
                    className={`
                      px-3 py-1.5 text-xs font-mono font-medium uppercase tracking-wide border-2 transition-all duration-150
                      ${wordCountFilter === range
                        ? 'bg-blue-500/20 border-[var(--accent-primary)] text-[var(--accent-primary)]'
                        : 'bg-transparent border-[var(--border-default)] text-[var(--text-tertiary)] hover:border-[var(--accent-primary)]/50 hover:text-[var(--accent-primary)]'
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

        {/* Result count + clear filters */}
        <div className="flex items-center justify-between text-xs font-mono text-[var(--text-tertiary)]">
          <span className="tracking-wide">
            {hasActiveFilters
              ? `Showing ${filteredHistory.length} of ${historyEntries.length}`
              : `${historyEntries.length} transcriptions`
            }
          </span>
          {hasActiveFilters && (
            <button
              onClick={clearAllFilters}
              className="text-[var(--accent-primary)] hover:text-[var(--text-primary)] transition-colors duration-150 uppercase tracking-wide"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Transcription list */}
      <div className="space-y-4 mb-8">
        {filteredHistory.length === 0 ? (
          <div className="text-center py-16 border-2 border-dashed border-[var(--border-default)]">
            <p className="text-sm text-[var(--text-tertiary)] font-mono">
              {historyEntries.length === 0
                ? 'No transcriptions yet'
                : 'No transcriptions match your filters'
              }
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

      {/* Footer actions */}
      {historyEntries.length > 0 && (
        <div className="border-t-2 border-[var(--border-default)] pt-6 pb-4 flex items-center justify-between">
          {/* Export */}
          <Button
            variant="ghost"
            size="md"
            onClick={handleExportAll}
            loading={isExporting}
            disabled={isExporting || historyEntries.length === 0}
            className={`
              flex items-center gap-2
              ${exportSuccess ? 'text-[var(--success)]' : ''}
              transition-all duration-150
            `}
          >
            <Download size={14} />
            <span>
              {exportSuccess ? `Exported ${historyEntries.length} transcriptions` : 'Export All'}
            </span>
          </Button>

          {/* Clear history */}
          {!showClearConfirmation ? (
            <Button
              variant="ghost"
              size="md"
              onClick={() => setShowClearConfirmation(true)}
              disabled={isClearing || historyEntries.length === 0}
              className="text-[var(--error)] hover:text-red-300 hover:bg-red-500/10 flex items-center gap-2"
            >
              <Trash2 size={14} />
              <span>{clearSuccess ? 'History cleared' : 'Clear History'}</span>
            </Button>
          ) : (
            <div className="flex items-center gap-3">
              <span className="text-xs text-[var(--text-tertiary)] font-mono uppercase tracking-wide">
                Delete all?
              </span>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowClearConfirmation(false)}
                  disabled={isClearing}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleClearHistory}
                  loading={isClearing}
                  disabled={isClearing}
                  className="text-xs bg-[var(--error)] hover:bg-red-600 border-red-900 hover:border-red-700"
                >
                  Confirm
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
