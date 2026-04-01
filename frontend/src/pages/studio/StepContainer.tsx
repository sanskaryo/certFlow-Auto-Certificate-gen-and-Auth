interface StepContainerProps {
  children: React.ReactNode;
}

export default function StepContainer({ children }: StepContainerProps) {
  return (
    <div className="p-6 bg-white rounded-2xl border border-studio-border shadow-sm animate-slideUp">
      {children}
    </div>
  );
}
