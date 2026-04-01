import PrimaryButton from './PrimaryButton';
import ProgressBar from './ProgressBar';
import { StudioState } from './types';

interface ConfirmationStepProps {
  state: StudioState;
  eventData: any;
  onGoToStep: (step: number) => void;
  onGenerate: () => void;
  isGenerating: boolean;
  progress: { total: number; success: number; failed: number } | null;
}

interface SummaryRow {
  field: string;
  value: string;
  step: number;
}

export default function ConfirmationStep({
  state,
  eventData: _eventData,
  onGoToStep,
  onGenerate,
  isGenerating,
  progress,
}: ConfirmationStepProps) {
  const recipientValue =
    state.mode === 'single'
      ? state.single.participant_name || '—'
      : state.mode === 'bulk'
      ? `${state.bulk.parsedLines.filter(l => l.valid).length} recipient(s)`
      : `${state.csv.parsedRows.filter(r => r.valid).length} recipient(s)`;

  const rows: SummaryRow[] = [
    { field: 'Mode', value: state.mode, step: 0 },
    { field: 'Recipient(s)', value: recipientValue, step: 2 },
    { field: 'Template', value: state.branding.templateId || '—', step: 1 },
    { field: 'Authority', value: state.authority.name || '—', step: 3 },
    { field: 'Position', value: state.authority.position || '—', step: 3 },
    { field: 'Organisation', value: state.single.organization || '—', step: 2 },
    { field: 'Issue Date', value: state.single.date_text || '—', step: 2 },
  ];

  const isBulk = state.mode !== 'single';
  const ctaLabel = isBulk ? 'Generate All Certificates' : 'Generate Certificate';

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-xl border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2.5 text-left font-semibold text-gray-600">Field</th>
              <th className="px-4 py-2.5 text-left font-semibold text-gray-600">Value</th>
              <th className="px-4 py-2.5 text-right font-semibold text-gray-600">Edit</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map(row => (
              <tr key={row.field} className="bg-white">
                <td className="px-4 py-2.5 text-gray-500 font-medium">{row.field}</td>
                <td className="px-4 py-2.5 text-gray-800">{row.value}</td>
                <td className="px-4 py-2.5 text-right">
                  <button
                    type="button"
                    onClick={() => onGoToStep(row.step)}
                    className="text-prime-600 hover:text-prime-700 text-xs font-semibold"
                  >
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isGenerating && progress && (
        <ProgressBar
          total={progress.total}
          success={progress.success}
          failed={progress.failed}
        />
      )}

      <PrimaryButton
        label={ctaLabel}
        onClick={onGenerate}
        loading={isGenerating}
        disabled={isGenerating}
      />
    </div>
  );
}
