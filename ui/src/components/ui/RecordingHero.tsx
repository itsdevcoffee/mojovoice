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

  const handleCancel = async () => {
    try {
      await invoke('cancel_recording');
    } catch {
      // ignore cancel errors
    } finally {
      setIsRecording(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 mt-6 mb-4">
      {/* Compact horizontal control row */}
      <div className="flex items-center gap-3 h-[48px]">
        {/* Recording indicator dot */}
        {isRecording && (
          <span
            className="inline-block w-2 h-2 rounded-full bg-[var(--success)] animate-pulse gpu-accelerated"
            aria-hidden="true"
          />
        )}

        <Button
          variant="primary"
          size="sm"
          loading={isRecording}
          onClick={handleTestRecording}
          disabled={isRecording}
          className={isRecording ? 'border-[var(--success)] shadow-[0_0_12px_rgba(34,197,94,0.4)]' : ''}
        >
          {isRecording ? 'RECORDING...' : '⏺ TEST MIC'}
        </Button>

        {isRecording && (
          <Button
            variant="secondary"
            size="sm"
            onClick={handleCancel}
            className="border-red-500 text-red-400 hover:bg-red-500 hover:text-white hover:shadow-[0_0_12px_rgba(239,68,68,0.4)]"
          >
            CANCEL
          </Button>
        )}
      </div>

      {/* Transcription result */}
      {transcription && (
        <div className="w-full max-w-[600px]" role="status" aria-live="polite" aria-atomic="true">
          <div className="p-6 bg-[var(--bg-surface)] border-2 border-[var(--border-default)]">
            <p className="text-sm text-[var(--text-tertiary)] font-ui mb-2">Transcription:</p>
            <p className="text-base text-[var(--text-primary)] font-ui leading-relaxed">{transcription}</p>
          </div>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="w-full max-w-[600px]" role="alert" aria-live="assertive">
          <div className="p-6 bg-red-500/10 border-2 border-red-500/50">
            <p className="text-sm text-red-400 font-ui mb-2">Error:</p>
            <p className="text-base text-red-300 font-ui leading-relaxed">{error}</p>
          </div>
        </div>
      )}
    </div>
  );
}
