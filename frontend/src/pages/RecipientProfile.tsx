import { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { API_BASE } from '../lib/api';

type Cert = {
  cert_id: string;
  participant_name: string;
  event_name: string;
  organization: string;
  date_text: string;
  role: string;
  issued_date: string;
  verification_hash: string;
};

type Profile = {
  username: string;
  display_name: string;
  bio: string;
  certificates: Cert[];
};

function RoleBadge({ role }: { role: string }) {
  const colors: Record<string, string> = {
    winner:      'bg-amber-100 text-amber-700',
    participant: 'bg-teal-100 text-teal-700',
    volunteer:   'bg-purple-100 text-purple-700',
    speaker:     'bg-blue-100 text-blue-700',
  };
  const key = role.toLowerCase();
  const cls = Object.entries(colors).find(([k]) => key.includes(k))?.[1] ?? 'bg-gray-100 text-gray-600';
  return (
    <span className={`inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full ${cls}`}>
      {role || 'Participant'}
    </span>
  );
}

function CertCard({ cert, api, onCopy }: { cert: Cert; api: string; onCopy: () => void }) {
  const date = cert.date_text || new Date(cert.issued_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  const verifyUrl = `${window.location.origin}/verify/${cert.cert_id}`;
  const issued = new Date(cert.issued_date);
  const linkedInUrl = [
    'https://www.linkedin.com/profile/add',
    '?startTask=CERTIFICATION_NAME',
    `&name=${encodeURIComponent(cert.event_name)}`,
    `&organizationName=${encodeURIComponent(cert.organization)}`,
    `&issueYear=${issued.getFullYear()}`,
    `&issueMonth=${issued.getMonth() + 1}`,
    `&certUrl=${encodeURIComponent(verifyUrl)}`,
    `&certId=${encodeURIComponent(cert.cert_id)}`,
  ].join('');

  return (
    <article className="group bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-lg hover:border-teal-200 transition-all duration-300 overflow-hidden flex flex-col">
      <div className="w-full h-32 bg-gray-50 overflow-hidden flex-shrink-0 relative">
        <img
          src={`${api}/verify/${cert.cert_id}/preview`}
          alt={cert.event_name}
          className="w-full h-full object-cover blur-[1px] group-hover:blur-0 transition-all"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-white/90 to-transparent" />
      </div>
      <div className="h-1 w-full bg-gradient-to-r from-teal-500 to-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      <div className="p-5 flex flex-col flex-1">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">{cert.organization}</p>
            <h3 className="text-base font-black text-slate-800 mt-1 leading-snug truncate">{cert.event_name}</h3>
          </div>
          <RoleBadge role={cert.role} />
        </div>

        <p className="text-xs text-slate-400 font-bold flex items-center gap-1.5 mb-6">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
          {date}
        </p>

        <div className="mt-auto flex items-center gap-2 pt-4 border-t border-slate-50">
          <Link
            to={`/verify/${cert.cert_id}`}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-slate-50 hover:bg-teal-50 text-slate-600 hover:text-teal-600 text-xs font-black rounded-xl transition-all"
          >
            Verify
          </Link>
          <button
            onClick={onCopy}
            className="p-2.5 bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-xl transition-all"
            title="Copy Link"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
          </button>
          <a
            href={linkedInUrl}
            target="_blank"
            rel="noreferrer"
            className="p-2.5 bg-[#0077b5]/10 hover:bg-[#0077b5]/20 text-[#0077b5] rounded-xl transition-all"
            title="Add to LinkedIn"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.761 0 5-2.239 5-5v-14c0-2.761-2.239-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg>
          </a>
        </div>
      </div>
    </article>
  );
}

export default function RecipientProfile() {
  const { username } = useParams<{ username: string }>();
  const API = API_BASE;
  const [profile, setProfile] = useState<Profile | null>(null);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  useEffect(() => {
    if (!username) return;
    fetch(`${API}/profiles/${username}`)
      .then(async r => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.detail || 'Profile not found');
        return data;
      })
      .then(data => ({
        ...data,
        certificates: (data.certificates || []).map((c: any) => ({
          ...c,
          cert_id: c.cert_id || c.id,
          issued_date: c.issued_date || c.issued_at,
        })),
      }))
      .then(setProfile)
      .catch(e => setError(e.message));
  }, [username, API]);

  const filtered = useMemo(
    () => (profile?.certificates || []).filter(c =>
      `${c.event_name} ${c.organization} ${c.role}`.toLowerCase().includes(query.toLowerCase())
    ),
    [profile, query]
  );

  const notify = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  };

  const handleShare = (certId: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/verify/${certId}`);
    notify('Link copied to clipboard');
  };

  if (error) return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
      <div className="glass-panel p-12 rounded-[2.5rem] text-center max-w-md w-full">
        <div className="w-20 h-20 bg-red-50 rounded-3xl flex items-center justify-center mx-auto mb-6 text-red-500">
          <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
        </div>
        <h2 className="text-2xl font-black text-slate-800 mb-2">Profile Lost</h2>
        <p className="text-slate-500 font-medium mb-8">{error}</p>
        <Link to="/" className="inline-flex py-3 px-8 gradient-brand text-white font-bold rounded-xl shadow-lg shadow-teal-500/20 active:scale-95 transition-all">Go Home</Link>
      </div>
    </div>
  );

  if (!profile) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50/50">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-4 border-teal-500/20 border-t-teal-500 rounded-full animate-spin" />
        <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Syncing Identity...</p>
      </div>
    </div>
  );

  const initials = (profile.display_name || profile.username).split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div className="min-h-screen bg-slate-50/30">
      {/* Hero */}
      <div className="bg-slate-900 overflow-hidden relative">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-[-10%] right-[-10%] w-96 h-96 bg-teal-500 rounded-full blur-[100px]" />
          <div className="absolute bottom-[-10%] left-[-10%] w-96 h-96 bg-indigo-500 rounded-full blur-[100px]" />
        </div>
        
        <div className="max-w-5xl mx-auto px-6 py-16 relative z-10 transition-all">
          <div className="flex flex-col md:flex-row items-center md:items-end gap-10">
            <div className="w-32 h-32 rounded-[2rem] bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-4xl font-black text-white shadow-2xl rotate-3 hover:rotate-0 transition-transform duration-500">
              {initials}
            </div>
            <div className="text-center md:text-left flex-1">
              <span className="px-3 py-1 bg-teal-500/20 text-teal-400 text-[10px] font-black uppercase tracking-widest rounded-full border border-teal-500/20">Verified Recipient</span>
              <h1 className="text-4xl md:text-6xl font-black text-white mt-4 font-display tracking-tight uppercase">
                {profile.display_name || profile.username}
              </h1>
              {profile.bio && <p className="mt-4 text-slate-300 font-medium max-w-lg leading-relaxed">{profile.bio}</p>}
            </div>
            <div className="shrink-0 flex gap-4">
               <div className="px-8 py-4 glass-panel border-white/10 text-center rounded-3xl">
                  <p className="text-3xl font-black text-white font-display leading-none">{profile.certificates.length}</p>
                  <p className="text-[10px] font-black text-teal-400 uppercase tracking-widest mt-2">Credentials</p>
               </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-6 py-12">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
          <h2 className="text-2xl font-black text-slate-800 font-display uppercase tracking-tight">Active Ecosystem Portfolio</h2>
          <div className="relative">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input
              className="pl-11 pr-6 h-12 rounded-2xl border-slate-200 bg-white w-full md:w-80 shadow-sm"
              placeholder="Search achievements..."
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-24 glass-panel rounded-[2.5rem] border-dashed border-slate-200">
            <svg className="w-16 h-16 text-slate-200 mx-auto mb-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            <p className="text-slate-400 font-black uppercase tracking-widest text-xs">No matching credentials found in manifest</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {filtered.map(cert => (
              <CertCard
                key={cert.cert_id}
                cert={cert}
                api={API}
                onCopy={() => handleShare(cert.cert_id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer Branding */}
      <footer className="py-12 border-t border-slate-100 mt-20">
         <div className="max-w-5xl mx-auto px-6 flex items-center justify-center flex-col gap-2">
            <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em]">SECURED BY</p>
            <Link to="/" className="text-xl font-black gradient-text font-display">CertFlow Enterprise</Link>
         </div>
      </footer>

      {/* Toast */}
      <div className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-50 transition-all duration-300 ${toast ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0 pointer-events-none'}`}>
        <div className="bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
          {toast}
        </div>
      </div>
    </div>
  );
}