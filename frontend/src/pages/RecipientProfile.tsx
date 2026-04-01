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
    <article className="group bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-lg hover:border-prime-200 transition-all duration-300 overflow-hidden flex flex-col">
      <div className="w-full h-32 bg-gray-100 overflow-hidden flex-shrink-0">
        <img
          src={`${api}/verify/${cert.cert_id}/preview`}
          alt={cert.event_name}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      </div>
      <div className="h-1 w-full bg-gradient-to-r from-prime-500 to-accent-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      <div className="p-5 flex flex-col flex-1">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-400 font-medium truncate">{cert.organization}</p>
            <h3 className="text-base font-bold text-gray-900 mt-0.5 leading-snug">{cert.event_name}</h3>
          </div>
          <RoleBadge role={cert.role} />
        </div>
        <p className="text-xs text-gray-400 flex items-center gap-1 mb-4">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          {date}
        </p>
        <div className="mt-auto flex flex-wrap gap-2">
          <Link
            to={`/verify/${cert.cert_id}`}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-prime-600 hover:bg-prime-700 text-white text-xs font-semibold rounded-lg transition"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            Verify
          </Link>
          <button
            onClick={onCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-lg transition"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            Copy Link
          </button>
          <a
            href={linkedInUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold rounded-lg transition"
          >
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
            </svg>
            LinkedIn
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

  const handleShare = async (certId: string) => {
    await fetch(`${API}/verify/${certId}/track/share`, { method: 'POST' }).catch(() => undefined);
    navigator.clipboard.writeText(`${window.location.origin}/verify/${certId}`);
    notify('Link copied to clipboard');
  };

  if (error) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-3">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
          <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <p className="text-gray-700 font-semibold">{error}</p>
        <Link to="/" className="text-prime-600 text-sm hover:underline">Go home</Link>
      </div>
    </div>
  );

  if (!profile) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-4 border-prime-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-500 text-sm">Loading profile...</p>
      </div>
    </div>
  );

  const initials = (profile.display_name || profile.username).slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen bg-gradient-to-br from-prime-50 via-white to-accent-50">
      <div className="bg-gradient-to-r from-prime-700 via-prime-600 to-accent-600 text-white">
        <div className="max-w-5xl mx-auto px-6 py-12">
          <div className="flex flex-col sm:flex-row items-center sm:items-end gap-6">
            <div className="w-24 h-24 rounded-2xl bg-white/20 backdrop-blur-sm border-2 border-white/30 flex items-center justify-center text-3xl font-bold shadow-xl flex-shrink-0">
              {initials}
            </div>
            <div className="text-center sm:text-left flex-1">
              <p className="text-prime-200 text-sm font-medium">@{profile.username}</p>
              <h1 className="text-3xl sm:text-4xl font-bold mt-1" style={{ fontFamily: 'Playfair Display, serif' }}>
                {profile.display_name || profile.username}
              </h1>
              {profile.bio && <p className="mt-2 text-white/80 text-sm max-w-lg">{profile.bio}</p>}
            </div>
            <div className="flex gap-6 text-center">
              <div className="bg-white/10 backdrop-blur-sm rounded-xl px-5 py-3">
                <p className="text-2xl font-bold">{profile.certificates.length}</p>
                <p className="text-xs text-white/70 mt-0.5">Certificates</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-gray-800">
            Credentials
            <span className="ml-2 text-sm font-normal text-gray-400">({filtered.length})</span>
          </h2>
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              className="pl-9 pr-4 py-2 text-sm rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-prime-500 outline-none w-64"
              placeholder="Search by event, role, org..."
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-16 bg-white/60 rounded-2xl border border-gray-100">
            <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-gray-400 text-sm">No certificates found</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
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

      <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 transition-all duration-300 ${toast ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0 pointer-events-none'}`}>
        <div className="bg-gray-900 text-white text-sm font-medium px-5 py-2.5 rounded-2xl shadow-2xl flex items-center gap-2">
          <svg className="w-4 h-4 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          {toast}
        </div>
      </div>
    </div>
  );
}
