import { useState, useEffect } from 'react';
import { Settings as SettingsIcon } from 'lucide-react';
import { Button } from './ui/Button';
import { StatusBar } from './ui/StatusBar';
import SectionHeader from './ui/SectionHeader';
import { TranscriptionCard } from './ui/TranscriptionCard';
import { SystemStatus } from './ui/SystemStatus';
import { invoke } from '../lib/ipc';
import { useAppStore } from '../stores/appStore';

export default function MissionControl() {
  const [isRecording, setIsRecording] = useState(false);
  const [transcription, setTranscription] = useState<string>('');
  const [error, setError] = useState<string>('');

  // Get history data from store
  const { historyEntries, loadHistory, deleteHistoryEntry } = useAppStore();

  // Load recent transcriptions on mount
  useEffect(() => {
    loadHistory(5, 0); // Load last 5 entries
  }, [loadHistory]);

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

  return (
    <div className="min-h-screen bg-[var(--bg-void)] text-[var(--text-primary)]">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-8 max-w-[800px] mx-auto">
        <h1 className="font-mono text-2xl font-bold tracking-wider text-[var(--text-primary)]">
          MOJOVOICE
        </h1>
        <button
          className="p-3 text-[var(--text-secondary)] hover:text-[var(--accent-primary)] transition-colors duration-150"
          aria-label="Settings"
        >
          <SettingsIcon className="w-6 h-6" />
        </button>
      </header>

      {/* Main content area */}
      <main className="max-w-[800px] mx-auto px-6 pb-12">
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

          {/* Transcription result */}
          {transcription && (
            <div className="mt-8 w-full max-w-[600px]">
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
            <div className="mt-8 w-full max-w-[600px]">
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
                  className="px-4 py-2 text-sm font-ui text-[var(--accent-primary)] hover:text-[var(--accent-glow)] transition-colors duration-150"
                  onClick={() => {
                    // TODO: Open history modal (placeholder for task #17)
                    console.log('View All clicked - History modal not yet implemented');
                  }}
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
    </div>
  );
}
