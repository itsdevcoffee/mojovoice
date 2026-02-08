import { useState, useEffect, useMemo, lazy, Suspense } from 'react';
import { Settings as SettingsIcon, ChevronDown, X as XIcon, Filter as FilterIcon } from 'lucide-react';
import { Button } from './ui/Button';
import { StatusBar } from './ui/StatusBar';
import SectionHeader from './ui/SectionHeader';
import { TranscriptionCard } from './ui/TranscriptionCard';
import { SystemStatus } from './ui/SystemStatus';
import { invoke } from '../lib/ipc';
import { useAppStore } from '../stores/appStore';

// Lazy load heavy components (only loaded when needed)
const Drawer = lazy(() => import('./ui/Drawer').then(m => ({ default: m.Drawer })));
const Modal = lazy(() => import('./ui/Modal').then(m => ({ default: m.Modal })));
const ModalHeader = lazy(() => import('./ui/Modal').then(m => ({ default: m.ModalHeader })));
const ModalBody = lazy(() => import('./ui/Modal').then(m => ({ default: m.ModalBody })));
const ModalFooter = lazy(() => import('./ui/Modal').then(m => ({ default: m.ModalFooter })));

export default function MissionControl() {
  const [isRecording, setIsRecording] = useState(false);
  const [transcription, setTranscription] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [wordCountFilter, setWordCountFilter] = useState<'all' | 'short' | 'medium' | 'long'>('all');

  // Export and clear state
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);
  const [showClearConfirmation, setShowClearConfirmation] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [clearSuccess, setClearSuccess] = useState(false);

  // Get history data from store
  const { historyEntries, loadHistory, deleteHistoryEntry, clearHistory } = useAppStore();

  // Load recent transcriptions on mount
  useEffect(() => {
    loadHistory(5, 0); // Load last 5 entries
  }, [loadHistory]);

  // Load all history when modal opens
  useEffect(() => {
    if (isHistoryModalOpen) {
      loadHistory(1000, 0); // Load up to 1000 entries for modal
    }
  }, [isHistoryModalOpen, loadHistory]);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Check if user is typing in an input field (don't intercept)
      const target = event.target as HTMLElement;
      const isInputField =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable;

      // Escape: always works (close modals/drawers)
      if (event.key === 'Escape') {
        if (isHistoryModalOpen) {
          setIsHistoryModalOpen(false);
          return;
        }
        if (isSettingsOpen) {
          setIsSettingsOpen(false);
          return;
        }
      }

      // Don't handle other shortcuts if typing in input field
      if (isInputField && event.key !== 'Escape') {
        return;
      }

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modifierKey = isMac ? event.metaKey : event.ctrlKey;

      // Space: test recording (when main screen focused)
      if (event.key === ' ' && !isInputField && !isHistoryModalOpen && !isSettingsOpen) {
        event.preventDefault();
        if (!isRecording) {
          handleTestRecording();
        }
        return;
      }

      // Cmd+, or Ctrl+,: open settings
      if (modifierKey && event.key === ',') {
        event.preventDefault();
        setIsSettingsOpen(true);
        return;
      }

      // Cmd+H or Ctrl+H: open history modal
      if (modifierKey && event.key === 'h') {
        event.preventDefault();
        setIsHistoryModalOpen(true);
        return;
      }

      // Cmd+K or Ctrl+K: open history modal with search focused
      if (modifierKey && event.key === 'k') {
        event.preventDefault();
        setIsHistoryModalOpen(true);
        // Focus search input after a brief delay (modal needs to render first)
        setTimeout(() => {
          const searchInput = document.querySelector<HTMLInputElement>('[data-search-input]');
          if (searchInput) {
            searchInput.focus();
          }
        }, 100);
        return;
      }

      // Cmd+C or Ctrl+C: copy last transcription (only if not in input field)
      if (modifierKey && event.key === 'c' && !isInputField) {
        event.preventDefault();
        if (historyEntries.length > 0) {
          const lastEntry = historyEntries[0];
          handleCopyTranscription(lastEntry.text);
          // Brief visual feedback (we'll add this later)
          console.log('Copied last transcription to clipboard');
        }
        return;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isHistoryModalOpen, isSettingsOpen, isRecording, historyEntries]);

  const handleTestRecording = async () => {
    try {
      setError('');
      setTranscription('');
      setIsRecording(true);

      // Start recording
      await invoke('start_recording');

      // Wait 5 seconds
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Stop recording and get transcription
      const result = await invoke<string>('stop_recording');
      setTranscription(result);

      // Reload history to show new transcription
      loadHistory(5, 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsRecording(false);
    }
  };

  const handleCopyTranscription = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  const handleDeleteTranscription = async (id: string) => {
    await deleteHistoryEntry(id);
  };

  const handleExportAll = async () => {
    try {
      setIsExporting(true);
      setExportSuccess(false);

      // Format entries for export
      const exportData = historyEntries.map((entry) => ({
        text: entry.text,
        timestamp: entry.timestamp,
        word_count: entry.text.split(/\s+/).filter(Boolean).length,
        model_used: entry.model,
      }));

      // Create JSON blob
      const jsonString = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });

      // Generate filename with current date
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD format
      const filename = `mojovoice-history-${dateStr}.json`;

      // Create download link and trigger download
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      // Show success state
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

      // Call backend to clear all history
      await clearHistory();

      // Show success state
      setClearSuccess(true);
      setShowClearConfirmation(false);

      // Clear success message after 3 seconds
      setTimeout(() => setClearSuccess(false), 3000);
    } catch (error) {
      console.error('Failed to clear history:', error);
    } finally {
      setIsClearing(false);
    }
  };

  // Filtered history entries based on search and filters
  const filteredHistory = useMemo(() => {
    let filtered = [...historyEntries];

    // Apply search filter (debounced via useMemo dependencies)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((entry) =>
        entry.text.toLowerCase().includes(query)
      );
    }

    // Apply date filter
    if (dateFilter !== 'all') {
      const now = Date.now();
      const oneDayMs = 24 * 60 * 60 * 1000;
      const oneWeekMs = 7 * oneDayMs;
      const oneMonthMs = 30 * oneDayMs;

      filtered = filtered.filter((entry) => {
        const entryTime = new Date(entry.timestamp).getTime();
        const diff = now - entryTime;

        switch (dateFilter) {
          case 'today':
            return diff < oneDayMs;
          case 'week':
            return diff < oneWeekMs;
          case 'month':
            return diff < oneMonthMs;
          default:
            return true;
        }
      });
    }

    // Apply word count filter
    if (wordCountFilter !== 'all') {
      filtered = filtered.filter((entry) => {
        const wordCount = entry.text.split(/\s+/).filter(Boolean).length;

        switch (wordCountFilter) {
          case 'short':
            return wordCount < 20;
          case 'medium':
            return wordCount >= 20 && wordCount <= 50;
          case 'long':
            return wordCount > 50;
          default:
            return true;
        }
      });
    }

    return filtered;
  }, [historyEntries, searchQuery, dateFilter, wordCountFilter]);

  return (
    <div className="min-h-screen bg-[var(--bg-void)] text-[var(--text-primary)]">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-8 max-w-[800px] mx-auto">
        <h1 className="font-mono text-2xl font-bold tracking-wider text-[var(--text-primary)]">
          MOJOVOICE
        </h1>
        <button
          className="p-3 text-[var(--text-secondary)] hover:text-[var(--accent-primary)] transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-blue-500 focus-visible:outline-offset-2 focus-visible:shadow-[0_0_20px_rgba(59,130,246,0.5)]"
          aria-label="Settings"
          title={`Settings (${navigator.platform.toUpperCase().indexOf('MAC') >= 0 ? 'Cmd' : 'Ctrl'}+,)`}
          onClick={() => setIsSettingsOpen(true)}
        >
          <SettingsIcon className="w-6 h-6" />
        </button>
      </header>

      {/* Main content area */}
      <main id="main-content" className="max-w-[800px] mx-auto px-6 pb-12">
        {/* Giant test recording button */}
        <div className="flex flex-col items-center justify-center mt-16 mb-12">
          <Button
            variant="primary"
            size="lg"
            loading={isRecording}
            onClick={handleTestRecording}
            disabled={isRecording}
            className="w-[280px] h-[120px] text-xl"
          >
            {isRecording ? 'RECORDING...' : '⏺ TEST MIC'}
          </Button>

          {/* Keyboard shortcut hint */}
          <p className="mt-3 text-xs text-[var(--text-tertiary)] font-ui">
            Press <kbd className="px-2 py-1 bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded font-mono text-[var(--text-secondary)]">Space</kbd> to start recording
          </p>

          {/* Transcription result */}
          {transcription && (
            <div className="mt-8 w-full max-w-[600px]" role="status" aria-live="polite" aria-atomic="true">
              <div className="p-6 bg-[var(--bg-surface)] border-2 border-[var(--border-default)] rounded">
                <p className="text-sm text-[var(--text-tertiary)] font-ui mb-2">
                  Transcription:
                </p>
                <p className="text-base text-[var(--text-primary)] font-ui leading-relaxed">
                  {transcription}
                </p>
              </div>
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="mt-8 w-full max-w-[600px]" role="alert" aria-live="assertive">
              <div className="p-6 bg-red-500/10 border-2 border-red-500/50 rounded">
                <p className="text-sm text-red-400 font-ui mb-2">
                  Error:
                </p>
                <p className="text-base text-red-300 font-ui leading-relaxed">
                  {error}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Status bar */}
        <StatusBar className="mt-12" />

        {/* Recent Transcriptions Section */}
        <section className="mt-12">
          <SectionHeader title="RECENT TRANSCRIPTIONS" />

          {historyEntries.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-sm text-[var(--text-tertiary)] font-ui">
                No transcriptions yet
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {historyEntries.slice(0, 5).map((entry) => (
                <TranscriptionCard
                  key={entry.id}
                  transcription={entry}
                  onCopy={handleCopyTranscription}
                  onDelete={handleDeleteTranscription}
                />
              ))}

              {/* View All button */}
              <div className="flex justify-center mt-6">
                <button
                  className="px-4 py-2 text-sm font-ui text-[var(--accent-primary)] hover:text-[var(--accent-glow)] transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-blue-500 focus-visible:outline-offset-2 focus-visible:shadow-[0_0_20px_rgba(59,130,246,0.5)]"
                  title={`View All History (${navigator.platform.toUpperCase().indexOf('MAC') >= 0 ? 'Cmd' : 'Ctrl'}+H)`}
                  aria-label="View all transcription history"
                  onClick={() => setIsHistoryModalOpen(true)}
                >
                  View All →
                </button>
              </div>
            </div>
          )}
        </section>

        {/* System Status Section */}
        <SystemStatus />
      </main>

      {/* Footer */}
      <footer className="max-w-[800px] mx-auto px-6 py-6 text-center">
        <p className="text-xs text-[var(--text-tertiary)] font-ui">
          Press hotkey to start recording
        </p>
      </footer>

      {/* Settings Drawer - Lazy loaded */}
      {isSettingsOpen && (
        <Suspense fallback={null}>
          <Drawer isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)}>
            <SettingsContent />
          </Drawer>
        </Suspense>
      )}

      {/* History Modal - Lazy loaded */}
      {isHistoryModalOpen && (
        <Suspense fallback={null}>
          <Modal isOpen={isHistoryModalOpen} onClose={() => setIsHistoryModalOpen(false)}>
        <ModalHeader
          title="TRANSCRIPTION HISTORY"
          onClose={() => setIsHistoryModalOpen(false)}
        />
        <ModalBody>
          {/* Search and Filter Controls */}
          <div className="mb-6 space-y-4">
            {/* Search input with clear button */}
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
                {/* Clear search button (X) */}
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

              {/* Filter button */}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`
                  px-4 py-3 flex items-center gap-2
                  border-2 rounded transition-all duration-150
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

            {/* Filter options (collapsible) */}
            {showFilters && (
              <div className="p-4 bg-[var(--bg-elevated)] border-2 border-[var(--border-default)] rounded space-y-4">
                {/* Date range filter */}
                <div className="space-y-2">
                  <label className="block text-xs font-ui font-medium text-[var(--text-secondary)] uppercase tracking-wide">
                    Date Range
                  </label>
                  <div className="flex gap-2">
                    {(['all', 'today', 'week', 'month'] as const).map((range) => (
                      <button
                        key={range}
                        onClick={() => setDateFilter(range)}
                        className={`
                          px-3 py-1.5 text-xs font-ui font-medium uppercase tracking-wide rounded
                          border-2 transition-all duration-150
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

                {/* Word count filter */}
                <div className="space-y-2">
                  <label className="block text-xs font-ui font-medium text-[var(--text-secondary)] uppercase tracking-wide">
                    Word Count
                  </label>
                  <div className="flex gap-2">
                    {(['all', 'short', 'medium', 'long'] as const).map((range) => (
                      <button
                        key={range}
                        onClick={() => setWordCountFilter(range)}
                        className={`
                          px-3 py-1.5 text-xs font-ui font-medium uppercase tracking-wide rounded
                          border-2 transition-all duration-150
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

            {/* Results count */}
            <div className="flex items-center justify-between text-xs font-ui text-[var(--text-tertiary)]">
              <span>
                Showing {filteredHistory.length} of {historyEntries.length} transcriptions
              </span>
              {(searchQuery || dateFilter !== 'all' || wordCountFilter !== 'all') && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setDateFilter('all');
                    setWordCountFilter('all');
                  }}
                  className="text-blue-400 hover:text-blue-300 transition-colors duration-150"
                >
                  Clear filters
                </button>
              )}
            </div>
          </div>

          {/* Scrollable history cards */}
          <div className="space-y-4">
            {filteredHistory.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-sm text-[var(--text-secondary)] font-ui">
                  {historyEntries.length === 0
                    ? 'No transcriptions yet'
                    : 'No transcriptions match your filters'}
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

        {/* Modal Footer with Export and Clear Actions */}
        <ModalFooter>
          {/* Export All button (left side) */}
          <Button
            variant="ghost"
            size="md"
            onClick={handleExportAll}
            loading={isExporting}
            disabled={isExporting || historyEntries.length === 0}
            className={`
              ${exportSuccess ? 'text-green-400' : ''}
              transition-all duration-150
            `}
          >
            {exportSuccess ? `Exported ${historyEntries.length} transcriptions` : 'Export All'}
          </Button>

          {/* Clear History button (right side) */}
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
              <span className="text-xs text-[var(--text-tertiary)] font-ui">
                Delete all transcriptions?
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
                  className="text-xs bg-red-500 hover:bg-red-600 border-red-600 hover:border-red-700"
                >
                  Confirm
                </Button>
              </div>
            </div>
          )}
        </ModalFooter>
      </Modal>
        </Suspense>
      )}
    </div>
  );
}

// Language options
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

interface Config {
  model: {
    path: string;
    model_id: string;
    language: string;
    prompt_biasing: string | null;
  };
  audio: {
    sample_rate: number;
    timeout_secs: number;
    save_audio_clips: boolean;
    audio_clips_path: string;
    device_name: string | null;
  };
  output: {
    display_server: string | null;
    append_space: boolean;
    refresh_command: string | null;
  };
}

interface DownloadedModel {
  name: string;
  filename: string;
  path: string;
  sizeMb: number;
  isActive: boolean;
}

interface AudioDevice {
  name: string;
  is_default: boolean;
  internal_name: string | null;
}

function SettingsContent() {
  const [config, setConfig] = useState<Config | null>(null);
  const [originalConfig, setOriginalConfig] = useState<Config | null>(null);
  const [downloadedModels, setDownloadedModels] = useState<DownloadedModel[]>([]);
  const [audioDevices, setAudioDevices] = useState<AudioDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [advancedExpanded, setAdvancedExpanded] = useState(() => {
    // Load collapsed state from localStorage (default: false/collapsed)
    const saved = localStorage.getItem('advancedSettings.collapsed');
    return saved === 'false'; // If saved is 'false', return true (expanded)
  });

  useEffect(() => {
    const loadSettings = async () => {
      try {
        setLoading(true);
        // Load config
        const cfg = await invoke<Config>('get_config');
        setConfig(cfg);
        setOriginalConfig(JSON.parse(JSON.stringify(cfg))); // Deep copy for reset

        // Load downloaded models
        const models = await invoke<DownloadedModel[]>('list_downloaded_models');
        setDownloadedModels(models);

        // Load audio devices
        const devices = await invoke<AudioDevice[]>('list_audio_devices');
        setAudioDevices(devices);
      } catch (error) {
        console.error('Failed to load settings:', error);
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, []);

  const handleModelChange = async (path: string) => {
    if (!config) return;

    try {
      // Extract filename from path for switch_model
      const pathParts = path.split('/');
      const filename = pathParts[pathParts.length - 1];

      // Switch model (this updates path, model_id, saves, and restarts daemon)
      await invoke('switch_model', { filename });

      // Reload config to get the updated model_id
      const updatedConfig = await invoke<Config>('get_config');
      setConfig(updatedConfig);

      // Reload models to update active status
      const models = await invoke<DownloadedModel[]>('list_downloaded_models');
      setDownloadedModels(models);
    } catch (error) {
      console.error('Failed to switch model:', error);
    }
  };

  const handleLanguageChange = async (language: string) => {
    if (!config) return;

    try {
      // Update config with new language
      const updatedConfig = {
        ...config,
        model: {
          ...config.model,
          language,
        },
      };

      await invoke('save_config', { config: updatedConfig });
      setConfig(updatedConfig);
    } catch (error) {
      console.error('Failed to update language:', error);
    }
  };

  const handleTimeoutChange = async (timeoutSecs: number) => {
    if (!config) return;

    try {
      // Update config with new timeout
      const updatedConfig = {
        ...config,
        audio: {
          ...config.audio,
          timeout_secs: timeoutSecs,
        },
      };

      await invoke('save_config', { config: updatedConfig });
      setConfig(updatedConfig);
    } catch (error) {
      console.error('Failed to update timeout:', error);
    }
  };

  const handleAudioDeviceChange = async (deviceName: string) => {
    if (!config) return;

    try {
      // Update config with new audio device (empty string = null/default)
      const updatedConfig = {
        ...config,
        audio: {
          ...config.audio,
          device_name: deviceName === '' ? null : deviceName,
        },
      };

      await invoke('save_config', { config: updatedConfig });
      setConfig(updatedConfig);
    } catch (error) {
      console.error('Failed to update audio device:', error);
    }
  };

  const handleAppendSpaceToggle = async () => {
    if (!config) return;

    try {
      // Toggle append_space
      const updatedConfig = {
        ...config,
        output: {
          ...config.output,
          append_space: !config.output.append_space,
        },
      };

      await invoke('save_config', { config: updatedConfig });
      setConfig(updatedConfig);
    } catch (error) {
      console.error('Failed to toggle append_space:', error);
    }
  };

  const handleModelPathOverrideChange = async (path: string) => {
    if (!config) return;

    try {
      const updatedConfig = {
        ...config,
        model: {
          ...config.model,
          path: path.trim() || config.model.path, // Don't allow empty path
        },
      };

      await invoke('save_config', { config: updatedConfig });
      setConfig(updatedConfig);
    } catch (error) {
      console.error('Failed to update model path:', error);
    }
  };

  const handleTechnicalVocabularyChange = async (vocabulary: string) => {
    if (!config) return;

    try {
      const updatedConfig = {
        ...config,
        model: {
          ...config.model,
          prompt_biasing: vocabulary.trim() || null,
        },
      };

      await invoke('save_config', { config: updatedConfig });
      setConfig(updatedConfig);
    } catch (error) {
      console.error('Failed to update technical vocabulary:', error);
    }
  };

  const handleRefreshCommandChange = async (command: string) => {
    if (!config) return;

    try {
      const updatedConfig = {
        ...config,
        output: {
          ...config.output,
          refresh_command: command.trim() || null,
        },
      };

      await invoke('save_config', { config: updatedConfig });
      setConfig(updatedConfig);
    } catch (error) {
      console.error('Failed to update refresh command:', error);
    }
  };

  const handleSaveAudioClipsToggle = async () => {
    if (!config) return;

    try {
      const updatedConfig = {
        ...config,
        audio: {
          ...config.audio,
          save_audio_clips: !config.audio.save_audio_clips,
        },
      };

      await invoke('save_config', { config: updatedConfig });
      setConfig(updatedConfig);
    } catch (error) {
      console.error('Failed to toggle save audio clips:', error);
    }
  };

  const handleAudioClipsPathChange = async (path: string) => {
    if (!config) return;

    try {
      const updatedConfig = {
        ...config,
        audio: {
          ...config.audio,
          audio_clips_path: path.trim() || config.audio.audio_clips_path,
        },
      };

      await invoke('save_config', { config: updatedConfig });
      setConfig(updatedConfig);
    } catch (error) {
      console.error('Failed to update audio clips path:', error);
    }
  };

  const toggleAdvancedSection = () => {
    const newState = !advancedExpanded;
    setAdvancedExpanded(newState);
    // Save collapsed state to localStorage
    localStorage.setItem('advancedSettings.collapsed', String(!newState));
  };

  const handleSaveChanges = async () => {
    if (!config) return;

    try {
      setSaving(true);
      setSaveSuccess(false);

      // Save config (already saved by individual handlers, but ensure it's persisted)
      await invoke('save_config', { config });

      // Check if daemon settings changed (model, language, audio device)
      const needsRestart = originalConfig && (
        config.model.path !== originalConfig.model.path ||
        config.model.language !== originalConfig.model.language ||
        config.audio.device_name !== originalConfig.audio.device_name
      );

      // Show success state
      setSaveSuccess(true);

      // Update original config to new saved state
      setOriginalConfig(JSON.parse(JSON.stringify(config)));

      // Clear success state after 3 seconds
      setTimeout(() => {
        setSaveSuccess(false);
      }, 3000);

      // If daemon settings changed, show banner (future implementation)
      if (needsRestart) {
        console.log('Daemon settings changed - restart recommended');
        // TODO: Show restart banner in future iteration
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (!originalConfig) return;

    // Reset config to original values
    setConfig(JSON.parse(JSON.stringify(originalConfig)));
  };

  // Helper function to format duration preview
  const formatDurationPreview = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    if (minutes === 0) {
      return `${seconds} seconds`;
    } else if (remainingSeconds === 0) {
      return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`;
    } else {
      return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ${remainingSeconds} ${remainingSeconds === 1 ? 'second' : 'seconds'}`;
    }
  };

  if (loading || !config) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-[var(--text-secondary)] font-ui">Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Voice Recognition Section */}
      <section>
        <SectionHeader title="VOICE RECOGNITION" />

        <div className="space-y-6 mt-6">
          {/* Model Dropdown */}
          <div className="space-y-2">
            <label className="block text-sm font-ui font-medium text-[var(--text-primary)]">
              Model
            </label>
            <select
              value={config.model.path}
              onChange={(e) => handleModelChange(e.target.value)}
              className="w-full px-4 py-3 bg-[var(--bg-surface)] border-2 border-[var(--border-default)] text-[var(--text-primary)] font-mono text-sm rounded focus:border-[var(--accent-primary)] focus:outline-none focus:shadow-[0_0_20px_rgba(59,130,246,0.3)] transition-all duration-150"
            >
              {downloadedModels.length === 0 ? (
                <option value="" disabled>No models downloaded</option>
              ) : (
                downloadedModels.map((model) => (
                  <option key={model.path} value={model.path}>
                    {model.name} ({model.sizeMb} MB){model.isActive ? ' ✓' : ''}
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Language Dropdown */}
          <div className="space-y-2">
            <label className="block text-sm font-ui font-medium text-[var(--text-primary)]">
              Language
            </label>
            <select
              value={config.model.language}
              onChange={(e) => handleLanguageChange(e.target.value)}
              className="w-full px-4 py-3 bg-[var(--bg-surface)] border-2 border-[var(--border-default)] text-[var(--text-primary)] font-mono text-sm rounded focus:border-[var(--accent-primary)] focus:outline-none focus:shadow-[0_0_20px_rgba(59,130,246,0.3)] transition-all duration-150"
            >
              {LANGUAGE_OPTIONS.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* Recording Section */}
      <section className="pt-8 border-t border-[var(--border-default)]">
        <SectionHeader title="RECORDING" />

        <div className="space-y-6 mt-6">
          {/* Max Duration Slider */}
          <div className="space-y-3">
            <label className="block text-sm font-ui font-medium text-[var(--text-primary)]">
              Max Duration
            </label>

            {/* Slider and number input container */}
            <div className="flex items-center gap-4">
              {/* Visual slider */}
              <input
                type="range"
                min="10"
                max="300"
                value={config.audio.timeout_secs}
                onChange={(e) => handleTimeoutChange(parseInt(e.target.value))}
                className="flex-1 h-2 bg-gradient-to-r from-blue-500/30 to-slate-700/50 rounded-sm appearance-none cursor-pointer
                  [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:h-6
                  [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-500
                  [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-[var(--bg-void)]
                  [&::-webkit-slider-thumb]:shadow-[0_0_12px_rgba(59,130,246,0.6)]
                  [&::-webkit-slider-thumb]:cursor-grab [&::-webkit-slider-thumb]:transition-all
                  [&::-webkit-slider-thumb]:duration-150
                  [&::-webkit-slider-thumb]:hover:bg-blue-400 [&::-webkit-slider-thumb]:hover:shadow-[0_0_20px_rgba(59,130,246,0.8)]
                  [&::-webkit-slider-thumb]:hover:scale-110
                  [&::-webkit-slider-thumb]:active:cursor-grabbing
                  [&::-moz-range-thumb]:w-6 [&::-moz-range-thumb]:h-6 [&::-moz-range-thumb]:rounded-full
                  [&::-moz-range-thumb]:bg-blue-500 [&::-moz-range-thumb]:border-2
                  [&::-moz-range-thumb]:border-[var(--bg-void)] [&::-moz-range-thumb]:cursor-grab
                  [&::-moz-range-thumb]:transition-all [&::-moz-range-thumb]:duration-150
                  focus:outline-none"
                style={{
                  background: `linear-gradient(to right,
                    rgba(59, 130, 246, 0.3) 0%,
                    rgba(59, 130, 246, 0.3) ${((config.audio.timeout_secs - 10) / (300 - 10)) * 100}%,
                    rgba(51, 65, 85, 0.5) ${((config.audio.timeout_secs - 10) / (300 - 10)) * 100}%,
                    rgba(51, 65, 85, 0.5) 100%)`
                }}
              />

              {/* Number input */}
              <input
                type="number"
                min="10"
                max="300"
                value={config.audio.timeout_secs}
                onChange={(e) => {
                  const value = parseInt(e.target.value);
                  if (!isNaN(value) && value >= 10 && value <= 300) {
                    handleTimeoutChange(value);
                  }
                }}
                className="w-20 px-3 py-2 bg-[var(--bg-surface)] border-2 border-[var(--border-default)]
                  text-[var(--text-primary)] font-mono text-sm text-center rounded
                  focus:border-[var(--accent-primary)] focus:outline-none
                  focus:shadow-[0_0_20px_rgba(59,130,246,0.3)] transition-all duration-150"
              />

              {/* Unit label */}
              <span className="text-sm font-mono text-[var(--text-secondary)] min-w-[60px]">
                seconds
              </span>
            </div>

            {/* Preview text */}
            <p className="text-xs text-[var(--text-tertiary)] font-ui flex items-center gap-2">
              <span>⏱️</span>
              <span>Approximately {formatDurationPreview(config.audio.timeout_secs)}</span>
            </p>
          </div>

          {/* Audio Device Dropdown */}
          <div className="space-y-2">
            <label className="block text-sm font-ui font-medium text-[var(--text-primary)]">
              Audio Device
            </label>
            <select
              value={config.audio.device_name || ''}
              onChange={(e) => handleAudioDeviceChange(e.target.value)}
              className="w-full px-4 py-3 bg-[var(--bg-surface)] border-2 border-[var(--border-default)] text-[var(--text-primary)] font-mono text-sm rounded focus:border-[var(--accent-primary)] focus:outline-none focus:shadow-[0_0_20px_rgba(59,130,246,0.3)] transition-all duration-150"
            >
              <option value="">System Default</option>
              {audioDevices.map((device) => (
                <option
                  key={device.internal_name || device.name}
                  value={device.internal_name || device.name}
                >
                  {device.name}{device.is_default ? ' (Default)' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* Behavior Section */}
      <section className="pt-8 border-t border-[var(--border-default)]">
        <SectionHeader title="BEHAVIOR" />

        <div className="space-y-6 mt-6">
          {/* Add trailing space toggle */}
          <div className="flex items-center justify-between">
            {/* Label */}
            <div className="flex-1">
              <label className="block text-sm font-ui font-medium text-[var(--text-primary)] cursor-pointer">
                Add trailing space
              </label>
              <p className="text-xs text-[var(--text-tertiary)] font-ui mt-1">
                Automatically add a space after transcribed text
              </p>
            </div>

            {/* Toggle switch */}
            <button
              onClick={handleAppendSpaceToggle}
              className={`
                relative w-14 h-7 rounded-full transition-all duration-200
                ${config.output.append_space
                  ? 'bg-blue-500/20 border-2 border-blue-500/50 shadow-[0_0_16px_rgba(59,130,246,0.2)]'
                  : 'bg-slate-700/50 border-2 border-slate-600/80'
                }
                hover:${config.output.append_space ? 'bg-blue-500/30' : 'bg-slate-700/70'}
                focus:outline-none focus-visible:outline-2 focus-visible:outline-blue-500
                focus-visible:outline-offset-2 focus-visible:shadow-[0_0_20px_rgba(59,130,246,0.5)]
              `}
              aria-label="Toggle add trailing space"
              aria-checked={config.output.append_space}
              role="switch"
            >
              {/* Thumb with liquid morph animation */}
              <div
                className={`
                  absolute top-0.5 left-0.5 w-5 h-5 rounded-full
                  transition-all duration-200
                  ${config.output.append_space
                    ? 'translate-x-7 bg-white shadow-[0_2px_8px_rgba(59,130,246,0.4)]'
                    : 'translate-x-0 bg-slate-300'
                  }
                `}
                style={{
                  transitionTimingFunction: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)'
                }}
              />
            </button>
          </div>
        </div>
      </section>

      {/* Advanced Section */}
      <section className="pt-8 border-t border-[var(--border-default)]">
        {/* Collapsible header */}
        <button
          onClick={toggleAdvancedSection}
          className="w-full flex items-center justify-between group focus:outline-none focus-visible:outline-2 focus-visible:outline-blue-500 focus-visible:outline-offset-2"
          aria-expanded={advancedExpanded}
          aria-controls="advanced-settings-content"
          aria-label={`Advanced settings section, ${advancedExpanded ? 'expanded' : 'collapsed'}. Click to ${advancedExpanded ? 'collapse' : 'expand'}.`}
        >
          <div className="flex items-center gap-3">
            <SectionHeader title="ADVANCED" />
          </div>
          <ChevronDown
            className={`w-4 h-4 text-[var(--text-tertiary)] transition-transform duration-200 ${
              advancedExpanded ? 'rotate-180' : ''
            }`}
            aria-hidden="true"
          />
        </button>

        {/* Collapsible content with smooth animation */}
        {advancedExpanded && (
          <div
            id="advanced-settings-content"
            className="mt-6 space-y-6 animate-expand"
            style={{
              animation: 'expand-smooth 200ms ease-out'
            }}
          >
            {/* Model Path Override */}
            <div className="space-y-2">
              <label className="block text-sm font-ui font-medium text-[var(--text-primary)]">
                Model Path Override
              </label>
              <p className="text-xs text-[var(--text-tertiary)] font-ui mb-2">
                Custom path to Whisper model file (advanced users only)
              </p>
              <div className="relative">
                {/* Terminal prompt */}
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-500 font-mono text-sm pointer-events-none">
                  &gt;
                </span>
                <input
                  type="text"
                  value={config.model.path}
                  onChange={(e) => handleModelPathOverrideChange(e.target.value)}
                  placeholder="~/.cache/whisper/models/..."
                  className="w-full pl-8 pr-4 py-3 bg-[var(--bg-surface)] border-2 border-[var(--border-default)]
                    text-[var(--text-primary)] font-mono text-sm rounded
                    placeholder:text-[var(--text-tertiary)]
                    focus:border-[var(--accent-primary)] focus:outline-none
                    focus:shadow-[0_0_20px_rgba(59,130,246,0.3)] transition-all duration-150"
                />
              </div>
            </div>

            {/* Technical Vocabulary */}
            <div className="space-y-2">
              <label className="block text-sm font-ui font-medium text-[var(--text-primary)]">
                Technical Vocabulary
              </label>
              <p className="text-xs text-[var(--text-tertiary)] font-ui mb-2">
                Custom words for prompt biasing (comma-separated)
              </p>
              <textarea
                value={config.model.prompt_biasing || ''}
                onChange={(e) => handleTechnicalVocabularyChange(e.target.value)}
                placeholder="Kubernetes, PostgreSQL, TypeScript..."
                rows={3}
                className="w-full px-4 py-3 bg-[var(--bg-surface)] border-2 border-[var(--border-default)]
                  text-[var(--text-primary)] font-mono text-sm rounded
                  placeholder:text-[var(--text-tertiary)] resize-none
                  focus:border-[var(--accent-primary)] focus:outline-none
                  focus:shadow-[0_0_20px_rgba(59,130,246,0.3)] transition-all duration-150"
              />
            </div>

            {/* Status Bar Integration */}
            <div className="space-y-2">
              <label className="block text-sm font-ui font-medium text-[var(--text-primary)]">
                Status Bar Integration
              </label>
              <p className="text-xs text-[var(--text-tertiary)] font-ui mb-2">
                Shell command to refresh status bar after transcription
              </p>
              <div className="relative">
                {/* Terminal prompt */}
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-500 font-mono text-sm pointer-events-none">
                  $
                </span>
                <input
                  type="text"
                  value={config.output.refresh_command || ''}
                  onChange={(e) => handleRefreshCommandChange(e.target.value)}
                  placeholder="killall -SIGUSR1 waybar"
                  className="w-full pl-8 pr-4 py-3 bg-[var(--bg-surface)] border-2 border-[var(--border-default)]
                    text-[var(--text-primary)] font-mono text-sm rounded
                    placeholder:text-[var(--text-tertiary)]
                    focus:border-[var(--accent-primary)] focus:outline-none
                    focus:shadow-[0_0_20px_rgba(59,130,246,0.3)] transition-all duration-150"
                />
              </div>
            </div>

            {/* Save Audio Clips */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                {/* Label */}
                <div className="flex-1">
                  <label className="block text-sm font-ui font-medium text-[var(--text-primary)] cursor-pointer">
                    Save Audio Clips
                  </label>
                  <p className="text-xs text-[var(--text-tertiary)] font-ui mt-1">
                    Save recorded audio to disk for debugging
                  </p>
                </div>

                {/* Toggle switch */}
                <button
                  onClick={handleSaveAudioClipsToggle}
                  className={`
                    relative w-14 h-7 rounded-full transition-all duration-200
                    ${config.audio.save_audio_clips
                      ? 'bg-blue-500/20 border-2 border-blue-500/50 shadow-[0_0_16px_rgba(59,130,246,0.2)]'
                      : 'bg-slate-700/50 border-2 border-slate-600/80'
                    }
                    hover:${config.audio.save_audio_clips ? 'bg-blue-500/30' : 'bg-slate-700/70'}
                    focus:outline-none focus-visible:outline-2 focus-visible:outline-blue-500
                    focus-visible:outline-offset-2 focus-visible:shadow-[0_0_20px_rgba(59,130,246,0.5)]
                  `}
                  aria-label="Toggle save audio clips"
                  aria-checked={config.audio.save_audio_clips}
                  role="switch"
                >
                  {/* Thumb with liquid morph animation */}
                  <div
                    className={`
                      absolute top-0.5 left-0.5 w-5 h-5 rounded-full
                      transition-all duration-200
                      ${config.audio.save_audio_clips
                        ? 'translate-x-7 bg-white shadow-[0_2px_8px_rgba(59,130,246,0.4)]'
                        : 'translate-x-0 bg-slate-300'
                      }
                    `}
                    style={{
                      transitionTimingFunction: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)'
                    }}
                  />
                </button>
              </div>

              {/* Path input (shows when enabled) */}
              {config.audio.save_audio_clips && (
                <div className="space-y-2 pl-4 border-l-2 border-blue-500/30">
                  <label className="block text-xs font-ui font-medium text-[var(--text-secondary)]">
                    Audio Clips Path
                  </label>
                  <div className="relative">
                    {/* Terminal prompt */}
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-500 font-mono text-sm pointer-events-none">
                      &gt;
                    </span>
                    <input
                      type="text"
                      value={config.audio.audio_clips_path}
                      onChange={(e) => handleAudioClipsPathChange(e.target.value)}
                      placeholder="~/mojovoice/clips"
                      className="w-full pl-8 pr-4 py-2 bg-[var(--bg-surface)] border-2 border-[var(--border-default)]
                        text-[var(--text-primary)] font-mono text-sm rounded
                        placeholder:text-[var(--text-tertiary)]
                        focus:border-[var(--accent-primary)] focus:outline-none
                        focus:shadow-[0_0_20px_rgba(59,130,246,0.3)] transition-all duration-150"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Save/Reset Actions */}
      <div className="sticky bottom-0 pt-6 pb-6 bg-[var(--bg-surface)] border-t-2 border-[var(--border-default)] flex items-center justify-between gap-3">
        {/* Reset button (left) */}
        <Button
          variant="ghost"
          size="md"
          onClick={handleReset}
          disabled={saving}
        >
          Reset
        </Button>

        {/* Save button (right) */}
        <Button
          variant="primary"
          size="md"
          onClick={handleSaveChanges}
          loading={saving}
          disabled={saving}
          className={`
            ${saveSuccess ? 'border-green-500 bg-green-500/20 text-green-400' : ''}
            transition-all duration-150
          `}
        >
          {saveSuccess ? 'Saved!' : 'Save Changes'}
        </Button>
      </div>
    </div>
  );
}
