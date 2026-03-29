import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import LogoPositioner, { type LogoPos } from '../components/LogoPositioner';

type Template = { id: string; name: string; bg: string; title: string };

export default function EventDetail() {
  const { id } = useParams();
  const token = localStorage.getItem('token');
  const API = 'http://localhost:8000';

  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateId, setTemplateId] = useState('classic-blue');
  const [msg, setMsg] = useState('');
  const [msgType, setMsgType] = useState<'success' | 'error' | 'info'>('info');
  const [verificationLink, setVerificationLink] = useState('');
  const [previewLink, setPreviewLink] = useState('');
  const [eventData, setEventData] = useState<any>(null);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
  const [sigFile, setSigFile] = useState<File | null>(null);
  const [logoPos, setLogoPos] = useState<LogoPos>({ x: 0.03, y: 0.82, size: 0.18 });
  const [showPositioner, setShowPositioner] = useState(false);
  const [authority, setAuthority] = useState({ name: '', position: '' });
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const [manualBulkText, setManualBulkText] = useState('');
  const [manual, setManual] = useState({
    participant_name: '',
    event_name: '',
    organization: '',
    date_text: new Date().toISOString().split('T')[0],
    role: '',
    email: '',
  });

  const notify = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setMsg(message);
    setMsgType(type);
    setTimeout(() => setMsg(''), 4000);
  };

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API}/events/templates`);
        const data = await res.json();
        let fetchedTemplates = data.templates || [];

        const evtRes = await fetch(`${API}/events/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (evtRes.ok) {
          const evtData = await evtRes.json();
          setEventData(evtData);
          setAuthority({ name: evtData.authority_name || '', position: evtData.authority_position || '' });
          setAiPrompt(evtData.description || '');
          if (evtData.logo_position) setLogoPos(evtData.logo_position);
          setManual(m => ({
            ...m,
            event_name: evtData.name,
            organization: evtData.organization || 'Event Organizer',
            date_text: evtData.date_text || m.date_text,
          }));
          if (evtData.template_id === 'ai-generated' || evtData.template_path) {
            const customId = evtData.template_id || 'ai-generated';
            if (!fetchedTemplates.find((t: any) => t.id === customId)) {
              fetchedTemplates = [{ id: customId, name: customId === 'ai-generated' ? 'AI Generated' : 'Custom Upload', bg: '', title: '' }, ...fetchedTemplates];
            }
            setTemplateId(customId);
          } else if (evtData.template_id) {
            setTemplateId(evtData.template_id);
          }
        }
        if (!fetchedTemplates.find((t: any) => t.id === 'ai-generated')) {
          fetchedTemplates.push({ id: 'ai-generated', name: 'AI Generated', bg: '', title: '' });
        }
        setTemplates(fetchedTemplates);
      } catch (e) {
        console.error('Failed to fetch event data', e);
      }
    })();
  }, [id, token]);

  const handleSendEmail = async () => {
    if (!verificationLink) return;
    const certId = verificationLink.split('/').pop();
    notify('Sending email...', 'info');
    try {
      const res = await fetch(`${API}/events/${id}/certificates/${certId}/send-email`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      notify(res.ok ? data.message : data.detail || 'Failed to send email', res.ok ? 'success' : 'error');
    } catch {
      notify('Error sending email', 'error');
    }
  };

  const handleManualGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGenerating(true);
    notify('Generating certificate...', 'info');
    try {
      const res = await fetch(`${API}/events/${id}/generate/manual`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...manual, template_id: templateId }),
      });
      const data = await res.json();
      if (!res.ok) { notify(data.detail || 'Generation failed', 'error'); return; }
      setVerificationLink(data.verification_link || `${API}/verify/${data.certificate_id}`);
      setPreviewLink(`${API}/verify/${data.certificate_id}/preview?t=${Date.now()}`);
      notify('Certificate created successfully!', 'success');
    } catch {
      notify('Error generating certificate', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleManualBulk = async (e: React.FormEvent) => {
    e.preventDefault();
    const participants = manualBulkText.split('\n').filter(l => l.trim()).map(l => {
      const [n, em, r] = l.split(',').map(s => s.trim());
      return { name: n || '', email: em || '', role: r || '' };
    }).filter(p => p.name);
    if (!participants.length) { notify('No valid participants. Format: Name, Email, Role', 'error'); return; }
    setIsBulkProcessing(true);
    notify(`Processing ${participants.length} participants...`, 'info');
    try {
      const res = await fetch(`${API}/events/${id}/generate/manual-bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ participants, event_name: manual.event_name, organization: manual.organization, date_text: manual.date_text, template_id: templateId }),
      });
      const data = await res.json();
      notify(res.ok ? (data.message || 'Bulk generation done') : (data.detail || 'Failed'), res.ok ? 'success' : 'error');
      const first = data.certificates?.[0];
      if (res.ok && first?.certificate_id) {
        setVerificationLink(first.verification_link || `${API}/verify/${first.certificate_id}`);
        setPreviewLink(`${API}/verify/${first.certificate_id}/preview?t=${Date.now()}`);
      }
    } catch {
      notify('Error in bulk generation', 'error');
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const handleUploadCsv = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!csvFile) return;
    notify('Uploading CSV...', 'info');
    const formData = new FormData();
    formData.append('file', csvFile);
    try {
      const res = await fetch(`${API}/events/${id}/participants`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      notify(res.ok ? data.message : data.detail || 'Upload failed', res.ok ? 'success' : 'error');
    } catch {
      notify('Error uploading CSV', 'error');
    }
  };

  const handleBranding = async (type: 'logo' | 'sig') => {
    const file = type === 'logo' ? logoFile : sigFile;
    if (!file) { notify('Please select a file first', 'error'); return; }
    notify('Uploading...', 'info');
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch(`${API}/events/${id}/${type === 'logo' ? 'logo' : 'signature'}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (res.ok && type === 'logo') {
        // keep preview URL for positioner
        const url = URL.createObjectURL(file);
        setLogoPreviewUrl(url);
        setShowPositioner(true);
      }
      notify(res.ok ? data.message : data.detail || 'Upload failed', res.ok ? 'success' : 'error');
    } catch {
      notify('Error uploading file', 'error');
    }
  };

  const handleSaveLogoPosition = async (p: LogoPos) => {
    try {
      const res = await fetch(`${API}/events/${id}/logo-position`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(p),
      });
      const data = await res.json();
      notify(res.ok ? 'Logo position saved' : data.detail || 'Failed', res.ok ? 'success' : 'error');
      if (res.ok) setEventData((prev: any) => ({ ...prev, logo_position: p }));
    } catch {
      notify('Error saving position', 'error');
    }
  };

  const handleAuthorityUpdate = async () => {
    try {
      const res = await fetch(`${API}/events/${id}/authority`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ authority_name: authority.name, authority_position: authority.position }),
      });
      if (res.ok) notify('Authority details saved', 'success');
    } catch { /* silent */ }
  };

  const handleGenerateAiTemplate = async () => {
    notify('Generating AI template... (~15s)', 'info');
    try {
      const res = await fetch(`${API}/events/${id}/ai-template`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ prompt: aiPrompt || 'Professional Certificate' }),
      });
      const data = await res.json();
      if (res.ok) {
        notify('AI Template generated!', 'success');
        setEventData((prev: any) => ({ ...prev, template_path: data.template_path, template_id: 'ai-generated' }));
        setTemplateId('ai-generated');
      } else {
        notify(data.detail || 'Generation failed', 'error');
      }
    } catch {
      notify('Error generating template', 'error');
    }
  };

  const handleStartBgProcessing = async () => {
    notify('Starting background processing...', 'info');
    try {
      const res = await fetch(`${API}/events/${id}/generate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      notify(res.ok ? data.message : data.detail || 'Failed', res.ok ? 'success' : 'error');
    } catch {
      notify('Error starting processing', 'error');
    }
  };

  const downloadZip = async () => {
    try {
      const res = await fetch(`${API}/events/${id}/download`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); notify(e.detail || 'Download failed', 'error'); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `event_${id}_certificates.zip`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch {
      notify('Error downloading ZIP', 'error');
    }
  };

  const toastColors = {
    success: 'bg-emerald-600',
    error: 'bg-red-600',
    info: 'bg-gray-800',
  };

  return (
    <div className="min-h-screen space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Link to="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-prime-600 font-semibold hover:text-prime-700 transition mb-2">
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

      {/* Setup Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Template */}
        <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-6 h-6 rounded-full bg-prime-100 text-prime-700 text-xs font-bold flex items-center justify-center">1</span>
            <h3 className="font-bold text-gray-800">Template</h3>
          </div>
          <select
            value={templateId}
            onChange={e => setTemplateId(e.target.value)}
            className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:ring-2 focus:ring-prime-500 outline-none bg-white text-gray-700 font-medium"
          >
            {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>

          {templateId === 'ai-generated' && (
            <div className="space-y-2 pt-2 border-t border-gray-100">
              {eventData?.template_path && (
                <a
                  href={`${API}/${eventData.template_path.replace(/\\/g, '/')}`}
                  target="_blank" rel="noreferrer"
                  className="text-xs text-prime-600 font-semibold hover:underline flex items-center gap-1"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  Preview current template
                </a>
              )}
              <textarea
                rows={2}
                className="w-full text-xs border border-gray-200 px-3 py-2 rounded-lg focus:ring-prime-500 outline-none resize-none"
                placeholder="Describe your theme (e.g. Modern Tech, Elegant Gold)"
                value={aiPrompt}
                onChange={e => setAiPrompt(e.target.value)}
              />
              <button
                type="button"
                onClick={handleGenerateAiTemplate}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs py-2 rounded-lg font-semibold transition"
              >
                {eventData?.template_path ? '✨ Regenerate AI Template' : '✨ Generate AI Template'}
              </button>
            </div>
          )}
        </div>

        {/* Branding */}
        <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-6 h-6 rounded-full bg-prime-100 text-prime-700 text-xs font-bold flex items-center justify-center">2</span>
            <h3 className="font-bold text-gray-800">Branding</h3>
          </div>
          {/* Logo */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Logo</label>
              {(logoPreviewUrl || eventData?.logo_path) && (
                <button
                  type="button"
                  onClick={() => setShowPositioner(v => !v)}
                  className="text-xs text-prime-600 font-semibold hover:underline flex items-center gap-1"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                  </svg>
                  {showPositioner ? 'Hide positioner' : 'Set position'}
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <label className="flex-1 cursor-pointer flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-500 hover:bg-gray-100 transition truncate">
                <svg className="w-4 h-4 flex-shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="truncate">{logoFile ? logoFile.name : 'Choose image'}</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={e => {
                    const f = e.target.files?.[0] || null;
                    setLogoFile(f);
                    if (f) {
                      const url = URL.createObjectURL(f);
                      setLogoPreviewUrl(url);
                    }
                  }}
                />
              </label>
              <button
                onClick={() => handleBranding('logo')}
                disabled={!logoFile}
                className="px-3 py-2 bg-prime-600 disabled:opacity-40 text-white rounded-lg text-xs font-semibold hover:bg-prime-700 transition"
              >
                Upload
              </button>
            </div>

            {/* Drag-and-drop positioner */}
            {showPositioner && (
              <div className="mt-2 p-3 bg-gray-50 rounded-xl border border-gray-200">
                <p className="text-xs text-gray-500 mb-2">Drag the logo to set its position on the certificate</p>
                <LogoPositioner
                  logoUrl={logoPreviewUrl}
                  initial={logoPos}
                  onChange={setLogoPos}
                  onSave={handleSaveLogoPosition}
                  templateColor={templates.find(t => t.id === templateId)?.bg || '#e8f1ff'}
                />
              </div>
            )}
          </div>
          {/* Signature */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Signature</label>
            <div className="flex gap-2">
              <label className="flex-1 cursor-pointer flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-500 hover:bg-gray-100 transition truncate">
                <svg className="w-4 h-4 flex-shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
                <span className="truncate">{sigFile ? sigFile.name : 'Choose image'}</span>
                <input type="file" accept="image/*" className="hidden" onChange={e => setSigFile(e.target.files?.[0] || null)} />
              </label>
              <button onClick={() => handleBranding('sig')} disabled={!sigFile} className="px-3 py-2 bg-prime-600 disabled:opacity-40 text-white rounded-lg text-xs font-semibold hover:bg-prime-700 transition">
                Upload
              </button>
            </div>
          </div>
        </div>

        {/* Authority */}
        <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-6 h-6 rounded-full bg-prime-100 text-prime-700 text-xs font-bold flex items-center justify-center">3</span>
            <h3 className="font-bold text-gray-800">Authority</h3>
          </div>
          <div className="space-y-2">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Name</label>
              <input
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-prime-500 outline-none"
                placeholder="e.g. Dr. Priya Sharma"
                value={authority.name}
                onChange={e => setAuthority(a => ({ ...a, name: e.target.value }))}
                onBlur={handleAuthorityUpdate}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Position</label>
              <input
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-prime-500 outline-none"
                placeholder="e.g. Director, IIT Bombay"
                value={authority.position}
                onChange={e => setAuthority(a => ({ ...a, position: e.target.value }))}
                onBlur={handleAuthorityUpdate}
              />
            </div>
          </div>
          <button onClick={handleAuthorityUpdate} className="w-full text-xs py-2 rounded-lg border border-prime-200 text-prime-700 font-semibold hover:bg-prime-50 transition">
            Save Authority
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Left: Single + Bulk */}
        <div className="space-y-5">
          {/* Single Certificate */}
          <form onSubmit={handleManualGenerate} className="bg-white/70 backdrop-blur-sm rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-prime-100 text-prime-700 text-xs font-bold flex items-center justify-center">4</span>
              <h3 className="font-bold text-gray-800">Single Certificate</h3>
            </div>
            <div className="space-y-3">
              <input
                className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:ring-2 focus:ring-prime-500 outline-none"
                placeholder="Participant Name *"
                value={manual.participant_name}
                onChange={e => setManual({ ...manual, participant_name: e.target.value })}
                required
              />
              <input
                type="email"
                className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:ring-2 focus:ring-prime-500 outline-none"
                placeholder="Email (optional — for auto-send)"
                value={manual.email}
                onChange={e => setManual({ ...manual, email: e.target.value })}
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  className="w-full rounded-xl border border-gray-100 px-4 py-2.5 text-sm bg-gray-50 text-gray-400 cursor-not-allowed"
                  value={manual.event_name}
                  readOnly
                  placeholder="Event Name"
                />
                <input
                  className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:ring-2 focus:ring-prime-500 outline-none"
                  value={manual.organization}
                  onChange={e => setManual({ ...manual, organization: e.target.value })}
                  placeholder="Organization"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="date"
                  className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:ring-2 focus:ring-prime-500 outline-none"
                  value={manual.date_text}
                  onChange={e => setManual({ ...manual, date_text: e.target.value })}
                  required
                />
                <select
                  className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:ring-2 focus:ring-prime-500 outline-none bg-white"
                  value={manual.role}
                  onChange={e => setManual({ ...manual, role: e.target.value })}
                >
                  <option value="">Select Role</option>
                  <option>Winner</option>
                  <option>Volunteer</option>
                  <option>Participant</option>
                  <option>Speaker</option>
                  <option>Organizer</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                disabled={isGenerating}
                className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-prime-600 to-accent-600 hover:from-prime-700 hover:to-accent-700 disabled:opacity-60 text-white rounded-xl py-2.5 text-sm font-semibold transition active:scale-95"
              >
                {isGenerating ? (
                  <><svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 2v4m0 12v4M4.22 4.22l2.83 2.83m7.9 7.9l2.83 2.83M2 12h4m12 0h4m-17.78 7.78l2.83-2.83m7.9-7.9l2.83-2.83" /></svg>Generating...</>
                ) : (
                  <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>Create Certificate</>
                )}
              </button>
              {verificationLink && (
                <button
                  type="button"
                  onClick={handleSendEmail}
                  className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-semibold transition flex items-center gap-1.5"
                  title="Send to email"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  Send
                </button>
              )}
            </div>
          </form>

          {/* Manual Bulk */}
          <form onSubmit={handleManualBulk} className="bg-white/70 backdrop-blur-sm rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-prime-100 text-prime-700 text-xs font-bold flex items-center justify-center">5</span>
              <h3 className="font-bold text-gray-800">Manual Bulk Entry</h3>
            </div>
            <p className="text-xs text-gray-400">One per line: <span className="font-mono bg-gray-100 px-1 rounded">Name, Email, Role</span></p>
            <textarea
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm min-h-28 focus:ring-2 focus:ring-prime-500 outline-none resize-none font-mono"
              placeholder={'Alice, alice@mail.com, Winner\nBob, bob@mail.com, Speaker'}
              value={manualBulkText}
              onChange={e => setManualBulkText(e.target.value)}
            />
            <button
              disabled={isBulkProcessing}
              className="w-full flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-900 disabled:opacity-60 text-white rounded-xl py-2.5 text-sm font-semibold transition active:scale-95"
            >
              {isBulkProcessing ? (
                <><svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 2v4m0 12v4M4.22 4.22l2.83 2.83m7.9 7.9l2.83 2.83M2 12h4m12 0h4m-17.78 7.78l2.83-2.83m7.9-7.9l2.83-2.83" /></svg>Processing...</>
              ) : 'Process Bulk List'}
            </button>
          </form>
        </div>

        {/* Right: CSV + Preview */}
        <div className="space-y-5">
          {/* CSV Upload */}
          <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-prime-100 text-prime-700 text-xs font-bold flex items-center justify-center">6</span>
              <h3 className="font-bold text-gray-800">CSV Upload</h3>
            </div>
            <div className="p-3 bg-blue-50 rounded-xl text-xs text-blue-700 space-y-1 border border-blue-100">
              <p className="flex items-center gap-1.5"><svg className="w-3.5 h-3.5 text-blue-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>Required header: <strong>name</strong></p>
              <p className="flex items-center gap-1.5"><svg className="w-3.5 h-3.5 text-blue-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>Optional: <strong>email</strong>, <strong>position</strong></p>
            </div>
            <label className="flex items-center gap-3 cursor-pointer px-4 py-3 bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl hover:border-prime-300 hover:bg-prime-50 transition group">
              <svg className="w-5 h-5 text-gray-400 group-hover:text-prime-500 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <span className="text-sm text-gray-500 group-hover:text-prime-600 transition">
                {csvFile ? csvFile.name : 'Click to choose CSV file'}
              </span>
              <input type="file" accept=".csv" className="hidden" onChange={e => setCsvFile(e.target.files?.[0] || null)} />
            </label>
            <button
              onClick={handleUploadCsv}
              disabled={!csvFile}
              className="w-full flex items-center justify-center gap-2 bg-prime-600 hover:bg-prime-700 disabled:opacity-40 text-white rounded-xl py-2.5 text-sm font-semibold transition active:scale-95"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Upload Participants
            </button>
            <div className="pt-3 border-t border-gray-100">
              <p className="text-xs text-gray-500 mb-2">After uploading CSV, run background generation:</p>
              <button
                onClick={handleStartBgProcessing}
                className="w-full flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-900 text-white rounded-xl py-2.5 text-sm font-semibold transition active:scale-95"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Start Background Processing
              </button>
            </div>
          </div>

          {/* Preview */}
          {previewLink && (
            <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3 animate-slideUp">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-gray-800 text-sm">
                  Preview — {manual.participant_name || 'Certificate'}
                </h3>
                <a href={previewLink} target="_blank" rel="noreferrer" className="text-xs text-prime-600 font-semibold hover:underline flex items-center gap-1">
                  Open full
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </div>
              <div className="w-full h-64 bg-gray-50 rounded-xl overflow-hidden border border-gray-100">
                <iframe src={previewLink} className="w-full h-full" title="Certificate Preview" />
              </div>
              {verificationLink && (
                <a href={verificationLink} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-prime-600 transition">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  Verify certificate
                </a>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Toast */}
      <div className={`fixed bottom-6 right-6 z-50 transition-all duration-300 ${msg ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0 pointer-events-none'}`}>
        <div className={`${toastColors[msgType]} text-white text-sm font-medium px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-2.5 max-w-xs`}>
          {msgType === 'success' && <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>}
          {msgType === 'error' && <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>}
          {msg}
        </div>
      </div>
    </div>
  );
}
