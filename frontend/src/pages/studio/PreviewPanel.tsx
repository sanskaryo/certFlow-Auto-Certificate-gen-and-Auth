import { useRef } from 'react';
import type { PreviewData, ChecklistItem } from './types';
import CertPreview from './CertPreview';
import FieldChecklist from './FieldChecklist';

interface PreviewPanelProps {
  data: PreviewData;
  eventData: any;
}

export default function PreviewPanel({ data }: PreviewPanelProps) {
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

  return (
    <>
      <div className="sticky top-6 max-h-[calc(100vh-3rem)] overflow-y-auto space-y-4">
        {/* Header */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-studio-heading">Live Preview</span>
          <span className="text-xs bg-prime-100 text-prime-700 px-2 py-0.5 rounded-full">
            Updates as you type
          </span>
        </div>

        {/* Certificate preview scaled to fit */}
        <div
          className="relative overflow-hidden rounded-lg"
          style={{ height: previewHeight }}
        >
          <CertPreview data={data} scale={previewScale} />
        </div>

        {/* Open full preview button */}
        <button
          onClick={openModal}
          className="w-full text-sm text-prime-600 border border-prime-300 rounded-lg py-2 hover:bg-prime-50 transition-colors"
        >
          Open Full Preview
        </button>

        {/* Checklist */}
        <div className="bg-studio-panel border border-studio-border rounded-lg p-4">
          <FieldChecklist items={checklistItems} />
        </div>
      </div>

      {/* Full-screen modal */}
      <dialog
        ref={dialogRef}
        onClick={handleBackdropClick}
        className="fixed inset-0 m-0 w-full h-full max-w-none max-h-none bg-transparent p-0 backdrop:bg-black/60"
      >
        <div className="flex items-center justify-center w-full h-full">
          <div className="relative">
            {/* Close button */}
            <button
              onClick={closeModal}
              className="absolute -top-10 right-0 text-white text-sm flex items-center gap-1 hover:text-prime-200 transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none">
                <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              Close
            </button>

            {/* Cert at ~80% of viewport width */}
            {(() => {
              const modalScale = Math.min((window.innerWidth * 0.8) / 794, (window.innerHeight * 0.8) / 561);
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
