import { useState, useEffect, lazy, Suspense } from 'react';
import { Settings as SettingsIcon } from 'lucide-react';
import { StatusBar } from './ui/StatusBar';
import SectionHeader from './ui/SectionHeader';
import { TranscriptionCard } from './ui/TranscriptionCard';
import { SystemStatus } from './ui/SystemStatus';
import StatusMicroIndicators from './ui/StatusMicroIndicators';
import RecordingHero from './ui/RecordingHero';
import { useAppStore } from '../stores/appStore';
import { useToast } from './ui/Toast';

const Drawer = lazy(() => import('./ui/Drawer').then(m => ({ default: m.Drawer })));
const SettingsPanel = lazy(() => import('./SettingsPanel'));
const HistoryModal = lazy(() => import('./HistoryModal'));
const CommandPalette = lazy(() => import('./CommandPalette'));

export default function MissionControl() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isTranscriptionsExpanded, setIsTranscriptionsExpanded] = useState(true);

  const { historyEntries, loadHistory, deleteHistoryEntry } = useAppStore();
  const { toast } = useToast();

  // Load recent transcriptions on mount
  useEffect(() => {
    loadHistory(5, 0);
  }, [loadHistory]);

  // Load all history when modal opens
  useEffect(() => {
    if (isHistoryModalOpen) {
      loadHistory(1000, 0);
    }
  }, [isHistoryModalOpen, loadHistory]);

  // Helper to open history with search focused
  const openHistoryWithSearch = () => {
    setIsHistoryModalOpen(true);
    setTimeout(() => {
      const searchInput = document.querySelector<HTMLInputElement>('[data-search-input]');
      if (searchInput) searchInput.focus();
    }, 100);
  };

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const isInputField =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable;

      if (event.key === 'Escape') {
        if (isCommandPaletteOpen) { setIsCommandPaletteOpen(false); return; }
        if (isHistoryModalOpen) { setIsHistoryModalOpen(false); return; }
        if (isSettingsOpen) { setIsSettingsOpen(false); return; }
      }

      if (isInputField && event.key !== 'Escape') return;

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modifierKey = isMac ? event.metaKey : event.ctrlKey;

      // Cmd+K: open command palette (reassigned from history search)
      if (modifierKey && event.key === 'k') {
        event.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
        return;
      }

      // Cmd+, : open settings
      if (modifierKey && event.key === ',') {
        event.preventDefault();
        setIsSettingsOpen(true);
        return;
      }

      // Cmd+H: open history modal
      if (modifierKey && event.key === 'h') {
        event.preventDefault();
        setIsHistoryModalOpen(true);
        return;
      }

      // Cmd+C: copy last transcription (only if not in input field)
      if (modifierKey && event.key === 'c' && !isInputField) {
        event.preventDefault();
        if (historyEntries.length > 0) {
          handleCopyTranscription(historyEntries[0].text);
        }
        return;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isCommandPaletteOpen, isHistoryModalOpen, isSettingsOpen, historyEntries]);

  const handleCopyTranscription = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ message: 'Copied to clipboard', variant: 'success' });
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
      toast({ message: 'Failed to copy', variant: 'error' });
    }
  };

  const handleDeleteTranscription = async (id: string) => {
    // Optimistically remove from UI, allow undo before actually deleting
    const entry = historyEntries.find((e) => e.id === id);
    if (!entry) return;

    // Track whether the user undid the action
    let undone = false;

    toast({
      message: 'Transcription deleted',
      variant: 'undo',
      duration: 5000,
      action: {
        label: 'Undo',
        onClick: () => {
          undone = true;
          // Reload to restore the entry (it hasn't been deleted yet)
          loadHistory(5, 0);
        },
      },
      onExpire: () => {
        // Timer ran out without undo — actually delete
        if (!undone) {
          deleteHistoryEntry(id);
        }
      },
    });

    // Immediately hide from UI by removing from local state
    // (The store's deleteHistoryEntry reloads, so we manually filter for instant feedback)
    useAppStore.setState((state) => ({
      historyEntries: state.historyEntries.filter((e) => e.id !== id),
    }));
  };

  return (
    <div className="min-h-screen bg-[var(--bg-void)] text-[var(--text-primary)]">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-8 max-w-[800px] mx-auto">
        <div className="flex items-center gap-4">
          <h1 className="font-mono text-2xl font-bold tracking-wider text-[var(--text-primary)]">
            MOJOVOICE
          </h1>
          <StatusMicroIndicators />
        </div>
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
        <RecordingHero />

        {/* Status bar */}
        <StatusBar className="mt-12" />

        {/* Recent Transcriptions Section */}
        <section className="mt-12">
          <SectionHeader
            title="RECENT TRANSCRIPTIONS"
            isExpanded={isTranscriptionsExpanded}
            onToggle={() => setIsTranscriptionsExpanded((prev) => !prev)}
          />

          <div
            className={`
              overflow-hidden transition-all duration-200
              ${isTranscriptionsExpanded ? 'max-h-[2000px] opacity-100 mt-4' : 'max-h-0 opacity-0 mt-0'}
            `}
            style={{ transitionTimingFunction: 'var(--ease-out)' }}
          >
            {historyEntries.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-sm text-[var(--text-tertiary)] font-ui">No transcriptions yet</p>
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
          </div>
        </section>

        <SystemStatus />
      </main>

      {/* Footer */}
      <footer className="max-w-[800px] mx-auto px-6 py-6 text-center">
        <p className="text-xs text-[var(--text-tertiary)] font-ui">
          Press hotkey to start recording
        </p>
      </footer>

      {/* Settings Drawer */}
      {isSettingsOpen && (
        <Suspense fallback={null}>
          <Drawer isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)}>
            <SettingsPanel />
          </Drawer>
        </Suspense>
      )}

      {/* History Modal */}
      <Suspense fallback={null}>
        <HistoryModal isOpen={isHistoryModalOpen} onClose={() => setIsHistoryModalOpen(false)} />
      </Suspense>

      {/* Command Palette */}
      <Suspense fallback={null}>
        <CommandPalette
          isOpen={isCommandPaletteOpen}
          onClose={() => setIsCommandPaletteOpen(false)}
          onOpenHistory={openHistoryWithSearch}
          onOpenSettings={() => setIsSettingsOpen(true)}
        />
      </Suspense>
    </div>
  );
}
