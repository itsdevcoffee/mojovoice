import { useState, useEffect, useRef } from 'react';

const MODEL_SIZE_MB = 1500;

// Derive fake download stats from progress (0-100)
function getDownloadStats(progress: number): { downloadedMb: number; speedMbps: number; etaSec: number } {
  const downloadedMb = Math.round((progress / 100) * MODEL_SIZE_MB);
  const speedMbps = 42; // fake constant
  const remainingMb = MODEL_SIZE_MB - downloadedMb;
  const etaSec = Math.max(0, Math.round(remainingMb / speedMbps));
  return { downloadedMb, speedMbps, etaSec };
}

function getStatusText(progress: number): string {
  if (progress >= 100) return 'COMPLETE ✓';
  if (progress >= 90) return 'VERIFYING...';
  return 'DOWNLOADING...';
}

interface DownloadStepProps {
  modelName: string;
  onComplete: () => void;
  onCancel: () => void;
}

export default function DownloadStep({ modelName, onComplete, onCancel }: DownloadStepProps) {
  const [progress, setProgress] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const completeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Check for reduced motion preference
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    if (prefersReducedMotion) {
      // Skip animation — jump straight to 100% then advance after a beat
      setProgress(100);
      completeTimerRef.current = setTimeout(() => {
        onComplete();
      }, 800);
      return () => {
        if (completeTimerRef.current !== null) clearTimeout(completeTimerRef.current);
      };
    }

    // ~3 seconds from 0→100: tick every 30ms, increment by 1
    intervalRef.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          if (intervalRef.current !== null) clearInterval(intervalRef.current);
          return 100;
        }
        return prev + 1;
      });
    }, 30);

    return () => {
      if (intervalRef.current !== null) clearInterval(intervalRef.current);
      if (completeTimerRef.current !== null) clearTimeout(completeTimerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When progress hits 100, wait 500ms then call onComplete
  useEffect(() => {
    if (progress >= 100 && !prefersReducedMotion) {
      completeTimerRef.current = setTimeout(() => {
        onComplete();
      }, 500);
      return () => {
        if (completeTimerRef.current !== null) clearTimeout(completeTimerRef.current);
      };
    }
  }, [progress, onComplete, prefersReducedMotion]);

  const { downloadedMb, speedMbps, etaSec } = getDownloadStats(progress);
  const statusText = getStatusText(progress);
  const isComplete = progress >= 100;
  const isVerifying = progress >= 90 && progress < 100;

  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center bg-[#0a0e1a]"
      role="main"
      aria-label="Downloading model"
      aria-live="polite"
      aria-atomic="false"
    >
      <div className="w-full max-w-2xl px-6 flex flex-col items-center">
        {/* Bracket title */}
        <div className="mb-2 text-center">
          <span className="font-mono text-xs tracking-[0.2em] text-[#3b82f6] uppercase select-none">
            [ MOJOVOICE SETUP ]
          </span>
        </div>

        <h1 className="font-mono text-2xl font-semibold text-white uppercase tracking-[0.1em] text-center mb-2">
          DOWNLOADING MODEL
        </h1>

        <p className="font-mono text-xs text-slate-600 uppercase tracking-[0.15em] mb-10">
          STEP 3 OF 4
        </p>

        {/* Model name */}
        <div className="w-full mb-6 text-center">
          <span className="font-mono text-sm text-slate-300">
            {modelName}
          </span>
        </div>

        {/* Progress bar */}
        <div
          className="w-full bg-[#151b2e] border-2 border-slate-700 h-6 relative overflow-hidden mb-3"
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Download progress: ${progress}%`}
        >
          <div
            className={`absolute inset-y-0 left-0 transition-all duration-100 ${
              isComplete
                ? 'bg-[#22c55e] shadow-[0_0_12px_rgba(34,197,94,0.5)]'
                : isVerifying
                ? 'bg-[#3b82f6]/80'
                : 'bg-[#3b82f6] shadow-[0_0_12px_rgba(59,130,246,0.4)]'
            }`}
            style={{ width: `${progress}%` }}
          />
          {/* Percentage label inside bar */}
          <span className="absolute inset-0 flex items-center justify-center font-mono text-xs font-semibold text-white mix-blend-difference select-none">
            {progress}%
          </span>
        </div>

        {/* Stats line */}
        <div className="w-full flex items-center justify-between mb-2">
          <span className="font-mono text-xs text-slate-500">
            {isComplete
              ? `${MODEL_SIZE_MB} MB / ${MODEL_SIZE_MB} MB`
              : `${downloadedMb} MB / ${MODEL_SIZE_MB} MB · ${speedMbps} MB/s · ETA ${etaSec}s`}
          </span>
          <span
            className={`font-mono text-xs font-semibold tracking-wider ${
              isComplete ? 'text-[#22c55e]' : isVerifying ? 'text-amber-400' : 'text-[#3b82f6]'
            }`}
          >
            {statusText}
          </span>
        </div>

        {/* Step dots */}
        <div className="flex items-center gap-2 mt-10 mb-6" aria-hidden="true">
          {[1, 2, 3, 4].map((step) => (
            <div
              key={step}
              className={`w-2.5 h-2.5 border-2 transition-all duration-150 ${
                step === 3
                  ? 'bg-[#22c55e] border-[#22c55e] shadow-[0_0_8px_rgba(34,197,94,0.6)]'
                  : step < 3
                  ? 'bg-[#334155] border-[#64748b]'
                  : 'bg-[#0a0e1a] border-slate-600'
              }`}
            />
          ))}
        </div>

        {/* Cancel link */}
        {!isComplete && (
          <button
            onClick={onCancel}
            className="font-mono text-xs text-slate-600 hover:text-slate-400 transition-colors duration-150 underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-[#3b82f6] focus-visible:outline-offset-2"
            aria-label="Cancel download and return to model selection"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
