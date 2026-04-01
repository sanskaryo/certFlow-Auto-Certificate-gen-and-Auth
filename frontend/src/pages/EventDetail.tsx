import { useEffect, useState, useMemo, useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import useStudioReducer from './studio/useStudioReducer';
import { validateStep } from './studio/utils';
import { PreviewData, CsvRow, mergeCertificateLayout } from './studio/types';
import StepIndicator from './studio/StepIndicator';
import StepContainer from './studio/StepContainer';
import PreviewPanel from './studio/PreviewPanel';
import ModeSelector from './studio/ModeSelector';
import BrandingStep from './studio/BrandingStep';
import RecipientStep from './studio/RecipientStep';
import AuthorityStep from './studio/AuthorityStep';
import ConfirmationStep from './studio/ConfirmationStep';
import SuccessState from './studio/SuccessState';
import CertificateLayoutEditor from './studio/CertificateLayoutEditor';
import { API_BASE } from '../lib/api';

const API = API_BASE;

type Template = { id: string; name: string; bg: string; title: string };
type Toast = { msg: string; type: 'success' | 'error' | 'info' } | null;

const STEP_LABELS = ['Mode', 'Template & Branding', 'Recipient Details', 'Authority', 'Confirm & Generate'];

export default function EventDetail() {
  const { id } = useParams<{ id: string }>();
  const token = localStorage.getItem('token');

  const { state, dispatch } = useStudioReducer();

  const [templates, setTemplates] = useState<Template[]>([]);
  const [eventData, setEventData] = useState<any>(null);
  const [toast, setToast] = useState<Toast>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [eventStats, setEventStats] = useState<any>(null);
  const [progress, setProgress] = useState<{ total: number; success: number; failed: number } | null>(null);
  const [debouncedPreview, setDebouncedPreview] = useState<PreviewData | null>(null);

  const authHeaders = useMemo<Record<string, string>>(
    () => (token ? { Authorization: `Bearer ${token}` } : ({} as Record<string, string>)),
    [token]
  );

  // ── Toast helper ──────────────────────────────────────────────────────────
  const notify = useCallback((msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  // ── On mount: fetch templates + event data ────────────────────────────────
  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const [tplRes, evtRes, statsRes] = await Promise.all([
          fetch(`${API}/events/templates`),
          fetch(`${API}/events/${id}`, { headers: authHeaders }),
          fetch(`${API}/events/${id}/analytics`, { headers: authHeaders }),
        ]);

        let fetchedTemplates: Template[] = [];
        if (tplRes.ok) {
          const data = await tplRes.json();
          fetchedTemplates = data.templates || [];
        }
        
        if (statsRes.ok) {
            const statsData = await statsRes.json();
            setEventStats(statsData);
        }

        if (evtRes.ok) {
          const evtData = await evtRes.json();
          setEventData(evtData);

          // Pre-fill single fields
          dispatch({ type: 'UPDATE_SINGLE', field: 'organization', value: evtData.organization || 'Event Organizer' });
          dispatch({ type: 'UPDATE_SINGLE', field: 'date_text', value: evtData.date_text || new Date().toISOString().split('T')[0] });

          // Pre-fill authority
          dispatch({ type: 'UPDATE_AUTHORITY', patch: { name: evtData.authority_name || '', position: evtData.authority_position || '' } });

          // Pre-fill branding
          const logoPos = evtData.logo_position || { x: 0.03, y: 0.82, size: 0.18 };
          const templateId = evtData.template_id || 'classic-blue';
          dispatch({ type: 'UPDATE_BRANDING', patch: { templateId, logoPos, aiPrompt: evtData.description || '' } });
          dispatch({
            type: 'UPDATE_CERTIFICATE_LAYOUT',
            patch: mergeCertificateLayout(evtData.certificate_layout),
          });

          // Handle custom/ai template
          if (evtData.template_id === 'ai-generated' || evtData.template_path) {
            const customId = evtData.template_id || 'ai-generated';
            if (!fetchedTemplates.find(t => t.id === customId)) {
              fetchedTemplates = [
                { id: customId, name: customId === 'ai-generated' ? 'AI Generated' : 'Custom Upload', bg: '', title: '' },
                ...fetchedTemplates,
              ];
            }
          }
        }

        if (!fetchedTemplates.find(t => t.id === 'ai-generated')) {
          fetchedTemplates.push({ id: 'ai-generated', name: 'AI Generated', bg: '', title: '' });
        }
        setTemplates(fetchedTemplates);
      } catch (e) {
        console.error('Failed to fetch event data', e);
      }
    })();
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derive PreviewData from state ─────────────────────────────────────────
  const previewData = useMemo<PreviewData>(() => {
    const logoUrl = state.branding.logoPreviewUrl
      ? state.branding.logoPreviewUrl
      : eventData?.logo_path
      ? `${API}/${eventData.logo_path.replace(/\\/g, '/')}`
      : null;

    const signatureUrl = state.authority.sigPreviewUrl
      ? state.authority.sigPreviewUrl
      : eventData?.signature_path
      ? `${API}/${eventData.signature_path.replace(/\\/g, '/')}`
      : null;

    return {
      name: state.single.participant_name || (state.mode !== 'single' ? 'Multiple Recipients' : ''),
      role: state.single.role,
      eventName: eventData?.name || '',
      organization: state.single.organization,
      date: state.single.date_text,
      authorityName: state.authority.name,
      authorityPosition: state.authority.position,
      logoUrl,
      logoPos: state.branding.logoPos,
      signatureUrl,
      templateId: state.branding.templateId,
      certificateLayout: state.certificateLayout,
    };
  }, [state, eventData]);

  // ── Debounce preview 300ms ────────────────────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedPreview(previewData), 300);
    return () => clearTimeout(timer);
  }, [previewData]);

  // ── Navigation ────────────────────────────────────────────────────────────
  const goToStep = useCallback((n: number) => {
    if (n < state.step) dispatch({ type: 'SET_STEP', step: n });
  }, [state.step, dispatch]);

  const validateAndAdvance = useCallback(() => {
    const errors = validateStep(state.step, state);
    if (Object.keys(errors).length > 0) {
      dispatch({ type: 'SET_ERRORS', errors });
      return;
    }
    dispatch({ type: 'SET_ERRORS', errors: {} });
    dispatch({ type: 'ADVANCE_STEP' });
  }, [state, dispatch]);

  const goToPreviousStep = useCallback(() => {
    if (state.step > 0) {
      dispatch({ type: 'SET_STEP', step: state.step - 1 });
    }
  }, [state.step, dispatch]);

  // ── Generation ────────────────────────────────────────────────────────────
  const handleGenerate = useCallback(async () => {
    if (!id) return;
    setIsGenerating(true);
    dispatch({ type: 'SET_GENERATION_STATUS', status: 'generating' });

    try {
      if (state.mode === 'single') {
        const body = {
          participant_name: state.single.participant_name,
          event_name: eventData?.name || '',
          organization: state.single.organization,
          date_text: state.single.date_text,
          role: state.single.role,
          email: state.single.email,
          template_id: state.branding.templateId,
        };
        const res = await fetch(`${API}/events/${id}/generate/manual`, {
          method: 'POST',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || 'Generation failed');
        dispatch({ type: 'SET_GENERATION_STATUS', status: 'success' });
        dispatch({
          type: 'SET_RESULT',
          result: {
            certificateId: data.certificate_id || null,
            verificationLink: data.verification_link || null,
            previewLink: data.preview_link || null,
            successCount: 1,
            totalCount: 1,
          },
        });
      } else if (state.mode === 'bulk') {
        const validLines = state.bulk.parsedLines.filter(l => l.valid);
        setProgress({ total: validLines.length, success: 0, failed: 0 });
        const body = {
          participants: validLines.map(l => ({ name: l.name, email: l.email, role: l.role })),
          event_name: eventData?.name || '',
          organization: state.single.organization,
          date_text: state.single.date_text,
          template_id: state.branding.templateId,
        };
        const res = await fetch(`${API}/events/${id}/generate/manual-bulk`, {
          method: 'POST',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || 'Bulk generation failed');
        const successCount = data.certificates?.length ?? validLines.length;
        setProgress({ total: validLines.length, success: successCount, failed: validLines.length - successCount });
        dispatch({ type: 'SET_GENERATION_STATUS', status: 'success' });
        dispatch({ type: 'SET_RESULT', result: { successCount, totalCount: validLines.length } });
      } else {
        // CSV mode
        if (!state.csv.file) throw new Error('No CSV file selected');
        const validRows = state.csv.parsedRows.filter(r => r.valid);
        setProgress({ total: validRows.length, success: 0, failed: 0 });

        // Step 1: upload participants
        const fd = new FormData();
        fd.append('file', state.csv.file);
        const uploadRes = await fetch(`${API}/events/${id}/participants`, {
          method: 'POST',
          headers: authHeaders,
          body: fd,
        });
        if (!uploadRes.ok) {
          const e = await uploadRes.json().catch(() => ({}));
          throw new Error(e.detail || 'CSV upload failed');
        }

        // Step 2: trigger generation
        const genRes = await fetch(`${API}/events/${id}/generate`, {
          method: 'POST',
          headers: authHeaders,
        });
        const genData = await genRes.json();
        if (!genRes.ok) throw new Error(genData.detail || 'Generation failed');

        const successCount = genData.success_count ?? validRows.length;
        const totalCount = genData.total_count ?? validRows.length;
        setProgress({ total: totalCount, success: successCount, failed: totalCount - successCount });
        dispatch({ type: 'SET_GENERATION_STATUS', status: 'success' });
        dispatch({ type: 'SET_RESULT', result: { successCount, totalCount } });
      }
    } catch (err: any) {
      dispatch({ type: 'SET_GENERATION_STATUS', status: 'error' });
      notify(err.message || 'Generation failed', 'error');
    } finally {
      setIsGenerating(false);
    }
  }, [id, state, eventData, authHeaders, dispatch, notify]);

  // ── Download ZIP ──────────────────────────────────────────────────────────
  const downloadZip = useCallback(async () => {
    if (!id) return;
    try {
      const res = await fetch(`${API}/events/${id}/download`, { headers: authHeaders });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        notify(e.detail || 'Download failed', 'error');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `event_${id}_certificates.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      notify('Error downloading ZIP', 'error');
    }
  }, [id, authHeaders, notify]);

  // ── Render active step ────────────────────────────────────────────────────
  function renderActiveStep() {
    if (state.generationStatus === 'success') {
      return (
        <SuccessState
          result={state.result}
          mode={state.mode}
          email={state.single.email}
          eventId={id!}
          token={token}
          onReset={() => dispatch({ type: 'RESET' })}
          onNotify={notify}
          apiBase={API}
        />
      );
    }

    switch (state.step) {
      case 0:
        return (
          <div className="space-y-6">
            <ModeSelector
              activeMode={state.mode}
              onSelect={mode => dispatch({ type: 'SET_MODE', mode })}
            />
            <button
              type="button"
              onClick={validateAndAdvance}
              className="w-full bg-teal-600 hover:bg-teal-700 text-white font-semibold py-3 rounded-xl transition text-sm"
            >
              Next: Template &amp; Branding
            </button>
          </div>
        );

      case 1:
        return (
          <BrandingStep
            branding={state.branding}
            templates={templates}
            eventId={id!}
            token={token}
            onBrandingChange={patch => dispatch({ type: 'UPDATE_BRANDING', patch })}
            onNotify={notify}
            onNext={validateAndAdvance}
          />
        );

      case 2:
        return (
          <RecipientStep
            mode={state.mode}
            single={state.single}
            bulk={state.bulk}
            csv={state.csv}
            errors={state.errors}
            eventName={eventData?.name || ''}
            onSingleChange={(field, value) => dispatch({ type: 'UPDATE_SINGLE', field, value })}
            onBulkTextChange={text => dispatch({ type: 'UPDATE_BULK_TEXT', text })}
            onCsvFileSelect={(file, rows: CsvRow[]) => dispatch({ type: 'SET_CSV_FILE', file, rows })}
            onNext={validateAndAdvance}
          />
        );

      case 3:
        return (
          <AuthorityStep
            authority={state.authority}
            errors={state.errors}
            eventId={id!}
            token={token}
            onAuthorityChange={patch => dispatch({ type: 'UPDATE_AUTHORITY', patch })}
            onNotify={notify}
            onNext={validateAndAdvance}
          />
        );

      case 4:
        return (
          <ConfirmationStep
            state={state}
            eventData={eventData}
            onGoToStep={goToStep}
            onGenerate={handleGenerate}
            isGenerating={isGenerating}
            progress={progress}
          />
        );

      default:
        return null;
    }
  }

  // ── Toast colors ──────────────────────────────────────────────────────────
  const toastBg = toast?.type === 'success' ? 'bg-emerald-600' : toast?.type === 'error' ? 'bg-red-600' : 'bg-gray-800';

  return (
    <div className="min-h-screen space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-1.5 text-sm text-prime-600 font-semibold hover:text-prime-700 transition mb-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
            </svg>
            Back to Dashboard
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">Certificate Studio</h1>
          {eventData && <p className="text-gray-500 mt-1 text-sm">📅 {eventData.name}</p>}
        </div>
        <button
          onClick={downloadZip}
          className="inline-flex items-center gap-2 bg-gradient-to-r from-prime-600 to-accent-600 hover:from-prime-700 hover:to-accent-700 text-white px-6 py-3 rounded-xl font-semibold shadow-lg shadow-prime-500/20 transition-all active:scale-95"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Download ZIP
        </button>
      </div>

      {eventStats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-white/70 backdrop-blur-sm p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center">
                <p className="text-gray-500 text-xs font-semibold mb-1">Issued</p>
                <p className="text-2xl font-bold text-prime-600">{eventStats.issued || 0}</p>
            </div>
            <div className="bg-white/70 backdrop-blur-sm p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center">
                <p className="text-gray-500 text-xs font-semibold mb-1">Opened</p>
                <p className="text-2xl font-bold text-teal-600">{eventStats.opened || 0}</p>
            </div>
            <div className="bg-white/70 backdrop-blur-sm p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center">
                <p className="text-gray-500 text-xs font-semibold mb-1">Shared</p>
                <p className="text-2xl font-bold text-blue-600">{eventStats.shared || 0}</p>
            </div>
            <div className="bg-white/70 backdrop-blur-sm p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center">
                <p className="text-gray-500 text-xs font-semibold mb-1">Verified</p>
                <p className="text-2xl font-bold text-purple-600">{eventStats.verified || 0}</p>
            </div>
            <div className="bg-white/70 backdrop-blur-sm p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center">
                <p className="text-gray-500 text-xs font-semibold mb-1">Emailed</p>
                <p className="text-2xl font-bold text-indigo-600">{eventStats.emailed || 0}</p>
            </div>
        </div>
      )}

      {id && eventData && state.generationStatus !== 'success' && (
        <CertificateLayoutEditor
          eventId={id}
          previewData={previewData}
          dispatch={dispatch}
          authHeaders={authHeaders}
          onNotify={notify}
        />
      )}

      {/* Main two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-6">
        {/* Left: step indicator + active step */}
        <div className="space-y-4">
          {state.generationStatus !== 'success' && (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <StepIndicator
                currentStep={state.step}
                totalSteps={STEP_LABELS.length}
                label={STEP_LABELS[state.step] ?? ''}
                onNavigate={goToStep}
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={goToPreviousStep}
                  disabled={state.step === 0}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  Previous
                </button>
                {state.step < STEP_LABELS.length - 1 && (
                  <button
                    type="button"
                    onClick={validateAndAdvance}
                    className="px-3 py-1.5 rounded-lg bg-prime-600 hover:bg-prime-700 text-sm font-semibold text-white transition"
                  >
                    Next
                  </button>
                )}
              </div>
            </div>
          )}
          <StepContainer>
            {renderActiveStep()}
          </StepContainer>
        </div>

        {/* Right: preview panel */}
        <div>
          {debouncedPreview && (
            <PreviewPanel data={debouncedPreview} eventData={eventData} />
          )}
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl text-white text-sm font-semibold shadow-lg transition-all ${toastBg}`}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}
