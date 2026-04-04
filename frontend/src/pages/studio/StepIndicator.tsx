interface StepIndicatorProps {
  currentStep: number; // 0-indexed
  totalSteps: number;
  label: string;
  onNavigate: (step: number) => void;
}

export default function StepIndicator({ currentStep, totalSteps, label, onNavigate }: StepIndicatorProps) {
  const getStepLabel = () => {
    if (currentStep === 0) return "Choose your issuance mode";
    return label;
  };

  return (
    <div className="flex items-center gap-4">
      <span className="text-sm font-medium text-gray-600">
        Step {currentStep + 1} of {totalSteps}: {getStepLabel()}
      </span>
      <div className="flex items-center gap-2">
        {Array.from({ length: totalSteps }, (_, i) => {
          const isActive = i === currentStep;
          const isClickable = i < currentStep;

          if (isActive) {
            return (
              <span
                key={i}
                className="w-[10px] h-[10px] rounded-full bg-[#0d9488]"
                aria-label={`Step ${i + 1} (current)`}
              />
            );
          }

          return (
            <button
              key={i}
              onClick={() => isClickable && onNavigate(i)}
              disabled={!isClickable}
              aria-label={`Step ${i + 1}`}
              className={`w-[8px] h-[8px] rounded-full border-[1.5px] border-[#cbd5e1] bg-transparent transition-all ${
                isClickable ? 'hover:border-[#0d9488] cursor-pointer' : 'cursor-default'
              }`}
            />
          );
        })}
      </div>
    </div>
  );
}
