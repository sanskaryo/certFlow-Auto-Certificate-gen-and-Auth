import { CsvFields, CsvRow } from '../types';
import { parseCsv } from '../utils';

interface CsvUploadFormProps {
  csv: CsvFields;
  onFileSelect: (file: File, rows: CsvRow[]) => void;
}

export default function CsvUploadForm({ csv, onFileSelect }: CsvUploadFormProps) {
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const text = ev.target?.result as string;
      const rows = parseCsv(text);
      onFileSelect(file, rows);
    };
    reader.readAsText(file);
  }

  const validCount = csv.parsedRows.filter(r => r.valid).length;
  const invalidCount = csv.parsedRows.filter(r => !r.valid).length;
  const previewRows = csv.parsedRows.slice(0, 10);
  const hasRows = csv.parsedRows.length > 0;

  return (
    <div className="space-y-4">
      <input
        type="file"
        accept=".csv"
        onChange={handleFileChange}
        className="text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-prime-50 file:text-prime-700 hover:file:bg-prime-100"
      />

      {hasRows && (
        <>
          <div className="flex gap-3 text-sm font-medium">
            <span className="text-green-600">{validCount} valid</span>
            {invalidCount > 0 && <span className="text-red-500">{invalidCount} invalid</span>}
          </div>

          {validCount === 0 ? (
            <p className="text-sm text-red-500">No valid recipients found.</p>
          ) : (
            <div className="overflow-x-auto max-h-64 overflow-y-auto rounded-lg border border-gray-200">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600">Row</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600">Name</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600">Email</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600">Role</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map(row => (
                    <tr
                      key={row.rowIndex}
                      className={row.valid ? 'bg-white' : 'bg-red-50'}
                    >
                      <td className="px-3 py-1.5 text-gray-500">{row.rowIndex}</td>
                      <td className="px-3 py-1.5">{row.name || '—'}</td>
                      <td className="px-3 py-1.5">{row.email || '—'}</td>
                      <td className="px-3 py-1.5">{row.role || '—'}</td>
                      <td className="px-3 py-1.5">
                        {row.valid ? (
                          <span className="text-green-600 font-medium">✓ Valid</span>
                        ) : (
                          <span className="text-red-600">{row.error}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {csv.parsedRows.length > 10 && (
                <p className="text-xs text-gray-400 px-3 py-2 border-t border-gray-100">
                  Showing 10 of {csv.parsedRows.length} rows
                </p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
