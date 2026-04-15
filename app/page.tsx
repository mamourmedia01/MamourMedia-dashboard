'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

// ── Types ─────────────────────────────────────────────────────

interface Project {
  id: string;
  name: string;
  subtitle?: string;
  description?: string;
  status: string;
  accent: string;
  features?: string[];
  progress?: number;
  user_prompt?: string;
  deployment_url?: string;
  build_count?: number;
  last_build_at?: string;
}

// ── Color accent swatches ─────────────────────────────────────

const ACCENTS = [
  { name: 'Amber', value: '#d4a574' },
  { name: 'Blue',  value: '#60a5fa' },
  { name: 'Purple', value: '#a78bfa' },
  { name: 'Green', value: '#34d399' },
  { name: 'Pink',  value: '#f472b6' },
];

// ── New Project Modal ─────────────────────────────────────────

function NewProjectModal({ onClose, onCreated }: {
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [name, setName] = useState('');
  const [prompt, setPrompt] = useState('');
  const [accent, setAccent] = useState('#d4a574');
  const [compUrl1, setCompUrl1] = useState('');
  const [compUrl2, setCompUrl2] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!name.trim() || !prompt.trim()) {
      setError('App name and description are required.');
      return;
    }
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          userPrompt: prompt.trim(),
          competitorUrls: [compUrl1, compUrl2].filter(Boolean),
          accent,
        }),
      });
      const data = await res.json() as { project?: { id: string }; error?: string };
      if (!res.ok || data.error) {
        setError(data.error ?? 'Failed to create project');
        setLoading(false);
        return;
      }
      onCreated(data.project!.id);
    } catch (e) {
      setError(String(e));
      setLoading(false);
    }
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)', animation: 'fadeIn 0.15s ease-out' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--glass-border)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 520, boxShadow: '0 24px 64px rgba(0,0,0,0.5)', animation: 'slideInRight 0.2s ease-out' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>New Project</h2>
            <p style={{ margin: '4px 0 0', color: 'var(--text3)', fontSize: 13 }}>Describe what you want — Claude builds and deploys it autonomously.</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 22, lineHeight: 1, padding: 0 }}>×</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: 11, color: 'var(--text3)', fontWeight: 700, marginBottom: 6, letterSpacing: '0.06em', textTransform: 'uppercase' }}>App Name</label>
            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. AI CRM, Marketing Dashboard, SaaS Landing Page…"
              style={{ width: '100%', boxSizing: 'border-box', background: 'var(--glass)', border: '1px solid var(--glass-border)', borderRadius: 8, color: 'var(--text)', padding: '10px 12px', fontSize: 14, fontFamily: 'inherit', outline: 'none' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 11, color: 'var(--text3)', fontWeight: 700, marginBottom: 6, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Accent Color</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {ACCENTS.map(a => (
                <button
                  key={a.value}
                  onClick={() => setAccent(a.value)}
                  title={a.name}
                  style={{ width: 28, height: 28, borderRadius: '50%', background: a.value, border: accent === a.value ? '2px solid #fff' : '2px solid transparent', cursor: 'pointer', outline: accent === a.value ? `2px solid ${a.value}` : 'none', outlineOffset: 1, transition: 'all 0.15s' }}
                />
              ))}
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 11, color: 'var(--text3)', fontWeight: 700, marginBottom: 6, letterSpacing: '0.06em', textTransform: 'uppercase' }}>What Do You Want to Build?</label>
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder="Be specific — describe features, target users, design style, integrations. The more detail you give, the better the AI builds."
              rows={5}
              style={{ width: '100%', boxSizing: 'border-box', background: 'var(--glass)', border: '1px solid var(--glass-border)', borderRadius: 8, color: 'var(--text)', padding: '10px 12px', fontSize: 14, fontFamily: 'inherit', outline: 'none', resize: 'vertical', lineHeight: 1.5 }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 11, color: 'var(--text3)', fontWeight: 700, marginBottom: 6, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Competitor URLs (Optional — We&apos;ll Build Something Better)</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={compUrl1} onChange={e => setCompUrl1(e.target.value)} placeholder="https://competitor.com" style={{ flex: 1, background: 'var(--glass)', border: '1px solid var(--glass-border)', borderRadius: 8, color: 'var(--text)', padding: '9px 12px', fontSize: 13, fontFamily: 'inherit', outline: 'none' }} />
              <input value={compUrl2} onChange={e => setCompUrl2(e.target.value)} placeholder="https://another.com" style={{ flex: 1, background: 'var(--glass)', border: '1px solid var(--glass-border)', borderRadius: 8, color: 'var(--text)', padding: '9px 12px', fontSize: 13, fontFamily: 'inherit', outline: 'none' }} />
            </div>
          </div>

          {error && (
            <div style={{ color: 'var(--red)', fontSize: 13, padding: '8px 12px', background: 'rgba(239,68,68,0.08)', borderRadius: 6 }}>{error}</div>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading}
            style={{ background: loading ? 'var(--glass)' : `linear-gradient(135deg, ${accent}, ${accent}cc)`, color: loading ? 'var(--text3)' : '#000', border: 'none', borderRadius: 8, padding: '12px', fontSize: 14, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', transition: 'all 0.2s', marginTop: 4 }}
          >
            {loading ? 'Creating project…' : '⚡ Build It'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Project Card ──────────────────────────────────────────────

function ProjectCard({ project }: { project: Project }) {
  const isBuilding = project.status === 'building';
  const isLive = !!project.deployment_url;

  return (
    <Link href={`/project/${project.id}`} style={{ textDecoration: 'none', display: 'block' }}>
      <div
        style={{ background: 'var(--glass)', border: '1px solid var(--glass-border)', borderRadius: 14, padding: 20, cursor: 'pointer', transition: 'all 0.2s', height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 12, position: 'relative', overflow: 'hidden' }}
        onMouseEnter={e => {
          const el = e.currentTarget as HTMLDivElement;
          el.style.borderColor = project.accent + '60';
          el.style.transform = 'translateY(-2px)';
          el.style.boxShadow = `0 8px 32px ${project.accent}20`;
        }}
        onMouseLeave={e => {
          const el = e.currentTarget as HTMLDivElement;
          el.style.borderColor = 'var(--glass-border)';
          el.style.transform = 'translateY(0)';
          el.style.boxShadow = 'none';
        }}
      >
        <div style={{ position: 'absolute', top: -30, right: -30, width: 80, height: 80, borderRadius: '50%', background: project.accent, opacity: 0.08, filter: 'blur(20px)', pointerEvents: 'none' }} />

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: project.accent + '20', border: `1px solid ${project.accent}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, color: project.accent }}>
            {project.name.charAt(0).toUpperCase()}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: isBuilding ? 'var(--amber)' : isLive ? 'var(--green)' : 'var(--text3)', animation: isBuilding ? 'pulse 1.5s ease-in-out infinite' : 'none', flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'capitalize' }}>
              {isBuilding ? 'building' : isLive ? 'live' : project.status}
            </span>
          </div>
        </div>

        <div>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{project.name}</h3>
          {project.subtitle && <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--text3)' }}>{project.subtitle}</p>}
        </div>

        {project.description && (
          <p style={{ margin: 0, fontSize: 12, color: 'var(--text2)', lineHeight: 1.5, flex: 1, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
            {project.description}
          </p>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto' }}>
          {isLive ? (
            <span style={{ fontSize: 11, color: 'var(--green)', fontWeight: 600 }}>↗ Live</span>
          ) : (
            <span style={{ fontSize: 11, color: 'var(--text3)' }}>
              {project.build_count ? `${project.build_count} build${project.build_count !== 1 ? 's' : ''}` : 'Not deployed'}
            </span>
          )}
          <span style={{ fontSize: 11, color: project.accent, fontWeight: 600 }}>Open →</span>
        </div>
      </div>
    </Link>
  );
}

// ── Main Dashboard ────────────────────────────────────────────

export default function Dashboard() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/projects')
      .then(r => r.json())
      .then((d: { projects?: Project[] }) => {
        if (d.projects) setProjects(d.projects);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Also try loading from Supabase directly as fallback
  useEffect(() => {
    supabase.from('projects').select('*').order('created_at', { ascending: false })
      .then(({ data }) => { if (data && data.length > 0) setProjects(data as Project[]); });
  }, []);

  const handleProjectCreated = (id: string) => {
    setShowModal(false);
    router.push(`/project/${id}?autostart=1`);
  };

  const liveCount = projects.filter(p => p.deployment_url).length;
  const totalBuilds = projects.reduce((sum, p) => sum + (p.build_count ?? 0), 0);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div style={{ display: 'flex', minHeight: '100vh' }}>
        {/* Sidebar */}
        <aside style={{ width: 220, borderRight: '1px solid var(--glass-border)', display: 'flex', flexDirection: 'column', position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 10, background: 'var(--bg)' }}>
          {/* Logo */}
          <div style={{ padding: '20px 16px', borderBottom: '1px solid var(--glass-border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg, var(--amber), #e8b882)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 16, color: '#000' }}>M</div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 14, letterSpacing: '-0.01em' }}>Mamour Media</div>
                <div style={{ fontSize: 10, color: 'var(--text3)', letterSpacing: '0.04em' }}>AI Platform</div>
              </div>
            </div>
          </div>

          {/* Nav */}
          <nav style={{ padding: '12px 8px' }}>
            <div style={{ background: 'rgba(212,165,116,0.1)', borderRadius: 6, padding: '8px 12px', color: 'var(--amber)', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>⊞</span> Dashboard
            </div>
            <Link href="/tools" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 6, textDecoration: 'none', color: 'var(--text2)', fontSize: 13, marginTop: 1, transition: 'background 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--glass)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <span>⚙</span> Tools
            </Link>
          </nav>

          {/* Projects in sidebar */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px 12px' }}>
            <div style={{ fontSize: 10, color: 'var(--text3)', letterSpacing: '0.08em', textTransform: 'uppercase', padding: '8px 8px 4px' }}>Projects</div>
            {projects.map(p => (
              <Link key={p.id} href={`/project/${p.id}`} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 8px', borderRadius: 6, textDecoration: 'none', color: 'var(--text2)', fontSize: 12, transition: 'background 0.15s' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--glass)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: p.deployment_url ? 'var(--green)' : p.status === 'building' ? 'var(--amber)' : 'var(--text3)', flexShrink: 0 }} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
              </Link>
            ))}
          </div>

          {/* New project CTA */}
          <div style={{ padding: '12px 8px', borderTop: '1px solid var(--glass-border)' }}>
            <button
              onClick={() => setShowModal(true)}
              style={{ width: '100%', background: 'linear-gradient(135deg, var(--amber), #e8b882)', color: '#000', border: 'none', borderRadius: 8, padding: '9px', fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'opacity 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '0.9')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
            >
              + New Project
            </button>
          </div>
        </aside>

        {/* Main */}
        <main style={{ flex: 1, marginLeft: 220, padding: '40px 48px', minHeight: '100vh', boxSizing: 'border-box' }}>
          {/* Hero */}
          <div style={{ marginBottom: 40 }}>
            <h1 style={{ margin: '0 0 10px', fontSize: 32, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.2 }}>
              Build anything.{' '}
              <span style={{ background: 'linear-gradient(135deg, var(--amber), #e8b882)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                Deploy instantly.
              </span>
            </h1>
            <p style={{ margin: '0 0 28px', color: 'var(--text2)', fontSize: 16, lineHeight: 1.6, maxWidth: 540 }}>
              Describe your app — Claude architects it, researches competitors, generates production code, and deploys it live. Bugs are auto-fixed. Enhancements are auto-applied.
            </p>

            {/* Stats */}
            <div style={{ display: 'flex', gap: 12 }}>
              {[
                { label: 'Projects', value: projects.length, color: 'var(--amber)' },
                { label: 'Live Apps', value: liveCount, color: 'var(--green)' },
                { label: 'Total Builds', value: totalBuilds, color: 'var(--blue)' },
              ].map(s => (
                <div key={s.label} style={{ background: 'var(--glass)', border: '1px solid var(--glass-border)', borderRadius: 10, padding: '12px 20px' }}>
                  <div style={{ fontSize: 24, fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Grid */}
          {loading ? (
            <div style={{ color: 'var(--text3)', fontSize: 14 }}>Loading projects…</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
              {/* New project card */}
              <div
                onClick={() => setShowModal(true)}
                style={{ background: 'var(--glass)', border: '1px dashed var(--glass-border)', borderRadius: 14, padding: 20, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, minHeight: 190, transition: 'all 0.2s' }}
                onMouseEnter={e => { const el = e.currentTarget as HTMLDivElement; el.style.borderColor = 'var(--amber)'; el.style.background = 'rgba(212,165,116,0.04)'; }}
                onMouseLeave={e => { const el = e.currentTarget as HTMLDivElement; el.style.borderColor = 'var(--glass-border)'; el.style.background = 'var(--glass)'; }}
              >
                <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(212,165,116,0.1)', border: '1px solid rgba(212,165,116,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, color: 'var(--amber)' }}>+</div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', marginBottom: 4 }}>New Project</div>
                  <div style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.4 }}>Describe what to build — AI does the rest</div>
                </div>
              </div>

              {/* Project cards */}
              {projects.map(p => <ProjectCard key={p.id} project={p} />)}
            </div>
          )}

          {/* Empty state */}
          {!loading && projects.length === 0 && (
            <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--text3)' }}>
              <div style={{ fontSize: 56, marginBottom: 20 }}>⚡</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>No projects yet</div>
              <div style={{ fontSize: 14, marginBottom: 28 }}>Create your first AI-powered app in seconds</div>
              <button
                onClick={() => setShowModal(true)}
                style={{ background: 'linear-gradient(135deg, var(--amber), #e8b882)', color: '#000', border: 'none', borderRadius: 8, padding: '11px 28px', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
              >
                Build Something
              </button>
            </div>
          )}
        </main>
      </div>

      {showModal && <NewProjectModal onClose={() => setShowModal(false)} onCreated={handleProjectCreated} />}
    </div>
  );
}
