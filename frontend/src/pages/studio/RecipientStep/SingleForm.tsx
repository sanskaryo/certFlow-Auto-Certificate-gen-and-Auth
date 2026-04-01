import FormSection from '../FormSection';
import InlineValidator from '../InlineValidator';
import { SingleFields, ValidationErrors } from '../types';

interface SingleFormProps {
  single: SingleFields;
  errors: ValidationErrors;
  eventName: string;
  onChange: (field: keyof SingleFields, value: string) => void;
}

const ROLES = ['Winner', 'Volunteer', 'Participant', 'Speaker', 'Organizer'];

export default function SingleForm({ single, errors, eventName, onChange }: SingleFormProps) {
  return (
    <div className="space-y-6">
      <FormSection title="Recipient Info">
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              Participant Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={single.participant_name}
              onChange={e => onChange('participant_name', e.target.value)}
              placeholder="Full name"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-prime-400"
            />
            <InlineValidator error={errors.participant_name ?? null} />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Email (optional)</label>
            <input
              type="email"
              value={single.email}
              onChange={e => onChange('email', e.target.value)}
              placeholder="recipient@example.com"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-prime-400"
            />
            <InlineValidator error={errors.email ?? null} />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Role</label>
            <select
              value={single.role}
              onChange={e => onChange('role', e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-prime-400"
            >
              <option value="">Select role...</option>
              {ROLES.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
        </div>
      </FormSection>

      <FormSection title="Event Info">
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Event Name</label>
            <input
              type="text"
              value={eventName}
              readOnly
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-500 cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Organization</label>
            <input
              type="text"
              value={single.organization}
              onChange={e => onChange('organization', e.target.value)}
              placeholder="Organizing body"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-prime-400"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              Issue Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={single.date_text}
              onChange={e => onChange('date_text', e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-prime-400"
            />
            <InlineValidator error={errors.date_text ?? null} />
          </div>
        </div>
      </FormSection>
    </div>
  );
}
