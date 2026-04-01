import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { API_BASE } from '../lib/api';

const API = API_BASE;
const CNAME_TARGET = 'verify.certflow.app';

type Settings = {
  custom_domain: string;
  white_label: boolean;
  primary_color: string;
  org_name_override: string;
  remove_branding: boolean;
  domain_verified: boolean;
};

function useToken() {
  return localStorage.getItem('token') || '';
}

export default function OrgSettings() {
  const navigate = useNavigate();
  const token = useToken();
  const [settings, setSettings] = useState<Settings>({
    custom_domain: '',
    white_label: false,
    primary_color: '#0d9488',
    org_name_override: '',
    remove_branding: false,
    domain_verified: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const notify = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }
    fetch(`${API}/settings`, { headers })
      .then(r => r.json())
      .then(setSettings)
      .catch(() => notify('Failed to load settings', false))
      .finally(() => setLoading(false));
  }, [navigate, token]);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const save = async (patch: Partial<Settings>) => {
    setSaving(true);
    try {
      const res = await fetch(`${API}/settings`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Save failed');
      setSettings(s => ({ ...s, ...patch }));
      notify('Saved');
    } catch (e: any) {
      notify(e.message, false);
    } finally {
      setSaving(false);
    }
  };

  const triggerVerify = async () => {
    setVerifying(true);
    try {
      const res = await fetch(`${API}/settings/verify-domain`, { method: 'POST', headers });
      const data = await res.json();
      if (data.verified) {
        setSettings(s => ({ ...s, domain_verified: true }));
        notify('Domain verified!');
      } else {
        notify('CNAME not found yet — DNS can take up to 48h to propagate', false);
        // poll every 30s for 5 minutes
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = setInterval(async () => {
          const r = await fetch(`${API}/settings/domain-status`, { headers });
          const d = await r.json();
          if (d.domain_verified) {
            setSettings(s => ({ ...s, domain_verified: true }));
            notify('Domain verified!');
            clearInterval(pollRef.current!);
          }
        }, 30_000);
        setTimeout(() => { if (pollRef.current) clearInterval(pollRef.current); }, 5 * 60_000);
      }
    } catch {
      notify('Verification request failed', false);
    } finally {
      setVerifying(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-prime-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-prime-50 via-white to-accent-50 p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <Link to="/dashboard" className="text-sm text-prime-600 hover:underline">← Back to Dashboard</Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-2">Organisation Settings</h1>
          <p className="text-sm text-gray-500 mt-1">Manage your custom domain and white-label branding.</p>
        </div>

        {/* Custom Domain */}
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
          <h2 className="font-bold text-gray-800 flex items-center gap-2">
            <svg className="w-5 h-5 text-prime-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
            </svg>
            Custom Domain
          </h2>

          <div className="flex gap-2">
            <input
              className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:ring-2 focus:ring-prime-500 outline-none"
              placeholder="certs.myorg.com"
              value={settings.custom_domain}
              onChange={e => setSettings(s => ({ ...s, custom_domain: e.target.value }))}
            />
            <button
              onClick={() => save({ custom_domain: settings.custom_domain })}
              disabled={saving}
              className="px-4 py-2.5 bg-prime-600 hover:bg-prime-700 text-white text-sm font-semibold rounded-xl transition disabled:opacity-50"
            >
              Save
            </button>
          </div>

          {/* CNAME instructions */}
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 space-y-2 text-sm">
            <p className="font-semibold text-blue-800">DNS Setup</p>
            <p className="text-blue-700">Add a CNAME record pointing your domain to:</p>
            <code className="block bg-white border border-blue-200 rounded-lg px-3 py-2 text-blue-900 font-mono text-xs select-all">
              {CNAME_TARGET}
            </code>
            <p className="text-blue-600 text-xs">Example: <span className="font-mono">certs.myorg.com → {CNAME_TARGET}</span></p>
          </div>

          {/* Verification status */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              {settings.domain_verified ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                  <span className="text-emerald-700 font-semibold">Verified</span>
                </>
              ) : (
                <>
                  <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
                  <span className="text-amber-700 font-semibold">Not verified</span>
                </>
              )}
            </div>
            {!settings.domain_verified && settings.custom_domain && (
              <button
                onClick={triggerVerify}
                disabled={verifying}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-gray-200 rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
              >
                {verifying ? (
                  <svg className="w-3.5 h-3.5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                ) : null}
                Check DNS
              </button>
            )}
          </div>
        </section>

        {/* Branding */}
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
          <h2 className="font-bold text-gray-800 flex items-center gap-2">
            <svg className="w-5 h-5 text-prime-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
            </svg>
            Branding
          </h2>

          {/* Org name override */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Organisation Name Override</label>
            <div className="flex gap-2">
              <input
                className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:ring-2 focus:ring-prime-500 outline-none"
                placeholder="Acme Corp"
                value={settings.org_name_override}
                onChange={e => setSettings(s => ({ ...s, org_name_override: e.target.value }))}
              />
              <button
                onClick={() => save({ org_name_override: settings.org_name_override })}
                disabled={saving}
                className="px-4 py-2.5 bg-prime-600 hover:bg-prime-700 text-white text-sm font-semibold rounded-xl transition disabled:opacity-50"
              >
                Save
              </button>
            </div>
          </div>

          {/* Primary color */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Primary Color</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                className="w-10 h-10 rounded-lg border border-gray-200 cursor-pointer p-0.5"
                value={settings.primary_color}
                onChange={e => setSettings(s => ({ ...s, primary_color: e.target.value }))}
              />
              <input
                className="w-32 rounded-xl border border-gray-200 px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-prime-500 outline-none"
                value={settings.primary_color}
                onChange={e => setSettings(s => ({ ...s, primary_color: e.target.value }))}
              />
              <button
                onClick={() => save({ primary_color: settings.primary_color })}
                disabled={saving}
                className="px-4 py-2 bg-prime-600 hover:bg-prime-700 text-white text-sm font-semibold rounded-xl transition disabled:opacity-50"
              >
                Save
              </button>
            </div>
          </div>

          {/* White label toggle */}
          <div className="flex items-center justify-between py-3 border-t border-gray-100">
            <div>
              <p className="text-sm font-semibold text-gray-800">White-label mode</p>
              <p className="text-xs text-gray-400 mt-0.5">Show your branding on the verify page instead of CertFlow's</p>
            </div>
            <button
              onClick={() => save({ white_label: !settings.white_label })}
              type="button"
              role="switch"
              aria-checked={settings.white_label}
              aria-label="Toggle white-label mode"
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings.white_label ? 'bg-prime-600' : 'bg-gray-200'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${settings.white_label ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          {/* Remove branding — gated */}
          <div className={`flex items-center justify-between py-3 border-t border-gray-100 ${!settings.white_label ? 'opacity-40 pointer-events-none' : ''}`}>
            <div>
              <p className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
                Remove "Powered by CertFlow"
                {!settings.white_label && (
                  <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold">Requires white-label</span>
                )}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">Hides the CertFlow footer attribution on verify pages</p>
            </div>
            <button
              onClick={() => save({ remove_branding: !settings.remove_branding })}
              type="button"
              role="switch"
              aria-checked={settings.remove_branding}
              aria-label='Toggle remove "Powered by CertFlow"'
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings.remove_branding ? 'bg-prime-600' : 'bg-gray-200'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${settings.remove_branding ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
        </section>
      </div>

      {/* Toast */}
      <div className={`fixed bottom-6 right-6 z-50 transition-all duration-300 ${toast ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0 pointer-events-none'}`}>
        <div className={`${toast?.ok ? 'bg-emerald-600' : 'bg-red-600'} text-white text-sm font-medium px-5 py-3 rounded-2xl shadow-2xl`}>
          {toast?.msg}
        </div>
      </div>
    </div>
  );
}
