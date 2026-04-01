interface FormSectionProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

export default function FormSection({ title, subtitle, children }: FormSectionProps) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-bold text-studio-heading">{title}</h3>
        {subtitle && <p className="text-sm text-studio-muted mt-0.5">{subtitle}</p>}
      </div>
      <div>{children}</div>
    </div>
  );
}
