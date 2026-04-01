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

const PREVIEW_SCALE = 0.38;

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
    <div className="bg-white/90 backdrop-blur border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
      <details className="group" open>
        <summary className="cursor-pointer list-none px-5 py-4 font-bold text-gray-900 flex items-center justify-between gap-2 hover:bg-gray-50/80">
          <span className="flex items-center gap-2">
            <svg className="w-5 h-5 text-prime-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
            </svg>
            Full certificate layout
          </span>
          <span className="text-xs font-normal text-gray-400 group-open:rotate-180 transition">▼</span>
        </summary>
        <div className="px-5 pb-4 space-y-3 border-t border-gray-100">
          <p className="text-xs text-gray-500 leading-relaxed">
            Drag each highlighted block: logo, recipient name, event details, signature image, authority name, designation, and QR area.
            Changes auto-save to this event.
          </p>
          <div className="overflow-x-auto rounded-xl border border-dashed border-prime-200 bg-prime-50/30 p-2">
            <CertPreview
              data={previewData}
              scale={PREVIEW_SCALE}
              interactive
              onLayoutPatch={patchLayout}
              onLogoPosChange={onLogoPosChange}
            />
          </div>
        </div>
      </details>

      <details className="group border-t border-gray-100">
        <summary className="cursor-pointer list-none px-5 py-3 text-sm font-semibold text-gray-700 flex items-center justify-between hover:bg-gray-50/80">
          Text size (per region)
          <span className="text-xs text-gray-400 group-open:rotate-180 transition">▼</span>
        </summary>
        <div className="px-5 pb-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <label className="flex flex-col gap-1">
            <span className="font-medium text-gray-600">Recipient name</span>
            <input
              type="range"
              min={0.65}
              max={1.35}
              step={0.05}
              value={previewData.certificateLayout.recipientName.scale}
              onChange={e =>
                patchLayout({
                  recipientName: {
                    ...previewData.certificateLayout.recipientName,
                    scale: parseFloat(e.target.value),
                  },
                })
              }
              className="accent-prime-600"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-medium text-gray-600">Event & role block</span>
            <input
              type="range"
              min={0.65}
              max={1.35}
              step={0.05}
              value={previewData.certificateLayout.bodyBlock.scale}
              onChange={e =>
                patchLayout({
                  bodyBlock: { ...previewData.certificateLayout.bodyBlock, scale: parseFloat(e.target.value) },
                })
              }
              className="accent-prime-600"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-medium text-gray-600">Authority name</span>
            <input
              type="range"
              min={0.65}
              max={1.35}
              step={0.05}
              value={previewData.certificateLayout.authorityName.scale}
              onChange={e =>
                patchLayout({
                  authorityName: {
                    ...previewData.certificateLayout.authorityName,
                    scale: parseFloat(e.target.value),
                  },
                })
              }
              className="accent-prime-600"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-medium text-gray-600">Designation / title</span>
            <input
              type="range"
              min={0.65}
              max={1.35}
              step={0.05}
              value={previewData.certificateLayout.designation.scale}
              onChange={e =>
                patchLayout({
                  designation: {
                    ...previewData.certificateLayout.designation,
                    scale: parseFloat(e.target.value),
                  },
                })
              }
              className="accent-prime-600"
            />
          </label>
        </div>
      </details>

      <details className="group border-t border-gray-100">
        <summary className="cursor-pointer list-none px-5 py-3 text-sm font-semibold text-gray-700 flex items-center justify-between hover:bg-gray-50/80">
          Signature & QR size
          <span className="text-xs text-gray-400 group-open:rotate-180 transition">▼</span>
        </summary>
        <div className="px-5 pb-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <label className="flex flex-col gap-1">
            <span className="font-medium text-gray-600">Signature box width</span>
            <input
              type="range"
              min={0.12}
              max={0.4}
              step={0.01}
              value={previewData.certificateLayout.signature.w}
              onChange={e =>
                patchLayout({
                  signature: {
                    ...previewData.certificateLayout.signature,
                    w: parseFloat(e.target.value),
                  },
                })
              }
              className="accent-prime-600"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-medium text-gray-600">Signature box height</span>
            <input
              type="range"
              min={0.06}
              max={0.22}
              step={0.01}
              value={previewData.certificateLayout.signature.h}
              onChange={e =>
                patchLayout({
                  signature: {
                    ...previewData.certificateLayout.signature,
                    h: parseFloat(e.target.value),
                  },
                })
              }
              className="accent-prime-600"
            />
          </label>
          <label className="flex flex-col gap-1 sm:col-span-2">
            <span className="font-medium text-gray-600">QR block size</span>
            <input
              type="range"
              min={0.08}
              max={0.2}
              step={0.01}
              value={previewData.certificateLayout.qr.size}
              onChange={e =>
                patchLayout({
                  qr: { ...previewData.certificateLayout.qr, size: parseFloat(e.target.value) },
                })
              }
              className="accent-prime-600"
            />
          </label>
        </div>
      </details>
    </div>
  );
}
