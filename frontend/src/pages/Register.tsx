import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiFetch } from '../lib/api';
import { useToast } from '../context/ToastContext';

export default function Register() {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const { showToast } = useToast();

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            await apiFetch('/auth/register', {
                method: 'POST',
                body: JSON.stringify({
                    name,
                    email,
                    password,
                    role: "admin"
                }),
            });

            showToast('Account established successfully!', 'success');
            navigate('/login');
        } catch (err: any) {
            showToast(err.message || 'Establishment failed', 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen relative overflow-hidden px-4">
            <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-teal-500/10 rounded-full blur-[120px] animate-pulse"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '2s' }}></div>

            <main className="glass-panel w-full max-w-lg rounded-[2.5rem] shadow-2xl border-white/60 p-12 lg:p-16 animate-in fade-in zoom-in-95 duration-500">
                <div className="text-center mb-12">
                   <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl gradient-brand mb-6 shadow-xl shadow-teal-500/20 -rotate-3 hover:rotate-0 transition-transform duration-300">
                        <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                        </svg>
                    </div>
                    <h1 className="text-4xl font-black gradient-text tracking-tighter mb-3 font-display">Establishment</h1>
                    <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">Create Your Organization Profile</p>
                </div>

                <form onSubmit={handleRegister} className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-widest text-slate-400 px-1">Organization Name</label>
                        <input
                            type="text" required value={name} onChange={(e) => setName(e.target.value)}
                            className="w-full h-14" placeholder="Acme Corporation" disabled={loading}
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-widest text-slate-400 px-1">Admin Email</label>
                        <input
                            type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                            className="w-full h-14" placeholder="admin@acme.com" disabled={loading}
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-widest text-slate-400 px-1">Access Credentials</label>
                        <input
                            type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                            className="w-full h-14" placeholder="••••••••" disabled={loading} minLength={6}
                        />
                    </div>

                    <button
                        type="submit" disabled={loading}
                        className="w-full gradient-brand text-white font-black h-16 rounded-2xl shadow-xl shadow-teal-500/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-3 mt-8"
                    >
                        {loading ? <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : (
                          <>
                            <span>Register Authority</span>
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                            </svg>
                          </>
                        )}
                    </button>
                </form>

                <div className="mt-12 pt-8 border-t border-slate-100 flex flex-col items-center gap-4">
                    <p className="text-slate-500 font-medium text-sm">Already part of the ecosystem?</p>
                    <Link to="/login" className="text-teal-600 font-black hover:text-teal-700 underline-offset-4 hover:underline decoration-2 transition-all">
                        Authenticate Existing Profile
                    </Link>
                </div>
            </main>
        </div>
    );
}
