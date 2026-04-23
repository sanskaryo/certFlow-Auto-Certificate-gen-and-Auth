import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { apiFetch } from '../lib/api';
import { useToast } from '../context/ToastContext';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();
    const { showToast } = useToast();

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        if (params.get('expired')) {
            showToast('Session expired. Please sign in again.', 'warning');
        }
    }, [location, showToast]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const formData = new URLSearchParams();
            formData.append('username', email);
            formData.append('password', password);

            const data = await apiFetch('/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: formData,
            });

            localStorage.setItem('token', data.access_token);
            showToast('Welcome back to CertFlow!', 'success');
            navigate('/dashboard');
        } catch (err: any) {
            showToast(err.message || 'Authentication failed', 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen relative overflow-hidden px-4">
            <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-teal-500/10 rounded-full blur-[120px] animate-pulse"></div>
            <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '2s' }}></div>

            <main className="glass-panel w-full max-w-lg rounded-[2.5rem] shadow-2xl border-white/60 p-12 lg:p-16 animate-in fade-in zoom-in-95 duration-500">
                <div className="text-center mb-12">
                   <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl gradient-brand mb-6 shadow-xl shadow-teal-500/20 rotate-3 hover:rotate-0 transition-transform duration-300">
                        <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <h1 className="text-4xl font-black gradient-text tracking-tighter mb-3 font-display">CertFlow</h1>
                    <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">Access Secure Infrastructure</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-widest text-slate-400 px-1">Email Coordinates</label>
                        <input
                            type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                            className="w-full h-14" placeholder="operator@certflow.app" disabled={loading}
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-widest text-slate-400 px-1">Security Key</label>
                        <input
                            type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                            className="w-full h-14" placeholder="••••••••" disabled={loading}
                        />
                    </div>

                    <button
                        type="submit" disabled={loading}
                        className="w-full gradient-brand text-white font-black h-16 rounded-2xl shadow-xl shadow-teal-500/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-3 mt-8"
                    >
                        {loading ? <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : (
                          <>
                            <span>Authenticate Entry</span>
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                            </svg>
                          </>
                        )}
                    </button>
                </form>

                <div className="mt-12 pt-8 border-t border-slate-100 flex flex-col items-center gap-4">
                    <p className="text-slate-500 font-medium text-sm">New to the ecosystem?</p>
                    <Link to="/register" className="text-teal-600 font-black hover:text-teal-700 underline-offset-4 hover:underline decoration-2 transition-all">
                        Establish Authority Profile
                    </Link>
                </div>
            </main>
        </div>
    );
}
