import { Mode } from './types';

interface ModeSelectorProps {
  activeMode: Mode;
  onSelect: (mode: Mode) => void;
}

const MODES: { mode: Mode; icon: string; title: string; description: string }[] = [
  {
    mode: 'single',
    icon: '👤',
    title: 'Single Certificate',
    description: 'Issue a certificate to one recipient',
  },
  {
    mode: 'bulk',
    icon: '📋',
    title: 'Bulk Entry',
    description: 'Paste a list of recipients manually',
  },
  {
    mode: 'csv',
    icon: '📂',
    title: 'CSV Upload',
    description: 'Upload a CSV file with recipient data',
  },
];

export default function ModeSelector({ activeMode, onSelect }: ModeSelectorProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {MODES.map(({ mode, icon, title, description }) => {
        const isActive = activeMode === mode;
        return (
          <button
            key={mode}
            type="button"
            onClick={() => onSelect(mode)}
            className={`flex flex-col items-start gap-2 p-4 rounded-xl border-2 text-left transition-all ${
              isActive
                ? 'border-teal-500 bg-teal-50'
                : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
            }`}
          >
            <span className="text-2xl">{icon}</span>
            <div>
              <p className={`font-semibold text-sm ${isActive ? 'text-teal-700' : 'text-gray-800'}`}>
                {title}
              </p>
              <p className={`text-xs mt-0.5 ${isActive ? 'text-teal-600' : 'text-gray-500'}`}>
                {description}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
