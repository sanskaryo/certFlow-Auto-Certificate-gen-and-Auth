import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
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
    winner: 'bg-amber-100 text-amber-700',
    participant: 'bg-teal-100 text-teal-700',
    volunteer: 'bg-purple-100 text-purple-700',
    speaker: 'bg-blue-100 text-blue-700',
  };

  const key = (role || '').toLowerCase();
  const cls = Object.entries(colors).find(([name]) => key.includes(name))?.[1] ?? 'bg-gray-100 text-gray-600';

  return (
    <span className={`inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full ${cls}`}>
      {role || 'Participant'}
    </span>
  );
}

function buildLinkedInUrl(cert: Cert) {
  const verifyUrl = `${window.location.origin}/verify/${cert.cert_id}`;
  const issued = new Date(cert.issued_date);

  return [
    'https://www.linkedin.com/profile/add',
    '?startTask=CERTIFICATION_NAME',
    `&name=${encodeURIComponent(cert.event_name)}`,
    `&organizationName=${encodeURIComponent(cert.organization)}`,
    `&issueYear=${issued.getFullYear()}`,
    `&issueMonth=${issued.getMonth() + 1}`,
    `&certUrl=${encodeURIComponent(verifyUrl)}`,
    `&certId=${encodeURIComponent(cert.cert_id)}`,
  ].join('');
}

function CertCard({ cert, api, onCopy }: { cert: Cert; api: string; onCopy: () => void }) {
  const date =
    cert.date_text ||
    new Date(cert.issued_date).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });

  const linkedInUrl = buildLinkedInUrl(cert);

  return (
    <article className="group bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-lg hover:border-prime-200 transition-all duration-300 overflow-hidden flex flex-col">
      <Link to={`/verify/${cert.cert_id}`} className="block w-full h-40 bg-gray-100 overflow-hidden">
        <img
          src={`${api}/verify/${cert.cert_id}/preview`}
          alt={cert.event_name}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      </Link>

      <div className="h-1 w-full bg-gradient-to-r from-prime-500 to-accent-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

      <div className="p-5 flex flex-col flex-1">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-400 font-medium truncate">{cert.organization}</p>
            <h3 className="text-base font-bold text-gray-900 mt-0.5 leading-snug">{cert.event_name}</h3>
          </div>
          <RoleBadge role={cert.role} />
        </div>

        <p className="text-xs text-gray-400 mb-4">{date}</p>

        <div className="mt-auto flex flex-wrap items-center gap-2">
          <Link
            to={`/verify/${cert.cert_id}`}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 hover:border-gray-300 text-gray-700 text-xs font-semibold rounded-lg transition"
          >
            Verify
          </Link>

          <button
            onClick={onCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-prime-600 hover:bg-prime-700 text-white text-xs font-semibold rounded-lg transition"
          >
            Copy Link
          </button>

          <a
            href={linkedInUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold rounded-lg transition"
          >
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
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || 'Profile not found');
        return data;
      })
      .then((data) => ({
        ...data,
        certificates: (data.certificates || []).map((c: any) => ({
          ...c,
          cert_id: c.cert_id || c.id,
          issued_date: c.issued_date || c.issued_at,
        })),
      }))
      .then(setProfile)
      .catch((e: any) => setError(e.message || 'Failed to load profile'));
  }, [username, API]);

  const filtered = useMemo(
    () =>
      (profile?.certificates || []).filter((c) =>
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
    await navigator.clipboard.writeText(`${window.location.origin}/verify/${certId}`);
    notify('Link copied to clipboard');
  };

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-3">
          <p className="text-gray-700 font-semibold">{error}</p>
          <Link to="/" className="text-prime-600 text-sm hover:underline">
            Go home
          </Link>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-prime-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500 text-sm">Loading profile...</p>
        </div>
      </div>
    );
  }

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

            <div className="bg-white/10 backdrop-blur-sm rounded-xl px-5 py-3 text-center">
              <p className="text-2xl font-bold">{profile.certificates.length}</p>
              <p className="text-xs text-white/70 mt-0.5">Certificates</p>
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

          <input
            className="px-4 py-2 text-sm rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-prime-500 outline-none w-full sm:w-72"
            placeholder="Search by event, role, org..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-16 bg-white/60 rounded-2xl border border-gray-100">
            <p className="text-gray-400 text-sm">No certificates found</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((cert) => (
              <CertCard key={cert.cert_id} cert={cert} api={API} onCopy={() => handleShare(cert.cert_id)} />
            ))}
          </div>
        )}
      </div>

      <div
        className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 transition-all duration-300 ${
          toast ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0 pointer-events-none'
        }`}
      >
        <div className="bg-gray-900 text-white text-sm font-medium px-5 py-2.5 rounded-2xl shadow-2xl">{toast}</div>
      </div>
    </div>
  );
}
