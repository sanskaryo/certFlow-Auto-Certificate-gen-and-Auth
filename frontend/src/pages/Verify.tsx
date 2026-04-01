import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { API_BASE } from '../lib/api';

const slugify = (name: string) =>
  name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 24) || 'recipient';

type OrgBranding = {
  org_name?: string;
  primary_color?: string;
  logo_url?: string;
  white_label: boolean;
  remove_branding: boolean;
};

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
    username?: string;
    branding?: OrgBranding | null;
};

export default function Verify() {
    const { id } = useParams<{ id: string }>();
    const API = API_BASE;

    const [certId, setCertId] = useState(id || '');
    const [hash, setHash] = useState('');
    const [data, setData] = useState<VerifyPayload | null>(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [toast, setToast] = useState('');

    // Derived branding — falls back to CertFlow defaults
    const brand = data?.branding?.white_label ? data.branding : null;
    const primaryColor = brand?.primary_color || '#0f766e';
    const orgName = brand?.org_name || 'CertFlow';
    const showPoweredBy = !brand?.remove_branding;

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

    const notify = (msg: string) => {
        setToast(msg);
        setTimeout(() => setToast(''), 2500);
    };

    return (
        <div className="min-h-screen bg-[#f4f7f2] p-6">
            <div className="max-w-4xl mx-auto">
                {/* Branded header */}
                <div className="flex items-center gap-3 mb-4">
                    {brand?.logo_url ? (
                        <img src={`${API}${brand.logo_url}`} alt={orgName} className="h-8 object-contain" />
                    ) : (
                        <span className="font-bold text-lg" style={{ color: primaryColor }}>🎓 {orgName}</span>
                    )}
                </div>
                <Link to="/" style={{ color: primaryColor }}>Back to home</Link>
                <h1 className="text-4xl mt-2" style={{ fontFamily: 'Playfair Display, serif' }}>Certificate Verification</h1>

                <div className="grid md:grid-cols-2 gap-4 mt-6">
                    <div className="bg-white border rounded-xl p-4">
                        <p className="font-semibold">Verify with Certificate ID</p>
                        <div className="flex gap-2 mt-3">
                            <input className="flex-1 rounded-lg border px-3 py-2" value={certId} onChange={(e) => setCertId(e.target.value)} placeholder="Paste certificate ID" />
                            <button
                                onClick={() => verifyById(certId)}
                                disabled={!certId.trim() || loading}
                                className="px-4 py-2 rounded-lg text-white disabled:opacity-60"
                                style={{ backgroundColor: primaryColor }}
                            >
                                Verify
                            </button>
                        </div>
                    </div>
                    <div className="bg-white border rounded-xl p-4">
                        <p className="font-semibold">Verify with Security Hash</p>
                        <div className="flex gap-2 mt-3">
                            <input className="flex-1 rounded-lg border px-3 py-2" value={hash} onChange={(e) => setHash(e.target.value)} placeholder="Paste hash" />
                            <button
                                onClick={verifyByHash}
                                disabled={!hash.trim() || loading}
                                className="px-4 py-2 rounded-lg text-white disabled:opacity-60"
                                style={{ backgroundColor: primaryColor }}
                            >
                                Lookup
                            </button>
                        </div>
                    </div>
                </div>

                {loading && <p className="mt-6">Verifying...</p>}
                {error && <p className="mt-6 text-red-600">{error}</p>}

                {data && (
                    <div className="mt-6 bg-white border rounded-2xl p-6">
                        <h2 className={`text-2xl font-bold ${data.is_valid ? 'text-green-700' : 'text-amber-700'}`}>
                            {data.is_valid ? 'Valid Certificate' : 'Certificate Found (Status Unverified)'}
                        </h2>
                        {!data.is_valid && (
                            <p className="mt-3 text-sm rounded-lg border border-amber-200 bg-amber-50 text-amber-800 px-3 py-2">
                                This certificate record was found, but it is currently marked as invalid.
                            </p>
                        )}
                        <p className="mt-4"><b>Recipient:</b> {data.participant_name}</p>
                        <p><b>Organization:</b> {data.organization || 'N/A'}</p>
                        <p><b>Event:</b> {data.event_name}</p>
                        <p><b>Role:</b> {data.role || 'N/A'}</p>
                        <p><b>Date:</b> {data.date_text || new Date(data.issued_at).toLocaleDateString()}</p>
                        <p><b>Issuer Signature:</b> {data.has_signature ? `${data.issuer_name || 'Issuer'}${data.issuer_position ? `, ${data.issuer_position}` : ''}` : 'Not available'}</p>

                        <p className="mt-3 text-xs break-all bg-gray-100 p-2 rounded"><b>Security Hash:</b> {data.verification_hash}</p>

                        <div className="mt-4 flex flex-wrap gap-2">
                            <a href={`${API}/verify/${data.id}/preview`} target="_blank" rel="noreferrer" className="px-4 py-2 rounded-lg bg-[#e3ece8]">Preview Certificate</a>
                            <button
                                className="px-4 py-2 rounded-lg text-white"
                                style={{ backgroundColor: primaryColor }}
                                onClick={async () => {
                                    await fetch(`${API}/verify/${data.id}/track/share`, { method: 'POST' }).catch(() => undefined);
                                    await navigator.clipboard.writeText(`${window.location.origin}/verify/${data.id}`);
                                    notify('Share link copied');
                                }}
                            >
                                Copy Share Link
                            </button>
                            {(() => {
                                const verifyUrl = `${window.location.origin}/verify/${data.id}`;
                                const issued = new Date(data.issued_at);
                                const linkedInUrl = [
                                    'https://www.linkedin.com/profile/add',
                                    '?startTask=CERTIFICATION_NAME',
                                    `&name=${encodeURIComponent(data.event_name)}`,
                                    `&organizationName=${encodeURIComponent(data.organization || '')}`,
                                    `&issueYear=${issued.getFullYear()}`,
                                    `&issueMonth=${issued.getMonth() + 1}`,
                                    `&certUrl=${encodeURIComponent(verifyUrl)}`,
                                    `&certId=${encodeURIComponent(data.id)}`,
                                ].join('');
                                return (
                                    <a
                                        href={linkedInUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0077b5] text-white font-semibold text-sm hover:bg-[#006097] transition"
                                    >
                                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                                        </svg>
                                        Add to LinkedIn
                                    </a>
                                );
                            })()}
                        </div>

                        <p className="mt-5 text-sm text-gray-500">QR scan flow: scanning a certificate QR should open this page with the certificate ID pre-filled.</p>

                        {(data.username || data.participant_name) && (
                            <div className="mt-4 pt-4 border-t border-gray-100">
                                <Link
                                    to={`/@${data.username || slugify(data.participant_name)}`}
                                    style={{ color: primaryColor }}
                                    className="text-sm hover:underline"
                                >
                                    View {data.participant_name}'s profile →
                                </Link>
                            </div>
                        )}

                        {showPoweredBy && (
                            <p className="mt-4 text-xs text-gray-400 text-center">
                                Powered by <a href="https://certflow.app" target="_blank" rel="noreferrer" className="hover:underline" style={{ color: primaryColor }}>CertFlow</a>
                            </p>
                        )}
                    </div>
                )}
            </div>
            <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 transition-all duration-300 ${toast ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0 pointer-events-none'}`}>
                <div className="bg-gray-900 text-white text-sm font-medium px-5 py-2.5 rounded-2xl shadow-2xl">
                    {toast}
                </div>
            </div>
        </div>
    );
}
