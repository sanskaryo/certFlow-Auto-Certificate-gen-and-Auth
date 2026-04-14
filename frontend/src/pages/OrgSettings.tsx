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
  smtp_from_name: string;
  smtp_from_email: string;
  smtp_host: string;
  smtp_port: string; // use string for easy input mapping
  smtp_username: string;
  smtp_password: string;
  admin_name: string;
  admin_role: string;
  admin_organization: string;
  default_signature_path: string;
  default_logo_path: string;
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
    smtp_from_name: '',
    smtp_from_email: '',
    smtp_host: '',
    smtp_port: '',
    smtp_username: '',
    smtp_password: '',
    admin_name: '',
    admin_role: '',
    admin_organization: '',
    default_signature_path: '',
    default_logo_path: '',
  });
  
  const [apiKeys, setApiKeys] = useState<any[]>([]);
  const [showNewKey, setShowNewKey] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [generatedKey, setGeneratedKey] = useState<{name: string, key: string} | null>(null);
  
  const [passwords, setPasswords] = useState({ current: '', new: '', confirm: '' });
  
  const [deletingMap, setDeletingMap] = useState<Record<string, boolean>>({});
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

  const handleUploadAsset = async (e: React.ChangeEvent<HTMLInputElement>, asset_type: 'logo' | 'signature') => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('asset_type', asset_type);

    setSaving(true);
    try {
      const res = await fetch(`${API}/settings/upload-asset`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Upload failed');
      
      setSettings(s => ({
        ...s,
        [asset_type === 'logo' ? 'default_logo_path' : 'default_signature_path']: data.path
      }));
      notify('Asset uploaded correctly');
    } catch (err: any) {
      notify(err.message, false);
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

  useEffect(() => {
    if (token) fetchApiKeys();
  }, [token]);

  const fetchApiKeys = async () => {
    try {
      const res = await fetch(`${API}/auth/api-keys`, { headers });
      if (res.ok) {
        const data = await res.json();
        setApiKeys(data);
      }
    } catch (e) {}
  };

  const generateApiKey = async () => {
    if (!newKeyName.trim()) return notify("Name required for API key", false);
    try {
      const res = await fetch(`${API}/auth/api-keys`, {
        method: "POST", headers, body: JSON.stringify({ name: newKeyName.trim() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to generate key");
      setGeneratedKey({ name: data.name, key: data.key });
      setNewKeyName('');
      setShowNewKey(false);
      fetchApiKeys();
      notify("API Key generated");
    } catch (e: any) {
      notify(e.message, false);
    }
  };

  const revokeApiKey = async (id: string) => {
    if (!confirm("Are you sure you want to revoke this key?")) return;
    setDeletingMap(p => ({ ...p, [id]: true }));
    try {
      const res = await fetch(`${API}/auth/api-keys/${id}`, { method: "DELETE", headers });
      if (!res.ok) throw new Error("Failed to revoke");
      fetchApiKeys();
      notify("API Key revoked");
    } catch (e: any) {
      notify(e.message, false);
    } finally {
      setDeletingMap(p => ({ ...p, [id]: false }));
    }
  };

  const testSmtp = async () => {
    try {
      setVerifying(true);
      const res = await fetch(`${API}/settings/smtp/test`, {
        method: "POST", headers, body: JSON.stringify({
          from_name: settings.smtp_from_name,
          from_email: settings.smtp_from_email,
          smtp_host: settings.smtp_host,
          smtp_port: parseInt(settings.smtp_port) || 587,
          smtp_username: settings.smtp_username,
          smtp_password: settings.smtp_password
        })
      });
      const data = await res.json();
      if (data.success) {
        notify("Test email sent successully");
      } else {
        notify("SMTP Error: " + data.message, false);
      }
    } catch (e: any) {
      notify("SMTP Test failed", false);
    } finally {
      setVerifying(false);
    }
  };

  const updatePassword = async () => {
    if (passwords.new !== passwords.confirm) return notify("New passwords do not match", false);
    if (!passwords.current || !passwords.new) return notify("Fill out password fields", false);
    try {
      setSaving(true);
      const res = await fetch(`${API}/auth/change-password`, {
        method: "POST", headers, body: JSON.stringify({
          current_password: passwords.current,
          new_password: passwords.new
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to update password");
      notify("Password updated successfully");
      setPasswords({ current: '', new: '', confirm: '' });
    } catch (e: any) {
      notify(e.message, false);
    } finally {
      setSaving(false);
    }
  };

  const confirmDeleteAccount = () => {
    const confirmEmail = prompt("This action cannot be undone. Type your email to confirm account deletion:");
    if (!confirmEmail) return;
    notify("Delete account request simulated.", false); // Safely mocked for now since backend delete missing
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
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-1.5 text-sm text-prime-600 font-semibold hover:text-prime-700 transition mb-4"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
            </svg>
            Back to Dashboard
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Organisation Settings</h1>
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

        {/* Authority Defaults */}
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
          <div>
            <h2 className="font-bold text-gray-800 text-lg">Authority Profile</h2>
            <p className="text-sm text-gray-500">Configure default details pre-filled for certificates.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500 uppercase">Authority Name</label>
              <input 
                placeholder="Dr. John Doe" 
                className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:ring-2 focus:ring-prime-500 outline-none"
                value={settings.admin_name || ''} onChange={e => setSettings(s => ({...s, admin_name: e.target.value}))}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500 uppercase">Authority Role</label>
              <input 
                placeholder="Director of Programs" 
                className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:ring-2 focus:ring-prime-500 outline-none"
                value={settings.admin_role || ''} onChange={e => setSettings(s => ({...s, admin_role: e.target.value}))}
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <label className="text-xs font-semibold text-gray-500 uppercase">Organization / Branch</label>
              <input 
                placeholder="College of Engineering" 
                className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:ring-2 focus:ring-prime-500 outline-none"
                value={settings.admin_organization || ''} onChange={e => setSettings(s => ({...s, admin_organization: e.target.value}))}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-gray-100 mt-2">
             <div className="space-y-2">
               <label className="text-xs font-semibold text-gray-500 uppercase">Default Signature</label>
               {settings.default_signature_path ? (
                 <div className="relative group rounded-xl border border-gray-200 p-4 bg-gray-50 flex items-center justify-center min-h-[100px]">
                   <img src={`${API_BASE.replace('/api/v1', '')}/${settings.default_signature_path}`} alt="Signature" className="max-h-16 object-contain" />
                   <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center rounded-xl">
                      <button onClick={() => setSettings(s => ({...s, default_signature_path: ''}))} className="bg-white text-red-600 px-3 py-1.5 text-xs font-bold rounded-lg shadow-sm hover:bg-red-50">Remove</button>
                   </div>
                 </div>
               ) : (
                 <div className="rounded-xl border-2 border-dashed border-gray-200 p-6 flex flex-col items-center justify-center hover:bg-gray-50 hover:border-prime-400 transition cursor-pointer" onClick={() => document.getElementById('upload-def-sig')?.click()}>
                   <svg className="w-8 h-8 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                   <span className="text-xs font-medium text-gray-500">Upload Signature</span>
                 </div>
               )}
               <input id="upload-def-sig" type="file" accept="image/png, image/jpeg" className="hidden" onChange={e => handleUploadAsset(e, 'signature')} />
             </div>

             <div className="space-y-2">
               <label className="text-xs font-semibold text-gray-500 uppercase">Default Logo</label>
               {settings.default_logo_path ? (
                 <div className="relative group rounded-xl border border-gray-200 p-4 bg-gray-50 flex items-center justify-center min-h-[100px]">
                   <img src={`${API_BASE.replace('/api/v1', '')}/${settings.default_logo_path}`} alt="Logo" className="max-h-16 object-contain" />
                   <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center rounded-xl">
                      <button onClick={() => setSettings(s => ({...s, default_logo_path: ''}))} className="bg-white text-red-600 px-3 py-1.5 text-xs font-bold rounded-lg shadow-sm hover:bg-red-50">Remove</button>
                   </div>
                 </div>
               ) : (
                 <div className="rounded-xl border-2 border-dashed border-gray-200 p-6 flex flex-col items-center justify-center hover:bg-gray-50 hover:border-prime-400 transition cursor-pointer" onClick={() => document.getElementById('upload-def-log')?.click()}>
                   <svg className="w-8 h-8 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0V19a2 2 0 01-2 2h-12a2 2 0 01-2-2v-5z" /></svg>
                   <span className="text-xs font-medium text-gray-500">Upload Logo</span>
                 </div>
               )}
               <input id="upload-def-log" type="file" accept="image/png, image/jpeg" className="hidden" onChange={e => handleUploadAsset(e, 'logo')} />
             </div>
          </div>

          <div className="flex items-center pt-2">
            <button
              onClick={() => save({
                admin_name: settings.admin_name,
                admin_role: settings.admin_role,
                admin_organization: settings.admin_organization,
                default_signature_path: settings.default_signature_path,
                default_logo_path: settings.default_logo_path,
              })}
              disabled={saving}
              className="px-6 py-2.5 bg-prime-600 hover:bg-prime-700 text-white text-sm font-semibold rounded-xl transition disabled:opacity-50"
            >
              Save Authority Profile
            </button>
          </div>
        </section>

        {/* CARD 3 — API Keys */}
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-bold text-gray-800 text-lg">API Keys</h2>
              <p className="text-sm text-gray-500">Use these keys to issue certificates programmatically from your LMS or platform</p>
            </div>
            <button
              onClick={() => setShowNewKey(!showNewKey)}
              className="px-4 py-2 border border-teal-600 text-teal-600 hover:bg-teal-50 text-sm font-semibold rounded-xl transition"
            >
              Generate new key
            </button>
          </div>

          {showNewKey && (
            <div className="flex gap-2 bg-gray-50 p-4 rounded-xl border border-gray-100">
              <input
                autoFocus
                placeholder="Key name (e.g. Teachable integration)"
                className="flex-1 rounded-xl border border-gray-200 px-4 py-2 text-sm focus:ring-2 focus:ring-prime-500 outline-none"
                value={newKeyName}
                onChange={e => setNewKeyName(e.target.value)}
              />
              <button
                onClick={generateApiKey}
                className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold rounded-xl transition"
              >
                Create
              </button>
            </div>
          )}

          {generatedKey && (
            <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl space-y-2">
              <p className="text-emerald-800 font-semibold text-sm flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                Key generated: {generatedKey.name}
              </p>
              <div className="flex gap-2">
                <code className="flex-1 block bg-white border border-emerald-200 rounded-lg px-3 py-2 text-emerald-900 font-mono text-sm break-all">
                  {generatedKey.key}
                </code>
                <button
                  onClick={() => { navigator.clipboard.writeText(generatedKey.key); notify("Copied to clipboard"); }}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg transition shrink-0"
                >
                  Copy
                </button>
              </div>
              <p className="text-xs text-emerald-600 font-medium pt-1">Save this key — it won't be shown again.</p>
            </div>
          )}

          {apiKeys.length === 0 ? (
            <div className="text-center py-6 border-2 border-dashed border-gray-100 rounded-xl bg-gray-50/50">
              <p className="text-sm text-gray-500">No API keys yet. Generate one to start issuing certificates from your platform.</p>
            </div>
          ) : (
            <div className="overflow-x-auto border border-gray-100 rounded-xl">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-gray-50 text-gray-500 font-semibold border-b border-gray-100 uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Key</th>
                    <th className="px-4 py-3">Created</th>
                    <th className="px-4 py-3">Last used</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {apiKeys.map(k => (
                    <tr key={k.id} className="hover:bg-gray-50/50">
                      <td className="px-4 py-3 font-medium text-gray-900">{k.name}</td>
                      <td className="px-4 py-3 font-mono text-gray-500">{k.key_masked}</td>
                      <td className="px-4 py-3 text-gray-500">{new Date(k.created_at).toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-gray-500">{k.last_used_at ? new Date(k.last_used_at).toLocaleDateString() : 'Never'}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => revokeApiKey(k.id)}
                          disabled={deletingMap[k.id]}
                          className="px-3 py-1.5 border border-red-200 text-red-600 hover:bg-red-50 text-xs font-semibold rounded-lg transition disabled:opacity-50"
                        >
                          {deletingMap[k.id] ? 'Revoking...' : 'Revoke'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* CARD 4 — Email / SMTP Configuration */}
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
          <div>
            <h2 className="font-bold text-gray-800 text-lg">Email sending</h2>
            <p className="text-sm text-gray-500">Certificates will be sent from this address. Leave blank to use CertFlow's default sender.</p>
          </div>

          {!settings.smtp_host && (
             <div className="bg-blue-50 border border-blue-100 text-blue-800 text-sm p-3 rounded-lg flex items-start gap-2">
               <svg className="w-5 h-5 shrink-0 mt-0.5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
               <p>Using CertFlow default sender. Recipients will see certificates sent from <strong>no-reply@certflow.app</strong></p>
             </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500 uppercase">From name</label>
              <input 
                placeholder="Acme Academy" 
                className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:ring-2 focus:ring-prime-500 outline-none"
                value={settings.smtp_from_name || ''} onChange={e => setSettings(s => ({...s, smtp_from_name: e.target.value}))}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500 uppercase">From email</label>
              <input 
                placeholder="certs@acme.com" 
                className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:ring-2 focus:ring-prime-500 outline-none"
                value={settings.smtp_from_email || ''} onChange={e => setSettings(s => ({...s, smtp_from_email: e.target.value}))}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500 uppercase">SMTP host</label>
              <input 
                placeholder="smtp.gmail.com" 
                className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:ring-2 focus:ring-prime-500 outline-none"
                value={settings.smtp_host || ''} onChange={e => setSettings(s => ({...s, smtp_host: e.target.value}))}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500 uppercase">SMTP port</label>
              <input 
                type="number" placeholder="587" 
                className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:ring-2 focus:ring-prime-500 outline-none"
                value={settings.smtp_port || ''} onChange={e => setSettings(s => ({...s, smtp_port: e.target.value}))}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500 uppercase">SMTP username</label>
              <input 
                className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:ring-2 focus:ring-prime-500 outline-none"
                value={settings.smtp_username || ''} onChange={e => setSettings(s => ({...s, smtp_username: e.target.value}))}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500 uppercase">SMTP password</label>
              <input 
                type="password"
                className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:ring-2 focus:ring-prime-500 outline-none"
                value={settings.smtp_password || ''} onChange={e => setSettings(s => ({...s, smtp_password: e.target.value}))}
              />
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={() => save({
                smtp_from_name: settings.smtp_from_name,
                smtp_from_email: settings.smtp_from_email,
                smtp_host: settings.smtp_host,
                smtp_port: settings.smtp_port,
                smtp_username: settings.smtp_username,
                smtp_password: settings.smtp_password,
              })}
              disabled={saving}
              className="px-6 py-2.5 bg-prime-600 hover:bg-prime-700 text-white text-sm font-semibold rounded-xl transition disabled:opacity-50"
            >
              Save email settings
            </button>
            <button
              onClick={testSmtp}
              disabled={verifying || !settings.smtp_host}
              className="px-4 py-2.5 border border-teal-600 text-teal-600 hover:bg-teal-50 text-sm font-semibold rounded-xl transition disabled:opacity-50"
            >
              Send test email
            </button>
          </div>
        </section>

        {/* CARD 5 — Account */}
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-6">
          <h2 className="font-bold text-gray-800 text-lg">Account</h2>
          
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-700">Change password</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input type="password" placeholder="Current password" value={passwords.current} onChange={e => setPasswords(p => ({...p, current: e.target.value}))} className="rounded-xl border border-gray-200 px-4 py-2 text-sm focus:ring-2 focus:ring-prime-500 outline-none" />
              <input type="password" placeholder="New password" value={passwords.new} onChange={e => setPasswords(p => ({...p, new: e.target.value}))} className="rounded-xl border border-gray-200 px-4 py-2 text-sm focus:ring-2 focus:ring-prime-500 outline-none" />
              <input type="password" placeholder="Confirm password" value={passwords.confirm} onChange={e => setPasswords(p => ({...p, confirm: e.target.value}))} className="rounded-xl border border-gray-200 px-4 py-2 text-sm focus:ring-2 focus:ring-prime-500 outline-none" />
            </div>
            <button onClick={updatePassword} disabled={saving} className="px-5 py-2.5 bg-gray-900 border border-transparent hover:bg-black text-white text-sm font-bold rounded-xl transition">
              Update password
            </button>
          </div>

          <div className="pt-6 border-t border-gray-100 space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-red-600">Danger zone</h3>
              <p className="text-xs text-gray-500 mt-1">Once you delete your account, there is no going back. Please be certain.</p>
            </div>
            <button onClick={confirmDeleteAccount} className="px-5 py-2.5 border border-red-300 text-red-600 hover:bg-red-50 text-sm font-bold rounded-xl transition">
              Delete account
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
