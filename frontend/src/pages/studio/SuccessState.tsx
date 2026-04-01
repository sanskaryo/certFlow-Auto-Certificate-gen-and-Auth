import { useState } from 'react';
import { GenerationResult, Mode } from './types';

interface SuccessStateProps {
  result: GenerationResult;
  mode: Mode;
  email: string;
  eventId: string;
  token: string | null;
  onReset: () => void;
  onNotify: (msg: string, type: 'success' | 'error' | 'info') => void;
  apiBase: string;
}

export default function SuccessState({
  result,
  mode,
  email,
  eventId,
  token,
  onReset,
  onNotify,
  apiBase,
}: SuccessStateProps) {
  const [emailSending, setEmailSending] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
  const isSingle = mode === 'single';

  async function handleDownload() {
    try {
      let url: string;
      if (isSingle && result.previewLink) {
        url = result.previewLink;
      } else if (isSingle && result.certificateId) {
        url = `${apiBase}/events/${eventId}/certificates/${result.certificateId}/download`;
      } else {
        url = `${apiBase}/events/${eventId}/download`;
      }

      const res = await fetch(url, { headers });
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = isSingle ? 'certificate.pdf' : 'certificates.zip';
      a.click();
    } catch {
      onNotify('Download failed', 'error');
    }
  }

  async function handleSendEmail() {
    if (!result.certificateId) return;
    setEmailSending(true);
    try {
      const res = await fetch(
        `${apiBase}/events/${eventId}/certificates/${result.certificateId}/send-email`,
        { method: 'POST', headers }
      );
      if (!res.ok) throw new Error('Send failed');
      setEmailSent(true);
      onNotify('Email sent successfully', 'success');
    } catch {
      onNotify('Failed to send email', 'error');
    } finally {
      setEmailSending(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-6 py-8 text-center">
      {/* Icon */}
      <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
        <svg className="w-9 h-9 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>

      <div>
        <h2 className="text-xl font-bold text-gray-800">Certificate Created!</h2>
        <p className="text-sm text-gray-500 mt-1">
          Generated: {result.successCount} certificate{result.successCount !== 1 ? 's' : ''}
        </p>
        {result.failedCount > 0 && (
          <p className="text-sm text-red-500 mt-0.5">{result.failedCount} failed</p>
        )}
      </div>

      <div className="flex flex-col gap-3 w-full max-w-xs">
        {/* Download */}
        <button
          type="button"
          onClick={handleDownload}
          className="w-full bg-prime-600 hover:bg-prime-700 text-white font-semibold py-2.5 rounded-xl transition text-sm"
        >
          {isSingle ? 'Download Certificate' : 'Download All (ZIP)'}
        </button>

        {/* Send Email */}
        {email && isSingle && result.certificateId && (
          <button
            type="button"
            onClick={handleSendEmail}
            disabled={emailSending || emailSent}
            className="w-full border border-prime-500 text-prime-600 hover:bg-prime-50 font-semibold py-2.5 rounded-xl transition text-sm disabled:opacity-60"
          >
            {emailSent ? '✓ Email Sent' : emailSending ? 'Sending...' : 'Send Email'}
          </button>
        )}

        {/* Verify */}
        {result.verificationLink && (
          <a
            href={result.verificationLink}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full border border-gray-200 text-gray-600 hover:bg-gray-50 font-semibold py-2.5 rounded-xl transition text-sm text-center"
          >
            Verify Certificate ↗
          </a>
        )}

        {/* Reset */}
        <button
          type="button"
          onClick={onReset}
          className="text-sm text-gray-400 hover:text-gray-600 transition mt-1"
        >
          Generate Another
        </button>
      </div>
    </div>
  );
}
