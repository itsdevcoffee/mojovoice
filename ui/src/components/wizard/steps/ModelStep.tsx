import { useState } from 'react';
import WizardStep from '../WizardStep';

interface ModelOption {
  id: string;
  name: string;
  description: string;
  detail: string;
  size: string;
  recommended?: boolean;
}

const MODEL_OPTIONS: ModelOption[] = [
  {
    id: 'large-v3-turbo',
    name: 'Large V3 Turbo',
    description: 'Best quality · Fast on GPU',
    detail: 'Highest accuracy for technical vocabulary. Requires CUDA GPU.',
    size: '1.5 GB',
    recommended: true,
  },
  {
    id: 'medium',
    name: 'Medium',
    description: 'Balanced · Works on CPU',
    detail: 'Good quality with moderate speed. Runs on any system.',
    size: '1.5 GB',
  },
  {
    id: 'tiny',
    name: 'Tiny',
    description: 'Fast · CPU only',
    detail: 'Fastest transcription, lower accuracy. Best for quick tasks.',
    size: '75 MB',
  },
];

interface ModelStepProps {
  onNext: (modelId: string) => void;
  onBack: () => void;
}

export default function ModelStep({ onNext, onBack }: ModelStepProps) {
  const [selectedModel, setSelectedModel] = useState<string | null>(null);

  const handleNext = () => {
    if (selectedModel) {
      onNext(selectedModel);
    }
  };

  return (
    <WizardStep
      stepNumber={2}
      totalSteps={4}
      title="CHOOSE YOUR MODEL"
      subtitle="Select the Whisper model for speech recognition."
      onNext={handleNext}
      onBack={onBack}
      showBack
      nextLabel="DOWNLOAD MODEL →"
      nextDisabled={selectedModel === null}
    >
      <div className="space-y-3">
        {MODEL_OPTIONS.map((model) => {
          const isSelected = selectedModel === model.id;
          return (
            <button
              key={model.id}
              onClick={() => setSelectedModel(model.id)}
              className={`
                w-full text-left p-5 border-2 transition-all duration-150 relative
                focus-visible:outline-2 focus-visible:outline-[#3b82f6] focus-visible:outline-offset-2
                ${isSelected
                  ? 'border-[#3b82f6] bg-[#3b82f6]/10 shadow-[0_0_16px_rgba(59,130,246,0.25)]'
                  : 'border-slate-700 bg-[#151b2e] hover:border-slate-500 hover:bg-[#1a2240]'
                }
              `}
              aria-pressed={isSelected}
              aria-label={`Select ${model.name} model${model.recommended ? ' (recommended)' : ''}`}
            >
              {/* Badges */}
              <div className="absolute top-3 right-3 flex items-center gap-2">
                {model.recommended && (
                  <span className="px-2 py-0.5 bg-[#3b82f6]/20 text-[#3b82f6] border border-[#3b82f6]/50 text-[10px] font-mono uppercase tracking-wider">
                    RECOMMENDED
                  </span>
                )}
                {isSelected && (
                  <span className="px-2 py-0.5 bg-[#22c55e]/20 text-[#22c55e] border border-[#22c55e]/50 text-[10px] font-mono uppercase tracking-wider">
                    SELECTED
                  </span>
                )}
              </div>

              <div className="pr-32">
                <div className="flex items-baseline gap-3 mb-1">
                  <span className="font-mono text-base font-semibold text-white">
                    {model.name}
                  </span>
                  <span className="font-mono text-xs text-slate-500">
                    {model.size}
                  </span>
                </div>
                <p className="font-mono text-xs text-[#3b82f6] mb-2 uppercase tracking-wide">
                  {model.description}
                </p>
                <p className="text-xs text-slate-400 font-[family-name:var(--font-ui)]">
                  {model.detail}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {selectedModel === null && (
        <p className="mt-4 text-xs text-slate-600 font-mono text-center uppercase tracking-wider">
          Select a model to continue
        </p>
      )}
    </WizardStep>
  );
}
