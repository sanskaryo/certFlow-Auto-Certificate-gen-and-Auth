import { useRef } from 'react';
import type { PreviewData, ChecklistItem, CertificateLayout, LogoPos } from './types';
import CertPreview from './CertPreview';
import FieldChecklist from './FieldChecklist';

interface PreviewPanelProps {
  data: PreviewData;
  eventData: any;
  currentStep: number;
  onLayoutPatch?: (patch: Partial<CertificateLayout>) => void;
  onLogoPosChange?: (pos: LogoPos) => void;
}

export default function PreviewPanel({ data, currentStep, onLayoutPatch, onLogoPosChange }: PreviewPanelProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  const checklistItems: ChecklistItem[] = [
    { label: 'Template Selected',       filled: !!data.templateId },
    { label: 'Logo Uploaded',           filled: !!data.logoUrl },
    { label: 'Recipient Name',          filled: !!data.name },
    { label: 'Event Info',              filled: !!data.eventName },
    { label: 'Authority Set',           filled: !!data.authorityName },
    { label: 'QR Verification Enabled', filled: true },
  ];

  const openModal  = () => dialogRef.current?.showModal();
  const closeModal = () => dialogRef.current?.close();

  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === dialogRef.current) closeModal();
  };

  if (currentStep === 0) {
    return (
      <div className="sticky top-6 w-full min-w-[280px] bg-gray-50 border border-dashed border-gray-200 rounded-2xl p-8 flex flex-col items-center justify-center text-center gap-4 min-h-[300px]">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center text-gray-400">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
        <p className="text-sm font-medium text-gray-500">Select a mode to start</p>
      </div>
    );
  }

  return (
    <>
      <div className="sticky top-6 max-h-[calc(100vh-3rem)] overflow-y-auto space-y-3 min-w-[280px]">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-900">Live Preview</span>
            <span className="text-[10px] uppercase tracking-wider font-bold bg-[#0d9488]/10 text-[#0d9488] px-2 py-0.5 rounded-full">
              Step {currentStep + 1}
            </span>
          </div>
          <span className="text-[10px] text-gray-400 italic">Drag elements to reposition</span>
        </div>

        {/* Certificate preview — interactive, drag to reposition */}
        <div className="relative overflow-hidden rounded-xl border border-gray-200 shadow-md">
          <CertPreview
            data={data}
            interactive={true}
            onLayoutPatch={onLayoutPatch}
            onLogoPosChange={onLogoPosChange}
          />
        </div>

        {/* Expand button */}
        <button
          onClick={openModal}
          className="w-full text-xs font-bold uppercase tracking-wider text-[#0d9488] border border-[#0d9488]/30 rounded-xl py-2.5 hover:bg-[#0d9488]/5 transition-all flex items-center justify-center gap-2"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
          </svg>
          Expand &amp; Edit Full Size
        </button>

        {/* Checklist */}
        <div className="bg-gray-50 border border-gray-100 rounded-xl p-4">
          <FieldChecklist items={checklistItems} />
        </div>
      </div>

      {/* ── Full-screen editable modal ────────────────────────────────────── */}
      <dialog
        ref={dialogRef}
        onClick={handleBackdropClick}
        className="fixed inset-0 m-0 w-full h-full max-w-none max-h-none bg-transparent p-0 backdrop:bg-black/85"
      >
        <div className="flex flex-col items-center justify-center w-full h-full gap-3 p-4">
          {/* Top bar */}
          <div className="flex items-center justify-between w-full max-w-5xl">
            <div className="flex items-center gap-3">
              <span className="text-white font-bold text-sm">Full Preview — Drag to edit</span>
              <span className="text-white/50 text-xs">• Changes sync instantly across all panels</span>
            </div>
            <button
              onClick={closeModal}
              className="text-white/70 hover:text-white flex items-center gap-1.5 text-xs font-bold transition-colors border border-white/20 rounded-lg px-3 py-1.5 hover:bg-white/10"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none">
                <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              Close (ESC)
            </button>
          </div>

          {/* Full-size interactive preview */}
          <div
            className="relative overflow-hidden rounded-2xl shadow-2xl border border-white/10"
            style={{
              width: Math.min(window.innerWidth * 0.92, 1050),
              height: Math.min(window.innerHeight * 0.78, 741),
            }}
          >
            <CertPreview
              data={data}
              interactive={true}
              onLayoutPatch={onLayoutPatch}
              onLogoPosChange={onLogoPosChange}
            />
          </div>

          <p className="text-white/40 text-[11px]">
            Click the background to dismiss • Drag logos, signature, text to reposition
          </p>
        </div>
      </dialog>
    </>
  );
}
