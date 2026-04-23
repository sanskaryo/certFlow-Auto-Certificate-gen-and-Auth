import { useState, useEffect } from 'react';
import { apiFetch } from '../lib/api';
import { useToast } from '../context/ToastContext';
import { Sidebar } from '../components/Sidebar';

export default function AdminPortal() {
    const [stats, setStats] = useState<any>(null);
    const [users, setUsers] = useState<any[]>([]);
    const [failedEmails, setFailedEmails] = useState<any[]>([]);
    const [healthStats, setHealthStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [userSearch, setUserSearch] = useState('');
    const { showToast } = useToast();

    useEffect(() => {
        fetchAllData();
    }, []);

    const fetchAllData = async () => {
        setLoading(true);
        try {
            const [adminStats, userData, , failed, health] = await Promise.all([
                apiFetch('/analytics/admin'),
                apiFetch('/admin/users'),
                apiFetch('/admin/events'),
                apiFetch('/admin/failed-emails'),
                apiFetch('/admin/health-stats')
            ]);
            setStats(adminStats);
            setUsers(userData);
            setFailedEmails(failed);
            setHealthStats(health);
        } catch (e: any) {
            showToast(e.message || 'Error loading administrative data', 'error');
        } finally {
            setLoading(false);
        }
    };

    const toggleUserStatus = async (id: string, currentStatus: boolean) => {
        try {
            await apiFetch(`/admin/users/${id}`, {
                method: 'PATCH',
                body: JSON.stringify({ disabled: !currentStatus })
            });
            showToast(`User ${currentStatus ? 'restored' : 'deactivated'}`, 'info');
            const updated = await apiFetch('/admin/users');
            setUsers(updated);
        } catch (e: any) {
            showToast(e.message, 'error');
        }
    };

    const filteredUsers = users.filter(u => u.email.toLowerCase().includes(userSearch.toLowerCase()));

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50/50">
            <div className="w-10 h-10 border-4 border-teal-500/30 border-t-teal-500 rounded-full animate-spin" />
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-50/50 flex flex-row">
            <Sidebar />
            <main className="flex-1 overflow-auto">
                <div className="page-container py-12 space-y-12">
                    {failedEmails.length > 0 && (
                        <div 
                            onClick={() => document.getElementById('failed-emails')?.scrollIntoView({ behavior: 'smooth' })}
                            className="bg-red-500 text-white font-black px-6 py-4 rounded-2xl cursor-pointer shadow-xl shadow-red-500/20 text-center animate-bounce duration-[2000ms]"
                        >
                            DANGER: {failedEmails.length} DISPATCH FAILURES DETECTED — REVIEW CLI LOGS
                        </div>
                    )}

                    <header>
                        <h1 className="text-4xl font-black gradient-text tracking-tight font-display text-slate-900">Ecosystem Governance</h1>
                        <p className="text-slate-500 mt-2 font-medium">Platform-wide nexus for user control and health diagnostics.</p>
                    </header>

                    {/* High Level Metrics */}
                    {stats && (
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                            <div className="glass-card p-6 rounded-3xl flex flex-col items-center">
                                <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-2">Total Entities</p>
                                <p className="text-3xl font-black text-teal-600 font-display">{stats.total_users || 0}</p>
                            </div>
                            <div className="glass-card p-6 rounded-3xl flex flex-col items-center">
                                <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-2">Active Events</p>
                                <p className="text-3xl font-black text-indigo-600 font-display">{stats.total_events || 0}</p>
                            </div>
                            <div className="glass-card p-6 rounded-3xl flex flex-col items-center">
                                <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-2">Issued Certs</p>
                                <p className="text-3xl font-black text-cyan-600 font-display">{stats.total_certs || 0}</p>
                            </div>
                            <div className="glass-card p-6 rounded-3xl flex flex-col items-center">
                                <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-2">Verified Proofs</p>
                                <p className="text-3xl font-black text-purple-600 font-display">{stats.total_verified || 0}</p>
                            </div>
                        </div>
                    )}

                    {/* Pulse Metrics */}
                    {healthStats && (
                        <section className="glass-panel p-8 rounded-[2rem]">
                            <h3 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em] mb-6">Real-time Pulse</h3>
                            <div className="flex flex-wrap gap-4">
                                {[
                                    { l: 'Dispatches Today', v: healthStats.emails_sent_today },
                                    { l: 'Builds Today', v: healthStats.certs_generated_today },
                                    { l: 'Verifications Today', v: healthStats.verifications_today },
                                    { l: 'Active Operators (7d)', v: healthStats.active_users_7d }
                                ].map(h => (
                                    <div key={h.l} className="bg-white/40 border border-white/60 px-5 py-3 rounded-2xl flex items-center gap-3">
                                        <div className="w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
                                        <span className="text-xs font-bold text-slate-800 tracking-tight">{h.l}: <span className="text-teal-600">{h.v}</span></span>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* Operational Tables */}
                    <section className="space-y-8">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                             <h3 className="text-2xl font-black font-display text-slate-800">Operator Manifest</h3>
                             <input 
                                type="text" placeholder="Search by identifier..." 
                                value={userSearch} onChange={e => setUserSearch(e.target.value)}
                                className="md:w-72"
                             />
                        </div>
                        <div className="glass-panel rounded-[2rem] overflow-hidden">
                            <table className="w-full text-left text-sm whitespace-nowrap">
                                <thead className="bg-slate-900/[0.02] text-slate-400 font-black uppercase text-[10px] tracking-widest border-b border-white/40">
                                    <tr>
                                        <th className="px-8 py-5">Operator Email</th>
                                        <th className="px-8 py-5">Joined</th>
                                        <th className="px-8 py-5 text-center">Events</th>
                                        <th className="px-8 py-5 text-center">Certs</th>
                                        <th className="px-8 py-5">Status</th>
                                        <th className="px-8 py-5 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/40">
                                    {filteredUsers.map(u => (
                                        <tr key={u.id} className="hover:bg-white/40 transition-colors">
                                            <td className="px-8 py-5 font-bold text-slate-800">{u.email}</td>
                                            <td className="px-8 py-5 text-slate-500">{new Date(u.created_at).toLocaleDateString()}</td>
                                            <td className="px-8 py-5 text-center font-mono text-xs">{u.event_count}</td>
                                            <td className="px-8 py-5 text-center font-mono text-xs">{u.cert_count}</td>
                                            <td className="px-8 py-5">
                                                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter ${!u.disabled ? 'bg-teal-100 text-teal-700' : 'bg-red-100 text-red-700'}`}>
                                                    {!u.disabled ? 'Authorized' : 'Decommissioned'}
                                                </span>
                                            </td>
                                            <td className="px-8 py-5 text-right">
                                                <button 
                                                  onClick={() => toggleUserStatus(u.id, u.disabled)}
                                                  className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${!u.disabled ? 'text-red-500 hover:bg-red-50' : 'text-teal-600 hover:bg-teal-50'}`}
                                                >
                                                    {!u.disabled ? 'Deactivate' : 'Restore'}
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>
                </div>
            </main>
        </div>
    );
}
