interface StepIndicatorProps {
  currentStep: number; // 0-indexed
  totalSteps: number;
  label: string;
  onNavigate: (step: number) => void;
}

export default function StepIndicator({ currentStep, totalSteps, label, onNavigate }: StepIndicatorProps) {
  return (
    <div className="flex items-center gap-4">
      <span className="text-sm font-medium text-studio-label">
        Step {currentStep + 1} of {totalSteps} — {label}
      </span>
      <div className="flex items-center gap-2">
        {Array.from({ length: totalSteps }, (_, i) => {
          const isActive = i === currentStep;
          const isClickable = i < currentStep;

          if (isClickable) {
            return (
              <button
                key={i}
                onClick={() => onNavigate(i)}
                aria-label={`Go to step ${i + 1}`}
                className="w-2.5 h-2.5 rounded-full bg-prime-400 hover:bg-prime-600 transition-colors cursor-pointer"
              />
            );
          }

          return (
            <span
              key={i}
              aria-label={`Step ${i + 1}${isActive ? ' (current)' : ''}`}
              className={`w-2.5 h-2.5 rounded-full ${
                isActive ? 'bg-prime-600' : 'bg-studio-border'
              }`}
            />
          );
        })}
      </div>
    </div>
  );
}
