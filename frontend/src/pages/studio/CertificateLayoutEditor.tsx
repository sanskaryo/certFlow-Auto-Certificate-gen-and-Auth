import { useEffect, useRef } from 'react';
import type { PreviewData, CertificateLayout } from './types';
import type { StudioAction } from './types';
import CertPreview from './CertPreview';
import { API_BASE } from '../../lib/api';

interface CertificateLayoutEditorProps {
  eventId: string;
  previewData: PreviewData;
  dispatch: React.Dispatch<StudioAction>;
  authHeaders: Record<string, string>;
  onNotify: (msg: string, type: 'success' | 'error' | 'info') => void;
}



export default function CertificateLayoutEditor({
  eventId,
  previewData,
  dispatch,
  authHeaders,
  onNotify,
}: CertificateLayoutEditorProps) {
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSaved = useRef<string>('');
  const skipFirstSave = useRef(true);

  const patchLayout = (patch: Partial<CertificateLayout>) => {
    dispatch({ type: 'UPDATE_CERTIFICATE_LAYOUT', patch });
  };

  const onLogoPosChange = (logoPos: PreviewData['logoPos']) => {
    dispatch({ type: 'UPDATE_BRANDING', patch: { logoPos } });
  };

  useEffect(() => {
    const payload = JSON.stringify({
      certificate_layout: previewData.certificateLayout,
      logo_position: previewData.logoPos,
    });
    if (skipFirstSave.current) {
      skipFirstSave.current = false;
      lastSaved.current = payload;
      return;
    }
    if (payload === lastSaved.current) return;

    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`${API_BASE}/events/${eventId}/certificate-layout`, {
          method: 'PATCH',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            certificate_layout: previewData.certificateLayout,
            logo_position: previewData.logoPos,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.detail || 'Save failed');
        }
        lastSaved.current = payload;
      } catch (e: unknown) {
        onNotify(e instanceof Error ? e.message : 'Layout save failed', 'error');
      }
    }, 1400);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [eventId, previewData.certificateLayout, previewData.logoPos, authHeaders, onNotify]);

  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-xl overflow-hidden ring-1 ring-black/5">
      {/* Visual Editor Section */}
      <details className="group border-b border-gray-100">
        <summary className="px-6 py-5 bg-gradient-to-r from-prime-50 to-white flex items-center justify-between cursor-pointer list-none hover:bg-gray-50/80 transition-all">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-prime-100 rounded-lg text-prime-600 group-open:bg-prime-600 group-open:text-white transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
              </svg>
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-lg">Visual Canvas</h3>
              <p className="text-xs text-gray-500 font-medium">Click to expand manual positioning</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <svg className="w-5 h-5 text-gray-400 group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </summary>

        <div className="p-6 border-t border-gray-100 bg-white">
          <div className="relative group rounded-3xl border-2 border-dashed border-prime-100 bg-gray-50/50 p-4 transition-all hover:border-prime-200">
            <div className="w-full">
              <CertPreview
                data={previewData}
                interactive
                onLayoutPatch={patchLayout}
                onLogoPosChange={onLogoPosChange}
              />
            </div>
            {/* Context help tooltip that fades in */}
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-all bg-gray-900/80 backdrop-blur-sm text-white text-[10px] px-2 py-1 rounded-md mb-2 pointer-events-none">
              Hover & Drag elements
            </div>
          </div>
          <p className="text-[10px] text-gray-400 mt-4 text-center italic">Changes to element positions are saved automatically.</p>
        </div>
      </details>

      {/* Property Adjustments */}
      <div className="divide-y divide-gray-50 bg-white">
        {/* Region Scaling */}
        <details className="group">
          <summary className="flex items-center justify-between cursor-pointer list-none px-6 py-4 hover:bg-gray-50 transition-colors">
            <div className="flex items-center gap-3">
              <svg className="w-4 h-4 text-gray-400 group-open:text-prime-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
              <span className="text-sm font-bold text-gray-700">Text Region Scaling</span>
            </div>
            <svg className="w-4 h-4 text-gray-400 group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
            </svg>
          </summary>

          <div className="px-6 pb-6 pt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5">
            {[
              { id: 'recipientName', label: 'Recipient Name' },
              { id: 'bodyBlock', label: 'Event Details & Role' },
              { id: 'authorityName', label: 'Authority Name' },
              { id: 'designation', label: 'Designation / Title' }
            ].map(ctrl => (
              <label key={ctrl.id} className="flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-gray-600 uppercase tracking-tight">{ctrl.label}</span>
                  <span className="text-[10px] font-mono text-prime-500 bg-prime-50 px-1.5 rounded">
                    {((previewData.certificateLayout as any)[ctrl.id].scale * 100).toFixed(0)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0.5}
                  max={1.5}
                  step={0.05}
                  value={(previewData.certificateLayout as any)[ctrl.id].scale}
                  onChange={e => patchLayout({ [ctrl.id]: { ...(previewData.certificateLayout as any)[ctrl.id], scale: parseFloat(e.target.value) } })}
                  className="w-full h-1.5 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-prime-600 hover:accent-prime-700 transition-all"
                />
              </label>
            ))}
          </div>
        </details>

        {/* Global Components */}
        <details className="group">
          <summary className="flex items-center justify-between cursor-pointer list-none px-6 py-4 hover:bg-gray-50 transition-colors">
            <div className="flex items-center gap-3">
              <svg className="w-4 h-4 text-gray-400 group-open:text-prime-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h2M4 8h16" />
              </svg>
              <span className="text-sm font-bold text-gray-700">Signature & Extras</span>
            </div>
            <svg className="w-4 h-4 text-gray-400 group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
            </svg>
          </summary>

          <div className="px-6 pb-6 pt-2 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5">
              <label className="flex flex-col gap-2">
                <span className="text-xs font-bold text-gray-600 uppercase tracking-tight">Sig Box Width</span>
                <input
                  type="range" min={0.10} max={0.5} step={0.01}
                  value={previewData.certificateLayout.signature.w}
                  onChange={e => patchLayout({ signature: { ...previewData.certificateLayout.signature, w: parseFloat(e.target.value) } })}
                  className="w-full h-1.5 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-prime-600"
                />
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-xs font-bold text-gray-600 uppercase tracking-tight">Sig Box Height</span>
                <input
                  type="range" min={0.05} max={0.3} step={0.01}
                  value={previewData.certificateLayout.signature.h}
                  onChange={e => patchLayout({ signature: { ...previewData.certificateLayout.signature, h: parseFloat(e.target.value) } })}
                  className="w-full h-1.5 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-prime-600"
                />
              </label>
              <label className="flex flex-col gap-2 sm:col-span-2">
                <span className="text-xs font-bold text-gray-600 uppercase tracking-tight">Verification QR Scale</span>
                <input
                  type="range" min={0.05} max={0.25} step={0.01}
                  value={previewData.certificateLayout.qr.size}
                  onChange={e => patchLayout({ qr: { ...previewData.certificateLayout.qr, size: parseFloat(e.target.value) } })}
                  className="w-full h-1.5 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-prime-600"
                />
              </label>
            </div>
            <div className="bg-prime-50 border border-prime-100 rounded-xl p-4 flex items-center gap-3">
              <svg className="w-5 h-5 text-prime-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-[11px] text-prime-700 leading-tight">These dimensions are saved automatically. Larger boxes allow for higher resolution uploads.</p>
            </div>
          </div>
        </details>
      </div>
    </div>
  );
}
