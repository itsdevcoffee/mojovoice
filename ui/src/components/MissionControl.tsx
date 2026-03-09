import { useState, useEffect, lazy, Suspense } from 'react';
import { Settings as SettingsIcon, ChevronLeft } from 'lucide-react';
import { StatusBar } from './ui/StatusBar';
import SectionHeader from './ui/SectionHeader';
import { TranscriptionCard } from './ui/TranscriptionCard';
import { SystemStatus } from './ui/SystemStatus';
import StatusMicroIndicators from './ui/StatusMicroIndicators';
import RecordingHero from './ui/RecordingHero';
import { useAppStore } from '../stores/appStore';
import { useTranscriptionActions } from '../hooks/useTranscriptionActions';

const Drawer = lazy(() => import('./ui/Drawer').then(m => ({ default: m.Drawer })));
const SettingsPanel = lazy(() => import('./SettingsPanel'));
const CommandPalette = lazy(() => import('./CommandPalette'));
const ModelsPanel = lazy(() => import('./ModelsPanel').then(m => ({ default: m.ModelsPanel })));
const HistoryView = lazy(() => import('./HistoryView').then(m => ({ default: m.HistoryView })));

export default function MissionControl() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isTranscriptionsExpanded, setIsTranscriptionsExpanded] = useState(true);

  const { historyEntries, loadHistory, activeView, setActiveView } = useAppStore();
  const { handleCopy: handleCopyTranscription, handleDelete: handleDeleteTranscription } = useTranscriptionActions(5);

  // Load recent transcriptions on mount
  useEffect(() => {
    loadHistory(5, 0);
  }, [loadHistory]);

  // Helper to open history with search focused
  const openHistoryWithSearch = () => {
    setActiveView('history');
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
        if (activeView === 'history' || activeView === 'models') {
          setActiveView('dashboard');
          return;
        }
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

      // Cmd+H: open history view
      if (modifierKey && event.key === 'h') {
        event.preventDefault();
        setActiveView('history');
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
  }, [isCommandPaletteOpen, activeView, isSettingsOpen, historyEntries]);

  // Determine if we're in a sub-view that needs a back button
  const isSubView = activeView === 'models' || activeView === 'history';

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
        {isSubView ? (
          <>
            {/* Back to dashboard */}
            <div className="mb-6">
              <button
                onClick={() => setActiveView('dashboard')}
                className="
                  flex items-center gap-1
                  font-mono text-xs uppercase tracking-wide
                  text-[var(--text-tertiary)]
                  hover:text-[var(--accent-primary)]
                  transition-colors duration-150
                  focus-visible:outline-2 focus-visible:outline-blue-500 focus-visible:outline-offset-2
                "
                aria-label="Back to dashboard"
              >
                <ChevronLeft size={14} />
                <span>[DASHBOARD]</span>
              </button>
            </div>

            {activeView === 'models' && (
              <Suspense fallback={
                <div className="py-12 text-center font-mono text-xs uppercase tracking-wide text-[var(--text-tertiary)]">
                  Loading models...
                </div>
              }>
                <ModelsPanel />
              </Suspense>
            )}

            {activeView === 'history' && (
              <Suspense fallback={
                <div className="py-12 text-center font-mono text-xs uppercase tracking-wide text-[var(--text-tertiary)]">
                  Loading history...
                </div>
              }>
                <HistoryView />
              </Suspense>
            )}
          </>
        ) : (
          <>
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
                        className="
                          px-4 py-2 font-mono text-xs uppercase tracking-wide
                          text-[var(--text-tertiary)]
                          hover:text-[var(--accent-primary)]
                          transition-colors duration-150
                          focus-visible:outline-2 focus-visible:outline-blue-500 focus-visible:outline-offset-2
                          focus-visible:shadow-[0_0_20px_rgba(59,130,246,0.5)]
                        "
                        title={`View All History (${navigator.platform.toUpperCase().indexOf('MAC') >= 0 ? 'Cmd' : 'Ctrl'}+H)`}
                        aria-label="View all transcription history"
                        onClick={() => setActiveView('history')}
                      >
                        [VIEW ALL]
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </section>

            <SystemStatus />
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="max-w-[800px] mx-auto px-6 py-6 text-center">
        <p className="text-xs text-[var(--text-tertiary)] font-ui">
          Press hotkey to start recording
        </p>
      </footer>

      {/* Settings Drawer */}
      <Suspense fallback={null}>
        <Drawer isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)}>
          <SettingsPanel />
        </Drawer>
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
