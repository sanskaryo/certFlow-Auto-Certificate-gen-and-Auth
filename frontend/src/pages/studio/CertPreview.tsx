import { useRef, useCallback, useState, useEffect } from 'react';
import type { PreviewData } from './types';
import type { CertificateLayout, LogoPos } from './types';
import { TEMPLATE_COLORS } from './templateColors';

const W = 794;
const H = 561;

interface CertPreviewProps {
  data: PreviewData;
  scale?: number;
  interactive?: boolean;
  onLayoutPatch?: (patch: Partial<CertificateLayout>) => void;
  onLogoPosChange?: (pos: LogoPos) => void;
}

type DragKey =
  | 'logo'
  | 'logo2'
  | 'watermark'
  | 'signature'
  | 'authorityName'
  | 'designation'
  | 'recipientName'
  | 'bodyBlock'
  | 'qr';

type DragSnap = {
  nx0: number;
  ny0: number;
  logo?: LogoPos;
  logo2?: LogoPos;
  watermark?: LogoPos;
  signature?: { x: number; y: number; w: number; h: number };
  qr?: { x: number; y: number; size: number };
  authorityName?: { x: number; y: number; scale: number };
  designation?: { x: number; y: number; scale: number };
  recipientName?: { x: number; y: number; scale: number };
  bodyBlock?: { x: number; y: number; scale: number };
};

