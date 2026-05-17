/**
 * Frontend mirror of the backend TEMPLATE_PRESETS palette.
 * Used by CertPreview to colour the preview without a server round-trip.
 */
export const TEMPLATE_COLORS: Record<string, { bg: string; title: string; text: string; accent: string }> = {
  'academic-classic':    { bg: '#f8f9fa', title: '#1e3a8a', text: '#1e293b', accent: '#3b82f6' },
  'academic-navy':       { bg: '#f0f4ff', title: '#1e3a8a', text: '#1e293b', accent: '#3b82f6' },
  'university-prestige': { bg: '#fffdfa', title: '#581c87', text: '#1e293b', accent: '#7e22ce' },
  'corporate-silver':    { bg: '#f8fafc', title: '#334155', text: '#1e293b', accent: '#94a3b8' },
  'executive-gold':      { bg: '#fffdf5', title: '#854d0e', text: '#334155', accent: '#ca8a04' },
  'business-clean':      { bg: '#ffffff', title: '#0f172a', text: '#334155', accent: '#3b82f6' },
  'hackathon-neon':      { bg: '#0f172a', title: '#22d3ee', text: '#f8fafc',  accent: '#e879f9' },
  'tech-dark':           { bg: '#020617', title: '#38bdf8', text: '#e2e8f0', accent: '#818cf8' },
  'cyber-matrix':        { bg: '#000000', title: '#4ade80', text: '#f1f5f9', accent: '#22c55e' },
  'workshop-modern':     { bg: '#fdf4ff', title: '#9d174d', text: '#374151', accent: '#f472b6' },
  'bootcamp-bold':       { bg: '#fef2f2', title: '#991b1b', text: '#1f2937', accent: '#ef4444' },
  'sports-champion':     { bg: '#fff1f2', title: '#be123c', text: '#1c1917', accent: '#f43f5e' },
  'athletics-dynamic':   { bg: '#fdf8f6', title: '#c2410c', text: '#1c1917', accent: '#f97316' },
  'volunteer-teal':      { bg: '#f0fdfa', title: '#0f766e', text: '#134e4a', accent: '#2dd4bf' },
  'warm-appreciation':   { bg: '#fffbeb', title: '#92400e', text: '#451a03', accent: '#f59e0b' },
  'cultural-fest':       { bg: '#fdf4ff', title: '#7e22ce', text: '#3b0764', accent: '#d946ef' },
  'achievement-gold':    { bg: '#fffcf0', title: '#b45309', text: '#1c1917', accent: '#fbbf24' },
  'excellence-blue':     { bg: '#eff6ff', title: '#1d4ed8', text: '#1e293b', accent: '#60a5fa' },
  'noir-luxe':           { bg: '#111827', title: '#f9fafb', text: '#f3f4f6', accent: '#4b5563' },
  'traditional-elegant': { bg: '#fefce8', title: '#713f12', text: '#451a03', accent: '#ca8a04' },
  'royal-purple':        { bg: '#f5f3ff', title: '#6d28d9', text: '#374151', accent: '#a78bfa' },
  'minimalist-white':    { bg: '#ffffff', title: '#171717', text: '#404040', accent: '#a3a3a3' },
  'emerald-clean':       { bg: '#ecfdf5', title: '#047857', text: '#374151', accent: '#34d399' },
  'modern-colorful':     { bg: '#ffffff', title: '#ec4899', text: '#111827', accent: '#8b5cf6' },
  'modern-cyan':         { bg: '#ecfeff', title: '#0e7490', text: '#374151', accent: '#22d3ee' },
  // AI-generated / custom upload — no predefined palette
  'ai-generated':        { bg: '#f8fafc', title: '#1e293b', text: '#374151', accent: '#94a3b8' },
};
