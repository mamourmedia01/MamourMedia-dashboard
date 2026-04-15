'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';

// ── Types ─────────────────────────────────────────────────────

interface Project {
  id: string;
  name: string;
  subtitle?: string;
  description?: string;
  status: string;
  accent: string;
  user_prompt?: string;
  deployment_url?: string;
  competitor_urls?: string[];
  build_count?: number;
  last_build_at?: string;
}

interface BuildEvent {
  id?: number;
  type: 'start' | 'research' | 'think' | 'generate' | 'file' | 'deploy' | 'poll' | 'fix' | 'suggest' | 'success' | 'error';
  content: string;
  metadata?: Record<string, unknown>;
  created_at?: string;
}

interface ProjectFile {
  file_path: string;
  content: string;
  build_id: string;
}

// ── Event icons/colors ────────────────────────────────────────

const EVENT_STYLE: Record<string, { icon: string; color: string }> = {
  start:    { icon: '◇', color: 'var(--text3)' },
  research: { icon: '◎', color: 'var(--blue)' },
  think:    { icon: '◆', color: 'var(--amber)' },
  generate: { icon: '⟳', color: 'var(--purple)' },
  file:     { icon: '·', color: 'var(--text3)' },
  deploy:   { icon: '↑', color: 'var(--amber)' },
  poll:     { icon: '⋯', color: 'var(--text3)' },
  fix:      { icon: '⚡', color: 'var(--amber)' },
  suggest:  { icon: '💡', color: '#a78bfa' },
  success:  { icon: '✓', color: 'var(--green)' },
  error:    { icon: '✗', color: 'var(--red)' },
};

// ── Sub-components ────────────────────────────────────────────

