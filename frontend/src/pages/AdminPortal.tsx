import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { API_BASE } from '../lib/api';

const API = API_BASE;

export default function AdminPortal() {
    const [stats, setStats] = useState<any>(null);
    const [users, setUsers] = useState<any[]>([]);
    const [events, setEvents] = useState<any[]>([]);
    const [failedEmails, setFailedEmails] = useState<any[]>([]);
    const [healthStats, setHealthStats] = useState<any>(null);
    const [organizations, setOrganizations] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [userSearch, setUserSearch] = useState('');
    const [editingOrg, setEditingOrg] = useState<any>(null);
    const token = localStorage.getItem('token');

    useEffect(() => {
        if (token) fetchAllData();
    }, [token]);

    const fetchAllData = async () => {
        setLoading(true);
        try {
            await Promise.all([
                fetchAdminStats(),
                fetchUsers(),
                fetchEvents(),
                fetchFailedEmails(),
                fetchHealthStats(),
                fetchOrganizations()
            ]);
        } catch (e) {
            setError('Error loading some admin data.');
        } finally {
            setLoading(false);
        }
    };

    const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };

    const fetchAdminStats = async () => {
        const response = await fetch(`${API}/analytics/admin`, { headers });
        if (response.ok) setStats(await response.json());
        else setError('Failed to load admin analytics. You may not be authorized.');
    };

    const fetchUsers = async () => {
        const res = await fetch(`${API}/admin/users`, { headers });
        if (res.ok) setUsers(await res.json());
    };

    const fetchEvents = async () => {
        const res = await fetch(`${API}/admin/events`, { headers });
        if (res.ok) setEvents(await res.json());
    };

    const fetchFailedEmails = async () => {
        const res = await fetch(`${API}/admin/failed-emails`, { headers });
        if (res.ok) setFailedEmails(await res.json());
    };

    const fetchHealthStats = async () => {
        const res = await fetch(`${API}/admin/health-stats`, { headers });
        if (res.ok) setHealthStats(await res.json());
    };

    const fetchOrganizations = async () => {
        const res = await fetch(`${API}/admin/organizations`, { headers });
        if (res.ok) setOrganizations(await res.json());
    };

    const updateOrg = async (e: any) => {
        e.preventDefault();
        const res = await fetch(`${API}/admin/organizations/${editingOrg.id}`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ plan: editingOrg.plan, max_certs: Number(editingOrg.max_certs) })
        });
        if (res.ok) {
            setEditingOrg(null);
            fetchOrganizations();
        } else {
            alert('Failed to update organization');
        }
    };

    const toggleUserStatus = async (id: string, currentStatus: boolean) => {
        const res = await fetch(`${API}/admin/users/${id}`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ disabled: !currentStatus })
        });
        if (res.ok) fetchUsers();
    };

    const retryEmail = async (certId: string, eventId: string) => {
        const res = await fetch(`${API}/events/${eventId}/certificates/${certId}/send-email`, {
            method: 'POST', headers
        });
        if (res.ok) {
            setFailedEmails(failedEmails.filter(e => e.cert_id !== certId));
        } else {
            alert('Retry failed');
        }
    };

    const dismissFailedEmail = (certId: string) => {
        setFailedEmails(failedEmails.filter(e => e.cert_id !== certId));
    };

    const filteredUsers = users.filter(u => u.email.toLowerCase().includes(userSearch.toLowerCase()));

    return (
        <div className="max-w-6xl mx-auto space-y-10 animate-fadeIn p-6 pb-20">
            {failedEmails.length > 0 && (
                <div 
                    onClick={() => document.getElementById('failed-emails')?.scrollIntoView({ behavior: 'smooth' })}
                    className="bg-red-500 text-white font-bold px-4 py-3 rounded-xl cursor-pointer shadow-lg text-center hover:bg-red-600 transition"
                >
                    ⚠ {failedEmails.length} certificate emails failed to deliver — Review
                </div>
            )}

            <header className="flex flex-col sm:flex-row sm:justify-between items-start sm:items-end gap-4">
                <div>
                    <Link
                        to="/dashboard"
                        className="inline-flex items-center gap-1.5 text-sm text-prime-600 font-semibold hover:text-prime-700 transition mb-4"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                        </svg>
                        Back to Dashboard
                    </Link>
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
                    {/* TOP STAT CARDS */}
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

                    {/* SECTION 4 — Platform health */}
                    {healthStats && (
                        <div className="space-y-4">
                            <h3 className="text-2xl font-bold text-gray-900">Platform health</h3>
                            <div className="flex flex-wrap gap-3">
                                <span className="bg-gray-100 text-gray-700 font-semibold px-4 py-1.5 rounded-full text-sm border border-gray-200">Emails sent today: {healthStats.emails_sent_today}</span>
                                <span className="bg-gray-100 text-gray-700 font-semibold px-4 py-1.5 rounded-full text-sm border border-gray-200">Certs generated today: {healthStats.certs_generated_today}</span>
                                <span className="bg-gray-100 text-gray-700 font-semibold px-4 py-1.5 rounded-full text-sm border border-gray-200">Verifications today: {healthStats.verifications_today}</span>
                                <span className="bg-gray-100 text-gray-700 font-semibold px-4 py-1.5 rounded-full text-sm border border-gray-200">Active users (7d): {healthStats.active_users_7d}</span>
                            </div>
                        </div>
                    )}

                    {/* SECTION 1 — Users table */}
                    <div className="space-y-4 pt-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-2xl font-bold text-gray-900">All users</h3>
                            <input 
                                type="text" 
                                placeholder="Search by email..." 
                                value={userSearch}
                                onChange={e => setUserSearch(e.target.value)}
                                className="border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-prime-500"
                            />
                        </div>
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden overflow-x-auto">
                            <table className="w-full text-left text-sm whitespace-nowrap">
                                <thead className="bg-gray-50/50 text-gray-500 font-semibold uppercase text-xs">
                                    <tr>
                                        <th className="px-6 py-4">Email</th>
                                        <th className="px-6 py-4">Joined</th>
                                        <th className="px-6 py-4">Events</th>
                                        <th className="px-6 py-4">Certs issued</th>
                                        <th className="px-6 py-4">Status</th>
                                        <th className="px-6 py-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {filteredUsers.map(u => (
                                        <tr key={u.id} className="hover:bg-gray-50/30">
                                            <td className="px-6 py-4 font-medium text-gray-900">{u.email}</td>
                                            <td className="px-6 py-4 text-gray-500">{new Date(u.created_at).toLocaleDateString()}</td>
                                            <td className="px-6 py-4 font-mono text-gray-600">{u.event_count}</td>
                                            <td className="px-6 py-4 font-mono text-gray-600">{u.cert_count}</td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${!u.disabled ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                                                    {!u.disabled ? 'Active' : 'Disabled'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right space-x-2 flex items-center justify-end">
                                                <button onClick={() => toggleUserStatus(u.id, u.disabled)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${!u.disabled ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'}`}>
                                                    {!u.disabled ? 'Disable' : 'Enable'}
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* SECTION 2 — Events table */}
                    <div className="space-y-4 pt-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-2xl font-bold text-gray-900">Recent events</h3>
                            <span className="text-sm font-semibold text-prime-600 cursor-pointer">View all</span>
                        </div>
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden overflow-x-auto">
                            <table className="w-full text-left text-sm whitespace-nowrap">
                                <thead className="bg-gray-50/50 text-gray-500 font-semibold uppercase text-xs">
                                    <tr>
                                        <th className="px-6 py-4">Event name</th>
                                        <th className="px-6 py-4">Owner email</th>
                                        <th className="px-6 py-4">Certs issued</th>
                                        <th className="px-6 py-4">Created</th>
                                        <th className="px-6 py-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {events.map(e => (
                                        <tr key={e.id} className="hover:bg-gray-50/30">
                                            <td className="px-6 py-4 font-bold text-gray-900">{e.name}</td>
                                            <td className="px-6 py-4 text-gray-500">{e.owner_email}</td>
                                            <td className="px-6 py-4 font-mono text-gray-600">{e.cert_count}</td>
                                            <td className="px-6 py-4 text-gray-500">{new Date(e.created_at).toLocaleDateString()}</td>
                                            <td className="px-6 py-4 text-right">
                                                <Link to={`/events/${e.id}`} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 transition">
                                                    View
                                                </Link>
                                            </td>
                                        </tr>
                                    ))}
                                    {events.length === 0 && (
                                        <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-500">No events found.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* SECTION 5 — Organizations table */}
                    <div className="space-y-4 pt-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-2xl font-bold text-gray-900">Organizations & Quotas</h3>
                        </div>
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden overflow-x-auto">
                            <table className="w-full text-left text-sm whitespace-nowrap">
                                <thead className="bg-gray-50/50 text-gray-500 font-semibold uppercase text-xs">
                                    <tr>
                                        <th className="px-6 py-4">Name</th>
                                        <th className="px-6 py-4">Plan</th>
                                        <th className="px-6 py-4">Certs Issued</th>
                                        <th className="px-6 py-4">Max Certs</th>
                                        <th className="px-6 py-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {organizations.map(org => (
                                        <tr key={org.id} className="hover:bg-gray-50/30">
                                            <td className="px-6 py-4 font-bold text-gray-900">{org.name}</td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold uppercase ${org.plan === 'premium' ? 'bg-purple-100 text-purple-800' : org.plan === 'pro' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}>
                                                    {org.plan}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 font-mono text-gray-600">{org.certs_issued}</td>
                                            <td className="px-6 py-4 font-mono text-gray-600">{org.max_certs}</td>
                                            <td className="px-6 py-4 text-right">
                                                <button onClick={() => setEditingOrg(org)} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 transition">
                                                    Edit
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* SECTION 3 — Failed email jobs */}
                    {failedEmails.length > 0 && (
                        <div id="failed-emails" className="space-y-4 pt-4">
                            <h3 className="text-2xl font-bold text-red-600 flex items-center gap-2">
                                Failed email deliveries
                            </h3>
                            <div className="bg-white rounded-2xl border border-red-200 shadow-sm overflow-hidden overflow-x-auto">
                                <table className="w-full text-left text-sm whitespace-nowrap">
                                    <thead className="bg-red-50 text-red-800 font-semibold uppercase text-xs">
                                        <tr>
                                            <th className="px-6 py-4">Recipient</th>
                                            <th className="px-6 py-4">Cert ID</th>
                                            <th className="px-6 py-4">Event</th>
                                            <th className="px-6 py-4">Failed at</th>
                                            <th className="px-6 py-4">Error</th>
                                            <th className="px-6 py-4 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-red-100">
                                        {failedEmails.map(c => (
                                            <tr key={c.cert_id} className="hover:bg-red-50/50">
                                                <td className="px-6 py-4 font-medium text-gray-900">{c.recipient}</td>
                                                <td className="px-6 py-4 font-mono text-gray-500 text-xs">{c.cert_id.substring(0, 8)}...</td>
                                                <td className="px-6 py-4 text-gray-700">{c.event_name}</td>
                                                <td className="px-6 py-4 text-gray-500">{new Date(c.failed_at).toLocaleString()}</td>
                                                <td className="px-6 py-4 text-red-600 text-xs max-w-xs truncate">{c.error_msg}</td>
                                                <td className="px-6 py-4 text-right space-x-2">
                                                    <button onClick={() => retryEmail(c.cert_id, c.event_id)} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-prime-600 text-white hover:bg-prime-700 transition">
                                                        Retry
                                                    </button>
                                                    <button onClick={() => dismissFailedEmail(c.cert_id)} className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-300 text-gray-600 hover:bg-gray-50 transition">
                                                        Dismiss
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Organization Edit Modal */}
                    {editingOrg && (
                        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                            <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-xl">
                                <h3 className="text-xl font-bold mb-4">Edit Organization</h3>
                                <form onSubmit={updateOrg} className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Name (Read-only)</label>
                                        <input type="text" disabled value={editingOrg.name} className="w-full border border-gray-200 rounded-xl px-4 py-2 bg-gray-50" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Plan</label>
                                        <select 
                                            value={editingOrg.plan} 
                                            onChange={e => setEditingOrg({...editingOrg, plan: e.target.value})}
                                            className="w-full border border-gray-200 rounded-xl px-4 py-2 focus:ring-2 focus:ring-prime-500 outline-none"
                                        >
                                            <option value="free">Free</option>
                                            <option value="pro">Pro</option>
                                            <option value="premium">Premium</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Max Certificates</label>
                                        <input 
                                            type="number" 
                                            value={editingOrg.max_certs} 
                                            onChange={e => setEditingOrg({...editingOrg, max_certs: e.target.value})}
                                            className="w-full border border-gray-200 rounded-xl px-4 py-2 focus:ring-2 focus:ring-prime-500 outline-none" 
                                        />
                                    </div>
                                    <div className="flex gap-3 justify-end mt-6">
                                        <button type="button" onClick={() => setEditingOrg(null)} className="px-4 py-2 rounded-xl text-gray-600 hover:bg-gray-100 font-semibold">Cancel</button>
                                        <button type="submit" className="px-4 py-2 rounded-xl bg-prime-600 text-white hover:bg-prime-700 font-semibold shadow-sm">Save Changes</button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )}
                </>
            ) : null}
        </div>
    );
}
