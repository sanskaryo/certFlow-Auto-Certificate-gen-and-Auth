import { useRef, useState } from 'react';
import FormSection from './FormSection';
import InlineValidator from './InlineValidator';
import PrimaryButton from './PrimaryButton';
import { AuthorityFields, ValidationErrors } from './types';
import { API_BASE } from '../../lib/api';

interface AuthorityStepProps {
  authority: AuthorityFields;
  errors: ValidationErrors;
  eventId: string;
  token: string | null;
  onAuthorityChange: (patch: Partial<AuthorityFields>) => void;
  onNotify: (msg: string, type: 'success' | 'error' | 'info') => void;
  onNext: () => void;
}

export default function AuthorityStep({
  authority,
  errors,
  eventId,
  token,
  onAuthorityChange,
  onNotify,
  onNext,
}: AuthorityStepProps) {
  const sigInputRef = useRef<HTMLInputElement>(null);
  const sig2InputRef = useRef<HTMLInputElement>(null);
  const [sigUploading, setSigUploading] = useState(false);
  const [sig2Uploading, setSig2Uploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

  async function handleSigUpload(key: string = 'signature_path') {
    const file = key === 'signature_path' ? sigInputRef.current?.files?.[0] : sig2InputRef.current?.files?.[0];
    if (!file) return;
    
    if (key === 'signature_path') setSigUploading(true);
    else setSig2Uploading(true);

    try {
      const fd = new FormData();
      fd.append('file', file);
      const url = new URL(`${API_BASE}/events/${eventId}/signature`);
      if (key !== 'signature_path') url.searchParams.append('key', key);
      
      const res = await fetch(url.toString(), {
        method: 'POST',
        headers,
        body: fd,
      });
      if (!res.ok) throw new Error('Upload failed');
      const previewUrl = URL.createObjectURL(file);
      
      if (key === 'signature_path') {
        onAuthorityChange({ sigFile: file, sigPreviewUrl: previewUrl });
      } else {
        onAuthorityChange({ sigPreviewUrl2: previewUrl });
      }
      onNotify('Signature uploaded successfully', 'success');
    } catch {
      onNotify('Signature upload failed', 'error');
    } finally {
      if (key === 'signature_path') setSigUploading(false);
      else setSig2Uploading(false);
    }
  }

  async function handleSaveAuthority() {
    setSaving(true);
    try {
      const payload: any = {
        authority_name: authority.name,
        authority_position: authority.position,
      };
      // Send secondary directly if possible or we wait for an expanded save endpoint.
      // Wait, let's just save additional_signatures.name2 and additional_signatures.position2 
      // The current PATCH /authority only accepts authority_name and authority_position.
      // Let's modify the PATCH payload to allow optional secondary fields.
      const res = await fetch(`${API_BASE}/events/${eventId}/authority`, {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          authority_name: authority.name,
          authority_position: authority.position,
          authority_name2: authority.name2,
          authority_position2: authority.position2,
        }),
      });
      if (!res.ok) throw new Error('Save failed');
      onNotify('Authority saved', 'success');
    } catch {
      onNotify('Failed to save authority', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <FormSection title="Authority" subtitle="Who is issuing this certificate?">
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              Authority Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={authority.name}
              onChange={e => onAuthorityChange({ name: e.target.value })}
              placeholder="e.g. Dr. Jane Smith"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-prime-400"
            />
            <InlineValidator error={errors.authority_name ?? null} />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              Authority Position <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={authority.position}
              onChange={e => onAuthorityChange({ position: e.target.value })}
              placeholder="e.g. Director of Programs"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-prime-400"
            />
            <InlineValidator error={errors.authority_position ?? null} />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Signature</label>
            <div className="flex items-center gap-3">
              <input
                ref={sigInputRef}
                type="file"
                accept="image/*"
                className="flex-1 text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-prime-50 file:text-prime-700 hover:file:bg-prime-100"
              />
              <button
                type="button"
                onClick={() => handleSigUpload()}
                disabled={sigUploading}
                className="px-4 py-2 bg-prime-600 hover:bg-prime-700 text-white text-sm font-semibold rounded-lg transition disabled:opacity-60 whitespace-nowrap"
              >
                {sigUploading ? 'Uploading...' : 'Upload'}
              </button>
            </div>

            {authority.sigPreviewUrl && (
              <div className="mt-3">
                <p className="text-xs font-semibold text-gray-500 mb-1">Signature Preview</p>
                <img
                  src={authority.sigPreviewUrl}
                  alt="Signature preview"
                  className="max-h-20 border border-gray-200 rounded-lg p-2 bg-white object-contain"
                />
              </div>
            )}
          </div>
        </div>
      </FormSection>

      <FormSection title="Secondary Signatory" subtitle="Optional secondary authority">
         <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                Secondary Name
              </label>
              <input
                type="text"
                value={authority.name2 || ''}
                onChange={e => onAuthorityChange({ name2: e.target.value })}
                placeholder="e.g. Prof. John Doe"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-prime-400"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                Secondary Position
              </label>
              <select
                value={authority.position2 || ''}
                onChange={e => onAuthorityChange({ position2: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-prime-400 bg-white"
              >
                 <option value="">-- Select or Type Custom --</option>
                 <option value="Director">Director</option>
                 <option value="Coordinator">Coordinator</option>
                 <option value="Dean">Dean</option>
                 <option value="Principal">Principal</option>
                 <option value="Organizer">Organizer</option>
                 <option value="Judge">Judge</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Secondary Signature</label>
              <div className="flex items-center gap-3">
                <input
                  ref={sig2InputRef}
                  type="file"
                  accept="image/*"
                  className="flex-1 text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-prime-50 file:text-prime-700 hover:file:bg-prime-100"
                />
                <button
                  type="button"
                  onClick={() => handleSigUpload('signature_path2')}
                  disabled={sig2Uploading}
                  className="px-4 py-2 bg-prime-600 hover:bg-prime-700 text-white text-sm font-semibold rounded-lg transition disabled:opacity-60 whitespace-nowrap"
                >
                  {sig2Uploading ? 'Uploading...' : 'Upload'}
                </button>
              </div>

              {authority.sigPreviewUrl2 && (
                <div className="mt-3">
                  <p className="text-xs font-semibold text-gray-500 mb-1">Signature 2 Preview</p>
                  <img
                    src={authority.sigPreviewUrl2}
                    alt="Signature preview"
                    className="max-h-20 border border-gray-200 rounded-lg p-2 bg-white object-contain bg-checkered"
                  />
                </div>
              )}
            </div>
         </div>
      </FormSection>

      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={handleSaveAuthority}
          disabled={saving}
          className="w-full border border-prime-500 text-prime-600 hover:bg-prime-50 font-semibold py-2.5 rounded-xl transition text-sm disabled:opacity-60"
        >
          {saving ? 'Saving...' : 'Save Authority'}
        </button>
        <PrimaryButton label="Next: Preview & Confirm" onClick={onNext} />
      </div>
    </div>
  );
}
