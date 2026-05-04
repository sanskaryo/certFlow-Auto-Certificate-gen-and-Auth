import { useRef, useState, useCallback, useEffect } from 'react';

// Certificate aspect ratio: A4 landscape = 297 x 210 mm
const CERT_W = 297;
const CERT_H = 210;
const ASPECT = CERT_W / CERT_H; // ~1.414

export type SigPos = { x: number; y: number; w: number; h: number };

interface Props {
  sigUrl: string | null;
  initial: SigPos;
  onChange: (pos: SigPos) => void;
  onSave: (pos: SigPos) => void;
  templateColor?: string;
}

const PRESETS: { label: string; pos: SigPos }[] = [
  { label: 'Bottom Right', pos: { x: 0.66, y: 0.66, w: 0.24, h: 0.12 } },
  { label: 'Bottom Left', pos: { x: 0.10, y: 0.66, w: 0.24, h: 0.12 } },
  { label: 'Center', pos: { x: 0.38, y: 0.66, w: 0.24, h: 0.12 } },
];

export default function SignaturePositioner({ sigUrl, initial, onChange, onSave, templateColor = '#e8f1ff' }: Props) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<SigPos>(initial);
  const [dragging, setDragging] = useState(false);
  const [saved, setSaved] = useState(false);
  const dragStart = useRef<{ mx: number; my: number; ox: number; oy: number } | null>(null);

  useEffect(() => { setPos(initial); }, [initial.x, initial.y, initial.w, initial.h]);

  const canvasSize = useCallback(() => {
    const el = canvasRef.current;
    if (!el) return { cw: 400, ch: 283 };
    return { cw: el.clientWidth, ch: el.clientHeight };
  }, []);

  const toPixels = (p: SigPos, cw: number, ch: number) => {
    const sigW = cw * p.w;
    const sigH = ch * p.h;
    const px = p.x * cw;
    const py = p.y * ch; // layout elements use y from top
    return { px, py, sigW, sigH };
  };

  const toFraction = (px: number, py: number, cw: number, ch: number): Pick<SigPos, 'x' | 'y'> => {
    const x = Math.max(0, Math.min(1 - pos.w, px / cw));
    const y = Math.max(0, Math.min(1 - pos.h, py / ch));
    return { x, y };
  };

  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const { cw, ch } = canvasSize();
    const { px, py } = toPixels(pos, cw, ch);
    dragStart.current = { mx: e.clientX, my: e.clientY, ox: px, oy: py };
    setDragging(true);
  };

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!dragging || !dragStart.current) return;
    const { cw, ch } = canvasSize();
    const dx = e.clientX - dragStart.current.mx;
    const dy = e.clientY - dragStart.current.my;
    const newPx = dragStart.current.ox + dx;
    const newPy = dragStart.current.oy + dy;
    const { x, y } = toFraction(newPx, newPy, cw, ch);
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

  const handleSave = () => {
    onSave(pos);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const applyPreset = (p: SigPos) => {
    setPos(p);
    onChange(p);
  };

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

  const { px, py, sigW, sigH } = toPixels(pos, canvasW, canvasH);

  return (
    <div className="space-y-3">
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

      <div
        ref={canvasRef}
        className="relative w-full rounded-xl overflow-hidden border-2 border-dashed border-gray-200 select-none"
        style={{ height: canvasH, background: templateColor, cursor: dragging ? 'grabbing' : 'default' }}
      >
        <div className="absolute inset-0 pointer-events-none opacity-20">
          <div className="absolute left-1/2 -translate-x-1/2 top-[28%] w-2/3 h-1.5 bg-gray-500 rounded" />
          <div className="absolute left-1/2 -translate-x-1/2 top-[42%] w-1/2 h-3 bg-gray-600 rounded" />
          <div className="absolute left-1/2 -translate-x-1/2 top-[56%] w-2/5 h-1 bg-gray-400 rounded" />
          <div className="absolute left-1/2 -translate-x-1/2 top-[64%] w-1/3 h-1 bg-gray-400 rounded" />
        </div>

        <div
          className={`absolute flex items-center justify-center rounded-lg border-2 transition-shadow ${
            dragging ? 'border-prime-500 shadow-lg shadow-prime-500/30 cursor-grabbing' : 'border-prime-400 border-dashed cursor-grab hover:border-prime-500 hover:shadow-md'
          }`}
          style={{
            left: px,
            top: py,
            width: sigW,
            height: sigH,
            background: sigUrl ? 'transparent' : 'rgba(255,255,255,0.7)',
          }}
          onMouseDown={onMouseDown}
        >
          {sigUrl ? (
            <img src={sigUrl} alt="Signature" className="w-full h-full object-contain pointer-events-none" draggable={false} />
          ) : (
            <span className="text-xs text-prime-600 font-semibold pointer-events-none select-none text-center px-1">
              Signature
            </span>
          )}
          <div className="absolute -top-2 -right-2 w-4 h-4 bg-prime-500 rounded-full flex items-center justify-center pointer-events-none">
            <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 3a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V4a1 1 0 011-1z" />
            </svg>
          </div>
        </div>

        {!dragging && (
          <div className="absolute bottom-1.5 right-2 text-xs text-gray-400 pointer-events-none">
            drag to reposition
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <label className="text-xs font-semibold text-gray-500 whitespace-nowrap">Width</label>
        <input
          type="range" min={5} max={60} step={1}
          value={Math.round(pos.w * 100)}
          onChange={e => {
            const next = { ...pos, w: parseInt(e.target.value) / 100 };
            setPos(next);
            onChange(next);
          }}
          className="flex-1 accent-prime-600"
        />
        <span className="text-xs text-gray-500 w-8 text-right">{Math.round(pos.w * 100)}%</span>
      </div>

      <div className="flex items-center gap-3">
        <label className="text-xs font-semibold text-gray-500 whitespace-nowrap">Height</label>
        <input
          type="range" min={5} max={40} step={1}
          value={Math.round(pos.h * 100)}
          onChange={e => {
            const next = { ...pos, h: parseInt(e.target.value) / 100 };
            setPos(next);
            onChange(next);
          }}
          className="flex-1 accent-prime-600"
        />
        <span className="text-xs text-gray-500 w-8 text-right">{Math.round(pos.h * 100)}%</span>
      </div>

      <button
        type="button"
        onClick={handleSave}
        className={`w-full py-2 rounded-xl text-sm font-semibold transition ${
          saved ? 'bg-emerald-500 text-white' : 'bg-prime-600 hover:bg-prime-700 text-white'
        }`}
      >
        {saved ? '✓ Position Saved' : 'Save Signature Position'}
      </button>
    </div>
  );
}
