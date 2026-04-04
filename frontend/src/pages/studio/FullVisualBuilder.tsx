import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { PreviewData, CertificateLayout, LogoPos, StudioAction } from './types';
import { API_BASE } from '../../lib/api';

const W = 794;
const H = 561;

interface FullVisualBuilderProps {
  eventId: string;
  previewData: PreviewData | null;
  dispatch: React.Dispatch<StudioAction>;
  authHeaders: Record<string, string>;
  onNotify: (msg: string, type: 'success' | 'error' | 'info') => void;
}

type DragKey =
  | 'logo'
  | 'signature'
  | 'authorityName'
  | 'designation'
  | 'recipientName'
  | 'bodyBlock'
  | 'qr';

export default function FullVisualBuilder({
  eventId,
  previewData,
  dispatch,
  authHeaders,
  onNotify,
}: FullVisualBuilderProps) {
  const [selectedElement, setSelectedElement] = useState<DragKey | null>(null);
  const [dragging, setDragging] = useState<DragKey | null>(null);
  const [resizing, setResizing] = useState<DragKey | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const dragSnap = useRef<any>(null);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSaved = useRef<string>('');

  useEffect(() => {
    if (!previewData) return;
    const payload = JSON.stringify({
      certificate_layout: previewData.certificateLayout,
      logo_position: previewData.logoPos,
    });
    if (!lastSaved.current) {
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
        if (!res.ok) throw new Error('Save failed');
        lastSaved.current = payload;
      } catch (e: unknown) {
        onNotify('Layout save failed', 'error');
      }
    }, 1000);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [eventId, previewData, authHeaders, onNotify]);

  const patchLayout = useCallback((patch: Partial<CertificateLayout>) => {
    dispatch({ type: 'UPDATE_CERTIFICATE_LAYOUT', patch });
  }, [dispatch]);

  const onLogoPosChange = useCallback((logoPos: LogoPos) => {
    dispatch({ type: 'UPDATE_BRANDING', patch: { logoPos } });
  }, [dispatch]);

  const toLocal = useCallback((clientX: number, clientY: number) => {
    const el = wrapRef.current;
    if (!el) return { nx: 0, ny: 0 };
    const r = el.getBoundingClientRect();
    return {
      nx: Math.max(0, Math.min(1, (clientX - r.left) / r.width)),
      ny: Math.max(0, Math.min(1, (clientY - r.top) / r.height)),
    };
  }, []);

  const onPointerMove = useCallback((e: PointerEvent) => {
    if ((!dragging && !resizing) || !dragSnap.current || !previewData) return;
    const { nx, ny } = toLocal(e.clientX, e.clientY);
    const s = dragSnap.current;
    const dx = nx - s.nx0;
    const dy = ny - s.ny0;

    if (resizing) {
      const delta = Math.abs(dx) > Math.abs(dy) ? dx : dy;
      if (resizing === 'logo') {
        onLogoPosChange({
          ...s.logo,
          size: Math.max(0.05, Math.min(0.5, s.logo.size + delta))
        });
      } else if (resizing === 'signature') {
        patchLayout({
          signature: {
            ...s.signature,
            w: Math.max(0.1, Math.min(0.6, s.signature.w + dx)),
            h: Math.max(0.05, Math.min(0.4, s.signature.h + dy))
          }
        });
      } else if (resizing === 'qr') {
        patchLayout({
          qr: { ...s.qr, size: Math.max(0.05, Math.min(0.3, s.qr.size + delta)) }
        });
      } else {
        // Text elements use scale
        const item = s[resizing];
        patchLayout({
          [resizing]: { ...item, scale: Math.max(0.4, Math.min(3, item.scale + delta * 2)) }
        });
      }
      return;
    }

    if (dragging === 'logo') {
      onLogoPosChange({
        ...s.logo,
        x: Math.max(0, Math.min(1 - s.logo.size, s.logo.x + dx)),
        y: Math.max(0, Math.min(1, s.logo.y - dy)),
      });
      return;
    }

    if (dragging === 'signature') {
      const sig = s.signature;
      patchLayout({
        signature: { ...sig, x: Math.max(0, Math.min(1 - sig.w, sig.x + dx)), y: Math.max(0, Math.min(1 - sig.h, sig.y + dy)) }
      });
      return;
    }
    
    if (dragging === 'qr') {
      const q = s.qr;
      patchLayout({
        qr: { ...q, x: Math.max(0, Math.min(1 - q.size, q.x + dx)), y: Math.max(0, Math.min(1 - q.size, q.y + dy)) }
      });
      return;
    }

    const item = s[dragging];
    if (item) {
      patchLayout({
        [dragging]: { ...item, x: Math.max(0, Math.min(1, item.x + dx)), y: Math.max(0, Math.min(1, item.y + dy)) }
      });
    }
  }, [dragging, resizing, previewData, onLogoPosChange, patchLayout, toLocal]);

  const onPointerUp = useCallback(() => {
    setDragging(null);
    setResizing(null);
    dragSnap.current = null;
  }, []);

  useEffect(() => {
    if (!dragging && !resizing) return;
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [dragging, resizing, onPointerMove, onPointerUp]);

  const startDrag = (key: DragKey, e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedElement(key);
    const { nx, ny } = toLocal(e.clientX, e.clientY);
    
    if (!previewData) return;
    const L = previewData.certificateLayout;
    
    const snapMap: any = {
      logo: { logo: { ...previewData.logoPos } },
      signature: { signature: { ...L.signature } },
      qr: { qr: { ...L.qr } },
      authorityName: { authorityName: { ...L.authorityName } },
      designation: { designation: { ...L.designation } },
      recipientName: { recipientName: { ...L.recipientName } },
      bodyBlock: { bodyBlock: { ...L.bodyBlock } }
    };

    dragSnap.current = { nx0: nx, ny0: ny, ...snapMap[key] };
    setDragging(key);
  };

  const startResize = (key: DragKey, e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const { nx, ny } = toLocal(e.clientX, e.clientY);
    if (!previewData) return;
    const L = previewData.certificateLayout;
    
    const snapMap: any = {
      logo: { logo: { ...previewData.logoPos } },
      signature: { signature: { ...L.signature } },
      qr: { qr: { ...L.qr } },
      authorityName: { authorityName: { ...L.authorityName } },
      designation: { designation: { ...L.designation } },
      recipientName: { recipientName: { ...L.recipientName } },
      bodyBlock: { bodyBlock: { ...L.bodyBlock } }
    };

    dragSnap.current = { nx0: nx, ny0: ny, ...snapMap[key] };
    setResizing(key);
  };

  if (!previewData) return <div className="p-8 text-center text-gray-500">Loading editor...</div>;

  const layout = previewData.certificateLayout;
  const logoTopPct = (1 - previewData.logoPos.y) * 100;

  const getElementStyle = (isSelected: boolean) => {
    return `absolute cursor-grab active:cursor-grabbing ${isSelected ? 'ring-2 ring-blue-500 ring-offset-2 rounded z-20 shadow-lg' : 'hover:ring-1 hover:ring-blue-300 hover:ring-offset-1 z-10'}`;
  };

  const ResizeHandle = ({ onStart }: { onStart: (e: React.PointerEvent) => void }) => (
    <div 
      className="absolute bottom-0 right-0 w-4 h-4 bg-blue-600 rounded-full border-2 border-white shadow-lg cursor-nwse-resize z-30 -mr-2 -mb-2 hover:scale-125 transition-transform"
      onPointerDown={onStart}
    />
  );

  return (
    <div className="flex h-[800px] border border-gray-200 rounded-2xl overflow-hidden bg-gray-50 shadow-sm">
      {/* Canvas Area */}
      <div className="flex-1 relative overflow-auto bg-gray-100 flex items-center justify-center p-8" onClick={() => setSelectedElement(null)}>
        <div
          ref={wrapRef}
          className="relative shadow-2xl transition-all"
          style={{
            width: '90%',
            maxWidth: '768px',
            maxHeight: '100%',
            aspectRatio: '794 / 561',
            background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
            border: '1px solid #e2e8f0',
          }}
        >
          {previewData.logoUrl && (
            <div
              className={getElementStyle(selectedElement === 'logo')}
              style={{
                left: `${previewData.logoPos.x * 100}%`,
                top: `${logoTopPct}%`,
                width: `${previewData.logoPos.size * 100}%`,
              }}
              onPointerDown={e => startDrag('logo', e)}
            >
              <img src={previewData.logoUrl} alt="Logo" className="w-full object-contain pointer-events-none" draggable={false} />
              {selectedElement === 'logo' && <ResizeHandle onStart={e => startResize('logo', e)} />}
            </div>
          )}

          <div
            className={`${getElementStyle(selectedElement === 'recipientName')} text-center`}
            style={{
              left: `${layout.recipientName.x * 100}%`,
              top: `${layout.recipientName.y * 100}%`,
              transform: `translate(-50%, -50%) scale(${layout.recipientName.scale})`,
              width: '85%',
              color: layout.recipientName.color || '#000000',
              fontFamily: layout.recipientName.fontFamily || 'inherit',
            }}
            onPointerDown={e => startDrag('recipientName', e)}
          >
            <p className="font-serif text-4xl font-bold leading-tight">{previewData.name || 'Recipient Name'}</p>
            {selectedElement === 'recipientName' && <ResizeHandle onStart={e => startResize('recipientName', e)} />}
          </div>

          <div
            className={`${getElementStyle(selectedElement === 'bodyBlock')} text-center`}
            style={{
              left: `${layout.bodyBlock.x * 100}%`,
              top: `${layout.bodyBlock.y * 100}%`,
              transform: `translate(-50%, -50%) scale(${layout.bodyBlock.scale})`,
              width: '88%',
              color: layout.bodyBlock.color || '#4b5563',
              fontFamily: layout.bodyBlock.fontFamily || 'inherit',
            }}
            onPointerDown={e => startDrag('bodyBlock', e)}
          >
            <p className="text-sm mb-1">
              has been awarded the role of <span className="font-semibold text-gray-900">{previewData.role || 'Role'}</span>
            </p>
            <p className="text-sm mb-1">
              at <span className="font-semibold text-gray-900">{previewData.eventName || 'Event Name'}</span>
            </p>
            <p className="text-xs mt-1">
              {previewData.organization || 'Organization'} &nbsp;·&nbsp; {previewData.date || 'Date'}
            </p>
            {selectedElement === 'bodyBlock' && <ResizeHandle onStart={e => startResize('bodyBlock', e)} />}
          </div>

          <div
            className={getElementStyle(selectedElement === 'signature')}
            style={{
              left: `${layout.signature.x * 100}%`,
              top: `${layout.signature.y * 100}%`,
              width: `${layout.signature.w * 100}%`,
              height: `${layout.signature.h * 100}%`,
            }}
            onPointerDown={e => startDrag('signature', e)}
          >
            {previewData.signatureUrl ? (
              <img src={previewData.signatureUrl} alt="Signature" className="w-full h-full object-contain pointer-events-none" />
            ) : (
              <div className="w-full h-full border-b-2 border-dashed border-gray-400 flex items-end justify-center pb-1 text-[10px] text-gray-400">
                Signature
              </div>
            )}
            {selectedElement === 'signature' && <ResizeHandle onStart={e => startResize('signature', e)} />}
          </div>

          <div
            className={`${getElementStyle(selectedElement === 'authorityName')} text-center`}
            style={{
              left: `${layout.authorityName.x * 100}%`,
              top: `${layout.authorityName.y * 100}%`,
              transform: `translate(-50%, -50%) scale(${layout.authorityName.scale})`,
              width: '40%',
              color: layout.authorityName.color || '#1f2937',
              fontFamily: layout.authorityName.fontFamily || 'inherit',
            }}
            onPointerDown={e => startDrag('authorityName', e)}
          >
            <p className="text-sm font-bold">{previewData.authorityName || 'Authority Name'}</p>
            {selectedElement === 'authorityName' && <ResizeHandle onStart={e => startResize('authorityName', e)} />}
          </div>

          <div
            className={`${getElementStyle(selectedElement === 'designation')} text-center`}
            style={{
              left: `${layout.designation.x * 100}%`,
              top: `${layout.designation.y * 100}%`,
              transform: `translate(-50%, -50%) scale(${layout.designation.scale})`,
              width: '40%',
              color: layout.designation.color || '#6b7280',
              fontFamily: layout.designation.fontFamily || 'inherit',
            }}
            onPointerDown={e => startDrag('designation', e)}
          >
            <p className="text-xs">{previewData.authorityPosition || 'Position'}</p>
            {selectedElement === 'designation' && <ResizeHandle onStart={e => startResize('designation', e)} />}
          </div>

          <div
            className={`${getElementStyle(selectedElement === 'qr')} flex flex-col items-center gap-1`}
            style={{
              left: `${layout.qr.x * 100}%`,
              top: `${layout.qr.y * 100}%`,
              width: `${layout.qr.size * 100}%`,
            }}
            onPointerDown={e => startDrag('qr', e)}
          >
            <div className="w-full aspect-square bg-gray-200 border-2 dashed border-gray-400 rounded flex items-center justify-center">
               <span className="text-xs text-gray-400 font-bold">QR</span>
            </div>
            <p className="text-[10px] text-gray-500 text-center uppercase tracking-wider font-semibold">Scan to verify</p>
            {selectedElement === 'qr' && <ResizeHandle onStart={e => startResize('qr', e)} />}
          </div>

        </div>
      </div>

      {/* Right Sidebar - Properties Panel */}
      <div className="w-80 bg-white border-l border-gray-200 flex flex-col items-stretch overflow-y-auto">
         <div className="p-5 border-b border-gray-100 bg-gray-50 flex flex-col gap-2">
            <h2 className="text-lg font-bold text-gray-800">Visual Builder</h2>
            <p className="text-sm text-gray-500">Select an element on the canvas to resize or style it.</p>
         </div>

         {selectedElement ? (
            <div className="p-5 space-y-6">
                <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold tracking-wide text-blue-600 uppercase">
                        Editing {selectedElement}
                    </span>
                    <button onClick={() => setSelectedElement(null)} className="text-gray-400 hover:text-gray-600">✕</button>
                </div>

                <div className="space-y-4">
                    {/* Scale Option for non-logo/non-sig/non-qr */}
                    {['recipientName', 'bodyBlock', 'authorityName', 'designation'].includes(selectedElement) && (
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-gray-700">Size (Scale)</label>
                            <input 
                                type="range" min="0.5" max="2" step="0.05" 
                                value={(layout as any)[selectedElement].scale}
                                onChange={(e) => patchLayout({ [selectedElement]: { ...(layout as any)[selectedElement], scale: parseFloat(e.target.value) } })}
                                className="w-full accent-blue-600"
                            />
                        </div>
                    )}
                    
                    {/* Size Option for Logo */}
                    {selectedElement === 'logo' && (
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-gray-700">Logo Size</label>
                            <input 
                                type="range" min="0.05" max="0.5" step="0.01" 
                                value={previewData.logoPos.size}
                                onChange={(e) => onLogoPosChange({ ...previewData.logoPos, size: parseFloat(e.target.value) })}
                                className="w-full accent-blue-600"
                            />
                        </div>
                    )}

                    {/* Size and Dimensions for Signature */}
                    {selectedElement === 'signature' && (
                        <>
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-gray-700">Width</label>
                                <input 
                                    type="range" min="0.1" max="0.5" step="0.01" 
                                    value={layout.signature.w}
                                    onChange={(e) => patchLayout({ signature: { ...layout.signature, w: parseFloat(e.target.value) } })}
                                    className="w-full accent-blue-600"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-gray-700">Height</label>
                                <input 
                                    type="range" min="0.05" max="0.3" step="0.01" 
                                    value={layout.signature.h}
                                    onChange={(e) => patchLayout({ signature: { ...layout.signature, h: parseFloat(e.target.value) } })}
                                    className="w-full accent-blue-600"
                                />
                            </div>
                        </>
                    )}

                    {/* QR Code */}
                    {selectedElement === 'qr' && (
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-gray-700">QR Size</label>
                            <input 
                                type="range" min="0.05" max="0.3" step="0.01" 
                                value={layout.qr.size}
                                onChange={(e) => patchLayout({ qr: { ...layout.qr, size: parseFloat(e.target.value) } })}
                                className="w-full accent-blue-600"
                            />
                        </div>
                    )}

                    {/* Colors and Fonts (Optional/Future for backend compat) */}
                    {['recipientName', 'bodyBlock', 'authorityName', 'designation'].includes(selectedElement) && (
                        <>
                            <div className="space-y-2 pt-4 border-t border-gray-100">
                                <label className="text-sm font-semibold text-gray-700">Text Color</label>
                                <div className="flex gap-2 items-center">
                                    <input 
                                        type="color" 
                                        value={(layout as any)[selectedElement].color || '#000000'}
                                        onChange={(e) => patchLayout({ [selectedElement]: { ...(layout as any)[selectedElement], color: e.target.value } })}
                                        className="w-10 h-10 p-1 rounded border-gray-200 cursor-pointer"
                                    />
                                    <span className="text-xs text-gray-500">{(layout as any)[selectedElement].color || '#000000'}</span>
                                </div>
                            </div>
                            <div className="space-y-2 pt-4 border-t border-gray-100">
                                <label className="text-sm font-semibold text-gray-700">Font</label>
                                <select 
                                    value={(layout as any)[selectedElement].fontFamily || 'inherit'}
                                    onChange={(e) => patchLayout({ [selectedElement]: { ...(layout as any)[selectedElement], fontFamily: e.target.value } })}
                                    className="w-full rounded-lg border-gray-300 text-sm focus:ring-blue-500 focus:border-blue-500"
                                >
                                    <option value="inherit">Default (Template)</option>
                                    <option value="Arial, sans-serif">Arial</option>
                                    <option value="'Times New Roman', serif">Times New Roman</option>
                                    <option value="'Courier New', monospace">Courier New</option>
                                </select>
                            </div>
                        </>
                    )}
                </div>
            </div>
         ) : (
            <div className="p-8 text-center text-gray-400 flex flex-col items-center justify-center flex-1">
                <svg className="w-12 h-12 mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                </svg>
                <p>Click on any text, logo, signature, or QR code on the certificate to edit its properties.</p>
            </div>
         )}
      </div>
    </div>
  );
}
