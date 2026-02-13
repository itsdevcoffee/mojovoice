import { useState } from 'react';
import { Button } from './Button';
import { invoke } from '../../lib/ipc';
import { useAppStore } from '../../stores/appStore';

export default function RecordingHero() {
  const [isRecording, setIsRecording] = useState(false);
  const [transcription, setTranscription] = useState('');
  const [error, setError] = useState('');
  const { loadHistory } = useAppStore();

  const handleTestRecording = async () => {
    try {
      setError('');
      setTranscription('');
      setIsRecording(true);

      await invoke('start_recording');
      await new Promise(resolve => setTimeout(resolve, 5000));
      const result = await invoke<string>('stop_recording');
      setTranscription(result);
      loadHistory(5, 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsRecording(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center mt-16 mb-12">
      {/* Pulsing ring container */}
      <div className="relative">
        {/* Outer pulsing ring (visible when recording) */}
        {isRecording && (
          <div
            className="absolute inset-0 border-2 border-[var(--success)] animate-pulse-ring gpu-accelerated"
            aria-hidden="true"
          />
        )}
        <Button
          variant="primary"
          size="lg"
          loading={isRecording}
          onClick={handleTestRecording}
          disabled={isRecording}
          className={`w-[280px] h-[120px] text-xl relative z-10 ${
            isRecording
              ? 'border-[var(--success)] shadow-[0_0_20px_rgba(34,197,94,0.5)]'
              : ''
          }`}
        >
          {isRecording ? 'RECORDING...' : '⏺ TEST MIC'}
        </Button>
      </div>

      {/* Keyboard shortcut hint */}
      <p className="mt-3 text-xs text-[var(--text-tertiary)] font-ui" aria-live="polite">
        {isRecording ? (
          'Recording... (5s)'
        ) : (
          <>
            Press <kbd className="px-2 py-1 bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded font-mono text-[var(--text-secondary)]">Space</kbd> to start recording
          </>
        )}
      </p>

      {/* Transcription result */}
      {transcription && (
        <div className="mt-8 w-full max-w-[600px]" role="status" aria-live="polite" aria-atomic="true">
          <div className="p-6 bg-[var(--bg-surface)] border-2 border-[var(--border-default)]">
            <p className="text-sm text-[var(--text-tertiary)] font-ui mb-2">Transcription:</p>
            <p className="text-base text-[var(--text-primary)] font-ui leading-relaxed">{transcription}</p>
          </div>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="mt-8 w-full max-w-[600px]" role="alert" aria-live="assertive">
          <div className="p-6 bg-red-500/10 border-2 border-red-500/50">
            <p className="text-sm text-red-400 font-ui mb-2">Error:</p>
            <p className="text-base text-red-300 font-ui leading-relaxed">{error}</p>
          </div>
        </div>
      )}
    </div>
  );
}
