import { useState, useEffect } from 'react';
import { API_BASE } from '../lib/api';

export default function AdminPortal() {
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const token = localStorage.getItem('token');

    useEffect(() => {
        fetchAdminStats();
    }, [token]);

    const fetchAdminStats = async () => {
        try {
            setLoading(true);
            const response = await fetch(`${API_BASE}/analytics/admin`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                setStats(data);
            } else {
                setError('Failed to load admin analytics. You may not be authorized.');
            }
        } catch (err) {
            setError('Error fetching admin analytics.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-6xl mx-auto space-y-10 animate-fadeIn">
            <header className="flex justify-between items-end">
                <div>
                    <h2 className="text-5xl font-bold text-gray-900">Admin Portal</h2>
                    <p className="text-gray-600 mt-3 text-lg">Platform-wide statistics and management.</p>
                </div>
            </header>

            {error && (
                <div className="bg-red-50 text-red-700 p-4 rounded-xl text-sm border border-red-200">
                    {error}
                </div>
            )}

            {loading ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="h-32 bg-gray-200 rounded-3xl animate-pulse"></div>
                    ))}
                </div>
            ) : stats ? (
                <>
                    <h3 className="text-2xl font-bold mb-6 text-gray-900">Platform Analytics</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                        <div className="bg-white/70 backdrop-blur-sm p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col items-center">
                            <p className="text-gray-500 text-sm font-semibold mb-1">Total Users</p>
                            <p className="text-4xl font-bold text-prime-600">{stats.total_users || 0}</p>
                        </div>
                        <div className="bg-white/70 backdrop-blur-sm p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col items-center">
                            <p className="text-gray-500 text-sm font-semibold mb-1">Total Events</p>
                            <p className="text-4xl font-bold text-teal-600">{stats.total_events || 0}</p>
                        </div>
                        <div className="bg-white/70 backdrop-blur-sm p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col items-center">
                            <p className="text-gray-500 text-sm font-semibold mb-1">Certificates Issued</p>
                            <p className="text-4xl font-bold text-blue-600">{stats.total_certs || 0}</p>
                        </div>
                        <div className="bg-white/70 backdrop-blur-sm p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col items-center">
                            <p className="text-gray-500 text-sm font-semibold mb-1">Verifications</p>
                            <p className="text-4xl font-bold text-purple-600">{stats.total_verified || 0}</p>
                        </div>
                    </div>
                </>
            ) : null}
        </div>
    );
}
