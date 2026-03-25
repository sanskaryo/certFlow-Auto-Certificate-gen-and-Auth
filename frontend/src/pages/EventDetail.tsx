import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

type Template = { id: string; name: string; bg: string; title: string };

export default function EventDetail() {
  const { id } = useParams();
  const token = localStorage.getItem('token');
  const API = 'http://localhost:8000';

  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateId, setTemplateId] = useState('classic-blue');
  const [msg, setMsg] = useState('');
  const [verificationLink, setVerificationLink] = useState('');
  const [previewLink, setPreviewLink] = useState('');
  const [eventData, setEventData] = useState<any>(null);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [sigFile, setSigFile] = useState<File | null>(null);
  const [authority, setAuthority] = useState({ name: '', position: '' });
  const [manual, setManual] = useState({
    participant_name: '',
    event_name: '',
    organization: '',
    date_text: new Date().toISOString().split('T')[0],
    role: '',
    email: '',
  });
  const [manualBulkText, setManualBulkText] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API}/events/templates`);
        const data = await res.json();
        let fetchedTemplates = data.templates || [];

        const evtRes = await fetch(`${API}/events/${id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (evtRes.ok) {
          const evtData = await evtRes.json();
          setEventData(evtData);
          setAuthority({ name: evtData.authority_name || '', position: evtData.authority_position || '' });
          setManual(m => ({
            ...m,
            event_name: evtData.name,
            organization: evtData.organization || 'Event Organizer',
            date_text: evtData.date_text || m.date_text
          }));
          if (evtData.template_id === 'ai-generated' || evtData.template_path) {
            const customId = evtData.template_id || 'ai-generated';
            if (!fetchedTemplates.find((t: any) => t.id === customId)) {
              fetchedTemplates = [{ id: customId, name: customId === 'ai-generated' ? 'AI Generated Template' : 'Uploaded Custom Template', bg: '', title: '' }, ...fetchedTemplates];
            }
            setTemplateId(customId);
          } else if (evtData.template_id) {
            setTemplateId(evtData.template_id);
          }
        }
        if (!fetchedTemplates.find((t: any) => t.id === 'ai-generated')) {
          fetchedTemplates.push({ id: 'ai-generated', name: 'AI Generated Template', bg: '', title: '' });
        }
        setTemplates(fetchedTemplates);
      } catch (e) {
        console.error("Failed to fetch event data", e);
      }
    })();
  }, [id, token]);

  const handleSendEmailManually = async () => {
    if (!verificationLink) return;
    const certId = verificationLink.split('/').pop();
    setMsg('Sending email...');
    try {
      const res = await fetch(`${API}/events/${id}/certificates/${certId}/send-email`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setMsg(res.ok ? data.message : data.detail || 'Failed to send email');
    } catch (e) {
      setMsg('Error sending email');
    }
  };

  const handleManualGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg('Generating certificate...');
    try {
      const res = await fetch(`${API}/events/${id}/generate/manual`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ...manual, template_id: templateId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.detail || 'Manual generation failed');
        return;
      }
      const certId = data.certificate_id;
      setVerificationLink(data.verification_link || `${API}/verify/${certId}`);
      setPreviewLink(`${API}/verify/${certId}/preview?t=${Date.now()}`);
      setMsg(`Generated: ${certId}`);
    } catch (e) {
      setMsg('Error generating certificate');
    }
  };

  const handleManualBulkGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    const lines = manualBulkText.split('\n').filter(l => l.trim());
    const participants = lines.map(l => {
      const [n, em, r] = l.split(',').map(s => s.trim());
      return { name: n || '', email: em || '', role: r || '' };
    }).filter(p => p.name);

    if (participants.length === 0) {
      setMsg('No valid participants found. Use: Name, Email, Role');
      return;
    }

    setMsg('Generating bulk certificates...');
    try {
      const res = await fetch(`${API}/events/${id}/generate/manual-bulk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          participants,
          event_name: manual.event_name,
          organization: manual.organization,
          date_text: manual.date_text,
          template_id: templateId,
        }),
      });
      const data = await res.json();
      setMsg(res.ok ? (data.message || 'Bulk generation completed') : (data.detail || 'Bulk generation failed'));

      const first = data.certificates?.[0];
      if (res.ok && first?.certificate_id) {
        setVerificationLink(first.verification_link || `${API}/verify/${first.certificate_id}`);
        setPreviewLink(`${API}/verify/${first.certificate_id}/preview?t=${Date.now()}`);
      }
    } catch (e) {
      setMsg('Error in bulk generation');
    }
  };

  const handleUploadCsv = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!csvFile) return;
    setMsg('Uploading CSV...');
    const formData = new FormData();
    formData.append('file', csvFile);

    try {
      const res = await fetch(`${API}/events/${id}/participants`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      setMsg(res.ok ? data.message : data.detail || 'Upload failed');
    } catch (e) {
      setMsg('Error uploading CSV');
    }
  };

  const handleUpdateBranding = async (type: 'logo' | 'sig' | 'auth') => {
    setMsg('Updating branding...');
    const formData = new FormData();
    let endpoint = '';

    if (type === 'logo' && logoFile) {
      formData.append('file', logoFile);
      endpoint = `${API}/events/${id}/logo`;
    } else if (type === 'sig' && sigFile) {
      formData.append('file', sigFile);
      endpoint = `${API}/events/${id}/signature`;
    } else if (type === 'auth') {
      const res = await fetch(`${API}/events/${id}/authority`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ authority_name: authority.name, authority_position: authority.position }),
      });
      const data = await res.json();
      setMsg(res.ok ? data.message : data.detail || 'Update failed');
      return;
    } else {
      setMsg('Please select a file first');
      return;
    }

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      setMsg(res.ok ? data.message : data.detail || 'Upload failed');
    } catch (e) {
      setMsg('Error uploading file');
    }
  };

  const handleGenerateCsvBg = async () => {
    setMsg('Starting background generation...');
    try {
      const res = await fetch(`${API}/events/${id}/generate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setMsg(res.ok ? data.message : data.detail || 'Failed to start generation');
    } catch (e) {
      setMsg('Error starting generation');
    }
  };

  const downloadZip = async () => {
    if (!token) {
      setMsg('Please login again');
      return;
    }
    try {
      const res = await fetch(`${API}/events/${id}/download`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        setMsg(error.detail || 'Failed to download ZIP');
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
    } catch (e) {
      setMsg('Error downloading ZIP');
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-8">
      <header className="flex justify-between items-center">
        <div>
          <Link to="/dashboard" className="text-prime-600 font-semibold hover:underline">
            ← Back to Dashboard
          </Link>
          <h2 className="text-3xl font-bold mt-2 text-gray-900">Certificate Studio</h2>
          {eventData && <p className="text-gray-500">Event: {eventData.name}</p>}
        </div>
        <button onClick={downloadZip} className="bg-prime-600 text-white rounded-xl px-6 py-3 font-semibold shadow-md hover:bg-prime-700 transition">
          Download ZIP (PDFs)
        </button>
      </header>

      <section className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div>
          <h3 className="text-lg font-bold text-gray-800 mb-2">1. Select Template Name</h3>
          <select
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
            className="w-full rounded-xl border border-gray-200 px-4 py-3 focus:ring-2 focus:ring-prime-500 outline-none bg-white text-gray-700 font-medium"
          >
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          {templateId === 'ai-generated' && (
            <div className="mt-3 space-y-2 border-t pt-3">
              {!eventData?.template_path ? (
                <div className="text-xs text-orange-600 font-medium mb-1">
                  No AI template exists for this event yet.
                </div>
              ) : (
                <div className="text-right mb-2">
                  <a
                    href={`${API}/${eventData.template_path.replace(/\\/g, '/')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-prime-600 font-bold hover:underline"
                  >
                    Preview Current AI Template ↗
                  </a>
                </div>
              )}
              <div className="flex flex-col gap-2">
                <input
                  type="text"
                  placeholder="Describe your desired theme (e.g. Modern Tech, Elegant Gold)"
                  className="w-full text-xs border border-gray-200 px-3 py-2 rounded focus:ring-prime-500 outline-none"
                  id="ai-prompt-input"
                  defaultValue={eventData?.description || ''}
                />
                <button
                  type="button"
                  onClick={async () => {
                    const promptInput = document.getElementById('ai-prompt-input') as HTMLInputElement;
                    const prompt = promptInput?.value || eventData?.description || 'Professional Certificate';
                    setMsg('Generating AI Template... (this takes ~10-15s)');
                    try {
                      const res = await fetch(`${API}/events/${id}/ai-template`, {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          Authorization: `Bearer ${token}`
                        },
                        body: JSON.stringify({ prompt })
                      });
                      const data = await res.json();
                      if (res.ok) {
                        setMsg('AI Template Regenerated Successfully!');
                        setEventData({ ...eventData, template_path: data.template_path, template_id: 'ai-generated' });
                        if (promptInput) promptInput.value = '';
                      } else {
                        setMsg(`Error: ${data.detail || 'Generation failed'}`);
                      }
                    } catch (err) {
                      setMsg(`Error generating template`);
                    }
                  }}
                  className="w-full bg-indigo-600 text-white text-xs py-2 rounded font-semibold hover:bg-indigo-700 transition shadow-sm"
                >
                  {eventData?.template_path ? 'Regenerate AI Template' : 'Generate AI Template'}
                </button>
              </div>
            </div>
          )}
        </div>

        <div>
          <h3 className="text-lg font-bold text-gray-800 mb-2">2. Branding (Logo &amp; Signature)</h3>
          <div className="space-y-4">
            {/* Logo Upload */}
            <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 p-3 bg-gray-50 rounded-xl border border-gray-200">
              <label className="font-semibold text-sm text-gray-700 md:w-32">Logo</label>
              <input
                id="logo-upload"
                type="file"
                accept="image/*"
                onChange={e => setLogoFile(e.target.files?.[0] || null)}
                className="hidden"
              />
              <div className="flex-1 flex items-center gap-2">
                <label htmlFor="logo-upload" className="flex-1 cursor-pointer px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-100 transition">
                  {logoFile ? logoFile.name : 'No file chosen'}
                </label>
                <button
                  type="button"
                  onClick={() => handleUpdateBranding('logo')}
                  className="bg-prime-600 text-white px-4 py-2 rounded-lg font-semibold text-sm shadow hover:bg-prime-700 transition"
                  disabled={!logoFile}
                >
                  Upload Logo
                </button>
              </div>
            </div>
            {/* Signature Upload */}
            <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 p-3 bg-gray-50 rounded-xl border border-gray-200">
              <label className="font-semibold text-sm text-gray-700 md:w-32">Signature</label>
              <input
                id="sig-upload"
                type="file"
                accept="image/*"
                onChange={e => setSigFile(e.target.files?.[0] || null)}
                className="hidden"
              />
              <div className="flex-1 flex items-center gap-2">
                <label htmlFor="sig-upload" className="flex-1 cursor-pointer px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-100 transition">
                  {sigFile ? sigFile.name : 'No file chosen'}
                </label>
                <button
                  type="button"
                  onClick={() => handleUpdateBranding('sig')}
                  className="bg-prime-600 text-white px-4 py-2 rounded-lg font-semibold text-sm shadow hover:bg-prime-700 transition"
                  disabled={!sigFile}
                >
                  Upload Signature
                </button>
              </div>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-bold text-gray-800 mb-2">3. Authority Details</h3>
          <div className="flex flex-col md:flex-row md:items-center gap-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
            <div className="flex-1 flex flex-col gap-2">
              <label className="font-semibold text-sm text-gray-700">Authority Name</label>
              <input
                placeholder="e.g. Dr. Priya Sharma"
                className="w-full text-base border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-prime-500 outline-none shadow-sm"
                value={authority.name}
                onChange={async e => {
                  const newVal = e.target.value;
                  setAuthority(a => ({ ...a, name: newVal }));
                  // Auto-save on change
                  await fetch(`${API}/events/${id}/authority`, {
                    method: 'PATCH',
                    headers: {
                      'Content-Type': 'application/json',
                      Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({ authority_name: newVal, authority_position: authority.position }),
                  });
                }}
              />
            </div>
            <div className="flex-1 flex flex-col gap-2">
              <label className="font-semibold text-sm text-gray-700">Authority Position</label>
              <input
                placeholder="e.g. Director, IIT Bombay"
                className="w-full text-base border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-prime-500 outline-none shadow-sm"
                value={authority.position}
                onChange={async e => {
                  const newVal = e.target.value;
                  setAuthority(a => ({ ...a, position: newVal }));
                  // Auto-save on change
                  await fetch(`${API}/events/${id}/authority`, {
                    method: 'PATCH',
                    headers: {
                      'Content-Type': 'application/json',
                      Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({ authority_name: authority.name, authority_position: newVal }),
                  });
                }}
              />
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <section className="space-y-6">
          <form onSubmit={handleManualGenerate} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
            <h3 className="text-lg font-bold text-gray-800">2. Generate Single Certificate</h3>
            <div className="space-y-3">
              <input
                className="w-full rounded-xl border border-gray-200 px-4 py-3 focus:ring-2 focus:ring-prime-500 outline-none"
                placeholder="Participant Name"
                value={manual.participant_name}
                onChange={(e) => setManual({ ...manual, participant_name: e.target.value })}
                required
              />
              <input
                type="email"
                className="w-full rounded-xl border border-gray-200 px-4 py-3 focus:ring-2 focus:ring-prime-500 outline-none"
                placeholder="Email Address (for sending)"
                value={manual.email}
                onChange={(e) => setManual({ ...manual, email: e.target.value })}
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 bg-gray-50 text-gray-500"
                  value={manual.event_name}
                  readOnly
                  placeholder="Event Name"
                />
                <input
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 focus:ring-2 focus:ring-prime-500 outline-none"
                  value={manual.organization}
                  onChange={(e) => setManual({ ...manual, organization: e.target.value })}
                  placeholder="Organization"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="date"
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 focus:ring-2 focus:ring-prime-500 outline-none"
                  value={manual.date_text}
                  onChange={(e) => setManual({ ...manual, date_text: e.target.value })}
                  required
                />
                <select
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 focus:ring-2 focus:ring-prime-500 outline-none"
                  value={manual.role}
                  onChange={(e) => setManual({ ...manual, role: e.target.value })}
                >
                  <option value="">Select Role</option>
                  <option value="Winner">Winner</option>
                  <option value="Volunteer">Volunteer</option>
                  <option value="Participant">Participant</option>
                  <option value="Speaker">Speaker</option>
                  <option value="Organizer">Organizer</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <button type="submit" className="flex-1 bg-prime-600 text-white rounded-xl py-3 font-semibold hover:bg-prime-700 transition">
                Create Certificate
              </button>
              {verificationLink && (
                <button
                  type="button"
                  onClick={handleSendEmailManually}
                  className="px-4 bg-accent-100 text-accent-700 rounded-xl font-bold hover:bg-accent-200 transition"
                  title="Send to Participant's Email"
                >
                  ✉️ Send
                </button>
              )}
            </div>
          </form>

          <form onSubmit={handleManualBulkGenerate} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
            <h3 className="text-lg font-bold text-gray-800">3. Manual Bulk Entry</h3>
            <p className="text-xs text-gray-400">Pase data as: <b>Name, Email, Role</b> (one per line)</p>
            <textarea
              className="w-full rounded-xl border border-gray-200 px-4 py-3 min-h-32 text-sm focus:ring-2 focus:ring-prime-500 outline-none"
              placeholder={'Alice, alice@mail.com, Winner\nBob, bob@mail.com, Speaker'}
              value={manualBulkText}
              onChange={(e) => setManualBulkText(e.target.value)}
            />
            <button className="w-full bg-gray-800 text-white rounded-xl py-3 font-semibold hover:bg-gray-900 transition">
              Process Bulk List
            </button>
          </form>
        </section>

        <section className="space-y-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
            <h4 className="text-lg font-bold text-gray-800">4. CSV Data Upload</h4>
            <div className="p-4 bg-blue-50 rounded-xl text-xs text-blue-700 space-y-1">
              <p>✔ CSV must have header: <b>name</b></p>
              <p>✔ Optional headers: <b>email</b>, <b>position</b></p>
            </div>
            <input
              type="file"
              accept=".csv"
              onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-prime-50 file:text-prime-700 hover:file:bg-prime-100"
            />
            <button
              type="button"
              onClick={handleUploadCsv}
              disabled={!csvFile}
              className="w-full bg-accent-600 disabled:opacity-50 text-white rounded-xl py-3 font-semibold hover:bg-accent-700 transition"
            >
              Upload Data File
            </button>

            <div className="pt-4 border-t border-gray-100">
              <h4 className="font-bold text-gray-800 mb-2">Automated Bulk Task</h4>
              <button
                type="button"
                onClick={handleGenerateCsvBg}
                className="w-full bg-prime-600 text-white rounded-xl py-3 font-semibold hover:bg-prime-700 transition shadow-sm"
              >
                Start Background Processing
              </button>
            </div>
          </div>

          {previewLink && (
            <div className="bg-white p-4 rounded-2xl shadow-lg border border-gray-200">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-bold text-gray-800">
                  Preview: {manual.participant_name || 'Latest Certificate'}
                </h3>
                <a href={previewLink} target="_blank" rel="noreferrer" className="text-xs text-prime-600 font-bold hover:underline">
                  Full View ↗
                </a>
              </div>
              <div className="w-full h-[450px] bg-gray-50 rounded-lg overflow-hidden border border-gray-100 shadow-inner">
                <iframe src={previewLink} className="w-full h-full" title="PDF Preview" />
              </div>
            </div>
          )}
        </section>
      </div>

      <div className={`fixed bottom-6 right-6 p-4 rounded-2xl shadow-2xl transition-all ${msg ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'} bg-gray-900 text-white text-sm font-medium z-50 max-w-xs`}>
        {msg}
      </div>
    </div>
  );
}
