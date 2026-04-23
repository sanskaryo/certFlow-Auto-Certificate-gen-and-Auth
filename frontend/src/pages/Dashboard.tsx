import React, { useState, useEffect } from 'react';
import { useNavigate, Routes, Route, Link } from 'react-router-dom';
import EventDetail from './EventDetail';
import { apiFetch } from '../lib/api';
import { useToast } from '../context/ToastContext';
import { Sidebar } from '../components/Sidebar';

interface EventStats {
  total_events: number;
  total_issued: number;
  total_opened: number;
  total_verified: number;
}

function StatCard({ label, value, colorClass }: { label: string, value: number, colorClass: string }) {
  return (
    <div className="glass-card p-6 rounded-3xl flex flex-col items-center">
      <p className="text-slate-500 text-sm font-bold uppercase tracking-wider mb-2">{label}</p>
      <p className={`text-4xl font-black ${colorClass}`}>{value.toLocaleString()}</p>
    </div>
  );
}

function EventList() {
  const [events, setEvents] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [organizer, setOrganizer] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [stats, setStats] = useState<EventStats | null>(null);
  const { showToast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [eventsData, statsData] = await Promise.all([
        apiFetch('/events/'),
        apiFetch('/analytics/dashboard')
      ]);
      setEvents(eventsData);
      setStats(statsData);
    } catch (err: any) {
      showToast(err.message || 'Failed to sync data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !organizer) return;
    
    setIsCreating(true);
    try {
      await apiFetch('/events/', {
        method: 'POST',
        body: JSON.stringify({ 
          name, 
          organization: organizer, 
          date: new Date(date).toISOString(), 
          description 
        })
      });
      
      showToast(description ? 'AI Template is being generated...' : 'Event created successfully!', 'success');
      setName('');
      setOrganizer('');
      setDescription('');
      fetchData();
    } catch (err: any) {
      showToast(err.message || 'Failed to create event', 'error');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteEvent = async (eventId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm("Delete this event? All data will be permanently removed.")) return;

    try {
      await apiFetch(`/events/${eventId}`, { method: 'DELETE' });
      showToast('Event deleted', 'success');
      fetchData();
    } catch (err: any) {
      showToast(err.message || 'Delete failed', 'error');
    }
  };

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-5xl font-black tracking-tight font-display gradient-text">Studio</h2>
          <p className="text-slate-500 mt-3 text-lg font-medium">Manage events and verify achievements in real-time.</p>
        </div>
      </header>

      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard label="Events" value={stats.total_events} colorClass="text-teal-600" />
          <StatCard label="Issued" value={stats.total_issued} colorClass="text-indigo-600" />
          <StatCard label="Live Views" value={stats.total_opened} colorClass="text-cyan-600" />
          <StatCard label="Verifications" value={stats.total_verified} colorClass="text-purple-600" />
        </div>
      )}

      <section className="glass-panel p-8 rounded-[2rem] border-teal-500/10 shadow-xl shadow-teal-500/5">
        <h3 className="text-2xl font-black mb-8 font-display text-slate-800">Launch New Event</h3>
        <form onSubmit={handleCreateEvent} className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-slate-400 px-1">Event Name</label>
            <input
              type="text" required value={name} onChange={e => setName(e.target.value)} disabled={isCreating}
              className="w-full" placeholder="e.g. Global Design Summit"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-slate-400 px-1">Organization</label>
            <input
               type="text" required value={organizer} onChange={e => setOrganizer(e.target.value)} disabled={isCreating}
               className="w-full" placeholder="e.g. Creative Collective"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-slate-400 px-1">Occurrence</label>
            <input
               type="date" required value={date} onChange={e => setDate(e.target.value)} disabled={isCreating}
               className="w-full"
            />
          </div>
          <div className="md:col-span-2 space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-slate-400 px-1">Narrative for AI Background (Optional)</label>
            <textarea
              value={description} onChange={e => setDescription(e.target.value)} disabled={isCreating}
              className="w-full min-h-[50px] resize-none" placeholder="e.g. Minimalist abstract waves in turquoise and silver..."
            />
          </div>
          <div className="flex items-end">
            <button
               disabled={isCreating}
               className="w-full gradient-brand text-white font-black py-4 rounded-xl shadow-lg shadow-teal-500/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-3 h-[50px]"
            >
              {isCreating ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Launch Studio'}
            </button>
          </div>
        </form>
      </section>

      <section>
        <div className="flex items-center justify-between mb-8">
          <h3 className="text-2xl font-black font-display text-slate-800">Your Ecosystem</h3>
        </div>
        
        {loading ? (
          <div className="dashboard-grid">
            {[1, 2, 3].map(i => <div key={i} className="h-64 glass-panel rounded-3xl animate-pulse shimmer" />)}
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-20 glass-panel rounded-[2rem] border-dashed border-slate-200 bg-white/30">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <p className="text-slate-500 font-bold font-display text-xl">The ecosystem is empty</p>
            <p className="text-slate-400 max-w-xs mx-auto mt-2">Create your first event to start issuing verified certificates.</p>
          </div>
        ) : (
          <div className="dashboard-grid">
            {events.map((evt: any) => (
              <Link 
                key={evt.id} 
                to={`/dashboard/event/${evt.id}`}
                className="glass-card p-8 rounded-[2rem] relative group border-white/50"
              >
                <div className="flex justify-between items-start mb-6">
                   <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-teal-50 group-hover:text-teal-600 transition-colors">
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                   </div>
                   <button 
                      onClick={(e) => handleDeleteEvent(evt.id, e)}
                      className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                   >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                   </button>
                </div>
                
                <h4 className="text-xl font-black text-slate-800 mb-2 truncate group-hover:text-teal-600 transition-colors uppercase tracking-tight">{evt.name}</h4>
                <div className="flex items-center gap-3 text-sm font-bold text-slate-400">
                  <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-teal-400" /> {new Date(evt.date).toLocaleDateString()}</span>
                </div>
                
                <div className="mt-8 pt-6 border-t border-slate-50 flex items-center justify-between">
                   <span className="text-xs font-bold uppercase tracking-widest text-slate-400">View Ecosystem</span>
                   <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-teal-500 group-hover:text-white transition-all transform group-hover:translate-x-1">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                      </svg>
                   </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');

  useEffect(() => {
    if (!token) navigate('/login');
  }, [token, navigate]);

  return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col lg:flex-row">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="page-container py-12">
          <Routes>
            <Route path="/" element={<EventList />} />
            <Route path="/event/:id" element={<EventDetail />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}
