import { useState, useRef } from 'react';
import WizardStep from '../WizardStep';
import { Button } from '../../ui/Button';

const MOCK_TRANSCRIPTION = 'The quick brown fox jumps over the lazy dog.';
const RECORDING_DURATION_MS = 2000;

type TestState = 'idle' | 'recording' | 'done';

interface TestStepProps {
  onNext: () => void;
  onBack: () => void;
}

export default function TestStep({ onNext, onBack }: TestStepProps) {
  const [testState, setTestState] = useState<TestState>('idle');
  const [transcription, setTranscription] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleRecord = () => {
    if (testState === 'recording') return;

    setTestState('recording');
    setTranscription(null);

    timerRef.current = setTimeout(() => {
      setTranscription(MOCK_TRANSCRIPTION);
      setTestState('done');
    }, RECORDING_DURATION_MS);
  };

  // Cleanup on unmount
  const cleanupTimer = () => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  // Use a cleanup ref approach — register cleanup via useEffect alternative
  // We attach cleanup directly to component lifecycle via ref
  if (typeof window !== 'undefined') {
    // Attach to window unload is not ideal; instead rely on button state
  }

  return (
    <WizardStep
      stepNumber={4}
      totalSteps={4}
      title="TEST YOUR SETUP"
      subtitle="Click the button below and say something to verify transcription works."
      onNext={() => {
        cleanupTimer();
        onNext();
      }}
      onBack={() => {
        cleanupTimer();
        onBack();
      }}
      showBack
      nextLabel="START USING MOJOVOICE →"
      nextDisabled={testState === 'recording'}
    >
      <div className="flex flex-col items-center gap-6">
        {/* Instruction */}
        <p className="font-mono text-sm text-[#3b82f6] uppercase tracking-[0.15em] text-center">
          SAY SOMETHING TO TEST YOUR SETUP
        </p>

        {/* Recording button area */}
        <div className="flex flex-col items-center gap-4">
          {/* Pulse ring when recording */}
          <div className="relative flex items-center justify-center">
            {testState === 'recording' && (
              <>
                <span
                  className="absolute w-24 h-24 rounded-full border-2 border-[#22c55e]/50 animate-ping"
                  aria-hidden="true"
                />
                <span
                  className="absolute w-20 h-20 rounded-full border-2 border-[#22c55e]/30 animate-ping [animation-delay:150ms]"
                  aria-hidden="true"
                />
              </>
            )}

            <Button
              variant="primary"
              size="lg"
              onClick={handleRecord}
              disabled={testState === 'recording' || testState === 'done'}
              className={`
                w-16 h-16 rounded-full flex items-center justify-center text-2xl
                border-2 border-black
                ${testState === 'recording'
                  ? 'bg-[#22c55e] border-[#22c55e] shadow-[0_0_20px_rgba(34,197,94,0.5)] animate-pulse'
                  : testState === 'done'
                  ? 'bg-slate-700 border-slate-600 opacity-50'
                  : 'bg-[#3b82f6] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]'
                }
              `}
              aria-label={testState === 'recording' ? 'Recording in progress' : 'Start test recording'}
            >
              {testState === 'recording' ? '●' : testState === 'done' ? '✓' : '⏺'}
            </Button>
          </div>

          {/* Status label */}
          <p className="font-mono text-xs text-slate-500 uppercase tracking-wider" aria-live="polite">
            {testState === 'idle' && 'CLICK TO RECORD'}
            {testState === 'recording' && 'RECORDING...'}
            {testState === 'done' && 'RECORDING COMPLETE'}
          </p>
        </div>

        {/* Transcription result */}
        {transcription && (
          <div
            className="w-full bg-[#151b2e] border-2 border-slate-700 p-5"
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            <p className="font-mono text-xs text-slate-500 uppercase tracking-wider mb-3">
              TRANSCRIPTION OUTPUT
            </p>
            <p className="text-base text-white font-[family-name:var(--font-ui)] leading-relaxed mb-4">
              {transcription}
            </p>
            <div className="flex items-center gap-2 pt-3 border-t border-slate-700">
              <span className="text-[#22c55e] text-sm">✓</span>
              <span className="font-mono text-xs text-[#22c55e] uppercase tracking-[0.15em] font-semibold">
                TRANSCRIPTION COMPLETE ✓
              </span>
            </div>
          </div>
        )}
      </div>
    </WizardStep>
  );
}
