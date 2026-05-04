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
import FullVisualBuilder from './studio/FullVisualBuilder';
import { API_BASE } from '../lib/api';

const API = API_BASE;

type Template = { id: string; name: string; bg: string; title: string };
type Toast = { msg: string; type: 'success' | 'error' | 'info' } | null;
type StudioDraft = {
  mode: 'single' | 'bulk' | 'csv';
  step: number;
  single: {
    participant_name: string;
    email: string;
    role: string;
    organization: string;
    date_text: string;
  };
  bulk: {
    rawText: string;
    parsedLines: Array<{ raw: string; name: string; email: string; role: string; valid: boolean; error: string | null }>;
  };
  csv: {
    parsedRows: CsvRow[];
  };
  branding: {
    templateId: string;
    aiPrompt: string;
    logoPreviewUrl: string | null;
    logoPos: { x: number; y: number; size: number; shape?: 'rectangle' | 'rounded' | 'circle' | 'oval' };
    logo2Url?: string | null;
    logo3Url?: string | null;
    watermarkUrl?: string | null;
  };
  authority: {
    name: string;
    position: string;
    sigPreviewUrl: string | null;
    name2?: string;
    position2?: string;
    sigPreviewUrl2?: string | null;
  };
  certificateLayout: ReturnType<typeof mergeCertificateLayout>;
  appMode?: 'wizard' | 'visual_builder';
};

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
  const [appMode, setAppMode] = useState<'wizard' | 'visual_builder'>('wizard');
  const [didApplyDraft, setDidApplyDraft] = useState(false);

  const draftKey = useMemo(() => (id ? `certflow:studio-draft:${id}` : ''), [id]);

  useEffect(() => {
    setDidApplyDraft(false);
  }, [draftKey]);

  const authHeaders = useMemo<Record<string, string>>(
    () => (token ? { Authorization: `Bearer ${token}` } : ({} as Record<string, string>)),
    [token]
  );

  const isBlobUrl = (value?: string | null) => !!value && value.startsWith('blob:');

  const buildDraft = useCallback((): StudioDraft => {
    const cleanBrandingUrl = (u?: string | null) => (isBlobUrl(u) ? null : (u || null));
    const cleanSigUrl = (u?: string | null) => (isBlobUrl(u) ? null : (u || null));

    return {
      mode: state.mode,
      step: state.step,
      single: { ...state.single },
      bulk: {
        rawText: state.bulk.rawText,
        parsedLines: state.bulk.parsedLines.map((l) => ({ ...l })),
      },
      csv: {
        parsedRows: state.csv.parsedRows.map((r) => ({ ...r })),
      },
      branding: {
        templateId: state.branding.templateId,
        aiPrompt: state.branding.aiPrompt,
        logoPreviewUrl: cleanBrandingUrl(state.branding.logoPreviewUrl),
        logoPos: { ...state.branding.logoPos },
        logo2Url: cleanBrandingUrl(state.branding.logo2Url),
        logo3Url: cleanBrandingUrl(state.branding.logo3Url),
        watermarkUrl: cleanBrandingUrl(state.branding.watermarkUrl),
      },
      authority: {
        name: state.authority.name,
        position: state.authority.position,
        sigPreviewUrl: cleanSigUrl(state.authority.sigPreviewUrl),
        name2: state.authority.name2,
        position2: state.authority.position2,
        sigPreviewUrl2: cleanSigUrl(state.authority.sigPreviewUrl2),
      },
      certificateLayout: mergeCertificateLayout(state.certificateLayout),
      appMode,
    };
  }, [state, appMode]);

  const applyDraft = useCallback((draft: Partial<StudioDraft>) => {
    if (!draft) return;
    if (draft.mode) dispatch({ type: 'SET_MODE', mode: draft.mode });
    if (typeof draft.step === 'number') {
      const boundedStep = Math.max(0, Math.min(STEP_LABELS.length - 1, draft.step));
      dispatch({ type: 'SET_STEP', step: boundedStep });
    }

    if (draft.single) {
      (Object.entries(draft.single) as Array<[keyof StudioDraft['single'], string]>).forEach(([field, value]) => {
        dispatch({ type: 'UPDATE_SINGLE', field, value: value ?? '' });
      });
    }

    if (draft.bulk?.rawText !== undefined) {
      dispatch({ type: 'UPDATE_BULK_TEXT', text: draft.bulk.rawText || '' });
    }

    if (draft.csv?.parsedRows) {
      dispatch({ type: 'SET_CSV_FILE', file: null, rows: draft.csv.parsedRows });
    }

    if (draft.branding) {
      dispatch({
        type: 'UPDATE_BRANDING',
        patch: {
          templateId: draft.branding.templateId || '',
          aiPrompt: draft.branding.aiPrompt || '',
          logoPreviewUrl: draft.branding.logoPreviewUrl || null,
          logoPos: draft.branding.logoPos || { x: 0.03, y: 0.82, size: 0.25 },
          logo2Url: draft.branding.logo2Url || null,
          logo3Url: draft.branding.logo3Url || null,
          watermarkUrl: draft.branding.watermarkUrl || null,
        },
      });
    }

    if (draft.authority) {
      dispatch({
        type: 'UPDATE_AUTHORITY',
        patch: {
          name: draft.authority.name || '',
          position: draft.authority.position || '',
          sigPreviewUrl: draft.authority.sigPreviewUrl || null,
          name2: draft.authority.name2 || '',
          position2: draft.authority.position2 || '',
          sigPreviewUrl2: draft.authority.sigPreviewUrl2 || null,
        },
      });
    }

    if (draft.certificateLayout) {
      dispatch({ type: 'UPDATE_CERTIFICATE_LAYOUT', patch: mergeCertificateLayout(draft.certificateLayout) });
    }

    if (draft.appMode) setAppMode(draft.appMode);
  }, [dispatch]);

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
          const logoPos = evtData.logo_position || { x: 0.03, y: 0.82, size: 0.25 };
          const templateId = evtData.template_id || 'classic-blue';
          dispatch({ type: 'UPDATE_BRANDING', patch: { templateId, logoPos, aiPrompt: evtData.description || '' } });
          dispatch({
            type: 'UPDATE_CERTIFICATE_LAYOUT',
            patch: mergeCertificateLayout(evtData.certificate_layout),
          });

          if (!didApplyDraft && draftKey) {
            try {
              const raw = localStorage.getItem(draftKey);
              if (raw) applyDraft(JSON.parse(raw));
            } catch {
              // Ignore invalid draft payload
            } finally {
              setDidApplyDraft(true);
            }
          }

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
  }, [id, draftKey, didApplyDraft, applyDraft]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!draftKey) return;
    try {
      localStorage.setItem(draftKey, JSON.stringify(buildDraft()));
    } catch {
      // Ignore storage quota/unavailable errors
    }
  }, [draftKey, buildDraft]);

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

    const logo2Url = state.branding.logo2Url
      ? state.branding.logo2Url
      : eventData?.additional_logos?.logo2
      ? `${API}/${eventData.additional_logos.logo2.replace(/\\/g, '/')}`
      : null;

    const logo3Url = state.branding.logo3Url
      ? state.branding.logo3Url
      : eventData?.additional_logos?.logo3
      ? `${API}/${eventData.additional_logos.logo3.replace(/\\/g, '/')}`
      : null;

    const watermarkUrl = state.branding.watermarkUrl
      ? state.branding.watermarkUrl
      : eventData?.additional_logos?.watermark
      ? `${API}/${eventData.additional_logos.watermark.replace(/\\/g, '/')}`
      : null;

    const sigPreviewUrl2 = state.authority.sigPreviewUrl2
      ? state.authority.sigPreviewUrl2
      : eventData?.additional_signatures?.signature_path2
      ? `${API}/${eventData.additional_signatures.signature_path2.replace(/\\/g, '/')}`
      : null;

    const templateUrl = eventData?.template_path
      ? `${API}/${eventData.template_path.replace(/\\/g, '/')}`
      : null;

    return {
      name: state.single.participant_name || (state.mode !== 'single' ? 'Multiple Recipients' : ''),
      role: state.single.role,
      eventName: eventData?.name || '',
      organization: state.single.organization,
      date: state.single.date_text,
      authorityName: state.authority.name,
      authorityPosition: state.authority.position,
      authority: {
        name2: state.authority.name2,
        position2: state.authority.position2,
        sigPreviewUrl2,
      },
      logoUrl,
      logoPos: state.branding.logoPos,
      logo2Url,
      logo3Url,
      watermarkUrl,
      signatureUrl,
      templateId: state.branding.templateId,
      templateUrl,
      certificateLayout: state.certificateLayout,
    };
  }, [state, eventData]);

  // (Debounce removed, using raw previewData for immediate feedback during interactions)

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
        if (validLines.length === 0) throw new Error('No valid recipient entries to generate certificates for.');
        setProgress({ total: validLines.length, success: 0, failed: 0 });
        // Fall back to eventData values in case the user didn't visit the single-recipient step
        const org = state.single.organization.trim() || eventData?.organization || eventData?.name || 'Organization';
        const dateText = state.single.date_text.trim() || eventData?.date_text || new Date().toISOString().split('T')[0];
        const body = {
          participants: validLines.map(l => ({ name: l.name, email: l.email || '', role: l.role || '' })),
          event_name: eventData?.name || 'Event',
          organization: org,
          date_text: dateText,
          template_id: state.branding.templateId || 'classic-blue',
        };
        const res = await fetch(`${API}/events/${id}/generate/manual-bulk`, {
          method: 'POST',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) {
          // FastAPI 422 returns detail as an array of validation error objects
          const detail = data.detail;
          if (Array.isArray(detail)) {
            const msgs = detail.map((d: any) => `${d.loc?.slice(1).join('.')} — ${d.msg}`).join('; ');
            throw new Error(`Validation error: ${msgs}`);
          }
          throw new Error(typeof detail === 'string' ? detail : 'Bulk generation failed');
        }
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
      // Ensure we always show a readable string, never [object Object]
      const msg = typeof err?.message === 'string' ? err.message : 'Generation failed';
      notify(msg, 'error');
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
            certificateLayout={state.certificateLayout}
            templates={templates}
            eventId={id!}
            token={token}
            onBrandingChange={patch => dispatch({ type: 'UPDATE_BRANDING', patch })}
            onLayoutPatch={patch => dispatch({ type: 'UPDATE_CERTIFICATE_LAYOUT', patch })}
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
            certificateLayout={state.certificateLayout}
            errors={state.errors}
            eventId={id!}
            token={token}
            onAuthorityChange={patch => dispatch({ type: 'UPDATE_AUTHORITY', patch })}
            onLayoutPatch={patch => dispatch({ type: 'UPDATE_CERTIFICATE_LAYOUT', patch })}
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
    <div className="min-h-screen space-y-8 animate-fadeIn pb-20">
      {/* 1a. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-1.5 text-sm text-[#0d9488] font-bold hover:underline mb-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7" />
            </svg>
            Dashboard
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-black text-gray-900 tracking-tight">Certificate Studio</h1>
            <div className="px-3 py-1 bg-gray-100 rounded-full text-[10px] font-bold text-gray-400 uppercase tracking-widest border border-gray-200">Editor</div>
          </div>
          {eventData && <p className="text-gray-500 mt-1 text-sm font-medium">Event: <span className="text-gray-900">{eventData.name}</span></p>}
        </div>
        <button
          onClick={downloadZip}
          className="inline-flex items-center gap-2 bg-gray-900 text-white px-6 py-3 rounded-xl font-bold shadow-xl hover:bg-gray-800 transition-all active:scale-95 text-sm"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Export ZIP
        </button>
      </div>

      {/* 1b. Analytics Bar */}
      {eventStats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { label: 'Issued', val: eventStats.issued },
              { label: 'Opened', val: eventStats.opened },
              { label: 'Shared', val: eventStats.shared },
              { label: 'Verified', val: eventStats.verified },
              { label: 'Emailed', val: eventStats.emailed },
            ].map(s => (
              <div key={s.label} className="bg-gray-50/50 p-[12px_20px] rounded-[8px] border border-gray-100 flex flex-col items-center group hover:bg-white hover:shadow-md transition-all">
                  <p className="text-gray-400 text-[10px] uppercase font-black mb-1 group-hover:text-gray-500">{s.label}</p>
                  <p className="text-2xl font-black text-[#0d9488] leading-none">{s.val || 0}</p>
              </div>
            ))}
        </div>
      )}

      {/* 1c. Editor Mode Toggle */}
      {state.generationStatus !== 'success' && (
        <div className="flex flex-col gap-3">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Studio Mode</p>
          <div className="flex bg-gray-50 p-1.5 rounded-2xl border border-gray-100 shadow-inner w-full sm:w-fit">
            <button
              onClick={() => setAppMode('wizard')}
              className={`flex-1 sm:flex-none px-8 py-3 rounded-xl text-sm font-black transition-all ${
                appMode === 'wizard' 
                  ? 'bg-[#0d9488] text-white shadow-lg' 
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
              }`}
            >
              Basic Wizard
            </button>
            <button
              onClick={() => setAppMode('visual_builder')}
              className={`flex-1 sm:flex-none px-8 py-3 rounded-xl text-sm font-black border transition-all ${
                appMode === 'visual_builder' 
                  ? 'bg-[#0d9488] text-white shadow-lg border-transparent ml-1.5' 
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100 border-gray-200 ml-1.5'
              }`}
            >
              Full Visual Editor
            </button>
          </div>
        </div>
      )}

      <div className="w-full flex flex-col gap-10">
        {appMode === 'visual_builder' && state.generationStatus !== 'success' ? (
          <div className="animate-fadeIn flex flex-col gap-10">
            <FullVisualBuilder
              eventId={id!}
              previewData={previewData}
              dispatch={dispatch}
              authHeaders={authHeaders}
              onNotify={notify}
            />
            {id && eventData && (
              <CertificateLayoutEditor
                eventId={id}
                previewData={previewData}
                dispatch={dispatch}
                authHeaders={authHeaders}
                onNotify={notify}
              />
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-10 animate-fadeIn">
            {/* Main two-column layout */}
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-10">
              {/* Left: step indicator + active step */}
              <div className="space-y-6">
                {state.generationStatus !== 'success' && (
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between p-4 bg-white border border-gray-100 rounded-2xl shadow-sm">
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
                        className="px-4 py-2 rounded-xl border border-gray-200 text-xs font-black text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all uppercase tracking-widest"
                      >
                        Prev
                      </button>
                      {state.step < STEP_LABELS.length - 1 && (
                        <button
                          type="button"
                          onClick={validateAndAdvance}
                          className="px-6 py-2 rounded-xl bg-gray-900 border border-gray-900 hover:bg-black text-xs font-black text-white transition-all uppercase tracking-widest shadow-lg shadow-gray-200"
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
              <div className="relative">
                {previewData && (
                  <PreviewPanel 
                    data={previewData} 
                    eventData={eventData} 
                    currentStep={state.step} 
                    onLayoutPatch={patch => dispatch({ type: 'UPDATE_CERTIFICATE_LAYOUT', patch })}
                    onLogoPosChange={logoPos => dispatch({ type: 'UPDATE_BRANDING', patch: { logoPos } })}
                  />
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-6 py-4 rounded-2xl text-white text-sm font-black shadow-2xl animate-slideIn ${toastBg}`}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}
