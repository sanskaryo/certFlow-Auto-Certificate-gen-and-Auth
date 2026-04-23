import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Verify from './pages/Verify';
import Landing from './pages/Landing';
import RecipientProfile from './pages/RecipientProfile';
import OrgSettings from './pages/OrgSettings';
import AdminPortal from './pages/AdminPortal';
import { ToastProvider } from './context/ToastContext';
import { ToastContainer } from './components/ToastContainer';

function NotFound() {
    return (
        <div className="min-h-screen flex items-center justify-center px-4">
            <div className="glass-panel rounded-3xl p-12 text-center max-w-md w-full border border-white/50 shadow-2xl">
                <h1 className="text-4xl font-extrabold gradient-text mb-4">404</h1>
                <h2 className="text-xl font-bold text-slate-800">Page not found</h2>
                <p className="text-slate-500 mt-2">The section you are looking for has either moved or doesn't exist.</p>
                <Link to="/" className="inline-flex mt-8 px-6 py-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold shadow-lg shadow-teal-500/20 transition-all hover:scale-105">
                    Return Home
                </Link>
            </div>
        </div>
    );
}

function App() {
    return (
        <ToastProvider>
            <Router>
                <div className="min-h-screen font-sans selection:bg-teal-100 selection:text-teal-900">
                    <ToastContainer />
                    <Routes>
                        <Route path="/" element={<Landing />} />
                        <Route path="/login" element={<Login />} />
                        <Route path="/register" element={<Register />} />
                        <Route path="/dashboard/*" element={<Dashboard />} />
                        <Route path="/verify/:id" element={<Verify />} />
                        <Route path="/verify" element={<Verify />} />
                        <Route path="/settings" element={<OrgSettings />} />
                        <Route path="/admin" element={<AdminPortal />} />
                        <Route path="/@:username" element={<RecipientProfile />} />
                        <Route path="*" element={<NotFound />} />
                    </Routes>
                </div>
            </Router>
        </ToastProvider>
    );
}

export default App;
