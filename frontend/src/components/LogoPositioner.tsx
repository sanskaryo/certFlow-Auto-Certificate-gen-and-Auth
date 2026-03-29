import { useRef, useState, useCallback, useEffect } from 'react';

// Certificate aspect ratio: A4 landscape = 297 x 210 mm
const CERT_W = 297;
const CERT_H = 210;
const ASPECT = CERT_W / CERT_H; // ~1.414

export type LogoPos = { x: number; y: number; size: number };

interface Props {
  logoUrl: string | null;       // preview URL of uploaded logo
  initial: LogoPos;
  onChange: (pos: LogoPos) => void;
  onSave: (pos: LogoPos) => void;
  templateColor?: string;       // bg hex for the mock cert
}

const PRESETS: { label: string; pos: LogoPos }[] = [
  { label: 'Top Left',    pos: { x: 0.03, y: 0.82, size: 0.18 } },
  { label: 'Top Center',  pos: { x: 0.41, y: 0.82, size: 0.18 } },
  { label: 'Top Right',   pos: { x: 0.76, y: 0.82, size: 0.18 } },
  { label: 'Bottom Left', pos: { x: 0.03, y: 0.22, size: 0.18 } },
];

export default function LogoPositioner({ logoUrl, initial, onChange, onSave, templateColor = '#e8f1ff' }: Props) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<LogoPos>(initial);
  const [dragging, setDragging] = useState(false);
  const [saved, setSaved] = useState(false);
  const dragStart = useRef<{ mx: number; my: number; ox: number; oy: number } | null>(null);

  // Keep in sync if parent resets
  useEffect(() => { setPos(initial); }, [initial.x, initial.y, initial.size]);

  const canvasSize = useCallback(() => {
    const el = canvasRef.current;
    if (!el) return { w: 400, h: 283 };
    return { w: el.clientWidth, h: el.clientHeight };
  }, []);

  // Convert fraction pos → pixel pos of logo top-left corner on canvas
  const toPixels = (p: LogoPos, w: number, h: number) => {
    const logoW = w * p.size;
    const logoH = logoW;
    // x is left edge fraction, y is top edge fraction (0=top in screen coords)
    const px = p.x * w;
    const py = (1 - p.y) * h - logoH; // flip: y=1 means top of cert
    return { px, py, logoW, logoH };
  };

  const toFraction = (px: number, py: number, logoW: number, w: number, h: number): Pick<LogoPos, 'x' | 'y'> => {
    const x = Math.max(0, Math.min(1 - pos.size, px / w));
    // py is top-left in screen coords; convert back to fraction where y=1 is top
    const y = Math.max(0, Math.min(1, 1 - (py + logoW) / h));
    return { x, y };
  };

  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const { w, h } = canvasSize();
    const { px, py } = toPixels(pos, w, h);
    dragStart.current = { mx: e.clientX, my: e.clientY, ox: px, oy: py };
    setDragging(true);
  };

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!dragging || !dragStart.current) return;
    const { w, h } = canvasSize();
    const { logoW } = toPixels(pos, w, h);
    const dx = e.clientX - dragStart.current.mx;
    const dy = e.clientY - dragStart.current.my;
    const newPx = dragStart.current.ox + dx;
    const newPy = dragStart.current.oy + dy;
    const { x, y } = toFraction(newPx, newPy, logoW, w, h);
    const next = { ...pos, x, y };
    setPos(next);
    onChange(next);
  }, [dragging, pos, canvasSize, onChange]);

  const onMouseUp = useCallback(() => { setDragging(false); dragStart.current = null; }, []);

  useEffect(() => {
    if (dragging) {
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [dragging, onMouseMove, onMouseUp]);

  // Touch support
  const onTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    const t = e.touches[0];
    const { w, h } = canvasSize();
    const { px, py } = toPixels(pos, w, h);
    dragStart.current = { mx: t.clientX, my: t.clientY, ox: px, oy: py };
    setDragging(true);
  };

  const onTouchMove = useCallback((e: TouchEvent) => {
    if (!dragging || !dragStart.current) return;
    const t = e.touches[0];
    const { w, h } = canvasSize();
    const { logoW } = toPixels(pos, w, h);
    const dx = t.clientX - dragStart.current.mx;
    const dy = t.clientY - dragStart.current.my;
    const newPx = dragStart.current.ox + dx;
    const newPy = dragStart.current.oy + dy;
    const { x, y } = toFraction(newPx, newPy, logoW, w, h);
    const next = { ...pos, x, y };
    setPos(next);
    onChange(next);
  }, [dragging, pos, canvasSize, onChange]);

  const onTouchEnd = useCallback(() => { setDragging(false); dragStart.current = null; }, []);

  useEffect(() => {
    if (dragging) {
      window.addEventListener('touchmove', onTouchMove, { passive: false });
      window.addEventListener('touchend', onTouchEnd);
    }
    return () => {
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [dragging, onTouchMove, onTouchEnd]);

  const handleSave = () => {
    onSave(pos);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const applyPreset = (p: LogoPos) => {
    setPos(p);
    onChange(p);
  };

  // Render — we need clientWidth so use a ResizeObserver trick via inline style
  const [canvasW, setCanvasW] = useState(400);
  const [canvasH, setCanvasH] = useState(Math.round(400 / ASPECT));

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      const w = entries[0].contentRect.width;
      setCanvasW(w);
      setCanvasH(Math.round(w / ASPECT));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { px, py, logoW, logoH } = toPixels(pos, canvasW, canvasH);

  return (
    <div className="space-y-3">
      {/* Preset buttons */}
      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map(p => (
          <button
            key={p.label}
            type="button"
            onClick={() => applyPreset(p.pos)}
            className="text-xs px-2.5 py-1 rounded-lg border border-gray-200 bg-white hover:border-prime-400 hover:text-prime-700 transition font-medium"
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Canvas */}
      <div
        ref={canvasRef}
        className="relative w-full rounded-xl overflow-hidden border-2 border-dashed border-gray-200 select-none"
        style={{ height: canvasH, background: templateColor, cursor: dragging ? 'grabbing' : 'default' }}
      >
        {/* Mock cert lines */}
        <div className="absolute inset-0 pointer-events-none opacity-20">
          <div className="absolute left-1/2 -translate-x-1/2 top-[28%] w-2/3 h-1.5 bg-gray-500 rounded" />
          <div className="absolute left-1/2 -translate-x-1/2 top-[42%] w-1/2 h-3 bg-gray-600 rounded" />
          <div className="absolute left-1/2 -translate-x-1/2 top-[56%] w-2/5 h-1 bg-gray-400 rounded" />
          <div className="absolute left-1/2 -translate-x-1/2 top-[64%] w-1/3 h-1 bg-gray-400 rounded" />
          <div className="absolute left-[6%] bottom-[8%] w-[12%] h-[12%] border border-gray-400 rounded" />
        </div>

        {/* Draggable logo */}
        <div
          className={`absolute flex items-center justify-center rounded-lg border-2 transition-shadow ${
            dragging
              ? 'border-prime-500 shadow-lg shadow-prime-500/30 cursor-grabbing'
              : 'border-prime-400 border-dashed cursor-grab hover:border-prime-500 hover:shadow-md'
          }`}
          style={{
            left: px,
            top: py,
            width: logoW,
            height: logoH,
            background: logoUrl ? 'transparent' : 'rgba(255,255,255,0.7)',
          }}
          onMouseDown={onMouseDown}
          onTouchStart={onTouchStart}
        >
          {logoUrl ? (
            <img
              src={logoUrl}
              alt="logo"
              className="w-full h-full object-contain pointer-events-none rounded"
              draggable={false}
            />
          ) : (
            <span className="text-xs text-prime-600 font-semibold pointer-events-none select-none text-center px-1">
              Logo
            </span>
          )}
          {/* Drag handle indicator */}
          <div className="absolute -top-2 -right-2 w-4 h-4 bg-prime-500 rounded-full flex items-center justify-center pointer-events-none">
            <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 3a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V4a1 1 0 011-1z" />
            </svg>
          </div>
        </div>

        {/* Hint */}
        {!dragging && (
          <div className="absolute bottom-1.5 right-2 text-xs text-gray-400 pointer-events-none">
            drag to reposition
          </div>
        )}
      </div>

      {/* Size slider */}
      <div className="flex items-center gap-3">
        <label className="text-xs font-semibold text-gray-500 whitespace-nowrap">Logo Size</label>
        <input
          type="range"
          min={5} max={40} step={1}
          value={Math.round(pos.size * 100)}
          onChange={e => {
            const next = { ...pos, size: parseInt(e.target.value) / 100 };
            setPos(next);
            onChange(next);
          }}
          className="flex-1 accent-teal-600"
        />
        <span className="text-xs text-gray-500 w-8 text-right">{Math.round(pos.size * 100)}%</span>
      </div>

      {/* Save button */}
      <button
        type="button"
        onClick={handleSave}
        className={`w-full py-2 rounded-xl text-sm font-semibold transition ${
          saved
            ? 'bg-emerald-500 text-white'
            : 'bg-prime-600 hover:bg-prime-700 text-white'
        }`}
      >
        {saved ? '✓ Position Saved' : 'Save Logo Position'}
      </button>
    </div>
  );
}
