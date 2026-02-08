import { useState } from 'react';
import { Settings as SettingsIcon } from 'lucide-react';
import { Button } from './ui/Button';
import { StatusBar } from './ui/StatusBar';
import { invoke } from '../lib/ipc';

export default function MissionControl() {
  const [isRecording, setIsRecording] = useState(false);
  const [transcription, setTranscription] = useState<string>('');
  const [error, setError] = useState<string>('');

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
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsRecording(false);
    }
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
