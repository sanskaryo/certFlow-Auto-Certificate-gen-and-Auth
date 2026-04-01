import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { API_BASE } from '../lib/api';

export default function Register() {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const response = await fetch(`${API_BASE}/auth/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name,
                    email,
                    password,
                    role: "admin"
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Registration failed');
            }

            navigate('/login', { state: { message: 'Account created! Please log in.' } });
        } catch (err: any) {
            setError(err.message || 'Registration failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex bg-gradient-to-br from-prime-50 via-white to-accent-50 items-center justify-center min-h-screen relative overflow-hidden px-4 py-8">
            {/* Animated background blobs */}
            <div className="absolute top-[10%] left-[5%] w-96 h-96 bg-accent-400/30 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob"></div>
            <div className="absolute top-[20%] right-[10%] w-96 h-96 bg-teal-400/20 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-2000" style={{ animationDelay: '2s' }}></div>
            <div className="absolute bottom-[-10%] left-[15%] w-96 h-96 bg-prime-400/30 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-4000" style={{ animationDelay: '4s' }}></div>

            <div className="glass w-full max-w-md z-10 rounded-3xl shadow-2xl border border-white/50 p-10 animate-slideUp">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-prime-500 to-accent-500 mb-4">
                        <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"></path>
                        </svg>
                    </div>
                    <h1 className="text-4xl font-bold gradient-text mb-2">Create Account</h1>
                    <p className="text-gray-600 font-medium">Join CertFlow and start generating!</p>
                </div>

                {/* Error Message */}
                {error && (
                    <div className="animate-slideDown bg-red-50 text-red-600 p-4 rounded-xl mb-6 text-sm text-center border border-red-200 flex items-center justify-center gap-2">
                        <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"></path>
                        </svg>
                        {error}
                    </div>
                )}

                {/* Register Form */}
                <form onSubmit={handleRegister} className="space-y-5">
                    <div className="animate-slideUp" style={{ animationDelay: '0.1s' }}>
                        <label className="block text-sm font-semibold text-gray-700 mb-2.5">Organization Name</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl bg-white border border-gray-200 focus:ring-2 focus:ring-prime-500 focus:border-transparent outline-none transition-all duration-200 placeholder-gray-400"
                            placeholder="Your organization name"
                            required
                            disabled={loading}
                        />
                    </div>

                    <div className="animate-slideUp" style={{ animationDelay: '0.2s' }}>
                        <label className="block text-sm font-semibold text-gray-700 mb-2.5">Email Address</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl bg-white border border-gray-200 focus:ring-2 focus:ring-prime-500 focus:border-transparent outline-none transition-all duration-200 placeholder-gray-400"
                            placeholder="you@example.com"
                            required
                            disabled={loading}
                        />
                    </div>

                    <div className="animate-slideUp" style={{ animationDelay: '0.3s' }}>
                        <label className="block text-sm font-semibold text-gray-700 mb-2.5">Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl bg-white border border-gray-200 focus:ring-2 focus:ring-prime-500 focus:border-transparent outline-none transition-all duration-200 placeholder-gray-400"
                            placeholder="••••••••"
                            required
                            minLength={6}
                            disabled={loading}
                        />
                        <p className="text-xs text-gray-500 mt-1.5">Must be at least 6 characters</p>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="animate-slideUp w-full bg-gradient-to-r from-prime-600 to-accent-600 hover:from-prime-700 hover:to-accent-700 disabled:from-gray-400 disabled:to-gray-400 text-white font-bold py-3.5 px-4 rounded-xl transition-all duration-200 transform hover:scale-105 active:scale-95 shadow-lg shadow-prime-500/30 disabled:shadow-none flex items-center justify-center gap-2 mt-8"
                        style={{ animationDelay: '0.4s' }}
                    >
                        {loading ? (
                            <>
                                <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 2v4m0 12v4M4.22 4.22l2.83 2.83m7.9 7.9l2.83 2.83M2 12h4m12 0h4m-17.78 7.78l2.83-2.83m7.9-7.9l2.83-2.83"></path>
                                </svg>
                                Creating account...
                            </>
                        ) : (
                            <>
                                Create Account
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6"></path>
                                </svg>
                            </>
                        )}
                    </button>
                </form>

                {/* Divider */}
                <div className="relative my-8">
                    <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-gray-200"></div>
                    </div>
                    <div className="relative flex justify-center text-sm">
                        <span className="px-2 bg-white text-gray-500">Already registered?</span>
                    </div>
                </div>

                {/* Login Link */}
                <p className="text-center text-sm text-gray-600">
                    Already have an account?{' '}
                    <Link to="/login" className="font-semibold text-prime-600 hover:text-prime-700 transition-colors duration-200">
                        Sign in →
                    </Link>
                </p>
            </div>
        </div>
    );
}
