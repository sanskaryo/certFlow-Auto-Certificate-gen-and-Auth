import { useRef, useState } from 'react';
import FormSection from './FormSection';
import PrimaryButton from './PrimaryButton';
import { BrandingFields } from './types';
import LogoPositioner from '../../components/LogoPositioner';
import { API_BASE } from '../../lib/api';

interface Template {
  id: string;
  name: string;
  bg: string;
  title: string;
}

interface BrandingStepProps {
  branding: BrandingFields;
  templates: Template[];
  eventId: string;
  token: string | null;
  onBrandingChange: (patch: Partial<BrandingFields>) => void;
  onNotify: (msg: string, type: 'success' | 'error' | 'info') => void;
  onNext: () => void;
}

export default function BrandingStep({
  branding,
  templates,
  eventId,
  token,
  onBrandingChange,
  onNotify,
  onNext,
}: BrandingStepProps) {
  const logoInputRef = useRef<HTMLInputElement>(null);
  const sigInputRef = useRef<HTMLInputElement>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [sigUploading, setSigUploading] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);

  const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

  async function handleLogoUpload() {
    const file = logoInputRef.current?.files?.[0];
    if (!file) return;
    setLogoUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`${API_BASE}/events/${eventId}/logo`, {
        method: 'POST',
        headers,
        body: fd,
      });
      if (!res.ok) throw new Error('Upload failed');
      const previewUrl = URL.createObjectURL(file);
      onBrandingChange({ logoFile: file, logoPreviewUrl: previewUrl });
      onNotify('Logo uploaded successfully', 'success');
    } catch {
      onNotify('Logo upload failed', 'error');
    } finally {
      setLogoUploading(false);
    }
  }

  async function handleSigUpload() {
    const file = sigInputRef.current?.files?.[0];
    if (!file) return;
    setSigUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`${API_BASE}/events/${eventId}/signature`, {
        method: 'POST',
        headers,
        body: fd,
      });
      if (!res.ok) throw new Error('Upload failed');
      onNotify('Signature uploaded successfully', 'success');
    } catch {
      onNotify('Signature upload failed', 'error');
    } finally {
      setSigUploading(false);
    }
  }

  async function handleLogoPositionSave(pos: { x: number; y: number; size: number }) {
    onBrandingChange({ logoPos: pos });
    try {
      await fetch(`${API_BASE}/events/${eventId}/logo-position`, {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(pos),
      });
      onNotify('Logo position saved', 'success');
    } catch {
      onNotify('Failed to save logo position', 'error');
    }
  }

  async function handleGenerateAiTemplate() {
    if (!branding.aiPrompt.trim()) return;
    setAiGenerating(true);
    try {
      const res = await fetch(`${API_BASE}/events/${eventId}/ai-template`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: branding.aiPrompt }),
      });
      if (!res.ok) throw new Error('AI generation failed');
      onNotify('AI template generated', 'success');
    } catch {
      onNotify('AI template generation failed', 'error');
    } finally {
      setAiGenerating(false);
    }
  }

  const activeTemplate = templates.find(t => t.id === branding.templateId);

  return (
    <div className="space-y-6">
      {/* Template */}
      <FormSection title="Template" subtitle="Choose a certificate template">
        {/* Visual template grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
          {templates.map(t => {
            const isActive = branding.templateId === t.id;
            const isAi = t.id === 'ai-generated';
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onBrandingChange({ templateId: t.id })}
                className={`relative flex flex-col items-start p-2.5 rounded-lg border-2 text-left transition-all ${
                  isActive
                    ? 'border-prime-500 ring-1 ring-prime-400'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                style={{ background: isAi ? '#f8fafc' : (t.bg || '#f8fafc') }}
              >
                {!isAi && t.bg && (
                  <div className="flex gap-1 mb-1.5">
                    <span className="w-3 h-3 rounded-full" style={{ background: t.title || '#333' }} />
                    <span className="w-3 h-3 rounded-full" style={{ background: (t as any).accent || '#999' }} />
                  </div>
                )}
                {isAi && <span className="text-base mb-1">✨</span>}
                <span
                  className="text-xs font-semibold leading-tight truncate w-full"
                  style={{ color: isAi ? '#374151' : (t.title || '#374151') }}
                >
                  {t.name}
                </span>
                {isActive && (
                  <span className="absolute top-1 right-1 w-4 h-4 bg-prime-500 rounded-full flex items-center justify-center">
                    <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 10 10" fill="none">
                      <path d="M2 5l2.5 2.5 3.5-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {branding.templateId === 'ai-generated' && (
          <div className="mt-3 space-y-2">
            <textarea
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-prime-400 min-h-[80px] resize-none"
              placeholder="Describe the certificate style you want..."
              value={branding.aiPrompt}
              onChange={e => onBrandingChange({ aiPrompt: e.target.value })}
            />
            <button
              type="button"
              onClick={handleGenerateAiTemplate}
              disabled={aiGenerating || !branding.aiPrompt.trim()}
              className="px-4 py-2 bg-prime-600 hover:bg-prime-700 text-white text-sm font-semibold rounded-lg transition disabled:opacity-60"
            >
              {aiGenerating ? 'Generating...' : 'Generate AI Template'}
            </button>
          </div>
        )}
      </FormSection>

      {/* Logo */}
      <FormSection title="Logo" subtitle="Upload your organization logo">
        <div className="flex items-center gap-3">
          <input
            ref={logoInputRef}
            type="file"
            accept="image/*"
            className="flex-1 text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-prime-50 file:text-prime-700 hover:file:bg-prime-100"
          />
          <button
            type="button"
            onClick={handleLogoUpload}
            disabled={logoUploading}
            className="px-4 py-2 bg-prime-600 hover:bg-prime-700 text-white text-sm font-semibold rounded-lg transition disabled:opacity-60 whitespace-nowrap"
          >
            {logoUploading ? 'Uploading...' : 'Upload'}
          </button>
        </div>

        {branding.logoPreviewUrl && (
          <div className="mt-4">
            <p className="text-xs font-semibold text-gray-500 mb-2">Position Logo</p>
            <LogoPositioner
              logoUrl={branding.logoPreviewUrl}
              initial={branding.logoPos}
              onChange={pos => onBrandingChange({ logoPos: pos })}
              onSave={handleLogoPositionSave}
              templateColor={activeTemplate?.bg}
            />
          </div>
        )}
      </FormSection>

      {/* Signature */}
      <FormSection title="Signature" subtitle="Upload authority signature (optional)">
        <div className="flex items-center gap-3">
          <input
            ref={sigInputRef}
            type="file"
            accept="image/*"
            className="flex-1 text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-prime-50 file:text-prime-700 hover:file:bg-prime-100"
          />
          <button
            type="button"
            onClick={handleSigUpload}
            disabled={sigUploading}
            className="px-4 py-2 bg-prime-600 hover:bg-prime-700 text-white text-sm font-semibold rounded-lg transition disabled:opacity-60 whitespace-nowrap"
          >
            {sigUploading ? 'Uploading...' : 'Upload'}
          </button>
        </div>
      </FormSection>

      <PrimaryButton label="Next: Recipient Details" onClick={onNext} />
    </div>
  );
}
