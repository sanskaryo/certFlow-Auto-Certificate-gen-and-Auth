import { Link } from 'react-router-dom';

export default function Landing() {
    return (
        <div className="landing-root">
            <div className="landing-hero">
                <div className="landing-left">
                    <h1 className="landing-title">CertFlow</h1>
                    <p className="landing-sub">Beautiful certificates, effortless issuance. Securely verify with a click.</p>

                    <div className="landing-cta">
                        <Link to="/register" className="cta-primary">Get Started</Link>
                        <Link to="/login" className="cta-ghost">Sign In</Link>
                    </div>
                </div>

                <div className="landing-right" aria-hidden>
                    <svg viewBox="0 0 600 400" className="landing-art" preserveAspectRatio="xMidYMid meet">
                        <defs>
                            <linearGradient id="g1" x1="0" x2="1">
                                <stop offset="0%" stopColor="#14b8a6" />
                                <stop offset="100%" stopColor="#06b6d4" />
                            </linearGradient>
                        </defs>
                        <rect width="600" height="400" fill="url(#g1)" rx="28" opacity="0.08" />
                        <circle cx="420" cy="260" r="120" fill="#0f172a" opacity="0.08" />
                        <circle cx="160" cy="140" r="90" fill="#0f172a" opacity="0.06" />
                    </svg>
                </div>
            </div>
        </div>
    );
}
