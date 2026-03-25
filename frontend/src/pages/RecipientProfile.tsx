import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';

type Cert = {
    id: string;
    participant_name: string;
    event_name: string;
    organization: string;
    date_text: string;
    role: string;
    issued_at: string;
};

type Profile = {
    username: string;
    display_name: string;
    bio: string;
    certificates: Cert[];
};

export default function RecipientProfile() {
    const { username } = useParams<{ username: string }>();
    const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';
    const [profile, setProfile] = useState<Profile | null>(null);
    const [query, setQuery] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        if (!username) return;
        fetch(`${API}/profiles/${username}`)
            .then(async (r) => {
                const data = await r.json();
                if (!r.ok) throw new Error(data.detail || 'Profile not found');
                return data;
            })
            .then((data) => setProfile(data))
            .catch((e) => setError(e.message));
    }, [username, API]);

    const filtered = useMemo(
        () =>
            (profile?.certificates || []).filter((c) =>
                `${c.event_name} ${c.organization} ${c.role}`.toLowerCase().includes(query.toLowerCase())
            ),
        [profile, query]
    );

    const shareCert = async (id: string) => {
        await fetch(`${API}/verify/${id}/track/share`, { method: 'POST' }).catch(() => undefined);
        navigator.clipboard.writeText(`${window.location.origin}/verify/${id}`);
    };

    if (error) return <div className="p-10 text-center text-red-600">{error}</div>;
    if (!profile) return <div className="p-10 text-center">Loading profile...</div>;

    return (
        <div className="min-h-screen bg-[#f4f7f2] text-[#1f2937]">
            <div className="max-w-6xl mx-auto p-6">
                <div className="rounded-2xl p-8 bg-gradient-to-r from-[#0f766e] to-[#1f9e91] text-white">
                    <p className="text-sm">@{profile.username}</p>
                    <h1 className="text-4xl mt-1" style={{ fontFamily: 'Playfair Display, serif' }}>{profile.display_name || profile.username}</h1>
                    <p className="mt-3 text-white/90">{profile.bio || 'Public credential profile'}</p>
                </div>

                <div className="mt-6">
                    <input
                        className="w-full max-w-md rounded-xl border px-4 py-2"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Filter certificates by event/role/org"
                    />
                </div>

                <div className="mt-6 grid md:grid-cols-2 gap-4">
                    {filtered.map((c) => (
                        <article key={c.id} className="bg-white border rounded-xl p-5">
                            <p className="text-sm text-gray-500">{c.organization}</p>
                            <h3 className="text-xl font-bold mt-1">{c.event_name}</h3>
                            <p className="mt-2 text-sm">Role: {c.role || 'Participant'}</p>
                            <p className="text-sm text-gray-600">Date: {c.date_text || new Date(c.issued_at).toLocaleDateString()}</p>
                            <div className="mt-4 flex gap-2 flex-wrap">
                                <a className="px-3 py-2 rounded-lg bg-[#0f766e] text-white text-sm" href={`/verify/${c.id}`}>Verify</a>
                                <button onClick={() => shareCert(c.id)} className="px-3 py-2 rounded-lg bg-[#e3ece8] text-sm">Share</button>
                                <a
                                    className="px-3 py-2 rounded-lg bg-[#e8f1ff] text-sm"
                                    href={`https://www.linkedin.com/profile/add?startTask=CERTIFICATION_NAME&name=${encodeURIComponent(c.event_name)}&organizationName=${encodeURIComponent(c.organization)}`}
                                    target="_blank"
                                    rel="noreferrer"
                                >
                                    Add to LinkedIn
                                </a>
                            </div>
                        </article>
                    ))}
                </div>
            </div>
        </div>
    );
}
