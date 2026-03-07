import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";

interface CertificateData {
    participant_name: string;
    event_name: string;
    role?: string;
    issued_at: string;
    verification_hash: string;
}

export default function Verify() {
    const { id } = useParams<{ id: string }>();

    const [data, setData] = useState<CertificateData | null>(null);
    const [error, setError] = useState<string>("");
    const [loading, setLoading] = useState<boolean>(true);

    const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

    const copyHash = () => {
        if (data?.verification_hash) {
            navigator.clipboard.writeText(data.verification_hash);
        }
    };

    useEffect(() => {
        const controller = new AbortController();

        const verifyCert = async () => {
            if (!id) {
                setError("Invalid certificate ID");
                setLoading(false);
                return;
            }

            try {
                const response = await fetch(`${API}/verify/${id}`, {
                    signal: controller.signal
                });

                const result = await response.json();

                if (!response.ok) {
                    throw new Error(result?.detail ?? "Certificate not found");
                }

                setData(result);
            } catch (err: unknown) {
                if (err instanceof DOMException && err.name === "AbortError") {
                    return;
                }
                if (err instanceof Error) {
                    setError(err.message);
                } else {
                    setError("Verification error occurred");
                }
            } finally {
                setLoading(false);
            }
        };

        verifyCert();

        return () => controller.abort();
    }, [id, API]);

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-prime-50 via-white to-accent-50 flex items-center justify-center relative overflow-hidden">

                <div className="absolute top-[-20%] left-[-10%] w-96 h-96 bg-prime-400/30 rounded-full mix-blend-multiply blur-3xl opacity-70 animate-blob"></div>
                <div className="absolute bottom-[-20%] right-[-10%] w-96 h-96 bg-accent-400/30 rounded-full mix-blend-multiply blur-3xl opacity-70 animate-blob"></div>

                <div className="text-center z-10">
                    <div className="w-16 h-16 border-4 border-prime-200 border-t-prime-600 rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-600 font-medium text-lg">
                        Verifying certificate...
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-prime-50 via-white to-accent-50 flex flex-col items-center justify-center p-6 relative overflow-hidden">

            <div className="absolute top-[-20%] left-[-10%] w-96 h-96 bg-prime-400/30 rounded-full mix-blend-multiply blur-3xl opacity-70 animate-blob"></div>
            <div className="absolute bottom-[-20%] right-[-10%] w-96 h-96 bg-accent-400/30 rounded-full mix-blend-multiply blur-3xl opacity-70 animate-blob"></div>

            <div className="w-full max-w-lg z-10 animate-slideUp">

                <div className="text-center mb-10">
                    <Link to="/" className="inline-block mb-6">
                        <div className="flex flex-col items-center gap-2">
                            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-prime-500 to-accent-500 flex items-center justify-center">
                                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                                    />
                                </svg>
                            </div>

                            <h1 className="text-3xl font-bold gradient-text">
                                CertFlow Verifier
                            </h1>
                        </div>
                    </Link>
                </div>

                {error ? (

                    <div className="glass p-10 rounded-3xl shadow-2xl border border-red-100 text-center animate-slideDown">

                        <div className="w-20 h-20 bg-gradient-to-br from-red-100 to-red-200 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
                            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                                    d="M6 18L18 6M6 6l12 12"
                                />
                            </svg>
                        </div>

                        <h2 className="text-3xl font-bold text-gray-900 mb-3">
                            Verification Failed
                        </h2>

                        <p className="text-red-600 text-lg font-medium mb-8">
                            {error}
                        </p>

                        <div className="p-4 rounded-xl bg-red-50 border border-red-200 mb-8">
                            <p className="text-sm text-red-700">
                                The certificate with ID
                                <code className="font-mono bg-white px-2 py-1 rounded ml-2">
                                    {id}
                                </code>
                                could not be verified.
                            </p>
                        </div>

                        <Link
                            to="/"
                            className="inline-block bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-bold py-3 px-6 rounded-xl transition-all duration-200"
                        >
                            Return to Home →
                        </Link>

                    </div>

                ) : (

                    <div className="glass p-10 rounded-3xl shadow-2xl border border-green-100 relative overflow-hidden">

                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-400 via-emerald-400 to-teal-400"></div>

                        <div className="w-20 h-20 bg-gradient-to-br from-green-100 to-emerald-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                            <svg className="w-12 h-12" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd"
                                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293
                                    a1 1 0 00-1.414-1.414L9 10.586
                                    7.707 9.293a1 1 0 00-1.414
                                    1.414l2 2a1 1 0 001.414
                                    0l4-4z"
                                    clipRule="evenodd"
                                />
                            </svg>
                        </div>

                        <h2 className="text-4xl font-bold text-center text-transparent bg-clip-text bg-gradient-to-r from-green-600 to-emerald-600 mb-2">
                            Certificate Verified
                        </h2>

                        <p className="text-center text-gray-600 mb-10 font-medium">
                            This certificate is authentic and valid
                        </p>

                        <div className="space-y-4">

                            <div>
                                <p className="text-xs text-gray-500 mb-1 uppercase tracking-widest font-bold">
                                    Recipient
                                </p>

                                <div className="bg-gradient-to-r from-prime-50 to-accent-50 p-4 rounded-xl border border-gray-100">
                                    <p className="text-2xl font-bold text-gray-900">
                                        {data?.participant_name ?? "N/A"}
                                    </p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">

                                <div>
                                    <p className="text-xs text-gray-500 mb-1 uppercase tracking-widest font-bold">
                                        Event
                                    </p>

                                    <div className="bg-gradient-to-r from-prime-50 to-accent-50 p-3 rounded-xl border border-gray-100">
                                        <p className="font-semibold text-gray-900">
                                            {data?.event_name ?? "N/A"}
                                        </p>
                                    </div>
                                </div>

                                <div>
                                    <p className="text-xs text-gray-500 mb-1 uppercase tracking-widest font-bold">
                                        Role
                                    </p>

                                    <div className="bg-gradient-to-r from-prime-50 to-accent-50 p-3 rounded-xl border border-gray-100">
                                        <p className="font-semibold text-gray-900">
                                            {data?.role || "N/A"}
                                        </p>
                                    </div>
                                </div>

                            </div>

                            <div>
                                <p className="text-xs text-gray-500 mb-1 uppercase tracking-widest font-bold">
                                    Issue Date
                                </p>

                                <div className="bg-gradient-to-r from-prime-50 to-accent-50 p-3 rounded-xl border border-gray-100">
                                    <p className="font-semibold text-gray-900">
                                        {data?.issued_at
                                            ? new Date(data.issued_at).toLocaleDateString(
                                                "en-US",
                                                { year: "numeric", month: "short", day: "numeric" }
                                            )
                                            : "N/A"}
                                    </p>
                                </div>
                            </div>

                            <div>
                                <p className="text-xs text-gray-500 mb-1 uppercase tracking-widest font-bold">
                                    Security Hash
                                </p>

                                <div
                                    onClick={copyHash}
                                    title="Click to copy"
                                    className="bg-gray-900 p-4 rounded-xl border border-gray-800 cursor-pointer"
                                >
                                    <p className="font-mono text-xs text-gray-300 break-all text-center">
                                        {data?.verification_hash ?? "N/A"}
                                    </p>
                                </div>
                            </div>

                        </div>

                        <div className="mt-10 p-4 bg-green-50 border border-green-200 rounded-xl text-center">
                            <p className="text-sm text-green-700 font-medium">
                                ✓ This certificate has been verified as authentic
                            </p>
                        </div>

                    </div>

                )}

            </div>
        </div>
    );
}
