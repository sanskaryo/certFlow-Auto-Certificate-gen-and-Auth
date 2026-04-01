import type { ChecklistItem } from './types';

interface FieldChecklistProps {
  items: ChecklistItem[];
}

export default function FieldChecklist({ items }: FieldChecklistProps) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-studio-label uppercase tracking-wide mb-3">
        Certificate Status
      </p>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.label} className="flex items-center gap-2">
            {item.filled ? (
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-success flex items-center justify-center">
                <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
                  <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            ) : (
              <span className="flex-shrink-0 w-5 h-5 rounded-full border-2 border-studio-muted" />
            )}
            <span className={item.filled ? 'text-sm text-studio-heading' : 'text-sm text-studio-muted'}>
              {item.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
