import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Verify from './pages/Verify';
import Landing from './pages/Landing';
import RecipientProfile from './pages/RecipientProfile';
import OrgSettings from './pages/OrgSettings';
import AdminPortal from './pages/AdminPortal';
function NotFound() {
    return (
        <div className="min-h-screen flex items-center justify-center px-4">
            <div className="bg-white/80 border border-gray-100 rounded-2xl p-8 text-center shadow-sm max-w-md w-full">
                <h1 className="text-2xl font-bold text-gray-900">Page not found</h1>
                <p className="text-gray-500 mt-2">The page you are looking for does not exist.</p>
                <Link to="/" className="inline-flex mt-6 px-4 py-2 rounded-lg bg-prime-600 hover:bg-prime-700 text-white font-semibold transition">
                    Go home
                </Link>
            </div>
        </div>
    );
}

function App() {
    return (
        <Router>
            <div className="min-h-screen bg-gradient-to-br from-prime-50 via-white to-accent-50 text-gray-900 font-sans">
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
    );
}

export default App;
