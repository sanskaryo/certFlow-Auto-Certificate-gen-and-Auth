import { useRef, useCallback, useState, useEffect } from 'react';
import type { PreviewData } from './types';
import type { CertificateLayout, LogoPos } from './types';

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
  signature?: { x: number; y: number; w: number; h: number };
  qr?: { x: number; y: number; size: number };
  authorityName?: { x: number; y: number; scale: number };
  designation?: { x: number; y: number; scale: number };
  recipientName?: { x: number; y: number; scale: number };
  bodyBlock?: { x: number; y: number; scale: number };
};

const Placeholder = ({ className = "" }: { className?: string }) => (
  <div className={`bg-[#e0e0e0] rounded-[4px] w-full h-full ${className}`} />
);

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
    signatureUrl,
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
        const delta = Math.abs(dx) > Math.abs(dy) ? dx : dy;
        if (resizing === 'logo' && s.logo) {
            onLogoPosChange?.({
                ...s.logo,
                size: Math.max(0.05, Math.min(0.5, s.logo.size + delta))
            });
        } else if (resizing === 'signature' && s.signature) {
            onLayoutPatch?.({
                signature: {
                    ...s.signature,
                    w: Math.max(0.1, Math.min(0.6, s.signature.w + dx)),
                    h: Math.max(0.05, Math.min(0.4, s.signature.h + dy))
                }
            });
        } else if (resizing === 'qr' && s.qr) {
            onLayoutPatch?.({
                qr: { ...s.qr, size: Math.max(0.05, Math.min(0.3, s.qr.size + delta)) }
            });
        } else {
            // Text elements
            const item = (s as any)[resizing];
            if (item) {
                onLayoutPatch?.({
                    [resizing]: { ...item, scale: Math.max(0.4, Math.min(3, item.scale + delta * 2)) }
                });
            }
        }
        return;
      }

      if (dragging === 'logo' && s.logo) {
        const lp = s.logo;
        onLogoPosChange?.({
          x: Math.max(0, Math.min(1 - lp.size, lp.x + dx)),
          y: Math.max(0, Math.min(1, lp.y - dy)),
          size: lp.size,
        });
        return;
      }
      if (dragging === 'signature' && s.signature) {
        const sig = s.signature;
        onLayoutPatch?.({
          signature: {
            x: Math.max(0, Math.min(1 - sig.w, sig.x + dx)),
            y: Math.max(0, Math.min(1 - sig.h, sig.y + dy)),
            w: sig.w,
            h: sig.h,
          },
        });
        return;
      }
      if (dragging === 'qr' && s.qr) {
        const q = s.qr;
        onLayoutPatch?.({
          qr: {
            x: Math.max(0, Math.min(1 - q.size, q.x + dx)),
            y: Math.max(0, Math.min(1 - q.size, q.y + dy)),
            size: q.size,
          },
        });
        return;
      }
      if (dragging === 'authorityName' && s.authorityName) {
        const a = s.authorityName;
        onLayoutPatch?.({
          authorityName: { ...a, x: Math.max(0, Math.min(1, a.x + dx)), y: Math.max(0, Math.min(1, a.y + dy)) },
        });
        return;
      }
      if (dragging === 'designation' && s.designation) {
        const d = s.designation;
        onLayoutPatch?.({
          designation: { ...d, x: Math.max(0, Math.min(1, d.x + dx)), y: Math.max(0, Math.min(1, d.y + dy)) },
        });
        return;
      }
      if (dragging === 'recipientName' && s.recipientName) {
        const r = s.recipientName;
        onLayoutPatch?.({
          recipientName: { ...r, x: Math.max(0, Math.min(1, r.x + dx)), y: Math.max(0, Math.min(1, r.y + dy)) },
        });
        return;
      }
      if (dragging === 'bodyBlock' && s.bodyBlock) {
        const b = s.bodyBlock;
        onLayoutPatch?.({
          bodyBlock: { ...b, x: Math.max(0, Math.min(1, b.x + dx)), y: Math.max(0, Math.min(1, b.y + dy)) },
        });
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
    e.preventDefault();
    e.stopPropagation();
    const { nx, ny } = toLocal(e.clientX, e.clientY);
    const L = layoutRef.current;
    const lp = logoPosRef.current;

    const snapMap: any = {
      logo: { logo: { ...lp } },
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
    if (!interactive) return;
    e.preventDefault();
    e.stopPropagation();
    const { nx, ny } = toLocal(e.clientX, e.clientY);
    const L = layoutRef.current;
    const lp = logoPosRef.current;

    const snapMap: any = {
      logo: { logo: { ...lp } },
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

  const ResizeHandle = ({ onStart }: { onStart: (e: React.PointerEvent) => void }) => (
    <div 
      className="absolute bottom-0 right-0 w-3 h-3 bg-prime-600 rounded-full border border-white shadow-md cursor-nwse-resize z-20 -mr-1.5 -mb-1.5"
      onPointerDown={onStart}
    />
  );

  const logoTopPct = (1 - logoPos.y) * 100;
  const ring = interactive ? 'ring-2 ring-prime-500 ring-offset-1 rounded z-10' : '';

  const [currentScale, setCurrentScale] = useState(scale);

  useEffect(() => {
    if (!wrapRef.current || !wrapRef.current.parentElement) return;
    const parent = wrapRef.current.parentElement;

    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        const width = entry.contentRect.width;
        if (width > 0) {
          setCurrentScale(width / W);
        }
      }
    });

    observer.observe(parent);
    return () => observer.disconnect();
  }, []);

  return (
    <div style={{ width: '100%', minWidth: 280, height: H * currentScale, overflow: 'hidden' }}>
        <div
          ref={wrapRef}
          className="relative overflow-hidden"
          style={{
            width: W,
            height: H,
            transform: `scale(${currentScale})`,
            transformOrigin: 'top left',
            background: 'linear-gradient(135deg, #f8fafc 0%, #ffffff 60%, #f0fdfa 100%)',
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
            fontFamily: 'inherit',
          }}
        >
          <div className="absolute inset-3 border border-prime-200 rounded pointer-events-none" />
      <div className="absolute inset-4 border border-prime-100 rounded pointer-events-none" />

      <div
        className={`absolute ${interactive ? 'cursor-grab active:cursor-grabbing' : ''} ${ring}`}
        style={{
          left: `${logoPos.x * 100}%`,
          top: `${logoTopPct}%`,
          width: `${logoPos.size * 100}%`,
          height: `${logoPos.size * W}px`,
          minHeight: '40px'
        }}
        onPointerDown={e => startDrag('logo', e)}
      >
        {logoUrl ? (
          <img src={logoUrl} alt="Logo" className="w-full h-full object-contain pointer-events-none" draggable={false} />
        ) : (
          <Placeholder />
        )}
        {interactive && <ResizeHandle onStart={e => startResize('logo', e)} />}
      </div>

      <p
        className="absolute left-1/2 -translate-x-1/2 font-cert text-3xl font-bold text-studio-heading tracking-wide text-center pointer-events-none"
        style={{ top: '10%', width: '90%' }}
      >
        Certificate of Achievement
      </p>
      <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-3 w-64 pointer-events-none" style={{ top: '18%' }}>
        <div className="flex-1 h-px bg-prime-300" />
        <div className="w-1.5 h-1.5 rounded-full bg-prime-400" />
        <div className="flex-1 h-px bg-prime-300" />
      </div>
      <p className="absolute left-1/2 -translate-x-1/2 text-xs text-studio-muted uppercase tracking-widest text-center pointer-events-none" style={{ top: '24%', width: '90%' }}>
        This is to certify that
      </p>

      <div
        className={`absolute text-center flex items-center justify-center ${interactive ? 'cursor-grab active:cursor-grabbing' : ''} ${ring}`}
        style={{
          left: `${layout.recipientName.x * 100}%`,
          top: `${layout.recipientName.y * 100}%`,
          transform: `translate(-50%, -50%) scale(${layout.recipientName.scale})`,
          width: '85%',
          minHeight: '40px'
        }}
        onPointerDown={e => startDrag('recipientName', e)}
      >
        {name ? (
          <p className="font-cert text-4xl font-bold text-prime-600 leading-tight">{name}</p>
        ) : (
          <div className="w-3/5 h-8">
            <Placeholder />
          </div>
        )}
        {interactive && <ResizeHandle onStart={e => startResize('recipientName', e)} />}
      </div>

      <div
        className={`absolute text-center ${interactive ? 'cursor-grab active:cursor-grabbing' : ''} ${ring}`}
        style={{
          left: `${layout.bodyBlock.x * 100}%`,
          top: `${layout.bodyBlock.y * 100}%`,
          transform: `translate(-50%, -50%) scale(${layout.bodyBlock.scale})`,
          width: '88%',
        }}
        onPointerDown={e => startDrag('bodyBlock', e)}
      >
        <p className="text-sm text-studio-label mb-1">
          has been awarded the role of <span className="font-semibold text-studio-heading">{role || 'Role'}</span>
        </p>
        <p className="text-sm text-studio-label mb-1">
          at <span className="font-semibold text-studio-heading">{eventName || 'Event Name'}</span>
        </p>
        <p className="text-xs text-studio-muted mt-1">
          {organization || 'Organization'} &nbsp;·&nbsp; {date || 'Date'}
        </p>
        {interactive && <ResizeHandle onStart={e => startResize('bodyBlock', e)} />}
      </div>

      <div
        className={`absolute ${interactive ? 'cursor-grab active:cursor-grabbing' : ''} ${ring}`}
        style={{
          left: `${layout.signature.x * 100}%`,
          top: `${layout.signature.y * 100}%`,
          width: `${layout.signature.w * 100}%`,
          height: `${layout.signature.h * 100}%`,
        }}
        onPointerDown={e => startDrag('signature', e)}
      >
        {signatureUrl ? (
          <img src={signatureUrl} alt="Signature" className="w-full h-full object-contain pointer-events-none" />
        ) : (
          <Placeholder />
        )}
        {interactive && <ResizeHandle onStart={e => startResize('signature', e)} />}
      </div>

      <div
        className={`absolute text-center ${interactive ? 'cursor-grab active:cursor-grabbing' : ''} ${ring}`}
        style={{
          left: `${layout.authorityName.x * 100}%`,
          top: `${layout.authorityName.y * 100}%`,
          transform: `translate(-50%, -50%) scale(${layout.authorityName.scale})`,
          width: '40%',
          minHeight: '20px'
        }}
        onPointerDown={e => startDrag('authorityName', e)}
      >
        <p className="text-xs font-semibold text-studio-heading">{authorityName || 'Authority Name'}</p>
        {interactive && <ResizeHandle onStart={e => startResize('authorityName', e)} />}
      </div>

      <div
        className={`absolute text-center ${interactive ? 'cursor-grab active:cursor-grabbing' : ''} ${ring}`}
        style={{
          left: `${layout.designation.x * 100}%`,
          top: `${layout.designation.y * 100}%`,
          transform: `translate(-50%, -50%) scale(${layout.designation.scale})`,
          width: '40%',
          minHeight: '20px'
        }}
        onPointerDown={e => startDrag('designation', e)}
      >
        <p className="text-xs text-studio-muted">{authorityPosition || 'Position'}</p>
        {interactive && <ResizeHandle onStart={e => startResize('designation', e)} />}
      </div>

      <div
        className={`absolute flex flex-col items-center gap-0.5 ${interactive ? 'cursor-grab active:cursor-grabbing' : ''} ${ring}`}
        style={{
          left: `${layout.qr.x * 100}%`,
          top: `${layout.qr.y * 100}%`,
          width: `${layout.qr.size * 100}%`,
        }}
        onPointerDown={e => startDrag('qr', e)}
      >
        <div className="w-full aspect-square bg-studio-border rounded flex items-center justify-center relative">
          <svg className="w-[60%] h-[60%] text-studio-muted" viewBox="0 0 24 24" fill="currentColor">
            <path d="M3 3h7v7H3V3zm2 2v3h3V5H5zm9-2h7v7h-7V3zm2 2v3h3V5h-3zM3 14h7v7H3v-7zm2 2v3h3v-3H5zm9 0h2v2h-2v-2zm4 0h2v2h-2v-2zm-4 4h2v2h-2v-2zm4 0h2v2h-2v-2zm-2-2h2v2h-2v-2z" />
          </svg>
          {interactive && <ResizeHandle onStart={e => startResize('qr', e)} />}
        </div>
        <p className="text-[9px] text-studio-muted text-center leading-tight">Cert ID: —</p>
      </div>
      </div>
    </div>
  );
}
