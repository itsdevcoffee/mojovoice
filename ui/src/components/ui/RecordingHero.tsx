import { useEffect, useRef } from 'react';
import { Mic, Square } from 'lucide-react';
import { invoke } from '../../lib/ipc';
import { useAppStore } from '../../stores/appStore';

interface RecordingHeroProps {
  onTranscription?: (text: string) => void;
}

export default function RecordingHero({ onTranscription }: RecordingHeroProps) {
  const { isRecording, isProcessing, setRecording, setProcessing, loadHistory } = useAppStore();

  // Track whether prefers-reduced-motion is set
  const prefersReducedMotion = useRef(
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false
  );

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (e: MediaQueryListEvent) => {
      prefersReducedMotion.current = e.matches;
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const handleClick = async () => {
    if (isProcessing) return;

    if (!isRecording) {
      // Start recording
      try {
        await invoke('start_recording');
        setRecording(true);
      } catch (err) {
        console.error('Failed to start recording:', err);
      }
    } else {
      // Stop recording and wait for transcription
      setRecording(false);
      setProcessing(true);
      try {
        const result = await invoke<string | { success: boolean }>('stop_recording');
        // Real backend returns a string; mock returns { success: true }
        const text = typeof result === 'string' ? result : '';
        if (text) {
          onTranscription?.(text);
          await loadHistory(5, 0);
        }
      } catch (err) {
        console.error('Failed to stop recording:', err);
      } finally {
        setProcessing(false);
      }
    }
  };

  const pulseClass = prefersReducedMotion.current ? '' : 'animate-pulse';

  return (
    <div className="flex flex-col items-center gap-6 py-10">
      {/* Central recording button */}
      <div className="relative flex items-center justify-center">
        {/* Pulsing acid green ring — only when recording and no reduced motion */}
        {isRecording && (
          <span
            className={`
              absolute inset-0 rounded-full
              border-4 border-[var(--accent-secondary,#a3e635)]
              ${pulseClass}
              gpu-accelerated
            `}
            style={{ transform: 'scale(1.25)' }}
            aria-hidden="true"
          />
        )}

        <button
          type="button"
          onClick={handleClick}
          disabled={isProcessing}
          aria-label={
            isProcessing
              ? 'Transcribing audio…'
              : isRecording
                ? 'Stop recording'
                : 'Start recording'
          }
          aria-pressed={isRecording}
          className={`
            relative z-10
            w-20 h-20 rounded-full
            flex items-center justify-center
            border-4
            transition-all duration-200
            focus-visible:outline-2 focus-visible:outline-blue-500 focus-visible:outline-offset-4
            disabled:cursor-not-allowed disabled:opacity-60
            ${isRecording
              ? 'bg-[var(--accent-secondary,#a3e635)] border-[var(--accent-secondary,#a3e635)] text-[var(--bg-void)] shadow-[0_0_24px_rgba(163,230,53,0.5)]'
              : 'bg-[var(--accent-primary)] border-[var(--accent-primary)] text-white shadow-[0_0_16px_rgba(59,130,246,0.4)] hover:shadow-[0_0_24px_rgba(59,130,246,0.6)]'
            }
          `}
        >
          {isProcessing ? (
            <span
              className="inline-block w-7 h-7 border-[3px] border-white border-t-transparent rounded-full animate-spin"
              aria-hidden="true"
            />
          ) : isRecording ? (
            <Square size={28} aria-hidden="true" />
          ) : (
            <Mic size={28} aria-hidden="true" />
          )}
        </button>
      </div>

      {/* Status label */}
      <p
        className="font-mono text-sm uppercase tracking-widest"
        aria-live="polite"
        aria-atomic="true"
      >
        {isProcessing ? (
          <span className="text-[var(--text-secondary)]">TRANSCRIBING...</span>
        ) : isRecording ? (
          <span className="text-[var(--accent-secondary,#a3e635)]">RECORDING</span>
        ) : (
          <span className="text-[var(--text-tertiary)]">CLICK TO RECORD</span>
        )}
      </p>
    </div>
  );
}
