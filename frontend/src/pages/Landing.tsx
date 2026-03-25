import { Link, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';

export default function Landing() {
    const navigate = useNavigate();

    useEffect(() => {
        document.body.style.background = '#f8f6f1';
        return () => { document.body.style.background = ''; };
    }, []);

    // Handler for "Start Free" button
    const handleStartFree = (e: React.MouseEvent) => {
        e.preventDefault();
        navigate('/register');
    };

    return (
        <div style={{ fontFamily: 'DM Sans, sans-serif', color: '#0d1117' }}>
            {/* NAV */}
            <nav style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.1rem 4rem', background: 'rgba(248,246,241,0.85)', backdropFilter: 'blur(12px)', borderBottom: '1px solid #e5e0d8' }}>
                <div style={{ fontFamily: 'Playfair Display, serif', fontSize: '1.5rem', fontWeight: 900, color: '#0d1117', letterSpacing: '-0.5px' }}>Cert<span style={{ color: '#0e9a7f' }}>Flow</span></div>
                <ul style={{ listStyle: 'none', display: 'flex', gap: '2.5rem' }}>
                    <li><a href="#how" style={{ textDecoration: 'none', color: '#6b7280', fontSize: '0.92rem', fontWeight: 500 }}>How it works</a></li>
                    <li><a href="#features" style={{ textDecoration: 'none', color: '#6b7280', fontSize: '0.92rem', fontWeight: 500 }}>Features</a></li>
                    <li><a href="#profiles" style={{ textDecoration: 'none', color: '#6b7280', fontSize: '0.92rem', fontWeight: 500 }}>Profiles</a></li>
                    <li><a href="#pricing" style={{ textDecoration: 'none', color: '#6b7280', fontSize: '0.92rem', fontWeight: 500 }}>Pricing</a></li>
                </ul>
                <a href="#" className="nav-cta" style={{ background: '#0d1117', color: '#fff', padding: '0.6rem 1.4rem', borderRadius: 6, textDecoration: 'none', fontSize: '0.88rem', fontWeight: 600 }} onClick={handleStartFree}>Start Free →</a>
            </nav>

            {/* HERO */}
            <section className="hero" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8rem 4rem 4rem', position: 'relative', overflow: 'hidden' }}>
                <div className="hero-bg" style={{ position: 'absolute', inset: 0, zIndex: 0, background: 'radial-gradient(ellipse 60% 50% at 70% 40%, rgba(14,154,127,0.08) 0%, transparent 60%), radial-gradient(ellipse 40% 40% at 20% 70%, rgba(201,168,76,0.07) 0%, transparent 55%)' }}></div>
                <div className="hero-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5rem', maxWidth: 1200, width: '100%', position: 'relative', zIndex: 1, alignItems: 'center' }}>
                    <div className="hero-left">
                        <div className="hero-tag" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(14,154,127,0.1)', border: '1px solid rgba(14,154,127,0.25)', color: '#0e9a7f', fontSize: '0.8rem', fontWeight: 600, padding: '0.35rem 0.9rem', borderRadius: 100, marginBottom: '1.5rem', letterSpacing: '0.5px', textTransform: 'uppercase' }}>🏆 Trusted by 500+ institutions</div>
                        <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 'clamp(2.8rem, 5vw, 4.2rem)', fontWeight: 900, lineHeight: 1.1, letterSpacing: '-1.5px', marginBottom: '1.5rem' }}>Issue <em style={{ color: '#0e9a7f' }}>beautiful</em> certificates. Build lasting credentials.</h1>
                        <p style={{ fontSize: '1.1rem', color: '#6b7280', lineHeight: 1.7, maxWidth: 480, marginBottom: '2.5rem' }}>CertFlow lets any organization issue, manage, and verify digital certificates at scale — while giving recipients a public profile to showcase their achievements forever.</p>
                        <div className="hero-actions" style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                            <a href="#" className="btn-primary" style={{ background: '#0e9a7f', color: '#fff', padding: '0.85rem 2rem', borderRadius: 8, textDecoration: 'none', fontWeight: 600, fontSize: '1rem', boxShadow: '0 4px 20px rgba(14,154,127,0.3)' }} onClick={handleStartFree}>Start for Free</a>
                            <a href="#" className="btn-ghost" style={{ color: '#0d1117', textDecoration: 'none', fontWeight: 500, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.85rem 1.2rem' }}>▶ Watch demo</a>
                        </div>
                        <div className="hero-stats" style={{ display: 'flex', gap: '2.5rem', marginTop: '3rem', paddingTop: '2rem', borderTop: '1px solid #e5e0d8' }}>
                            <div className="stat-item"><h3 style={{ fontSize: '1.8rem', fontWeight: 700, color: '#0d1117' }}>2.4M+</h3><p style={{ fontSize: '0.82rem', color: '#6b7280', fontWeight: 500, marginTop: 2 }}>Certificates issued</p></div>
                            <div className="stat-item"><h3 style={{ fontSize: '1.8rem', fontWeight: 700, color: '#0d1117' }}>18K+</h3><p style={{ fontSize: '0.82rem', color: '#6b7280', fontWeight: 500, marginTop: 2 }}>Organizations</p></div>
                            <div className="stat-item"><h3 style={{ fontSize: '1.8rem', fontWeight: 700, color: '#0d1117' }}>99.9%</h3><p style={{ fontSize: '0.82rem', color: '#6b7280', fontWeight: 500, marginTop: 2 }}>Delivery rate</p></div>
                        </div>
                    </div>
                    <div className="cert-preview">
                        <div className="cert-float" style={{ background: '#fff', borderRadius: 16, padding: '2.5rem', boxShadow: '0 30px 80px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.05)', position: 'relative' }}>
                            <div className="verified-badge" style={{ position: 'absolute', top: -14, right: 20, background: '#0e9a7f', color: '#fff', fontSize: '0.72rem', fontWeight: 700, padding: '0.3rem 0.8rem', borderRadius: 100, display: 'flex', alignItems: 'center', gap: 4 }}>✓ Verified</div>
                            <div className="cert-inner" style={{ border: '2px solid #c9a84c', borderRadius: 10, padding: '2rem', textAlign: 'center', position: 'relative', background: 'linear-gradient(135deg, #fffef9, #fff)' }}>
                                <div className="cert-corner tl" style={{ position: 'absolute', width: 20, height: 20, borderTop: '3px solid #c9a84c', borderLeft: '3px solid #c9a84c', top: 8, left: 8 }}></div>
                                <div className="cert-corner tr" style={{ position: 'absolute', width: 20, height: 20, borderTop: '3px solid #c9a84c', borderRight: '3px solid #c9a84c', top: 8, right: 8 }}></div>
                                <div className="cert-corner bl" style={{ position: 'absolute', width: 20, height: 20, borderBottom: '3px solid #c9a84c', borderLeft: '3px solid #c9a84c', bottom: 8, left: 8 }}></div>
                                <div className="cert-corner br" style={{ position: 'absolute', width: 20, height: 20, borderBottom: '3px solid #c9a84c', borderRight: '3px solid #c9a84c', bottom: 8, right: 8 }}></div>
                                <div className="cert-logo-circle" style={{ width: 48, height: 48, borderRadius: '50%', background: '#0e9a7f', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem', color: 'white', fontSize: '1.2rem' }}>🎓</div>
                                <div className="cert-title-label" style={{ fontSize: '0.7rem', letterSpacing: 3, textTransform: 'uppercase', color: '#6b7280', fontWeight: 600, marginBottom: '0.5rem' }}>Certificate of Achievement</div>
                                <div className="cert-headline" style={{ fontFamily: 'Playfair Display, serif', fontSize: '1.4rem', fontWeight: 700, color: '#0e9a7f', marginBottom: '1rem' }}>Certificate of Achievement</div>
                                <div className="cert-body" style={{ fontSize: '0.82rem', color: '#888', marginBottom: '0.3rem' }}>This certifies that</div>
                                <div className="cert-name" style={{ fontFamily: 'Playfair Display, serif', fontSize: '1.8rem', fontWeight: 900, color: '#0d1117', margin: '0.6rem 0' }}>Priya Sharma</div>
                                <div className="cert-event" style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '1.2rem' }}>has contributed as a <strong>Speaker</strong><br />at <strong>Annual AI Hackathon 2026</strong></div>
                                <div className="cert-meta" style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #f0ece3', paddingTop: '1rem', marginTop: '0.5rem' }}>
                                    <div className="cert-meta-item" style={{ fontSize: '0.72rem', color: '#6b7280', textAlign: 'center' }}><strong style={{ display: 'block', color: '#0d1117', fontSize: '0.78rem' }}>Mar 10, 2026</strong>Issued</div>
                                    <div className="cert-meta-item" style={{ fontSize: '0.72rem', color: '#6b7280', textAlign: 'center' }}><strong style={{ display: 'block', color: '#0d1117', fontSize: '0.78rem' }}>IIT Delhi</strong>Organization</div>
                                    <div className="cert-meta-item" style={{ fontSize: '0.72rem', color: '#6b7280', textAlign: 'center' }}><strong style={{ display: 'block', color: '#0d1117', fontSize: '0.78rem' }}>Dr. Ravi K.</strong>Director</div>
                                </div>
                            </div>
                            <div className="cert-share-row" style={{ display: 'flex', gap: '0.6rem', marginTop: '1.2rem', flexWrap: 'wrap' }}>
                                <div className="share-btn" style={{ flex: 1, padding: '0.5rem', borderRadius: 6, border: '1px solid #e5e0d8', background: '#fafafa', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer', color: '#6b7280', textAlign: 'center' }}>🔗 Share</div>
                                <div className="share-btn" style={{ flex: 1, padding: '0.5rem', borderRadius: 6, border: '1px solid #e5e0d8', background: '#fafafa', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer', color: '#6b7280', textAlign: 'center' }}>in LinkedIn</div>
                                <div className="share-btn" style={{ flex: 1, padding: '0.5rem', borderRadius: 6, border: '1px solid #e5e0d8', background: '#fafafa', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer', color: '#6b7280', textAlign: 'center' }}>⬇ Download</div>
                                <div className="share-btn" style={{ flex: 1, padding: '0.5rem', borderRadius: 6, border: '1px solid #e5e0d8', background: '#fafafa', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer', color: '#6b7280', textAlign: 'center' }}>✓ Verify</div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* LOGOS STRIP */}
            <div className="logos-strip" style={{ background: '#fff', borderTop: '1px solid #e5e0d8', borderBottom: '1px solid #e5e0d8', padding: '1.5rem 4rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3rem', overflow: 'hidden' }}>
                <p style={{ fontSize: '0.78rem', color: '#6b7280', fontWeight: 500, whiteSpace: 'nowrap' }}>TRUSTED BY</p>
                <div className="org-pill" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 1rem', borderRadius: 100, background: '#f8f6f1', border: '1px solid #e5e0d8', fontSize: '0.8rem', fontWeight: 600, color: '#0d1117', whiteSpace: 'nowrap' }}><span className="org-dot" style={{ width: 8, height: 8, borderRadius: '50%', background: '#0e9a7f' }}></span> IIT Bombay</div>
                <div className="org-pill" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 1rem', borderRadius: 100, background: '#f8f6f1', border: '1px solid #e5e0d8', fontSize: '0.8rem', fontWeight: 600, color: '#0d1117', whiteSpace: 'nowrap' }}><span className="org-dot" style={{ width: 8, height: 8, borderRadius: '50%', background: '#0e9a7f' }}></span> TechFest Delhi</div>
                <div className="org-pill" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 1rem', borderRadius: 100, background: '#f8f6f1', border: '1px solid #e5e0d8', fontSize: '0.8rem', fontWeight: 600, color: '#0d1117', whiteSpace: 'nowrap' }}><span className="org-dot" style={{ width: 8, height: 8, borderRadius: '50%', background: '#0e9a7f' }}></span> Nasscom Foundation</div>
                <div className="org-pill" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 1rem', borderRadius: 100, background: '#f8f6f1', border: '1px solid #e5e0d8', fontSize: '0.8rem', fontWeight: 600, color: '#0d1117', whiteSpace: 'nowrap' }}><span className="org-dot" style={{ width: 8, height: 8, borderRadius: '50%', background: '#0e9a7f' }}></span> Google DSC India</div>
                <div className="org-pill" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 1rem', borderRadius: 100, background: '#f8f6f1', border: '1px solid #e5e0d8', fontSize: '0.8rem', fontWeight: 600, color: '#0d1117', whiteSpace: 'nowrap' }}><span className="org-dot" style={{ width: 8, height: 8, borderRadius: '50%', background: '#0e9a7f' }}></span> FICCI</div>
            </div>

            {/* HOW IT WORKS */}
            <section className="section" id="how" style={{ padding: '6rem 4rem', maxWidth: 1200, margin: '0 auto' }}>
                <div className="section-tag" style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: '#0e9a7f', marginBottom: '1rem' }}>How it works</div>
                <div className="section-title" style={{ fontFamily: 'Playfair Display, serif', fontSize: 'clamp(2rem, 3.5vw, 2.8rem)', fontWeight: 900, letterSpacing: '-1px', marginBottom: '1rem', lineHeight: 1.15 }}>From zero to 10,000 certificates<br />in under 10 minutes.</div>
                <p className="section-sub" style={{ fontSize: '1rem', color: '#6b7280', maxWidth: 500, lineHeight: 1.7 }}>No design skills needed. No complex setup. Just fast, beautiful, verifiable certificates for everyone.</p>
                <div className="steps-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem', marginTop: '4rem' }}>
                    <div className="step-card" style={{ background: '#fff', border: '1px solid #e5e0d8', borderRadius: 16, padding: '2rem 1.5rem', position: 'relative' }}>
                        <div className="step-num" style={{ fontFamily: 'Playfair Display, serif', fontSize: '3rem', fontWeight: 900, color: 'rgba(14,154,127,0.15)', lineHeight: 1, marginBottom: '1rem' }}>01</div>
                        <div className="step-icon" style={{ width: 42, height: 42, borderRadius: 10, background: 'rgba(14,154,127,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', marginBottom: '1.2rem' }}>🎨</div>
                        <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.5rem' }}>Design your template</h3>
                        <p style={{ fontSize: '0.85rem', color: '#6b7280', lineHeight: 1.6 }}>Use AI to generate a stunning certificate design, or upload your own. Add your logo, signature, and brand colors.</p>
                    </div>
                    <div className="step-card" style={{ background: '#fff', border: '1px solid #e5e0d8', borderRadius: 16, padding: '2rem 1.5rem', position: 'relative' }}>
                        <div className="step-num" style={{ fontFamily: 'Playfair Display, serif', fontSize: '3rem', fontWeight: 900, color: 'rgba(14,154,127,0.15)', lineHeight: 1, marginBottom: '1rem' }}>02</div>
                        <div className="step-icon" style={{ width: 42, height: 42, borderRadius: 10, background: 'rgba(14,154,127,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', marginBottom: '1.2rem' }}>📋</div>
                        <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.5rem' }}>Upload recipient data</h3>
                        <p style={{ fontSize: '0.85rem', color: '#6b7280', lineHeight: 1.6 }}>Drop a CSV file with names, emails, and roles. Or paste a list manually. Or connect via API for full automation.</p>
                    </div>
                    <div className="step-card" style={{ background: '#fff', border: '1px solid #e5e0d8', borderRadius: 16, padding: '2rem 1.5rem', position: 'relative' }}>
                        <div className="step-num" style={{ fontFamily: 'Playfair Display, serif', fontSize: '3rem', fontWeight: 900, color: 'rgba(14,154,127,0.15)', lineHeight: 1, marginBottom: '1rem' }}>03</div>
                        <div className="step-icon" style={{ width: 42, height: 42, borderRadius: 10, background: 'rgba(14,154,127,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', marginBottom: '1.2rem' }}>⚡</div>
                        <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.5rem' }}>Issue in bulk</h3>
                        <p style={{ fontSize: '0.85rem', color: '#6b7280', lineHeight: 1.6 }}>Click one button. CertFlow generates every certificate, assigns a unique verification hash, and emails them instantly.</p>
                    </div>
                    <div className="step-card" style={{ background: '#fff', border: '1px solid #e5e0d8', borderRadius: 16, padding: '2rem 1.5rem', position: 'relative' }}>
                        <div className="step-num" style={{ fontFamily: 'Playfair Display, serif', fontSize: '3rem', fontWeight: 900, color: 'rgba(14,154,127,0.15)', lineHeight: 1, marginBottom: '1rem' }}>04</div>
                        <div className="step-icon" style={{ width: 42, height: 42, borderRadius: 10, background: 'rgba(14,154,127,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', marginBottom: '1.2rem' }}>🌐</div>
                        <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.5rem' }}>Recipients share publicly</h3>
                        <p style={{ fontSize: '0.85rem', color: '#6b7280', lineHeight: 1.6 }}>Each recipient gets a public profile URL. They can share on LinkedIn, Twitter, or embed on their portfolio.</p>
                    </div>
                </div>
            </section>

            {/* FEATURES */}
            <section className="features-section" id="features" style={{ background: '#0d1117', padding: '6rem 4rem' }}>
                <div className="features-inner" style={{ maxWidth: 1200, margin: '0 auto' }}>
                    <div className="section-tag" style={{ color: '#12c49f', fontSize: '0.75rem', fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', marginBottom: '1rem' }}>Features</div>
                    <div className="section-title" style={{ color: '#fff', fontFamily: 'Playfair Display, serif', fontSize: 'clamp(2rem, 3.5vw, 2.8rem)', fontWeight: 900, letterSpacing: '-1px', marginBottom: '1rem', lineHeight: 1.15 }}>Everything you need.<br />Nothing you don't.</div>
                    <p className="section-sub" style={{ color: 'rgba(255,255,255,0.5)', fontSize: '1rem', maxWidth: 500, lineHeight: 1.7 }}>Built for colleges, companies, and clubs — at any scale.</p>
                    <div className="features-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem', marginTop: '4rem' }}>
                        <div className="feature-card" style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '2rem', color: '#fff' }}>
                            <div className="feature-icon" style={{ fontSize: '1.8rem', marginBottom: '1.2rem' }}>🤖</div>
                            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.5rem' }}>AI Certificate Designer</h3>
                            <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)', lineHeight: 1.6 }}>Describe your event and CertFlow generates a polished, print-ready certificate design in seconds.</p>
                            <span className="feature-badge" style={{ display: 'inline-block', marginTop: '0.8rem', background: 'rgba(14,154,127,0.2)', color: '#12c49f', fontSize: '0.7rem', fontWeight: 700, padding: '0.2rem 0.6rem', borderRadius: 4, letterSpacing: '0.5px' }}>AI-Powered</span>
                        </div>
                        <div className="feature-card" style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '2rem', color: '#fff' }}>
                            <div className="feature-icon" style={{ fontSize: '1.8rem', marginBottom: '1.2rem' }}>📊</div>
                            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.5rem' }}>Bulk CSV Issuance</h3>
                            <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)', lineHeight: 1.6 }}>Upload a spreadsheet. Get 10,000 personalized, signed certificates in minutes. Background processing, zero manual work.</p>
                        </div>
                        <div className="feature-card" style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '2rem', color: '#fff' }}>
                            <div className="feature-icon" style={{ fontSize: '1.8rem', marginBottom: '1.2rem' }}>🔐</div>
                            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.5rem' }}>Tamper-Proof Verification</h3>
                            <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)', lineHeight: 1.6 }}>Every certificate gets a unique SHA-256 hash. Anyone can verify authenticity in one click via QR or URL.</p>
                            <span className="feature-badge" style={{ display: 'inline-block', marginTop: '0.8rem', background: 'rgba(14,154,127,0.2)', color: '#12c49f', fontSize: '0.7rem', fontWeight: 700, padding: '0.2rem 0.6rem', borderRadius: 4, letterSpacing: '0.5px' }}>Blockchain-ready</span>
                        </div>
                        <div className="feature-card" style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '2rem', color: '#fff' }}>
                            <div className="feature-icon" style={{ fontSize: '1.8rem', marginBottom: '1.2rem' }}>👤</div>
                            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.5rem' }}>Public Credential Profiles</h3>
                            <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)', lineHeight: 1.6 }}>Like Credly, but faster. Recipients get a public profile at certflow.io/@username to showcase all their certificates.</p>
                            <span className="feature-badge" style={{ display: 'inline-block', marginTop: '0.8rem', background: 'rgba(14,154,127,0.2)', color: '#12c49f', fontSize: '0.7rem', fontWeight: 700, padding: '0.2rem 0.6rem', borderRadius: 4, letterSpacing: '0.5px' }}>Coming soon</span>
                        </div>
                        <div className="feature-card" style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '2rem', color: '#fff' }}>
                            <div className="feature-icon" style={{ fontSize: '1.8rem', marginBottom: '1.2rem' }}>📧</div>
                            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.5rem' }}>Automated Email Delivery</h3>
                            <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)', lineHeight: 1.6 }}>Branded emails land in every recipient's inbox. Track opens, views, and shares from your dashboard.</p>
                        </div>
                        <div className="feature-card" style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '2rem', color: '#fff' }}>
                            <div className="feature-icon" style={{ fontSize: '1.8rem', marginBottom: '1.2rem' }}>🔗</div>
                            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.5rem' }}>LinkedIn Integration</h3>
                            <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)', lineHeight: 1.6 }}>Recipients add their certificate to LinkedIn with one click. Auto-filled title, org, date, and credential URL.</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* PUBLIC PROFILE SECTION */}
            <section className="profile-section" id="profiles" style={{ padding: '6rem 4rem' }}>
                <div className="profile-inner" style={{ maxWidth: 1200, margin: '0 auto' }}>
                    <div className="section-tag" style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: '#0e9a7f', marginBottom: '1rem' }}>Public Profiles</div>
                    <div className="section-title" style={{ fontFamily: 'Playfair Display, serif', fontSize: 'clamp(2rem, 3.5vw, 2.8rem)', fontWeight: 900, letterSpacing: '-1px', marginBottom: '1rem', lineHeight: 1.15 }}>Your achievements,<br />always shareable.</div>
                    <div className="profile-demo-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5rem', marginTop: '4rem', alignItems: 'center' }}>
                        <div>
                            <div className="profile-text-points" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                <div className="point-item" style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                                    <div className="point-icon" style={{ width: 40, height: 40, flexShrink: 0, background: 'rgba(14,154,127,0.1)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem' }}>🌐</div>
                                    <div>
                                        <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.3rem' }}>A permanent public URL</h4>
                                        <p style={{ fontSize: '0.85rem', color: '#6b7280', lineHeight: 1.6 }}>Every recipient gets certflow.io/@theirname — a living portfolio of verified credentials, forever accessible.</p>
                                    </div>
                                </div>
                                <div className="point-item" style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                                    <div className="point-icon" style={{ width: 40, height: 40, flexShrink: 0, background: 'rgba(14,154,127,0.1)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem' }}>in</div>
                                    <div>
                                        <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.3rem' }}>One-click LinkedIn sharing</h4>
                                        <p style={{ fontSize: '0.85rem', color: '#6b7280', lineHeight: 1.6 }}>Add any certificate directly to the LinkedIn Licenses & Certifications section. All fields pre-filled automatically.</p>
                                    </div>
                                </div>
                                <div className="point-item" style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                                    <div className="point-icon" style={{ width: 40, height: 40, flexShrink: 0, background: 'rgba(14,154,127,0.1)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem' }}>🛡️</div>
                                    <div>
                                        <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.3rem' }}>Verified badges, not just images</h4>
                                        <p style={{ fontSize: '0.85rem', color: '#6b7280', lineHeight: 1.6 }}>Unlike a PDF, CertFlow credentials are live-verified. Employers and institutions can check authenticity instantly.</p>
                                    </div>
                                </div>
                                <div className="point-item" style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                                    <div className="point-icon" style={{ width: 40, height: 40, flexShrink: 0, background: 'rgba(14,154,127,0.1)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem' }}>🎛️</div>
                                    <div>
                                        <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.3rem' }}>Privacy controls</h4>
                                        <p style={{ fontSize: '0.85rem', color: '#6b7280', lineHeight: 1.6 }}>Recipients choose which certificates to show publicly. Full control over their credential visibility.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="profile-card-demo" style={{ background: '#fff', border: '1px solid #e5e0d8', borderRadius: 20, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.08)' }}>
                            <div className="profile-header-demo" style={{ background: 'linear-gradient(135deg, #0e9a7f, #0a7a63)', padding: '2rem', color: 'white', textAlign: 'center' }}>
                                <div className="profile-avatar" style={{ width: 70, height: 70, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', margin: '0 auto 1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.8rem', border: '3px solid rgba(255,255,255,0.4)' }}>👩‍💻</div>
                                <h3 style={{ fontFamily: 'Playfair Display, serif', fontSize: '1.3rem', fontWeight: 700 }}>Priya Sharma</h3>
                                <p style={{ fontSize: '0.82rem', opacity: 0.8, marginTop: '0.3rem' }}>Computer Science · IIT Bombay '25</p>
                                <div className="profile-url" style={{ fontSize: '0.75rem', opacity: 0.7, marginTop: '0.5rem' }}>certflow.io/@priyasharma</div>
                            </div>
                            <div className="profile-body" style={{ padding: '1.5rem' }}>
                                <div className="mini-cert-row" style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                                    <div className="mini-cert" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.8rem', borderRadius: 10, border: '1px solid #e5e0d8', background: '#f8f6f1' }}>
                                        <div className="mini-cert-icon" style={{ width: 36, height: 36, borderRadius: 8, background: '#0e9a7f', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem', flexShrink: 0 }}>🏆</div>
                                        <div className="mini-cert-info"><h4 style={{ fontSize: '0.82rem', fontWeight: 700 }}>Speaker · Annual AI Hackathon</h4><p style={{ fontSize: '0.72rem', color: '#6b7280' }}>IIT Delhi</p></div>
                                        <div className="mini-cert-meta" style={{ marginLeft: 'auto', fontSize: '0.7rem', color: '#6b7280', textAlign: 'right' }}>Mar 2026<br /><span style={{ color: '#0e9a7f', fontWeight: 700 }}>✓ Verified</span></div>
                                    </div>
                                    <div className="mini-cert" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.8rem', borderRadius: 10, border: '1px solid #e5e0d8', background: '#f8f6f1' }}>
                                        <div className="mini-cert-icon" style={{ width: 36, height: 36, borderRadius: 8, background: '#0e9a7f', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem', flexShrink: 0 }}>🎓</div>
                                        <div className="mini-cert-info"><h4 style={{ fontSize: '0.82rem', fontWeight: 700 }}>Winner · Smart India Hackathon</h4><p style={{ fontSize: '0.72rem', color: '#6b7280' }}>MoE, India</p></div>
                                        <div className="mini-cert-meta" style={{ marginLeft: 'auto', fontSize: '0.7rem', color: '#6b7280', textAlign: 'right' }}>Dec 2025<br /><span style={{ color: '#0e9a7f', fontWeight: 700 }}>✓ Verified</span></div>
                                    </div>
                                    <div className="mini-cert" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.8rem', borderRadius: 10, border: '1px solid #e5e0d8', background: '#f8f6f1' }}>
                                        <div className="mini-cert-icon" style={{ width: 36, height: 36, borderRadius: 8, background: '#0e9a7f', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem', flexShrink: 0 }}>⭐</div>
                                        <div className="mini-cert-info"><h4 style={{ fontSize: '0.82rem', fontWeight: 700 }}>Volunteer · TEDxIITB 2025</h4><p style={{ fontSize: '0.72rem', color: '#6b7280' }}>TEDx Organization</p></div>
                                        <div className="mini-cert-meta" style={{ marginLeft: 'auto', fontSize: '0.7rem', color: '#6b7280', textAlign: 'right' }}>Aug 2025<br /><span style={{ color: '#0e9a7f', fontWeight: 700 }}>✓ Verified</span></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* PRICING */}
            <section className="pricing-section" id="pricing" style={{ background: '#f8f6f1', padding: '6rem 4rem', borderTop: '1px solid #e5e0d8' }}>
                <div className="pricing-inner" style={{ maxWidth: 1100, margin: '0 auto' }}>
                    <div style={{ textAlign: 'center', marginBottom: 0 }}>
                        <div className="section-tag" style={{ justifyContent: 'center', display: 'flex', fontSize: '0.75rem', fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: '#0e9a7f', marginBottom: '1rem' }}>Pricing</div>
                        <div className="section-title" style={{ textAlign: 'center', fontFamily: 'Playfair Display, serif', fontSize: 'clamp(2rem, 3.5vw, 2.8rem)', fontWeight: 900, letterSpacing: '-1px', marginBottom: '1rem', lineHeight: 1.15 }}>Simple, honest pricing.</div>
                        <p className="section-sub" style={{ margin: '0 auto', textAlign: 'center', fontSize: '1rem', color: '#6b7280', maxWidth: 500, lineHeight: 1.7 }}>Start free. Scale as you grow. No per-certificate fees on paid plans.</p>
                    </div>
                    <div className="pricing-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem', marginTop: '4rem' }}>
                        <div className="price-card" style={{ background: '#fff', border: '1px solid #e5e0d8', borderRadius: 20, padding: '2.5rem 2rem', position: 'relative' }}>
                            <div className="price-tier" style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#6b7280' }}>Starter</div>
                            <div className="price-amount" style={{ fontFamily: 'Playfair Display, serif', fontSize: '3rem', fontWeight: 900, margin: '0.8rem 0 0.2rem' }}>₹0 <span style={{ fontSize: '1rem', fontFamily: 'DM Sans, sans-serif', fontWeight: 400, color: '#6b7280' }}>/ month</span></div>
                            <div className="price-desc" style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '1.5rem' }}>Perfect for small clubs and events</div>
                            <ul className="price-features" style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.7rem', marginBottom: '2rem' }}>
                                <li>100 certificates / month</li>
                                <li>3 templates</li>
                                <li>Basic verify page</li>
                                <li>Email delivery</li>
                                <li style={{ color: '#6b7280' }}>Public recipient profiles</li>
                                <li style={{ color: '#6b7280' }}>Custom domain</li>
                                <li style={{ color: '#6b7280' }}>API access</li>
                            </ul>
                            <a className="price-btn" href="#" style={{ display: 'block', textAlign: 'center', padding: '0.8rem', borderRadius: 8, fontWeight: 600, fontSize: '0.9rem', textDecoration: 'none', border: '2px solid #e5e0d8', color: '#0d1117' }} onClick={handleStartFree}>Get started free</a>
                        </div>
                        <div className="price-card featured" style={{ borderColor: '#0e9a7f', boxShadow: '0 0 0 4px rgba(14,154,127,0.08)', background: '#fff', borderRadius: 20, padding: '2.5rem 2rem', position: 'relative' }}>
                            <div className="price-badge" style={{ position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)', background: '#0e9a7f', color: '#fff', fontSize: '0.72rem', fontWeight: 700, padding: '0.3rem 1rem', borderRadius: 100, whiteSpace: 'nowrap' }}>Most Popular</div>
                            <div className="price-tier" style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#6b7280' }}>Pro</div>
                            <div className="price-amount" style={{ fontFamily: 'Playfair Display, serif', fontSize: '3rem', fontWeight: 900, margin: '0.8rem 0 0.2rem' }}>₹999 <span style={{ fontSize: '1rem', fontFamily: 'DM Sans, sans-serif', fontWeight: 400, color: '#6b7280' }}>/ month</span></div>
                            <div className="price-desc" style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '1.5rem' }}>For colleges, companies & active orgs</div>
                            <ul className="price-features" style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.7rem', marginBottom: '2rem' }}>
                                <li>Unlimited certificates</li>
                                <li>AI template generator</li>
                                <li>Public recipient profiles</li>
                                <li>LinkedIn integration</li>
                                <li>Analytics dashboard</li>
                                <li>Email tracking</li>
                                <li style={{ color: '#6b7280' }}>Custom domain</li>
                            </ul>
                            <a className="price-btn primary" href="#" style={{ background: '#0e9a7f', borderColor: '#0e9a7f', color: '#fff', display: 'block', textAlign: 'center', padding: '0.8rem', borderRadius: 8, fontWeight: 600, fontSize: '0.9rem', textDecoration: 'none' }} onClick={handleStartFree}>Start Pro trial</a>
                        </div>
                        <div className="price-card" style={{ background: '#fff', border: '1px solid #e5e0d8', borderRadius: 20, padding: '2.5rem 2rem', position: 'relative' }}>
                            <div className="price-tier" style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#6b7280' }}>Enterprise</div>
                            <div className="price-amount" style={{ fontFamily: 'Playfair Display, serif', fontSize: '3rem', fontWeight: 900, margin: '0.8rem 0 0.2rem' }}>Custom</div>
                            <div className="price-desc" style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '1.5rem' }}>For large institutions & corporates</div>
                            <ul className="price-features" style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.7rem', marginBottom: '2rem' }}>
                                <li>Everything in Pro</li>
                                <li>Custom domain & branding</li>
                                <li>API & webhook access</li>
                                <li>SSO / SAML login</li>
                                <li>SLA & priority support</li>
                                <li>Blockchain anchoring</li>
                                <li>Dedicated account manager</li>
                            </ul>
                            <a className="price-btn" href="#" style={{ display: 'block', textAlign: 'center', padding: '0.8rem', borderRadius: 8, fontWeight: 600, fontSize: '0.9rem', textDecoration: 'none', border: '2px solid #e5e0d8', color: '#0d1117' }}>Contact sales</a>
                        </div>
                    </div>
                </div>
            </section>

            {/* CTA */}
            <section className="cta-section" style={{ background: 'linear-gradient(135deg, #0d1117 0%, #1a2a25 100%)', padding: '6rem 4rem', textAlign: 'center' }}>
                <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 900, color: '#fff', marginBottom: '1rem', letterSpacing: '-1px' }}>Ready to issue your first <em style={{ color: '#12c49f' }}>beautiful</em> certificate?</h2>
                <p style={{ color: 'rgba(255,255,255,0.5)', marginBottom: '2.5rem', fontSize: '1rem' }}>Join 18,000+ organizations already using CertFlow. Free forever for small orgs.</p>
                <div className="cta-btns" style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                    <a className="btn-primary" href="#" style={{ background: '#0e9a7f', color: '#fff', padding: '0.85rem 2rem', borderRadius: 8, textDecoration: 'none', fontWeight: 600, fontSize: '1rem', boxShadow: '0 4px 20px rgba(14,154,127,0.3)' }} onClick={handleStartFree}>Start for Free — No credit card</a>
                    <a href="#" style={{ color: 'rgba(255,255,255,0.5)', textDecoration: 'none', fontSize: '0.95rem', padding: '0.85rem 1rem' }}>Book a demo →</a>
                </div>
            </section>

            {/* FOOTER */}
            <footer style={{ background: '#0a0f0d', padding: '3rem 4rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                <div className="logo" style={{ color: '#fff', fontSize: '1.2rem' }}>Cert<span style={{ color: '#0e9a7f' }}>Flow</span></div>
                <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.3)' }}>© 2026 CertFlow. Issue with confidence.</p>
                <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.2)' }}>Privacy · Terms · Contact</p>
            </footer>
        </div>
    );
}
