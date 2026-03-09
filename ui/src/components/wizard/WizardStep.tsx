import React from 'react';
import { Button } from '../ui/Button';

export interface WizardStepProps {
  stepNumber: number;
  totalSteps: number;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  onNext: () => void;
  onBack?: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  showBack?: boolean;
}

export default function WizardStep({
  stepNumber,
  totalSteps,
  title,
  subtitle,
  children,
  onNext,
  onBack,
  nextLabel = 'CONTINUE →',
  nextDisabled = false,
  showBack = false,
}: WizardStepProps) {
  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center bg-[#0a0e1a]"
      role="main"
      aria-label={`Setup wizard step ${stepNumber} of ${totalSteps}: ${title}`}
    >
      {/* Step dot indicators */}
      <div className="flex items-center gap-2 mb-10" role="progressbar" aria-valuenow={stepNumber} aria-valuemin={1} aria-valuemax={totalSteps} aria-label="Setup progress">
        {Array.from({ length: totalSteps }, (_, i) => (
          <div
            key={i}
            className={`w-2.5 h-2.5 border-2 transition-all duration-150 ${
              i + 1 === stepNumber
                ? 'bg-[#22c55e] border-[#22c55e] shadow-[0_0_8px_rgba(34,197,94,0.6)]'
                : i + 1 < stepNumber
                ? 'bg-[#334155] border-[#64748b]'
                : 'bg-[#0a0e1a] border-slate-600'
            }`}
            aria-hidden="true"
          />
        ))}
      </div>

      {/* Main content area */}
      <div className="w-full max-w-2xl px-6 flex flex-col items-center">
        {/* Bracket title */}
        <div className="mb-2 text-center">
          <span className="font-mono text-xs tracking-[0.2em] text-[#3b82f6] uppercase select-none">
            [ MOJOVOICE SETUP ]
          </span>
        </div>

        {/* Step title */}
        <h1 className="font-mono text-2xl font-semibold text-white uppercase tracking-[0.1em] text-center mb-2">
          {title}
        </h1>

        {/* Optional subtitle */}
        {subtitle && (
          <p className="text-sm text-slate-400 text-center mb-8 font-[family-name:var(--font-ui)]">
            {subtitle}
          </p>
        )}

        {/* Step counter */}
        <p className="font-mono text-xs text-slate-600 uppercase tracking-[0.15em] mb-8">
          STEP {stepNumber} OF {totalSteps}
        </p>

        {/* Children content */}
        <div className="w-full mb-10">
          {children}
        </div>

        {/* Bottom bar */}
        <div className="flex items-center justify-between w-full">
          <div>
            {showBack && onBack && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onBack}
                className="text-slate-400 hover:text-slate-200"
              >
                ← BACK
              </Button>
            )}
          </div>

          <Button
            variant="primary"
            size="md"
            onClick={onNext}
            disabled={nextDisabled}
            className="border-2 border-black text-white bg-[#3b82f6] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:-translate-x-0.5 hover:-translate-y-0.5 active:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-0.5 active:translate-y-0.5"
          >
            {nextLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
