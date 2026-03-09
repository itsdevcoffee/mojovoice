import WizardStep from '../WizardStep';

interface HardwareStepProps {
  onNext: () => void;
}

export default function HardwareStep({ onNext }: HardwareStepProps) {
  return (
    <WizardStep
      stepNumber={1}
      totalSteps={4}
      title="HARDWARE DETECTION"
      subtitle="We scanned your system to determine the best configuration."
      onNext={onNext}
      nextLabel="CHOOSE MODEL →"
    >
      {/* Hardware card */}
      <div className="bg-[#151b2e] border-2 border-slate-700 border-l-4 border-l-[#22c55e] p-6 relative">
        {/* READY badge */}
        <div className="absolute top-3 right-3">
          <span className="px-2 py-0.5 bg-[#22c55e]/20 text-[#22c55e] border border-[#22c55e]/50 text-xs font-mono uppercase tracking-wider">
            ✓ READY
          </span>
        </div>

        <h2 className="font-mono text-xs text-[#3b82f6] uppercase tracking-[0.15em] mb-6">
          ▸ SYSTEM SPECIFICATIONS
        </h2>

        <div className="space-y-4">
          {/* GPU */}
          <div className="flex items-start gap-4">
            <span className="font-mono text-xs text-slate-500 uppercase tracking-wider w-12 pt-0.5 shrink-0">GPU</span>
            <div>
              <p className="font-mono text-sm text-white font-semibold">NVIDIA RTX 4090</p>
              <p className="font-mono text-xs text-slate-400 mt-0.5">
                24 GB VRAM
                <span className="ml-2 px-1.5 py-0.5 bg-[#22c55e]/20 text-[#22c55e] border border-[#22c55e]/40 text-[10px] uppercase tracking-wider">
                  CUDA READY
                </span>
              </p>
            </div>
          </div>

          {/* Divider */}
          <div className="h-px bg-slate-800" />

          {/* RAM */}
          <div className="flex items-center gap-4">
            <span className="font-mono text-xs text-slate-500 uppercase tracking-wider w-12 shrink-0">RAM</span>
            <p className="font-mono text-sm text-white">32 GB</p>
          </div>

          {/* Divider */}
          <div className="h-px bg-slate-800" />

          {/* Disk */}
          <div className="flex items-center gap-4">
            <span className="font-mono text-xs text-slate-500 uppercase tracking-wider w-12 shrink-0">DISK</span>
            <p className="font-mono text-sm text-white">450 GB available</p>
          </div>
        </div>

        {/* Bottom status banner */}
        <div className="mt-6 pt-4 border-t border-slate-700/60 flex items-center gap-2">
          <span className="text-[#22c55e] text-base">✓</span>
          <span className="font-mono text-xs text-[#22c55e] uppercase tracking-[0.15em] font-semibold">
            YOUR SYSTEM IS READY
          </span>
        </div>
      </div>

      <p className="mt-4 text-xs text-slate-600 font-mono text-center">
        Hardware detection shown above is illustrative. Real detection wires in Phase 3.
      </p>
    </WizardStep>
  );
}
