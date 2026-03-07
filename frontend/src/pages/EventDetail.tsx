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
  const [bulkNames, setBulkNames] = useState('');
  const [manual, setManual] = useState({
    participant_name: '',
    event_name: '',
    organization: '',
    date_text: new Date().toISOString().split('T')[0],
    role: '',
  });

  useEffect(() => {
    (async () => {
      const res = await fetch(`${API}/events/templates`);
      const data = await res.json();
      setTemplates(data.templates || []);
    })();
  }, []);

  const handleManualGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg('Generating certificate...');
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
    const certId = data.certificate_id as string;
    setVerificationLink(data.verification_link || `${API}/verify/${certId}`);
    setPreviewLink(`${API}/verify/${certId}/preview`);
    setMsg(`Generated: ${certId}`);
  };

  const handleBulkGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    const participant_names = bulkNames
      .split('\n')
      .map((n) => n.trim())
      .filter(Boolean);
    setMsg('Generating bulk certificates...');
    const res = await fetch(`${API}/events/${id}/generate/manual-bulk`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        participant_names,
        event_name: manual.event_name,
        organization: manual.organization,
        date_text: manual.date_text,
        role: manual.role,
        template_id: templateId,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMsg(data.detail || 'Bulk generation failed');
      return;
    }
    const first = data.certificates?.[0];
    if (first?.certificate_id) {
      setVerificationLink(first.verification_link || `${API}/verify/${first.certificate_id}`);
      setPreviewLink(`${API}/verify/${first.certificate_id}/preview`);
    }
    setMsg(data.message || 'Bulk generation completed');
  };

  const downloadZip = async () => {
    if (!token) {
      setMsg('Please login again');
      return;
    }
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
  };

  return (
    <div className="space-y-8">
      <header>
        <Link to="/dashboard" className="text-prime-600 font-semibold">
          Back to Dashboard
        </Link>
        <h2 className="text-3xl font-bold mt-3">Certificate Studio</h2>
      </header>

      <section className="bg-white p-6 rounded-2xl border border-gray-200 space-y-4">
        <h3 className="text-xl font-semibold">1. Select Template (10+ available)</h3>
        <select
          value={templateId}
          onChange={(e) => setTemplateId(e.target.value)}
          className="w-full rounded-xl border border-gray-300 px-4 py-3"
        >
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <form onSubmit={handleManualGenerate} className="bg-white p-6 rounded-2xl border border-gray-200 space-y-4">
          <h3 className="text-xl font-semibold">2. Manual Single Generation</h3>
          <input
            className="w-full rounded-xl border border-gray-300 px-4 py-3"
            placeholder="Participant name"
            value={manual.participant_name}
            onChange={(e) => setManual({ ...manual, participant_name: e.target.value })}
            required
          />
          <input
            className="w-full rounded-xl border border-gray-300 px-4 py-3"
            placeholder="Event name"
            value={manual.event_name}
            onChange={(e) => setManual({ ...manual, event_name: e.target.value })}
            required
          />
          <input
            className="w-full rounded-xl border border-gray-300 px-4 py-3"
            placeholder="Organization"
            value={manual.organization}
            onChange={(e) => setManual({ ...manual, organization: e.target.value })}
            required
          />
          <input
            type="date"
            className="w-full rounded-xl border border-gray-300 px-4 py-3"
            value={manual.date_text}
            onChange={(e) => setManual({ ...manual, date_text: e.target.value })}
            required
          />
          <select
            className="w-full rounded-xl border border-gray-300 px-4 py-3"
            value={manual.role}
            onChange={(e) => setManual({ ...manual, role: e.target.value })}
          >
            <option value="">Role (Optional)</option>
            <option value="Winner">Winner</option>
            <option value="Volunteer">Volunteer</option>
            <option value="Participant">Participant</option>
            <option value="Speaker">Speaker</option>
            <option value="Organizer">Organizer</option>
          </select>
          <button className="bg-prime-600 text-white rounded-xl px-5 py-3 font-semibold">Generate Certificate</button>
        </form>

        <form onSubmit={handleBulkGenerate} className="bg-white p-6 rounded-2xl border border-gray-200 space-y-4">
          <h3 className="text-xl font-semibold">3. Manual Bulk Generation (No CSV)</h3>
          <textarea
            className="w-full rounded-xl border border-gray-300 px-4 py-3 min-h-56"
            placeholder={'One participant per line\nAlice\nBob\nCharlie'}
            value={bulkNames}
            onChange={(e) => setBulkNames(e.target.value)}
            required
          />
          <button className="bg-accent-600 text-white rounded-xl px-5 py-3 font-semibold">Generate Bulk</button>
        </form>
      </section>

      <section className="bg-gradient-to-r from-prime-900 to-accent-700 text-white p-6 rounded-2xl flex flex-wrap gap-4 items-center">
        <button onClick={downloadZip} className="bg-white text-prime-900 rounded-xl px-5 py-3 font-semibold">
          Download ZIP (PDFs)
        </button>
        {previewLink && (
          <a href={previewLink} target="_blank" rel="noreferrer" className="bg-white/20 rounded-xl px-4 py-2 text-sm">
            Preview Latest Certificate
          </a>
        )}
        {verificationLink && (
          <a href={verificationLink} target="_blank" rel="noreferrer" className="bg-white/20 rounded-xl px-4 py-2 text-sm">
            Open Verification Link
          </a>
        )}
        <p className="text-sm break-all w-full">{msg}</p>
      </section>
    </div>
  );
}
