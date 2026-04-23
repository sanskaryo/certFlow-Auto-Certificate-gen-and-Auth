import { useRef, useState } from 'react';
import PrimaryButton from './PrimaryButton';
import { BrandingFields } from './types';
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
  const logo2InputRef = useRef<HTMLInputElement>(null);
  const watermarkInputRef = useRef<HTMLInputElement>(null);

  const [aiGenerating, setAiGenerating] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logo2Uploading, setLogo2Uploading] = useState(false);
  const [watermarkUploading, setWatermarkUploading] = useState(false);

  const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

  async function handleLogoUpload(key: string = 'logo_path') {
    let file: File | undefined;
    if (key === 'logo_path') file = logoInputRef.current?.files?.[0];
    else if (key === 'logo2') file = logo2InputRef.current?.files?.[0];
    else if (key === 'watermark') file = watermarkInputRef.current?.files?.[0];

    if (!file) return;

    if (key === 'logo_path') setLogoUploading(true);
    else if (key === 'logo2') setLogo2Uploading(true);
    else if (key === 'watermark') setWatermarkUploading(true);

    try {
      const fd = new FormData();
      fd.append('file', file);
      
      const url = new URL(`${API_BASE}/events/${eventId}/logo`);
      if (key !== 'logo_path') url.searchParams.append('key', key);

      const res = await fetch(url.toString(), {
        method: 'POST',
        headers,
        body: fd,
      });

      if (!res.ok) {
        throw new Error('Logo upload failed');
      }

      const previewUrl = URL.createObjectURL(file);
      
      if (key === 'logo_path') {
          onBrandingChange({ logoFile: file, logoPreviewUrl: previewUrl });
      } else if (key === 'logo2') {
          onBrandingChange({ logo2Url: previewUrl });
      } else if (key === 'watermark') {
          onBrandingChange({ watermarkUrl: previewUrl });
      }
      onNotify(`${key} uploaded successfully`, 'success');
    } catch {
      onNotify('Upload failed', 'error');
    } finally {
      if (key === 'logo_path') setLogoUploading(false);
      else if (key === 'logo2') setLogo2Uploading(false);
      else if (key === 'watermark') setWatermarkUploading(false);
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


  return (
    <div className="space-y-6">
      {/* Template */}
      <details className="group border border-gray-200 rounded-xl bg-white shadow-sm overflow-hidden">
        <summary className="font-bold text-gray-800 px-5 py-4 cursor-pointer hover:bg-gray-50 flex justify-between items-center list-none">
           <div>
              Template
              <p className="text-xs text-gray-400 mt-0.5 font-normal">Choose a certificate template</p>
           </div>
           <span className="text-gray-400 group-open:rotate-180 transition-transform">▼</span>
        </summary>
        <div className="px-5 pb-5 pt-2 border-t border-gray-100">
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
        </div>
      </details>

      {/* Logo */}
      {/* Logo */}
      <details className="group border border-gray-200 rounded-xl bg-white shadow-sm overflow-hidden">
        <summary className="font-bold text-gray-800 px-5 py-4 cursor-pointer hover:bg-gray-50 flex justify-between items-center list-none">
           <div>
              Logo
              <p className="text-xs text-gray-400 mt-0.5 font-normal">Upload your organization logo</p>
           </div>
           <span className="text-gray-400 group-open:rotate-180 transition-transform">▼</span>
        </summary>
        <div className="px-5 pb-5 pt-2 border-t border-gray-100">
          <div className="flex items-center gap-3">
            <input
              ref={logoInputRef}
              type="file"
              accept="image/*"
              className="flex-1 text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-prime-50 file:text-prime-700 hover:file:bg-prime-100"
            />
            <button
              type="button"
              onClick={() => handleLogoUpload()}
              disabled={logoUploading}
              className="px-4 py-2 bg-prime-600 hover:bg-prime-700 text-white text-sm font-semibold rounded-lg transition disabled:opacity-60 whitespace-nowrap"
            >
              {logoUploading ? 'Uploading...' : 'Upload Primary'}
            </button>
          </div>

          <div className="mt-6 flex items-center gap-3 border-t border-gray-100 pt-4">
            <input
              ref={logo2InputRef}
              type="file"
              accept="image/*"
              className="flex-1 text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
            />
            <button
              type="button"
              onClick={() => handleLogoUpload('logo2')}
              disabled={logo2Uploading}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white text-sm font-semibold rounded-lg transition disabled:opacity-60 whitespace-nowrap"
            >
              {logo2Uploading ? 'Uploading...' : 'Upload Secondary Logo'}
            </button>
          </div>
          
          <div className="mt-6 flex items-center gap-3 border-t border-gray-100 pt-4">
            <input
              ref={watermarkInputRef}
              type="file"
              accept="image/*"
              className="flex-1 text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
            />
            <button
              type="button"
              onClick={() => handleLogoUpload('watermark')}
              disabled={watermarkUploading}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white text-sm font-semibold rounded-lg transition disabled:opacity-60 whitespace-nowrap"
            >
              {watermarkUploading ? 'Uploading...' : 'Upload Watermark'}
            </button>
          </div>

          <p className="text-xs text-gray-500 mt-4 leading-relaxed bg-blue-50 p-2 rounded border border-blue-100">
             Logos can be resized, positioned, rotated, and framed visually in the "Design Studio" step.
          </p>
        </div>
      </details>

      <PrimaryButton label="Next: Recipient Details" onClick={onNext} />
    </div>
  );
}
