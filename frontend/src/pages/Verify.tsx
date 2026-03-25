import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

type VerifyPayload = {
    id: string;
    participant_name: string;
    event_name: string;
    organization?: string;
    role?: string;
    date_text?: string;
    issued_at: string;
    verification_hash: string;
    issuer_name?: string;
    issuer_position?: string;
    has_signature?: boolean;
    is_valid: boolean;
};

export default function Verify() {
    const { id } = useParams<{ id: string }>();
    const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';

    const [certId, setCertId] = useState(id || '');
    const [hash, setHash] = useState('');
    const [data, setData] = useState<VerifyPayload | null>(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const verifyById = async (target: string) => {
        setLoading(true);
        setError('');
        try {
            const res = await fetch(`${API}/verify/${target}`);
            const body = await res.json();
            if (!res.ok) throw new Error(body.detail || 'Invalid certificate');
            setData(body);
            await fetch(`${API}/verify/${target}/track/open`, { method: 'POST' }).catch(() => undefined);
        } catch (e: any) {
            setData(null);
            setError(e.message || 'Verification failed');
        } finally {
            setLoading(false);
        }
    };

    const verifyByHash = async () => {
        if (!hash.trim()) return;
        setLoading(true);
        setError('');
        try {
            const res = await fetch(`${API}/verify/hash/${encodeURIComponent(hash.trim())}`);
            const body = await res.json();
            if (!res.ok) throw new Error(body.detail || 'Invalid hash');
            setData(body);
            setCertId(body.id);
        } catch (e: any) {
            setData(null);
            setError(e.message || 'Hash lookup failed');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (id) verifyById(id);
    }, [id]);

    return (
        <div className="min-h-screen bg-[#f4f7f2] p-6">
            <div className="max-w-4xl mx-auto">
                <Link to="/" className="text-[#0f766e]">Back to home</Link>
                <h1 className="text-4xl mt-2" style={{ fontFamily: 'Playfair Display, serif' }}>Certificate Verification</h1>

                <div className="grid md:grid-cols-2 gap-4 mt-6">
                    <div className="bg-white border rounded-xl p-4">
                        <p className="font-semibold">Verify with Certificate ID</p>
                        <div className="flex gap-2 mt-3">
                            <input className="flex-1 rounded-lg border px-3 py-2" value={certId} onChange={(e) => setCertId(e.target.value)} placeholder="Paste certificate ID" />
                            <button onClick={() => verifyById(certId)} className="px-4 py-2 rounded-lg bg-[#0f766e] text-white">Verify</button>
                        </div>
                    </div>
                    <div className="bg-white border rounded-xl p-4">
                        <p className="font-semibold">Verify with Security Hash</p>
                        <div className="flex gap-2 mt-3">
                            <input className="flex-1 rounded-lg border px-3 py-2" value={hash} onChange={(e) => setHash(e.target.value)} placeholder="Paste hash" />
                            <button onClick={verifyByHash} className="px-4 py-2 rounded-lg bg-[#1f9e91] text-white">Lookup</button>
                        </div>
                    </div>
                </div>

                {loading && <p className="mt-6">Verifying...</p>}
                {error && <p className="mt-6 text-red-600">{error}</p>}

                {data && (
                    <div className="mt-6 bg-white border rounded-2xl p-6">
                        <h2 className="text-2xl font-bold text-green-700">Valid Certificate</h2>
                        <p className="mt-4"><b>Recipient:</b> {data.participant_name}</p>
                        <p><b>Organization:</b> {data.organization || 'N/A'}</p>
                        <p><b>Event:</b> {data.event_name}</p>
                        <p><b>Role:</b> {data.role || 'N/A'}</p>
                        <p><b>Date:</b> {data.date_text || new Date(data.issued_at).toLocaleDateString()}</p>
                        <p><b>Issuer Signature:</b> {data.has_signature ? `${data.issuer_name || 'Issuer'}${data.issuer_position ? `, ${data.issuer_position}` : ''}` : 'Not available'}</p>

                        <p className="mt-3 text-xs break-all bg-gray-100 p-2 rounded"><b>Security Hash:</b> {data.verification_hash}</p>

                        <div className="mt-4 flex gap-2">
                            <a href={`${API}/verify/${data.id}/preview`} target="_blank" rel="noreferrer" className="px-4 py-2 rounded-lg bg-[#e3ece8]">Preview Certificate</a>
                            <button
                                className="px-4 py-2 rounded-lg bg-[#0f766e] text-white"
                                onClick={async () => {
                                    await fetch(`${API}/verify/${data.id}/track/share`, { method: 'POST' }).catch(() => undefined);
                                    navigator.clipboard.writeText(`${window.location.origin}/verify/${data.id}`);
                                }}
                            >
                                Copy Share Link
                            </button>
                        </div>

                        <p className="mt-5 text-sm text-gray-500">QR scan flow: scanning a certificate QR should open this page with the certificate ID pre-filled.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
