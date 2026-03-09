import { useState } from 'react';
import { useAppStore } from '../../stores/appStore';
import HardwareStep from './steps/HardwareStep';
import ModelStep from './steps/ModelStep';
import DownloadStep from './steps/DownloadStep';
import TestStep from './steps/TestStep';

// Wizard steps: 0=Hardware, 1=Model, 2=Download, 3=Test
type WizardStep = 0 | 1 | 2 | 3;

const MODEL_DISPLAY_NAMES: Record<string, string> = {
  'large-v3-turbo': 'Whisper Large V3 Turbo',
  medium: 'Whisper Medium',
  tiny: 'Whisper Tiny',
};

export default function SetupWizard() {
  const [step, setStep] = useState<WizardStep>(0);
  const [selectedModel, setSelectedModel] = useState<string>('large-v3-turbo');

  const setWizardComplete = useAppStore((s) => s.setWizardComplete);

  const goTo = (next: WizardStep) => setStep(next);

  const handleHardwareNext = () => goTo(1);

  const handleModelNext = (modelId: string) => {
    setSelectedModel(modelId);
    goTo(2);
  };

  const handleModelBack = () => goTo(0);

  const handleDownloadComplete = () => goTo(3);

  const handleDownloadCancel = () => goTo(1);

  const handleTestNext = () => {
    setWizardComplete();
  };

  const handleTestBack = () => goTo(1);

  const modelDisplayName = MODEL_DISPLAY_NAMES[selectedModel] ?? selectedModel;

  return (
    <>
      {step === 0 && (
        <HardwareStep onNext={handleHardwareNext} />
      )}
      {step === 1 && (
        <ModelStep onNext={handleModelNext} onBack={handleModelBack} />
      )}
      {step === 2 && (
        <DownloadStep
          modelName={modelDisplayName}
          onComplete={handleDownloadComplete}
          onCancel={handleDownloadCancel}
        />
      )}
      {step === 3 && (
        <TestStep onNext={handleTestNext} onBack={handleTestBack} />
      )}
    </>
  );
}
