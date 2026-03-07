import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Verify from './pages/Verify';
import Landing from './pages/Landing';

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
                </Routes>
            </div>
        </Router>
    );
}

export default App;
