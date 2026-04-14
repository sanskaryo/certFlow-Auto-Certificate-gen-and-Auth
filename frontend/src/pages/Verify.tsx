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
                {error && <p className="mt-6 text-red-600">{error}</                {data && (
                    <div className="mt-8 bg-white border border-gray-100 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden animate-slideUp">
                        {/* Status Banner */}
                        <div className={`px-6 py-4 flex items-center gap-3 border-b ${data.is_valid ? 'bg-emerald-50/50 border-emerald-100' : 'bg-amber-50/50 border-amber-100'}`}>
                            {data.is_valid ? (
                                <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                                    <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                </div>
                            ) : (
                                <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                                    <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                </div>
                            )}
                            <div>
                                <h2 className={`text-lg font-bold ${data.is_valid ? 'text-emerald-800' : 'text-amber-800'}`}>
                                    {data.is_valid ? 'Verified Certificate' : 'Certificate Revoked / Invalid'}
                                </h2>
                                <p className={`text-sm ${data.is_valid ? 'text-emerald-600' : 'text-amber-600'}`}>
                                    {data.is_valid ? 'This credential is authentic and was issued by a verified authority.' : 'This certificate record exists but is currently flagged as invalid.'}
                                </p>
                            </div>
                        </div>

                        {/* Certificate Details */}
                        <div className="p-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                                <div className="space-y-1">
                                    <p className="text-sm font-semibold text-gray-500 uppercase tracking-widest">Issued To</p>
                                    <p className="text-xl font-bold text-gray-900">{data.participant_name}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-sm font-semibold text-gray-500 uppercase tracking-widest">Event / Course</p>
                                    <p className="text-xl font-bold text-gray-900">{data.event_name}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-sm font-semibold text-gray-500 uppercase tracking-widest">Organization</p>
                                    <p className="text-lg font-medium text-gray-700">{data.organization || 'N/A'}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-sm font-semibold text-gray-500 uppercase tracking-widest">Role / Achievement</p>
                                    <p className="text-lg font-medium text-gray-700">{data.role || 'Participant'}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-sm font-semibold text-gray-500 uppercase tracking-widest">Issue Date</p>
                                    <p className="text-lg font-medium text-gray-700">{data.date_text || new Date(data.issued_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-sm font-semibold text-gray-500 uppercase tracking-widest">Issuer Details</p>
                                    <p className="text-lg font-medium text-gray-700">
                                        {data.has_signature ? `${data.issuer_name || 'Authorized Signatory'}${data.issuer_position ? ` • ${data.issuer_position}` : ''}` : 'System Generated'}
                                    </p>
                                </div>
                            </div>

                            <div className="mt-8 pt-6 border-t border-gray-100">
                                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                    <div className="space-y-1 w-full max-w-md">
                                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Cryptographic Hash</p>
                                        <div className="bg-gray-50 rounded-lg p-2.5 font-mono text-[10px] sm:text-xs text-gray-500 break-all border border-gray-100">
                                            {data.verification_hash}
                                        </div>
                                    </div>
                                    <div className="shrink-0 pt-2 sm:pt-0 pb-1">
                                        <img src={`https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${encodeURIComponent(`${window.location.origin}/verify/${data.id}`)}`} alt="QR Code" className="w-16 h-16 rounded border border-gray-100 p-1 bg-white shadow-sm" />
                                    </div>
                                </div>
                            </div>

                            <div className="mt-8 flex flex-wrap items-center gap-3">
                                <a href={`${API}/verify/${data.id}/preview`} target="_blank" rel="noreferrer" className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-gray-200 text-gray-700 font-semibold hover:bg-gray-50 hover:border-gray-300 transition shadow-sm">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                    View PDF
                                </a>
                                <button
                                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white font-semibold transition shadow-sm hover:shadow-md active:scale-95"
                                    style={{ backgroundColor: primaryColor }}
                                    onClick={async () => {
                                        await fetch(`${API}/verify/${data.id}/track/share`, { method: 'POST' }).catch(() => undefined);
                                        await navigator.clipboard.writeText(`${window.location.origin}/verify/${data.id}`);
                                        notify('Share link copied');
                                    }}
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                                    Copy Link
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
                                            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0077b5] text-white font-semibold hover:bg-[#006097] transition shadow-sm"
                                        >
                                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                                            </svg>
                                            Add to Profile
                                        </a>
                                    );
                                })()}
                            </div>

                            {/* Public Profile Link Footer */}
                            {(data.username || data.participant_name) && (
                                <div className="mt-8 pt-6 border-t border-gray-100 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-prime-50 flex items-center justify-center text-prime-700 font-bold border border-prime-100">
                                            {data.participant_name.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-500 font-medium">Recipient Profile</p>
                                            <Link
                                                to={`/@${data.username || slugify(data.participant_name)}`}
                                                style={{ color: primaryColor }}
                                                className="text-sm font-semibold hover:underline flex items-center gap-1"
                                            >
                                                View all credentials
                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                                            </Link>
                                        </div>
                                    </div>
                                    {showPoweredBy && (
                                        <p className="text-[10px] text-gray-400 font-medium tracking-wide">
                                            VERIFIED BY <a href="https://certflow.app" target="_blank" rel="noreferrer" className="hover:underline" style={{ color: primaryColor }}>CERTFLOW</a>
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}     )}
            </div>
            <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 transition-all duration-300 ${toast ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0 pointer-events-none'}`}>
                <div className="bg-gray-900 text-white text-sm font-medium px-5 py-2.5 rounded-2xl shadow-2xl">
                    {toast}
                </div>
            </div>
        </div>
    );
}
