import { BulkFields } from '../types';

interface BulkEntryFormProps {
  bulk: BulkFields;
  onTextChange: (text: string) => void;
}

export default function BulkEntryForm({ bulk, onTextChange }: BulkEntryFormProps) {
  const validCount = bulk.parsedLines.filter(l => l.valid).length;
  const invalidCount = bulk.parsedLines.filter(l => !l.valid).length;
  const errorLines = bulk.parsedLines
    .map((l, i) => ({ ...l, lineNum: i + 1 }))
    .filter(l => !l.valid);

  return (
    <div className="space-y-3">
      <textarea
        className="w-full font-mono text-sm border border-gray-200 rounded-lg px-3 py-2 min-h-40 resize-y focus:outline-none focus:ring-2 focus:ring-prime-400"
        placeholder={"Alice, alice@mail.com, Winner\nBob, bob@mail.com, Speaker"}
        value={bulk.rawText}
        onChange={e => onTextChange(e.target.value)}
      />

      {bulk.parsedLines.length > 0 && (
        <div className="flex gap-3 text-sm font-medium">
          <span className="text-green-600">{validCount} valid</span>
          {invalidCount > 0 && <span className="text-red-500">{invalidCount} invalid</span>}
        </div>
      )}

      {errorLines.length > 0 && (
        <ul className="space-y-1">
          {errorLines.map(l => (
            <li key={l.lineNum} className="text-xs text-red-600 bg-red-50 rounded px-2 py-1">
              Line {l.lineNum}: {l.error}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
