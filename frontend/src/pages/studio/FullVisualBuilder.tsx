import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { PreviewData, CertificateLayout, LogoPos, StudioAction } from './types';
import { API_BASE } from '../../lib/api';



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
      if (['logo', 'logo2', 'logo3', 'watermark'].includes(resizing)) {
        const logoKey = resizing as 'logo' | 'logo2' | 'logo3' | 'watermark';
        const logoState = logoKey === 'logo' ? s.logo : previewData.certificateLayout[logoKey] as LogoPos;
        if (logoState) {
          const newVal = { ...logoState, size: Math.max(0.05, Math.min(0.5, logoState.size + delta)) };
          if (logoKey === 'logo') onLogoPosChange(newVal);
          else patchLayout({ [logoKey]: newVal });
        }
      } else if (['signature', 'signature2'].includes(resizing)) {
        const sigKey = resizing as 'signature' | 'signature2';
        const sigState = sigKey === 'signature' ? s.signature : s.signature2;
        if (sigState) {
          patchLayout({
            [sigKey]: {
              ...sigState,
              w: Math.max(0.1, Math.min(0.6, sigState.w + dx)),
              h: Math.max(0.05, Math.min(0.4, sigState.h + dy))
            }
          });
        }
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

    if (['logo', 'logo2', 'logo3', 'watermark'].includes(dragging)) {
      const logoKey = dragging as 'logo' | 'logo2' | 'logo3' | 'watermark';
      const logoState = logoKey === 'logo' ? s.logo : previewData.certificateLayout[logoKey] as LogoPos;
      if (logoState) {
          const newVal = {
            ...logoState,
            x: Math.max(0, Math.min(1 - logoState.size, logoState.x + dx)),
            y: Math.max(0, Math.min(1, logoState.y - dy)),
          };
          if (logoKey === 'logo') onLogoPosChange(newVal);
          else patchLayout({ [logoKey]: newVal });
      }
      return;
    }

    if (['signature', 'signature2'].includes(dragging)) {
      const sigKey = dragging as 'signature' | 'signature2';
      const sig = sigKey === 'signature' ? s.signature : s.signature2;
      if (sig) {
        patchLayout({
          [sigKey]: { ...sig, x: Math.max(0, Math.min(1 - sig.w, sig.x + dx)), y: Math.max(0, Math.min(1 - sig.h, sig.y + dy)) }
        });
      }
      return;
    }
    
    if (dragging === 'qr') {
      const q = s.qr;
      patchLayout({
        qr: { ...q, x: Math.max(0, Math.min(1 - q.size, q.x + dx)), y: Math.max(0, Math.min(1 - q.size, q.y + dy)) }
      });
      return;
    }

    const key = dragging as string;
    const item = (s as any)[key];
    if (item) {
      patchLayout({
        [key]: { ...item, x: Math.max(0, Math.min(1, item.x + dx)), y: Math.max(0, Math.min(1, item.y + dy)) }
      } as any);
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
    e.stopPropagation();  // prevent bubbling to canvas wrapper which would clear selection
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
      {/* Canvas Area — click the background (not an element) to deselect */}
      <div
        className="flex-1 relative overflow-auto bg-gray-100 flex items-center justify-center p-8"
        onPointerDown={(e) => {
          // Only deselect if the click landed directly on this wrapper (not a child element)
          if (e.target === e.currentTarget) setSelectedElement(null);
        }}
      >
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
            className={`${getElementStyle(selectedElement === 'recipientName')} text-center flex flex-col items-center justify-center`}
            style={{
              left: `${layout.recipientName.x * 100}%`,
              top: `${layout.recipientName.y * 100}%`,
              transform: `translate(-50%, -50%) scale(${layout.recipientName.scale})`,
              width: '85%',
              color: (layout.recipientName as any).color || (layout.theme as any)?.titleColor || '#000000',
              fontFamily: (layout.recipientName as any).fontFamily || (layout.theme as any)?.fontFamily || 'inherit',
              fontWeight: (layout.recipientName as any).fontWeight || 'bold',
              letterSpacing: `${(layout.recipientName as any).letterSpacing || 0}px`,
              textTransform: (layout.recipientName as any).textTransform || 'none',
            }}
            onPointerDown={e => startDrag('recipientName', e)}
          >
            <p className="font-serif text-4xl leading-tight" style={{ color: 'inherit', fontWeight: 'inherit', letterSpacing: 'inherit', textTransform: 'inherit' }}>{previewData.name || 'Recipient Name'}</p>
            {selectedElement === 'recipientName' && <ResizeHandle onStart={e => startResize('recipientName', e)} />}
          </div>

          <div
            className={`${getElementStyle(selectedElement === 'bodyBlock')} text-center flex flex-col items-center justify-center`}
            style={{
              left: `${layout.bodyBlock.x * 100}%`,
              top: `${layout.bodyBlock.y * 100}%`,
              transform: `translate(-50%, -50%) scale(${layout.bodyBlock.scale})`,
              width: '88%',
              color: (layout.bodyBlock as any).color || (layout.theme as any)?.textColor || '#4b5563',
              fontFamily: (layout.bodyBlock as any).fontFamily || (layout.theme as any)?.fontFamily || 'inherit',
              fontWeight: (layout.bodyBlock as any).fontWeight || 'normal',
              letterSpacing: `${(layout.bodyBlock as any).letterSpacing || 0}px`,
              textTransform: (layout.bodyBlock as any).textTransform || 'none',
            }}
            onPointerDown={e => startDrag('bodyBlock', e)}
          >
            <p className="text-sm mb-1 leading-snug" style={{ fontWeight: 'inherit', letterSpacing: 'inherit', textTransform: 'inherit' }}>
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
          {['signature', 'signature2'].map(k => {
             const sigKey = k as 'signature' | 'signature2';
             const sig = layout[sigKey];
             if (!sig || sig.hidden) return null;
             const isSecondary = sigKey === 'signature2';
             const url = isSecondary ? previewData.authority.sigPreviewUrl2 : previewData.signatureUrl;
             const aName = isSecondary ? previewData.authority.name2 : previewData.authorityName;
             const aPosUrl = isSecondary ? previewData.authority.position2 : previewData.authorityPosition;
             const aNameLayout = isSecondary ? layout.authorityName2 : layout.authorityName;
             const aDesigLayout = isSecondary ? layout.designation2 : layout.designation;

             return (
                <div key={sigKey}>
                   {url && (
                    <div
                      className={getElementStyle(selectedElement === sigKey)}
                      style={{
                        left: `${sig.x * 100}%`,
                        top: `${(1 - sig.y) * 100}%`,
                        width: `${sig.w * 100}%`,
                        height: `${sig.h * 100}%`,
                        transform: 'translateY(-100%)',
                      }}
                      onPointerDown={e => startDrag(sigKey, e)}
                    >
                      <img src={url} alt="Signature" className="w-full h-full object-contain pointer-events-none" />
                      {selectedElement === sigKey && <ResizeHandle onStart={e => startResize(sigKey, e)} />}
                    </div>
                  )}

                  {aName && aNameLayout && (
                    <div
                      className={`${getElementStyle(selectedElement === (isSecondary ? 'authorityName2' : 'authorityName'))} text-center flex flex-col items-center justify-center`}
                      style={{
                        left: `${aNameLayout.x * 100}%`,
                        top: `${aNameLayout.y * 100}%`,
                        transform: `translate(-50%, -50%) scale(${aNameLayout.scale})`,
                        width: '30%',
                        color: aNameLayout.color || layout.theme?.textColor || '#4b5563',
                        fontFamily: aNameLayout.fontFamily || 'inherit',
                        fontWeight: aNameLayout.fontWeight || 'bold',
                        letterSpacing: `${aNameLayout.letterSpacing || 0}px`,
                        textTransform: aNameLayout.textTransform || 'none',
                      }}
                      onPointerDown={e => startDrag(isSecondary ? 'authorityName2' : 'authorityName', e)}
                    >
                      <p className="text-sm" style={{ color: 'inherit', fontWeight: 'inherit', letterSpacing: 'inherit', textTransform: 'inherit' }}>{aName}</p>
                    </div>
                  )}

                  {aPosUrl && aDesigLayout && (
                    <div
                      className={`${getElementStyle(selectedElement === (isSecondary ? 'designation2' : 'designation'))} text-center flex flex-col items-center justify-center`}
                      style={{
                        left: `${aDesigLayout.x * 100}%`,
                        top: `${aDesigLayout.y * 100}%`,
                        transform: `translate(-50%, -50%) scale(${aDesigLayout.scale})`,
                        width: '30%',
                        color: aDesigLayout.color || layout.theme?.textColor || '#6b7280',
                        fontFamily: aDesigLayout.fontFamily || 'inherit',
                        fontWeight: aDesigLayout.fontWeight || 'normal',
                        letterSpacing: `${aDesigLayout.letterSpacing || 0}px`,
                        textTransform: aDesigLayout.textTransform || 'none',
                      }}
                      onPointerDown={e => startDrag(isSecondary ? 'designation2' : 'designation', e)}
                    >
                      <p className="text-xs tracking-wide" style={{ color: 'inherit', fontWeight: 'inherit', letterSpacing: 'inherit', textTransform: 'inherit' }}>{aPosUrl}</p>
                    </div>
                  )}
                </div>
             );
          })}

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
        
     <div className="w-80 bg-white border-l border-gray-200 flex flex-col items-stretch overflow-y-auto">
        <div className="p-5 border-b border-gray-100 bg-gray-50 flex flex-col gap-2 relative">
            <h2 className="text-lg font-bold text-gray-800">Visual Builder</h2>
            <p className="text-sm text-gray-500">{selectedElement ? 'Element Settings' : 'Global Settings'}</p>
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
                    {['recipientName', 'bodyBlock', 'authorityName', 'designation', 'authorityName2', 'designation2'].includes(selectedElement) && (
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-gray-700 flex justify-between">
                                <span>Scale</span>
                                <span className="font-mono text-gray-400">{((layout as any)[selectedElement].scale || 1).toFixed(2)}x</span>
                            </label>

                            <input 
                                type="range" min="0.5" max="3" step="0.05" 
                                value={(layout as any)[selectedElement].scale || 1}
                                onChange={(e) => patchLayout({ [selectedElement]: { ...(layout as any)[selectedElement], scale: parseFloat(e.target.value) } })}
                                className="w-full accent-blue-600 cursor-ew-resize"
                            />
                        </div>
                    )}
                    
                    {/* Size Option for Logos */}
                    {['logo', 'logo2', 'logo3', 'watermark'].includes(selectedElement) && (
                        <>
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-gray-700 flex justify-between">
                                <span>Logo Size</span>
                                <span className="font-mono text-gray-400">
                                   {Math.round((selectedElement === 'logo' ? previewData.logoPos.size : (layout as any)[selectedElement]?.size || 0.25) * 100)}%
                                </span>
                            </label>
                            <input 
                                type="range" min="0.05" max="0.6" step="0.01" 
                                value={selectedElement === 'logo' ? previewData.logoPos.size : (layout as any)[selectedElement]?.size || 0.25}
                                onChange={(e) => {
                                   if (selectedElement === 'logo') onLogoPosChange({ ...previewData.logoPos, size: parseFloat(e.target.value) });
                                   else patchLayout({ [selectedElement]: { ...(layout as any)[selectedElement], size: parseFloat(e.target.value) } });
                                }}
                                className="w-full accent-blue-600 cursor-ew-resize"
                            />
                        </div>
                        <div className="space-y-2 pt-4 border-t border-gray-100">
                           <label className="text-sm font-semibold text-gray-700">Shape</label>
                           <div className="flex gap-2">
                              {['rectangle', 'rounded', 'circle', 'oval'].map(s => {
                                 const currentShape = selectedElement === 'logo' ? previewData.logoPos.shape : (layout as any)[selectedElement]?.shape;
                                 return (
                                     <button
                                        key={s} type="button"
                                        onClick={() => {
                                            if (selectedElement === 'logo') onLogoPosChange({ ...previewData.logoPos, shape: s as any });
                                            else patchLayout({ [selectedElement]: { ...(layout as any)[selectedElement], shape: s as any } });
                                        }}
                                        className={`flex-1 py-1 text-[11px] capitalize rounded ${currentShape === s || (!currentShape && s === 'rectangle') ? 'bg-blue-100 text-blue-700 font-bold' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                                     >
                                        {s}
                                     </button>
                                 );
                              })}
                           </div>
                        </div>
                        {selectedElement !== 'logo' && (
                           <div className="space-y-2 pt-4 border-t border-gray-100">
                               <label className="text-sm font-semibold text-gray-700 flex justify-between">
                                  <span>Opacity</span>
                                  <span className="font-mono text-gray-400">{Math.round(((layout as any)[selectedElement]?.opacity ?? (selectedElement === 'watermark' ? 0.15 : 1)) * 100)}%</span>
                               </label>
                               <input 
                                  type="range" min="0.05" max="1" step="0.05" 
                                  value={(layout as any)[selectedElement]?.opacity ?? (selectedElement === 'watermark' ? 0.15 : 1)}
                                  onChange={(e) => patchLayout({ [selectedElement]: { ...(layout as any)[selectedElement], opacity: parseFloat(e.target.value) } })}
                                  className="w-full accent-blue-600"
                               />
                           </div>
                        )}
                        </>
                    )}

                    {/* Size and Dimensions for Signature */}
                    {['signature', 'signature2'].includes(selectedElement) && (
                        <>
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-gray-700 flex justify-between">
                                    <span>Width</span>
                                <span className="font-mono text-gray-400">{Math.round((layout as any)[selectedElement].w * 100)}%</span>
                            </label>
                            <input 
                                type="range" min="0.1" max="0.6" step="0.01" 
                                value={(layout as any)[selectedElement].w}
                                onChange={(e) => patchLayout({ [selectedElement]: { ...(layout as any)[selectedElement], w: parseFloat(e.target.value) } })}
                                className="w-full accent-blue-600 cursor-ew-resize"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-gray-700 flex justify-between">
                                <span>Height</span>
                                <span className="font-mono text-gray-400">{Math.round((layout as any)[selectedElement].h * 100)}%</span>
                            </label>
                            <input 
                                type="range" min="0.05" max="0.4" step="0.01" 
                                value={(layout as any)[selectedElement].h}
                                onChange={(e) => patchLayout({ [selectedElement]: { ...(layout as any)[selectedElement], h: parseFloat(e.target.value) } })}
                                    className="w-full accent-blue-600 cursor-ew-resize"
                                />
                            </div>
                        </>
                    )}

                    {/* QR Code */}
                    {selectedElement === 'qr' && (
                        <div className="space-y-2">
                             <label className="text-sm font-semibold text-gray-700 flex justify-between">
                                <span>QR Size</span>
                                <span className="font-mono text-gray-400">{Math.round(layout.qr.size * 100)}%</span>
                            </label>
                            <input 
                                type="range" min="0.05" max="0.3" step="0.01" 
                                value={layout.qr.size}
                                onChange={(e) => patchLayout({ qr: { ...layout.qr, size: parseFloat(e.target.value) } })}
                                className="w-full accent-blue-600 cursor-ew-resize"
                            />
                        </div>
                    )}

                    {/* Colors and Fonts (Optional/Future for backend compat) */}
                    {['recipientName', 'bodyBlock', 'authorityName', 'designation', 'authorityName2', 'designation2'].includes(selectedElement) && (
                        <>
                            <div className="space-y-2 pt-4 border-t border-gray-100">
                                <label className="text-sm font-semibold text-gray-700">Text Color Override</label>
                                <div className="flex gap-3 items-center">
                                    <input 
                                        type="color" 
                                        value={(layout as any)[selectedElement].color || (layout.theme as any)?.textColor || '#000000'}
                                        onChange={(e) => patchLayout({ [selectedElement]: { ...(layout as any)[selectedElement], color: e.target.value } })}
                                        className="w-8 h-8 rounded shrink-0 cursor-pointer border border-gray-200"
                                    />
                                    <button 
                                        onClick={() => patchLayout({ [selectedElement]: { ...(layout as any)[selectedElement], color: undefined } })}
                                        className="text-xs text-red-500 hover:text-red-700 font-medium"
                                    >Clear</button>
                                </div>
                            </div>
                            <div className="space-y-2 pt-4 border-t border-gray-100">
                                <label className="text-sm font-semibold text-gray-700">Font Family</label>
                                <select 
                                    value={(layout as any)[selectedElement].fontFamily || 'inherit'}
                                    onChange={(e) => patchLayout({ [selectedElement]: { ...(layout as any)[selectedElement], fontFamily: e.target.value } })}
                                    className="w-full rounded-lg border-gray-300 bg-white font-medium text-sm focus:ring-blue-500 focus:border-blue-500 py-2"
                                >
                                    <option value="inherit">Use Theme Default</option>
                                    <option value="Helvetica, Arial, sans-serif">Helvetica / Sans</option>
                                    <option value="'Times New Roman', serif">Times / Serif</option>
                                    <option value="'Courier New', monospace">Courier / Mono</option>
                                    <option value="'Montserrat', sans-serif">Montserrat (Modern)</option>
                                    <option value="'Playfair Display', serif">Playfair Display (Premium)</option>
                                    <option value="'Great Vibes', cursive">Great Vibes (Cursive)</option>
                                    <option value="'Noto Sans Devanagari', sans-serif">Noto Sans Devanagari (Hindi)</option>
                                </select>
                            </div>
                            
                            {/* ADVANCED TYPOGRAPHY */}
                            <div className="grid grid-cols-2 gap-3 pt-4 border-t border-gray-100">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-gray-500 uppercase">Weight</label>
                                    <select 
                                        value={(layout as any)[selectedElement].fontWeight || 'normal'}
                                        onChange={(e) => patchLayout({ [selectedElement]: { ...(layout as any)[selectedElement], fontWeight: e.target.value } })}
                                        className="w-full text-xs border border-gray-300 rounded p-1"
                                    >
                                        <option value="normal">Normal</option>
                                        <option value="bold">Bold</option>
                                        <option value="italic">Italic</option>
                                        <option value="bold-italic">Bold Italic</option>
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-gray-500 uppercase">Transform</label>
                                    <select 
                                        value={(layout as any)[selectedElement].textTransform || 'none'}
                                        onChange={(e) => patchLayout({ [selectedElement]: { ...(layout as any)[selectedElement], textTransform: e.target.value } })}
                                        className="w-full text-xs border border-gray-300 rounded p-1"
                                    >
                                        <option value="none">None</option>
                                        <option value="uppercase">UPPERCASE</option>
                                        <option value="lowercase">lowercase</option>
                                        <option value="capitalize">Capitalize</option>
                                    </select>
                                </div>
                            </div>
                            <div className="space-y-2 pt-2">
                                <label className="text-[10px] font-bold text-gray-500 uppercase flex justify-between">
                                    <span>Letter Spacing</span>
                                    <span className="font-mono text-gray-400">{(layout as any)[selectedElement].letterSpacing || 0}px</span>
                                </label>
                                <input 
                                    type="range" min="-2" max="10" step="0.5" 
                                    value={(layout as any)[selectedElement].letterSpacing || 0}
                                    onChange={(e) => patchLayout({ [selectedElement]: { ...(layout as any)[selectedElement], letterSpacing: parseFloat(e.target.value) } })}
                                    className="w-full accent-blue-600 cursor-ew-resize"
                                />
                            </div>
                        </>
                    )}
                </div>
            </div>
        ) : (
            <div className="p-5 space-y-6">
                <div className="mb-2">
                    <h3 className="text-sm font-bold tracking-wide text-gray-700 uppercase mb-4">Global Theme</h3>
                    
                    <div className="space-y-5">
                       <div className="space-y-2">
                           <label className="text-sm font-semibold text-gray-700">Master Font Family</label>
                           <select 
                               value={(layout.theme as any)?.fontFamily || 'inherit'}
                               onChange={(e) => patchLayout({ theme: { ...(layout.theme as any), fontFamily: e.target.value } })}
                               className="w-full rounded-lg border-gray-300 bg-white font-medium text-sm focus:ring-blue-500 focus:border-blue-500 py-2 shadow-sm"
                           >
                               <option value="inherit">Template Default</option>
                               <option value="Helvetica, Arial, sans-serif">Helvetica / Sans</option>
                               <option value="'Times New Roman', Times, serif">Times / Serif</option>
                               <option value="'Courier New', Courier, monospace">Courier / Mono</option>
                               <option value="'Montserrat', sans-serif">Montserrat (Modern)</option>
                               <option value="'Playfair Display', serif">Playfair Display (Premium)</option>
                               <option value="'Great Vibes', cursive">Great Vibes (Cursive)</option>
                               <option value="'Noto Sans Devanagari', sans-serif">Noto Sans Devanagari (Hindi)</option>
                           </select>
                       </div>

                       <div className="space-y-3 pt-2">
                           <label className="text-sm font-semibold text-gray-700">Color Palette</label>
                           
                           <div className="flex items-center justify-between border border-gray-100 p-2 rounded bg-white shadow-sm">
                               <span className="text-xs font-medium text-gray-600">Background Tint</span>
                               <div className="flex items-center gap-2">
                                  <input type="color" value={(layout.theme as any)?.bgTint || '#ffffff'} onChange={e => patchLayout({ theme: { ...(layout.theme as any), bgTint: e.target.value } })} className="w-6 h-6 border-0 p-0 rounded overflow-hidden cursor-pointer shrink-0"/>
                                  <button onClick={() => patchLayout({ theme: { ...(layout.theme as any), bgTint: undefined }})} className="text-[10px] text-gray-400 hover:text-red-500">Reset</button>
                               </div>
                           </div>
                           
                           <div className="flex items-center justify-between border border-gray-100 p-2 rounded bg-white shadow-sm">
                               <span className="text-xs font-medium text-gray-600">Title Color</span>
                               <div className="flex items-center gap-2">
                                  <input type="color" value={(layout.theme as any)?.titleColor || '#000000'} onChange={e => patchLayout({ theme: { ...(layout.theme as any), titleColor: e.target.value } })} className="w-6 h-6 border-0 p-0 rounded overflow-hidden cursor-pointer shrink-0"/>
                                  <button onClick={() => patchLayout({ theme: { ...(layout.theme as any), titleColor: undefined }})} className="text-[10px] text-gray-400 hover:text-red-500">Reset</button>
                               </div>
                           </div>

                           <div className="flex items-center justify-between border border-gray-100 p-2 rounded bg-white shadow-sm">
                               <span className="text-xs font-medium text-gray-600">Text Color</span>
                               <div className="flex items-center gap-2">
                                  <input type="color" value={(layout.theme as any)?.textColor || '#4b5563'} onChange={e => patchLayout({ theme: { ...(layout.theme as any), textColor: e.target.value } })} className="w-6 h-6 border-0 p-0 rounded overflow-hidden cursor-pointer shrink-0"/>
                                  <button onClick={() => patchLayout({ theme: { ...(layout.theme as any), textColor: undefined }})} className="text-[10px] text-gray-400 hover:text-red-500">Reset</button>
                               </div>
                           </div>

                           <div className="flex items-center justify-between border border-gray-100 p-2 rounded bg-white shadow-sm">
                               <span className="text-xs font-medium text-gray-600">Border / Accent</span>
                               <div className="flex items-center gap-2">
                                  <input type="color" value={(layout.theme as any)?.accentColor || '#3b82f6'} onChange={e => patchLayout({ theme: { ...(layout.theme as any), accentColor: e.target.value } })} className="w-6 h-6 border-0 p-0 rounded overflow-hidden cursor-pointer shrink-0"/>
                                  <button onClick={() => patchLayout({ theme: { ...(layout.theme as any), accentColor: undefined }})} className="text-[10px] text-gray-400 hover:text-red-500">Reset</button>
                               </div>
                           </div>

                       </div>
                    </div>
                </div>

                <div className="pt-6 border-t border-gray-200 mt-6 hidden">
                   {/* We can add Multi-Signature or Multi-Logo panel controls here in the future if they want a sidebar list instead of canvas direct manip */}
                </div>

                <div className="p-4 bg-blue-50 rounded-lg border border-blue-100 mt-4">
                    <p className="text-xs text-blue-800 flex gap-2">
                        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                        Click any element on the canvas (text, logo, signature) to edit its individual properties, resize, or drag to position.
                    </p>
                </div>
            </div>
        )}
      </div>
    </div>
  );
}
