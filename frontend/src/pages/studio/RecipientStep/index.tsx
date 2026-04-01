import PrimaryButton from '../PrimaryButton';
import { Mode, SingleFields, BulkFields, CsvFields, CsvRow, ValidationErrors } from '../types';
import SingleForm from './SingleForm';
import BulkEntryForm from './BulkEntryForm';
import CsvUploadForm from './CsvUploadForm';

interface RecipientStepProps {
  mode: Mode;
  single: SingleFields;
  bulk: BulkFields;
  csv: CsvFields;
  errors: ValidationErrors;
  eventName: string;
  onSingleChange: (field: keyof SingleFields, value: string) => void;
  onBulkTextChange: (text: string) => void;
  onCsvFileSelect: (file: File, rows: CsvRow[]) => void;
  onNext: () => void;
}

export default function RecipientStep({
  mode,
  single,
  bulk,
  csv,
  errors,
  eventName,
  onSingleChange,
  onBulkTextChange,
  onCsvFileSelect,
  onNext,
}: RecipientStepProps) {
  return (
    <div className="space-y-6">
      {mode === 'single' && (
        <SingleForm
          single={single}
          errors={errors}
          eventName={eventName}
          onChange={onSingleChange}
        />
      )}
      {mode === 'bulk' && (
        <BulkEntryForm bulk={bulk} onTextChange={onBulkTextChange} />
      )}
      {mode === 'csv' && (
        <CsvUploadForm csv={csv} onFileSelect={onCsvFileSelect} />
      )}

      <PrimaryButton label="Next: Authority & Branding" onClick={onNext} />
    </div>
  );
}