export default function CertPreview({
  data,
  scale = 1,
  interactive = false,
  onLayoutPatch,
  onLogoPosChange,
}: CertPreviewProps) {
  const {
    name,
    role,
    eventName,
    organization,
    date,
    authorityName,
    authorityPosition,
    logoUrl,
    logoPos,
    logo2Url,
    watermarkUrl,
    signatureUrl,
    templateId,
    templateUrl,
    certificateLayout: layout,
  } = data;

  const wrapRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<DragKey | null>(null);
  const [resizing, setResizing] = useState<DragKey | null>(null);
  const dragSnap = useRef<DragSnap | null>(null);

  const layoutRef = useRef(layout);
  const logoPosRef = useRef(logoPos);
  layoutRef.current = layout;
  logoPosRef.current = logoPos;

  const toLocal = useCallback((clientX: number, clientY: number) => {
    const el = wrapRef.current;
    if (!el) return { nx: 0, ny: 0 };
    const r = el.getBoundingClientRect();
    return {
      nx: Math.max(0, Math.min(1, (clientX - r.left) / r.width)),
      ny: Math.max(0, Math.min(1, (clientY - r.top) / r.height)),
    };
  }, []);

  const onPointerMove = useCallback(
    (e: PointerEvent) => {
      if ((!dragging && !resizing) || !dragSnap.current || !interactive) return;
      const { nx, ny } = toLocal(e.clientX, e.clientY);
      const s = dragSnap.current;
      const dx = nx - s.nx0;
      const dy = ny - s.ny0;

      if (resizing) {
        const delta = (Math.abs(dx) > Math.abs(dy) ? dx : dy);
        if (resizing === 'logo' && s.logo) {
          onLogoPosChange?.({ ...s.logo, size: Math.max(0.05, Math.min(0.5, s.logo.size + delta)) });
        } else if (resizing === 'logo2' && s.logo2) {
          onLayoutPatch?.({ logo2: { ...s.logo2, size: Math.max(0.05, Math.min(0.5, s.logo2.size + delta)) } });
        } else if (resizing === 'watermark' && s.watermark) {
          onLayoutPatch?.({ watermark: { ...s.watermark, size: Math.max(0.05, Math.min(0.6, s.watermark.size + delta)) } });
        } else if (resizing === 'signature' && s.signature) {
          onLayoutPatch?.({
            signature: {
              ...s.signature,
              w: Math.max(0.1, Math.min(0.6, s.signature.w + dx)),
              h: Math.max(0.05, Math.min(0.4, s.signature.h + dy)),
            },
          });
        } else if (resizing === 'qr' && s.qr) {
          onLayoutPatch?.({ qr: { ...s.qr, size: Math.max(0.05, Math.min(0.3, s.qr.size + delta)) } });
        } else {
          const item = (s as any)[resizing];
          if (item) onLayoutPatch?.({ [resizing]: { ...item, scale: Math.max(0.4, Math.min(3, item.scale + delta * 2)) } });
        }
        return;
      }

      // Dragging
      if (dragging === 'logo' && s.logo) {
        onLogoPosChange?.({
          ...s.logo,
          x: Math.max(0, Math.min(1 - s.logo.size, s.logo.x + dx)),
          y: Math.max(0, Math.min(1, s.logo.y - dy)), // y is from-bottom, drag down = decrease y
        });
        return;
      }
      if (dragging === 'logo2' && s.logo2) {
        const l2 = s.logo2;
        onLayoutPatch?.({ logo2: { ...l2, x: Math.max(0, Math.min(1 - l2.size, l2.x + dx)), y: Math.max(0, Math.min(1, l2.y - dy)) } });
        return;
      }
      if (dragging === 'watermark' && s.watermark) {
        const wm = s.watermark;
        onLayoutPatch?.({ watermark: { ...wm, x: Math.max(0, Math.min(1 - wm.size, wm.x + dx)), y: Math.max(0, Math.min(1, wm.y - dy)) } });
        return;
      }
      if (dragging === 'signature' && s.signature) {
        const sig = s.signature;
        onLayoutPatch?.({
          signature: {
            x: Math.max(0, Math.min(1 - sig.w, sig.x + dx)),
            y: Math.max(0, Math.min(1 - sig.h, sig.y + dy)),
            w: sig.w, h: sig.h,
          },
        });
        return;
      }
      if (dragging === 'qr' && s.qr) {
        const q = s.qr;
        onLayoutPatch?.({ qr: { x: Math.max(0, Math.min(1 - q.size, q.x + dx)), y: Math.max(0, Math.min(1 - q.size, q.y + dy)), size: q.size } });
        return;
      }
      // Text elements (y stored as from-top for these)
      const textKey = dragging as 'authorityName' | 'designation' | 'recipientName' | 'bodyBlock';
      const item = (s as any)[textKey];
      if (item) {
        onLayoutPatch?.({ [textKey]: { ...item, x: Math.max(0, Math.min(1, item.x + dx)), y: Math.max(0, Math.min(1, item.y + dy)) } });
      }
    },
    [dragging, resizing, interactive, onLayoutPatch, onLogoPosChange, toLocal]
  );

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
    if (!interactive) return;
    e.preventDefault(); e.stopPropagation();
    const { nx, ny } = toLocal(e.clientX, e.clientY);
    const L = layoutRef.current;
    const lp = logoPosRef.current;
    const snapMap: any = {
      logo: { logo: { ...lp } },
      logo2: { logo2: L.logo2 ? { ...L.logo2 } : undefined },
      watermark: { watermark: L.watermark ? { ...L.watermark } : undefined },
      signature: { signature: { ...L.signature } },
      qr: { qr: { ...L.qr } },
      authorityName: { authorityName: { ...L.authorityName } },
      designation: { designation: { ...L.designation } },
      recipientName: { recipientName: { ...L.recipientName } },
      bodyBlock: { bodyBlock: { ...L.bodyBlock } },
    };
    dragSnap.current = { nx0: nx, ny0: ny, ...snapMap[key] };
    setDragging(key);
  };

  const startResize = (key: DragKey, e: React.PointerEvent) => {
    if (!interactive) return;
    e.preventDefault(); e.stopPropagation();
    const { nx, ny } = toLocal(e.clientX, e.clientY);
    const L = layoutRef.current;
    const lp = logoPosRef.current;
    const snapMap: any = {
      logo: { logo: { ...lp } },
      logo2: { logo2: L.logo2 ? { ...L.logo2 } : undefined },
      watermark: { watermark: L.watermark ? { ...L.watermark } : undefined },
      signature: { signature: { ...L.signature } },
      qr: { qr: { ...L.qr } },
      authorityName: { authorityName: { ...L.authorityName } },
      designation: { designation: { ...L.designation } },
      recipientName: { recipientName: { ...L.recipientName } },
      bodyBlock: { bodyBlock: { ...L.bodyBlock } },
    };
    dragSnap.current = { nx0: nx, ny0: ny, ...snapMap[key] };
    setResizing(key);
  };

  const ResizeHandle = ({ onStart }: { onStart: (e: React.PointerEvent) => void }) => (
    <div
      className="absolute bottom-0 right-0 w-3 h-3 bg-blue-500 rounded-full border-2 border-white shadow-md cursor-nwse-resize z-20 -mr-1.5 -mb-1.5 hover:scale-125 transition-transform"
      onPointerDown={onStart}
    />
  );

  // y for logos is from-bottom: convert to CSS top = (1-y)*100%
  const logoTopPct  = (1 - logoPos.y) * 100;
  const logo2TopPct = layout.logo2  ? (1 - layout.logo2.y) * 100  : 0;
  const wmTopPct    = layout.watermark ? (1 - layout.watermark.y) * 100 : 0;

  const interactiveCls = interactive ? 'cursor-grab active:cursor-grabbing' : '';
  const ringCls = interactive ? 'hover:ring-2 hover:ring-blue-400 hover:ring-offset-1 rounded' : '';

  // Pick background color from template catalog
  const tplColors = TEMPLATE_COLORS[templateId] || {};
  const bgColor = tplColors.bg || '#fdfcfb';
  const titleColor = tplColors.title || '#1e3a8a';
  const textColor = tplColors.text || '#374151';
  const accentColor = tplColors.accent || '#9ca3af';

  // Responsive scaling
  const [currentScale, setCurrentScale] = useState(scale);
  useEffect(() => {
    if (!wrapRef.current?.parentElement) return;
    const parent = wrapRef.current.parentElement;
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        const w = entry.contentRect.width;
        if (w > 0) setCurrentScale(w / W);
      }
    });
    observer.observe(parent);
    return () => observer.disconnect();
  }, []);

  return (
    <div style={{ width: '100%', minWidth: 200, height: H * currentScale, overflow: 'hidden' }}>
      <div
        ref={wrapRef}
        className="relative overflow-hidden select-none"
        style={{
          width: W,
          height: H,
          transform: `scale(${currentScale})`,
          transformOrigin: 'top left',
          backgroundColor: bgColor,
          fontFamily: 'inherit',
        }}
      >
        {/* Template background image */}
        {templateUrl && (
          <img
            src={templateUrl}
            alt="Template"
            className="absolute inset-0 w-full h-full object-cover pointer-events-none"
            style={{ zIndex: 0 }}
          />
        )}

        {/* Decorative border overlay (when no image template) */}
        {!templateUrl && (
          <>
            <div className="absolute pointer-events-none" style={{ inset: 20, border: `3px solid ${titleColor}22`, borderRadius: 2, zIndex: 1 }} />
            <div className="absolute pointer-events-none" style={{ inset: 27, border: `1px solid ${accentColor}55`, borderRadius: 1, zIndex: 1 }} />
          </>
        )}

        {/* Watermark (behind everything, very transparent) */}
        {watermarkUrl && layout.watermark && !layout.watermark.hidden && (
          <div
            className={`absolute ${interactiveCls} ${ringCls}`}
            style={{
              left: `${layout.watermark.x * 100}%`,
              top: `${wmTopPct}%`,
              width: `${layout.watermark.size * 100}%`,
              opacity: layout.watermark.opacity ?? 0.12,
              zIndex: 2,
            }}
            onPointerDown={e => startDrag('watermark', e)}
          >
            <img src={watermarkUrl} alt="Watermark" className="w-full object-contain pointer-events-none" draggable={false} />
            {interactive && <ResizeHandle onStart={e => startResize('watermark', e)} />}
          </div>
        )}

        {/* Primary Logo */}
        <div
          className={`absolute ${interactiveCls} ${ringCls}`}
          style={{ left: `${logoPos.x * 100}%`, top: `${logoTopPct}%`, width: `${logoPos.size * 100}%`, minHeight: 30, zIndex: 10 }}
          onPointerDown={e => startDrag('logo', e)}
        >
          {logoUrl ? (
            <img
              src={logoUrl}
              alt="Logo"
              className={`w-full h-full pointer-events-none ${
                logoPos.shape === 'circle' ? 'rounded-full object-cover' :
                logoPos.shape === 'rounded' ? 'rounded-[15%] object-cover' :
                logoPos.shape === 'oval' ? 'rounded-[50%] object-cover' : 'object-contain'
              }`}
              draggable={false}
            />
          ) : (
            <div className="w-full h-10 bg-gray-200/60 rounded border border-dashed border-gray-300 flex items-center justify-center">
              <span className="text-[10px] text-gray-400 font-semibold">Logo 1</span>
            </div>
          )}
          {interactive && <ResizeHandle onStart={e => startResize('logo', e)} />}
        </div>

        {/* Secondary Logo (logo2) */}
        {(logo2Url || interactive) && layout.logo2 && !layout.logo2.hidden && (
          <div
            className={`absolute ${interactiveCls} ${ringCls}`}
            style={{ left: `${layout.logo2.x * 100}%`, top: `${logo2TopPct}%`, width: `${layout.logo2.size * 100}%`, minHeight: 30, zIndex: 10 }}
            onPointerDown={e => startDrag('logo2', e)}
          >
            {logo2Url ? (
              <img src={logo2Url} alt="Logo 2" className="w-full object-contain pointer-events-none" draggable={false} />
            ) : (
              <div className="w-full h-10 bg-gray-200/60 rounded border border-dashed border-gray-300 flex items-center justify-center">
                <span className="text-[10px] text-gray-400 font-semibold">Logo 2</span>
              </div>
            )}
            {interactive && <ResizeHandle onStart={e => startResize('logo2', e)} />}
          </div>
        )}

        {/* Certificate Title */}
        <p
          className="absolute left-1/2 -translate-x-1/2 font-bold text-center pointer-events-none"
          style={{ top: '10%', width: '70%', fontSize: 32, color: titleColor, zIndex: 5 }}
        >
          Certificate of Achievement
        </p>

        {/* Decorative divider */}
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2 pointer-events-none" style={{ top: '22%', width: 220, zIndex: 5 }}>
          <div className="flex-1 h-px" style={{ background: accentColor }} />
          <p className="text-[11px] whitespace-nowrap" style={{ color: textColor }}>This certifies that</p>
          <div className="flex-1 h-px" style={{ background: accentColor }} />
        </div>

        {/* Recipient Name */}
        <div
          className={`absolute text-center flex items-center justify-center ${interactiveCls} ${ringCls}`}
          style={{
            left: `${layout.recipientName.x * 100}%`,
            top: `${layout.recipientName.y * 100}%`,
            transform: `translate(-50%, -50%) scale(${layout.recipientName.scale})`,
            width: '85%', minHeight: 40, zIndex: 5,
          }}
          onPointerDown={e => startDrag('recipientName', e)}
        >
          <p className="font-bold text-4xl leading-tight" style={{ color: titleColor }}>
            {name || 'Recipient Name'}
          </p>
          {interactive && <ResizeHandle onStart={e => startResize('recipientName', e)} />}
        </div>

        {/* Body Text */}
        <div
          className={`absolute text-center ${interactiveCls} ${ringCls}`}
          style={{
            left: `${layout.bodyBlock.x * 100}%`,
            top: `${layout.bodyBlock.y * 100}%`,
            transform: `translate(-50%, -50%) scale(${layout.bodyBlock.scale})`,
            width: '88%', zIndex: 5,
          }}
          onPointerDown={e => startDrag('bodyBlock', e)}
        >
          <p className="text-sm mb-1" style={{ color: textColor }}>
            has been awarded the role of <span className="font-semibold">{role || 'Role'}</span>
          </p>
          <p className="text-sm mb-1" style={{ color: textColor }}>
            at <span className="font-semibold">{eventName || 'Event Name'}</span>
          </p>
          <p className="text-xs mt-1" style={{ color: accentColor }}>
            {organization || 'Organization'} &nbsp;·&nbsp; {date || 'Date'}
          </p>
          {interactive && <ResizeHandle onStart={e => startResize('bodyBlock', e)} />}
        </div>

        {/* Signature */}
        <div
          className={`absolute ${interactiveCls} ${ringCls}`}
          style={{
            left: `${layout.signature.x * 100}%`,
            top: `${layout.signature.y * 100}%`,
            width: `${layout.signature.w * 100}%`,
            height: `${layout.signature.h * 100}%`,
            zIndex: 5,
          }}
          onPointerDown={e => startDrag('signature', e)}
        >
          {signatureUrl ? (
            <img src={signatureUrl} alt="Signature" className="w-full h-full object-contain pointer-events-none" />
          ) : (
            <div className="w-full h-full border border-dashed border-gray-300 rounded flex items-center justify-center">
              <span className="text-[10px] text-gray-400">Signature</span>
            </div>
          )}
          {interactive && <ResizeHandle onStart={e => startResize('signature', e)} />}
        </div>

        {/* Authority Name */}
        <div
          className={`absolute text-center ${interactiveCls} ${ringCls}`}
          style={{
            left: `${layout.authorityName.x * 100}%`,
            top: `${layout.authorityName.y * 100}%`,
            transform: `translate(-50%, -50%) scale(${layout.authorityName.scale})`,
            width: '40%', minHeight: 20, zIndex: 5,
          }}
          onPointerDown={e => startDrag('authorityName', e)}
        >
          <p className="text-xs font-semibold" style={{ color: textColor }}>{authorityName || 'Authority Name'}</p>
          {interactive && <ResizeHandle onStart={e => startResize('authorityName', e)} />}
        </div>

        {/* Designation */}
        <div
          className={`absolute text-center ${interactiveCls} ${ringCls}`}
          style={{
            left: `${layout.designation.x * 100}%`,
            top: `${layout.designation.y * 100}%`,
            transform: `translate(-50%, -50%) scale(${layout.designation.scale})`,
            width: '40%', minHeight: 20, zIndex: 5,
          }}
          onPointerDown={e => startDrag('designation', e)}
        >
          <p className="text-xs" style={{ color: accentColor }}>{authorityPosition || 'Position'}</p>
          {interactive && <ResizeHandle onStart={e => startResize('designation', e)} />}
        </div>

        {/* QR Code placeholder */}
        <div
          className={`absolute flex flex-col items-center gap-0.5 ${interactiveCls} ${ringCls}`}
          style={{ left: `${layout.qr.x * 100}%`, top: `${layout.qr.y * 100}%`, width: `${layout.qr.size * 100}%`, zIndex: 5 }}
          onPointerDown={e => startDrag('qr', e)}
        >
          <div className="w-full aspect-square rounded flex items-center justify-center border border-dashed" style={{ borderColor: accentColor + '66' }}>
            <svg className="w-[60%] h-[60%]" style={{ color: accentColor }} viewBox="0 0 24 24" fill="currentColor">
              <path d="M3 3h7v7H3V3zm2 2v3h3V5H5zm9-2h7v7h-7V3zm2 2v3h3V5h-3zM3 14h7v7H3v-7zm2 2v3h3v-3H5zm9 0h2v2h-2v-2zm4 0h2v2h-2v-2zm-4 4h2v2h-2v-2zm4 0h2v2h-2v-2zm-2-2h2v2h-2v-2z" />
            </svg>
            {interactive && <ResizeHandle onStart={e => startResize('qr', e)} />}
          </div>
          <p className="text-[9px] text-center leading-tight" style={{ color: accentColor }}>Scan to verify</p>
        </div>
      </div>
    </div>
  );
}