function BuildConsole({ events, isBuilding }: { events: BuildEvent[]; isBuilding: boolean }) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [events.length]);

  return (
    <div style={{
      background: 'var(--bg2)',
      border: '1px solid var(--glass-border)',
      borderRadius: 12,
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color: 'var(--text2)', fontSize: 12, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Build Console</span>
        {isBuilding && (
          <span style={{ display: 'flex', gap: 3, marginLeft: 'auto' }}>
            {[0, 1, 2].map(i => (
              <span key={i} style={{
                width: 6, height: 6, borderRadius: '50%', background: 'var(--amber)',
                animation: `pulse 1.2s ${i * 0.2}s ease-in-out infinite`,
              }} />
            ))}
          </span>
        )}
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', fontFamily: 'monospace', fontSize: 13, lineHeight: 1.7 }}>
        {events.length === 0 ? (
          <div style={{ color: 'var(--text3)', fontStyle: 'italic' }}>Waiting for build to start…</div>
        ) : (
          events.map((e, i) => {
            const style = EVENT_STYLE[e.type] ?? EVENT_STYLE.start;
            const isFile = e.type === 'file';
            const isPoll = e.type === 'poll';
            return (
              <div key={i} style={{
                display: 'flex',
                gap: 8,
                marginBottom: isPoll ? 0 : 2,
                paddingLeft: isFile ? 16 : 0,
                opacity: isPoll ? 0.5 : 1,
              }}>
                <span style={{ color: style.color, minWidth: 16, textAlign: 'center' }}>{style.icon}</span>
                <span style={{ color: isFile ? 'var(--text3)' : isPoll ? 'var(--text3)' : 'var(--text)', wordBreak: 'break-all' }}>
                  {e.content}
                </span>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

function FileTree({
  files,
  selectedPath,
  onSelect,
}: {
  files: ProjectFile[];
  selectedPath: string | null;
  onSelect: (path: string) => void;
}) {
  // Group by top-level directory
  const groups: Record<string, ProjectFile[]> = {};
  for (const f of files) {
    const parts = f.file_path.split('/');
    const group = parts.length > 1 ? parts[0] : '__root__';
    if (!groups[group]) groups[group] = [];
    groups[group].push(f);
  }

  return (
    <div style={{ fontSize: 12, fontFamily: 'monospace' }}>
      {Object.entries(groups).map(([group, groupFiles]) => (
        <div key={group} style={{ marginBottom: 8 }}>
          {group !== '__root__' && (
            <div style={{ color: 'var(--text3)', marginBottom: 2, paddingLeft: 4, fontSize: 11, letterSpacing: '0.04em' }}>
              {group}/
            </div>
          )}
          {groupFiles.map(f => (
            <button
              key={f.file_path}
              onClick={() => onSelect(f.file_path)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                background: selectedPath === f.file_path ? 'rgba(212,165,116,0.12)' : 'transparent',
                border: 'none',
                borderRadius: 4,
                padding: '3px 8px',
                cursor: 'pointer',
                color: selectedPath === f.file_path ? 'var(--amber)' : 'var(--text2)',
                fontSize: 12,
                fontFamily: 'monospace',
                paddingLeft: group !== '__root__' ? 16 : 8,
                transition: 'background 0.15s',
              }}
            >
              {f.file_path.split('/').pop()}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

function SuccessCard({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div style={{
      background: 'rgba(34,197,94,0.08)',
      border: '1px solid rgba(34,197,94,0.3)',
      borderRadius: 12,
      padding: '16px 20px',
      marginTop: 8,
      display: 'flex',
      alignItems: 'center',
      gap: 12,
    }}>
      <span style={{ color: 'var(--green)', fontSize: 20 }}>✓</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: 'var(--text)', fontWeight: 600, marginBottom: 2 }}>App is live</div>
        <div style={{ color: 'var(--text2)', fontSize: 12, wordBreak: 'break-all' }}>{url}</div>
      </div>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          background: 'var(--green)',
          color: '#000',
          padding: '6px 14px',
          borderRadius: 6,
          fontWeight: 600,
          fontSize: 12,
          textDecoration: 'none',
          whiteSpace: 'nowrap',
        }}
      >
        Open ↗
      </a>
      <button
        onClick={() => { navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
        style={{ background: 'var(--glass)', border: '1px solid var(--glass-border)', color: 'var(--text2)', padding: '6px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 12, whiteSpace: 'nowrap' }}
      >
        {copied ? 'Copied!' : 'Copy URL'}
      </button>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────

export default function ProjectPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const projectId = params.id as string;
  const autostart = searchParams.get('autostart') === '1';

  const [project, setProject] = useState<Project | null>(null);
  const [events, setEvents] = useState<BuildEvent[]>([]);
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [isBuilding, setIsBuilding] = useState(false);
  const [successUrl, setSuccessUrl] = useState<string | null>(null);
  const [rebuildPrompt, setRebuildPrompt] = useState('');
  const [compUrl1, setCompUrl1] = useState('');
  const [compUrl2, setCompUrl2] = useState('');
  const [activeBuildId, setActiveBuildId] = useState<string | null>(null);
  const [lastEventId, setLastEventId] = useState<number>(0);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const sseRef = useRef<EventSource | null>(null);

  // Load project
  useEffect(() => {
    if (!projectId) return;
    supabase.from('projects').select('*').eq('id', projectId).single()
      .then(({ data }) => {
        if (data) {
          setProject(data as Project);
          if (data.deployment_url) setSuccessUrl(data.deployment_url as string);
          if (data.competitor_urls) {
            const urls = data.competitor_urls as string[];
            setCompUrl1(urls[0] ?? '');
            setCompUrl2(urls[1] ?? '');
          }
        }
      });
  }, [projectId]);

  // Load latest build files
  useEffect(() => {
    if (!projectId) return;
    supabase.from('builds')
      .select('id, status, deployment_url')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
      .then(({ data: build }) => {
        if (!build) return;
        if (build.deployment_url) setSuccessUrl(build.deployment_url as string);
        supabase.from('project_files')
          .select('file_path, content, build_id')
          .eq('build_id', build.id)
          .order('file_path')
          .then(({ data }) => {
            if (data) setFiles(data as ProjectFile[]);
          });
      });
  }, [projectId]);

  // SSE polling fallback
  const startPolling = useCallback((buildId: string) => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    pollIntervalRef.current = setInterval(async () => {
      const res = await fetch(`/api/builds/${buildId}/events?since=${lastEventId}`);
      const { events: newEvents } = await res.json() as { events: Array<BuildEvent & { id: number }> };
      if (!newEvents?.length) return;

      const last = newEvents[newEvents.length - 1];
      setLastEventId(last.id ?? 0);
      setEvents(prev => [...prev, ...newEvents]);

      const done = newEvents.some(e => e.type === 'success' || (e.type === 'error' && e.content.includes('exhausted')));
      if (done) {
        clearInterval(pollIntervalRef.current!);
        setIsBuilding(false);
        const success = newEvents.find(e => e.type === 'success');
        if (success?.metadata?.url) setSuccessUrl(success.metadata.url as string);
      }
    }, 3000);
  }, [lastEventId]);

  // Start build via SSE
  const startBuild = useCallback(async (prompt: string, competitors: string[]) => {
    if (isBuilding) return;
    setIsBuilding(true);
    setEvents([]);
    setSuccessUrl(null);

    let buildId: string | null = null;

    try {
      const res = await fetch('/api/build', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, userPrompt: prompt, competitorUrls: competitors.filter(Boolean) }),
      });

      if (!res.ok || !res.body) throw new Error('Build request failed');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let sseActive = true;

      // Set a 55s timeout — if SSE drops, switch to polling
      const sseTimeout = setTimeout(() => {
        sseActive = false;
        if (buildId) startPolling(buildId);
      }, 55_000);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() ?? '';

        for (const chunk of lines) {
          const dataLine = chunk.replace(/^data: /, '').trim();
          if (!dataLine || dataLine === '[DONE]') {
            if (dataLine === '[DONE]') {
              clearTimeout(sseTimeout);
              setIsBuilding(false);
            }
            continue;
          }

          try {
            const event = JSON.parse(dataLine) as BuildEvent;
            setEvents(prev => [...prev, event]);

            if (event.type === 'success' && event.metadata?.url) {
              setSuccessUrl(event.metadata.url as string);
            }
            if (event.metadata?.deploymentId && !buildId) {
              // Use deploymentId as proxy for buildId until we have the real one
              buildId = activeBuildId;
            }
          } catch {
            // Ignore parse errors
          }
        }

        if (!sseActive) break;
      }

      clearTimeout(sseTimeout);
    } catch {
      setEvents(prev => [...prev, { type: 'error', content: 'Connection to build engine lost. Switching to polling…' }]);
      if (buildId) startPolling(buildId);
    }

    setIsBuilding(false);

    // Reload files after build
    const { data: latestBuild } = await supabase
      .from('builds')
      .select('id, deployment_url')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (latestBuild) {
      if (latestBuild.deployment_url) setSuccessUrl(latestBuild.deployment_url as string);
      const { data: newFiles } = await supabase
        .from('project_files')
        .select('file_path, content, build_id')
        .eq('build_id', latestBuild.id)
        .order('file_path');
      if (newFiles) setFiles(newFiles as ProjectFile[]);
    }
  }, [projectId, isBuilding, activeBuildId, startPolling]);

  // Auto-start if navigated with ?autostart=1
  useEffect(() => {
    if (autostart && project && !isBuilding) {
      const prompt = project.user_prompt ?? project.description ?? '';
      const competitors = project.competitor_urls ?? [];
      if (prompt) startBuild(prompt, competitors);
    }
    // Only run once when project loads
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id]);

  // Cleanup
  useEffect(() => {
    return () => {
      sseRef.current?.close();
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  const selectedFileContent = files.find(f => f.file_path === selectedFile)?.content ?? null;
  const statusColor = project?.status === 'active' ? 'var(--green)' : project?.status === 'building' ? 'var(--amber)' : 'var(--text3)';

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--bg)', color: 'var(--text)', fontFamily: 'Inter, system-ui, sans-serif', overflow: 'hidden' }}>
      {/* Sidebar */}
      <aside style={{ width: 220, borderRight: '1px solid var(--glass-border)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ padding: '20px 16px 12px', borderBottom: '1px solid var(--glass-border)' }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', color: 'var(--text2)', fontSize: 12, marginBottom: 16 }}>
            ← Dashboard
          </Link>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', lineHeight: 1.3 }}>{project?.name ?? '…'}</div>
          {project?.subtitle && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{project.subtitle}</div>}
          {project && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: statusColor, flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'capitalize' }}>{project.status}</span>
            </div>
          )}
        </div>

        <nav style={{ flex: 1, padding: '12px 8px', overflowY: 'auto' }}>
          <div style={{ fontSize: 10, color: 'var(--text3)', letterSpacing: '0.08em', textTransform: 'uppercase', padding: '4px 8px', marginBottom: 4 }}>Navigation</div>
          <Link href="/tools" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px', borderRadius: 6, textDecoration: 'none', color: 'var(--text2)', fontSize: 13 }}>
            ⚙ Tools
          </Link>
        </nav>

        {successUrl && (
          <div style={{ padding: '12px 16px', borderTop: '1px solid var(--glass-border)' }}>
            <a href={successUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--green)', textDecoration: 'none', fontSize: 12, fontWeight: 600 }}>
              <span>↗</span> View Live App
            </a>
          </div>
        )}
      </aside>

      {/* Main */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <header style={{ padding: '14px 24px', borderBottom: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <h1 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{project?.name ?? 'Loading…'}</h1>
          {project && (
            <span style={{
              background: project.status === 'active' ? 'rgba(34,197,94,0.12)' : project.status === 'building' ? 'rgba(212,165,116,0.12)' : 'var(--glass)',
              color: statusColor,
              border: `1px solid ${statusColor}40`,
              borderRadius: 20,
              padding: '2px 10px',
              fontSize: 11,
              fontWeight: 600,
              textTransform: 'capitalize',
            }}>
              {project.status}
            </span>
          )}
          <div style={{ flex: 1 }} />
          {successUrl && (
            <a href={successUrl} target="_blank" rel="noopener noreferrer" style={{
              background: 'transparent',
              border: '1px solid var(--glass-border)',
              color: 'var(--text)',
              padding: '6px 14px',
              borderRadius: 6,
              textDecoration: 'none',
              fontSize: 13,
              fontWeight: 500,
            }}>
              Open App ↗
            </a>
          )}
          <button
            onClick={() => startBuild(rebuildPrompt || project?.user_prompt || '', [compUrl1, compUrl2])}
            disabled={isBuilding}
            style={{
              background: isBuilding ? 'var(--glass)' : 'var(--amber)',
              color: isBuilding ? 'var(--text3)' : '#000',
              border: 'none',
              padding: '6px 16px',
              borderRadius: 6,
              cursor: isBuilding ? 'not-allowed' : 'pointer',
              fontWeight: 700,
              fontSize: 13,
              transition: 'all 0.2s',
            }}
          >
            {isBuilding ? 'Building…' : 'Rebuild'}
          </button>
        </header>

        {/* Content */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden', gap: 0 }}>
          {/* Build console — 60% */}
          <div style={{ flex: '0 0 60%', display: 'flex', flexDirection: 'column', padding: 16, gap: 12, overflow: 'hidden', borderRight: '1px solid var(--glass-border)' }}>
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <BuildConsole events={events} isBuilding={isBuilding} />
            </div>
            {successUrl && <SuccessCard url={successUrl} />}
          </div>

          {/* Right panel — file tree + preview — 40% */}
          <div style={{ flex: '0 0 40%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* File tree */}
            <div style={{ flex: '0 0 auto', maxHeight: '45%', padding: '12px 16px', borderBottom: '1px solid var(--glass-border)', overflowY: 'auto' }}>
              <div style={{ fontSize: 10, color: 'var(--text3)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
                Generated Files {files.length > 0 && `(${files.length})`}
              </div>
              {files.length === 0 ? (
                <div style={{ color: 'var(--text3)', fontSize: 12, fontStyle: 'italic' }}>No files yet — start a build</div>
              ) : (
                <FileTree files={files} selectedPath={selectedFile} onSelect={setSelectedFile} />
              )}
            </div>

            {/* File preview */}
            <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              {selectedFile && selectedFileContent ? (
                <>
                  <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--glass-border)', fontSize: 11, color: 'var(--amber)', fontFamily: 'monospace' }}>
                    {selectedFile}
                  </div>
                  <pre style={{
                    flex: 1,
                    overflow: 'auto',
                    margin: 0,
                    padding: '12px 16px',
                    fontFamily: 'monospace',
                    fontSize: 11,
                    lineHeight: 1.6,
                    color: 'var(--text2)',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}>
                    {selectedFileContent}
                  </pre>
                </>
              ) : (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', fontSize: 12 }}>
                  Select a file to preview
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Rebuild bar */}
        <div style={{
          padding: '12px 16px',
          borderTop: '1px solid var(--glass-border)',
          display: 'flex',
          gap: 8,
          flexShrink: 0,
          background: 'var(--bg2)',
        }}>
          <textarea
            value={rebuildPrompt}
            onChange={e => setRebuildPrompt(e.target.value)}
            placeholder={project?.user_prompt ? `Rebuild with changes… (current: "${project.user_prompt.slice(0, 60)}…")` : 'Describe what you want to change or add…'}
            rows={1}
            style={{
              flex: 1,
              background: 'var(--glass)',
              border: '1px solid var(--glass-border)',
              borderRadius: 8,
              color: 'var(--text)',
              padding: '8px 12px',
              fontSize: 13,
              resize: 'none',
              fontFamily: 'inherit',
              outline: 'none',
            }}
            onKeyDown={e => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                startBuild(rebuildPrompt || project?.user_prompt || '', [compUrl1, compUrl2]);
              }
            }}
          />
          <input
            value={compUrl1}
            onChange={e => setCompUrl1(e.target.value)}
            placeholder="Competitor URL 1"
            style={{ width: 140, background: 'var(--glass)', border: '1px solid var(--glass-border)', borderRadius: 8, color: 'var(--text)', padding: '8px 10px', fontSize: 12, fontFamily: 'inherit', outline: 'none' }}
          />
          <input
            value={compUrl2}
            onChange={e => setCompUrl2(e.target.value)}
            placeholder="Competitor URL 2"
            style={{ width: 140, background: 'var(--glass)', border: '1px solid var(--glass-border)', borderRadius: 8, color: 'var(--text)', padding: '8px 10px', fontSize: 12, fontFamily: 'inherit', outline: 'none' }}
          />
          <button
            onClick={() => startBuild(rebuildPrompt || project?.user_prompt || '', [compUrl1, compUrl2])}
            disabled={isBuilding}
            style={{
              background: isBuilding ? 'var(--glass)' : 'linear-gradient(135deg, var(--amber), #e8b882)',
              color: isBuilding ? 'var(--text3)' : '#000',
              border: 'none',
              padding: '8px 20px',
              borderRadius: 8,
              cursor: isBuilding ? 'not-allowed' : 'pointer',
              fontWeight: 700,
              fontSize: 13,
              whiteSpace: 'nowrap',
              transition: 'all 0.2s',
            }}
          >
            {isBuilding ? '⟳ Building…' : '⚡ Build It'}
          </button>
        </div>
      </main>
    </div>
  );
}
