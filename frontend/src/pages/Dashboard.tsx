import React, { useState, useEffect } from 'react';
import { useNavigate, Routes, Route, Link } from 'react-router-dom';
import EventDetail from './EventDetail';

function EventList() {
    const [events, setEvents] = useState([]);
    const [name, setName] = useState('');
    const [organizer, setOrganizer] = useState('');
    const [date, setDate] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    const token = localStorage.getItem('token');

    useEffect(() => {
        fetchEvents();
    }, [token]);

    const fetchEvents = async () => {
        try {
            setLoading(true);
            const response = await fetch('http://localhost:8000/events/', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                setEvents(data);
            }
        } catch (err) {
            setError('Failed to load events');
        } finally {
            setLoading(false);
        }
    };

    const handleCreateEvent = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        setIsCreating(true);

        try {
            const response = await fetch('http://localhost:8000/events/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ name, organization: organizer, date: new Date(date).toISOString() })
            });
            if (response.ok) {
                setSuccess('Event created successfully! 🎉');
                setName('');
                setOrganizer('');
                setDate('');
                fetchEvents();
                setTimeout(() => setSuccess(''), 3000);
            } else {
                setError('Failed to create event');
            }
        } catch (err) {
            setError('Error creating event');
        } finally {
            setIsCreating(false);
        }
    };

    return (
        <div className="max-w-6xl mx-auto space-y-10 animate-fadeIn">
            {/* Header */}
            <header className="flex justify-between items-end">
                <div>
                    <h2 className="text-5xl font-bold gradient-text">Event Dashboard</h2>
                    <p className="text-gray-600 mt-3 text-lg">Manage your events and generate certificates with ease.</p>
                </div>
            </header>

            {/* Create Event Card */}
            <div className="bg-white/70 backdrop-blur-sm p-8 rounded-3xl shadow-sm border border-gray-100 hover:border-prime-200 hover:shadow-lg transition-all duration-300 group">
                <h3 className="text-2xl font-bold mb-6 text-gray-900">Create New Event</h3>

                {error && (
                    <div className="animate-slideDown bg-red-50 text-red-700 p-4 rounded-xl mb-6 text-sm border border-red-200 flex items-center gap-2">
                        <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"></path>
                        </svg>
                        {error}
                    </div>
                )}

                {success && (
                    <div className="animate-slideDown bg-green-50 text-green-700 p-4 rounded-xl mb-6 text-sm border border-green-200 flex items-center gap-2">
                        <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path>
                        </svg>
                        {success}
                    </div>
                )}

                <form onSubmit={handleCreateEvent} className="flex flex-col md:flex-row gap-4 items-end">
                    <div className="flex-1">
                        <label className="block text-sm font-semibold text-gray-700 mb-2.5">Event Name</label>
                        <input
                            type="text"
                            required
                            value={name}
                            onChange={e => setName(e.target.value)}
                            disabled={isCreating}
                            className="w-full px-5 py-3 rounded-xl bg-white border border-gray-200 focus:ring-2 focus:ring-prime-500 outline-none transition-all duration-200 placeholder-gray-400"
                            placeholder="e.g. Annual Tech Hackathon 2024"
                        />
                    </div>
                    <div className="flex-1">
                        <label className="block text-sm font-semibold text-gray-700 mb-2.5">Organizer Name</label>
                        <input
                            type="text"
                            required
                            value={organizer}
                            onChange={e => setOrganizer(e.target.value)}
                            disabled={isCreating}
                            className="w-full px-5 py-3 rounded-xl bg-white border border-gray-200 focus:ring-2 focus:ring-prime-500 outline-none transition-all duration-200 placeholder-gray-400"
                            placeholder="e.g. Acme Corporation"
                        />
                    </div>
                    <div className="flex-1">
                        <label className="block text-sm font-semibold text-gray-700 mb-2.5">Event Date</label>
                        <input
                            type="date"
                            required
                            value={date}
                            onChange={e => setDate(e.target.value)}
                            disabled={isCreating}
                            className="w-full px-5 py-3 rounded-xl bg-white border border-gray-200 focus:ring-2 focus:ring-prime-500 outline-none transition-all duration-200"
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={isCreating}
                        className="bg-gradient-to-r from-prime-600 to-accent-600 hover:from-prime-700 hover:to-accent-700 disabled:from-gray-400 disabled:to-gray-400 text-white px-8 py-3 rounded-xl font-bold h-[50px] shadow-lg shadow-prime-500/20 transition-all duration-200 active:scale-95 disabled:shadow-none flex items-center justify-center gap-2 w-full md:w-auto"
                    >
                        {isCreating ? (
                            <>
                                <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 2v4m0 12v4M4.22 4.22l2.83 2.83m7.9 7.9l2.83 2.83M2 12h4m12 0h4m-17.78 7.78l2.83-2.83m7.9-7.9l2.83-2.83"></path>
                                </svg>
                                Creating...
                            </>
                        ) : (
                            <>
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path>
                                </svg>
                                Create Event
                            </>
                        )}
                    </button>
                </form>
            </div>

            {/* Events Grid */}
            <div>
                <h3 className="text-2xl font-bold mb-6 text-gray-900">Your Events</h3>
                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="h-48 bg-gray-200 rounded-3xl animate-pulse"></div>
                        ))}
                    </div>
                ) : events.length === 0 ? (
                    <div className="text-center py-16 bg-white/50 rounded-3xl border border-gray-100">
                        <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        </svg>
                        <p className="text-gray-500 text-lg">No events yet. Create one to get started!</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {events.map((evt: any, idx: number) => (
                            <Link
                                key={evt.id}
                                to={`/dashboard/event/${evt.id}`}
                                className="bg-white/70 backdrop-blur-sm p-7 rounded-3xl shadow-sm border border-gray-100 hover:border-prime-300 hover:shadow-xl transition-all duration-300 transform hover:scale-105 hover:-translate-y-1 group relative overflow-hidden animate-slideUp"
                                style={{ animationDelay: `${idx * 0.1}s` }}
                            >
                                {/* Gradient overlay on hover */}
                                <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-prime-500 to-accent-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

                                <div className="flex items-start justify-between mb-4">
                                    <div>
                                        <h4 className="text-xl font-bold text-gray-900 group-hover:gradient-text transition-all duration-300">{evt.name || 'Untitled Event'}</h4>
                                        <p className="text-gray-500 text-sm mt-1">📅 {new Date(evt.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</p>
                                    </div>
                                    <div className="w-10 h-10 bg-gradient-to-br from-prime-500 to-accent-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6"></path>
                                        </svg>
                                    </div>
                                </div>

                                <div className="text-sm text-gray-500">
                                    <p className="group-hover:text-prime-600 transition-colors duration-300">Click to manage certificates →</p>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

export default function Dashboard() {
    const navigate = useNavigate();
    const token = localStorage.getItem('token');

    useEffect(() => {
        if (!token) navigate('/login');
    }, [token, navigate]);

    const handleLogout = () => {
        localStorage.removeItem('token');
        navigate('/login');
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-prime-50 via-white to-accent-50 flex">
            {/* Sidebar */}
            <aside className="w-64 bg-white/80 backdrop-blur-sm border-r border-gray-200 shadow-sm flex flex-col sticky top-0 h-screen">
                <div className="p-6">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-prime-500 to-accent-500 flex items-center justify-center">
                            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                            </svg>
                        </div>
                        <div>
                            <h1 className="text-xl font-bold gradient-text">CertFlow</h1>
                            <p className="text-xs text-gray-500">Certificate Manager</p>
                        </div>
                    </div>
                </div>

                <nav className="flex-1 px-4 space-y-2">
                    <Link
                        to="/dashboard"
                        className="flex items-center space-x-3 text-prime-600 bg-prime-50 px-4 py-3.5 rounded-xl font-semibold transition-all duration-200 hover:bg-prime-100 group"
                    >
                        <svg className="w-5 h-5 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path>
                        </svg>
                        <span>Dashboard</span>
                    </Link>
                </nav>

                {/* Logout Button */}
                <div className="p-4 border-t border-gray-100">
                    <button
                        onClick={handleLogout}
                        className="flex items-center space-x-3 text-gray-600 hover:text-red-600 hover:bg-red-50 w-full px-4 py-3 rounded-xl font-semibold transition-all duration-200 group"
                    >
                        <svg className="w-5 h-5 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path>
                        </svg>
                        <span>Logout</span>
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 p-10 overflow-auto">
                <Routes>
                    <Route path="/" element={<EventList />} />
                    <Route path="/event/:id" element={<EventDetail />} />
                </Routes>
            </main>
        </div>
    );
}
