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
    { label: 'Template Selected', filled: !!data.templateId },
    { label: 'Recipient Name', filled: !!data.name },
    { label: 'Event Info', filled: !!data.eventName },
    { label: 'Authority Set', filled: !!data.authorityName },
    { label: 'Secure Hash Enabled', filled: true },
    { label: 'QR Verification Enabled', filled: true },
  ];

  const openModal = () => dialogRef.current?.showModal();
  const closeModal = () => dialogRef.current?.close();

  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === dialogRef.current) closeModal();
  };

  // Scale the 794px-wide cert to fit within the panel (~320px wide)
  const previewScale = 320 / 794;
  const previewHeight = 561 * previewScale;

  if (currentStep === 0) {
    return (
      <div className="sticky top-6 w-full min-w-[280px] bg-gray-50 border border-dashed border-gray-200 rounded-2xl p-8 flex flex-col items-center justify-center text-center gap-4 min-h-[300px]">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center text-gray-400">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
        <p className="text-sm font-medium text-gray-500">Preview will appear after you select a template</p>
      </div>
    );
  }

  return (
    <>
      <div className="sticky top-6 max-h-[calc(100vh-3rem)] overflow-y-auto space-y-4 min-w-[280px]">
        {/* Header */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-900">Live Preview</span>
          <span className="text-[10px] uppercase tracking-wider font-bold bg-[#0d9488]/10 text-[#0d9488] px-2 py-0.5 rounded-full">
            Step {currentStep + 1}
          </span>
        </div>

        {/* Certificate preview scaled to fit */}
        <div
          className="relative overflow-hidden rounded-xl border border-gray-100 shadow-sm"
          style={{ height: previewHeight }}
        >
          <CertPreview 
            data={data} 
            scale={previewScale} 
            interactive={true} 
            onLayoutPatch={onLayoutPatch} 
            onLogoPosChange={onLogoPosChange} 
          />
        </div>

        {/* Open full preview button */}
        <button
          onClick={openModal}
          className="w-full text-xs font-bold uppercase tracking-wider text-[#0d9488] border border-[#0d9488]/20 rounded-xl py-3 hover:bg-[#0d9488]/5 transition-all"
        >
          View Full Size
        </button>

        {/* Checklist */}
        <div className="bg-gray-50 border border-gray-100 rounded-xl p-4">
          <FieldChecklist items={checklistItems} />
        </div>
      </div>

      {/* Full-screen modal */}
      <dialog
        ref={dialogRef}
        onClick={handleBackdropClick}
        className="fixed inset-0 m-0 w-full h-full max-w-none max-h-none bg-transparent p-0 backdrop:bg-black/80"
      >
        <div className="flex items-center justify-center w-full h-full">
          <div className="relative">
            {/* Close button */}
            <button
              onClick={closeModal}
              className="absolute -top-12 right-0 text-white text-sm font-bold flex items-center gap-2 hover:text-gray-300 transition-colors"
            >
              <svg className="w-5 h-5" viewBox="0 0 16 16" fill="none">
                <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              ESC TO CLOSE
            </button>

            {/* Cert at ~85% of viewport width */}
            {(() => {
              const modalScale = Math.min((window.innerWidth * 0.85) / 794, (window.innerHeight * 0.85) / 561);
              const modalW = 794 * modalScale;
              const modalH = 561 * modalScale;
              return (
                <div style={{ width: modalW, height: modalH, position: 'relative', overflow: 'hidden' }}>
                  <CertPreview data={data} scale={modalScale} />
                </div>
              );
            })()}
          </div>
        </div>
      </dialog>
    </>
  );
}
