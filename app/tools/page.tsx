'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';

// ── Agent Panel ───────────────────────────────────────────────

interface AgentStep {
  type: 'think' | 'browse' | 'result' | 'error';
  content: string;
  screenshot?: string;
}

function AgentPanel() {
  const [task, setTask] = useState('');
  const [steps, setSteps] = useState<AgentStep[]>([]);
  const [running, setRunning] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [steps.length]);

  const runAgent = async () => {
    if (!task.trim() || running) return;
    setRunning(true);
    setSteps([]);

    try {
      const res = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task }),
      });

      if (!res.body) throw new Error('No stream');
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() ?? '';
        for (const chunk of lines) {
          const data = chunk.replace(/^data: /, '').trim();
          if (data === '[DONE]') break;
          try {
            const step = JSON.parse(data) as AgentStep;
            setSteps(prev => [...prev, step]);
          } catch { /* */ }
        }
      }
    } catch (e) {
      setSteps(prev => [...prev, { type: 'error', content: String(e) }]);
    }

    setRunning(false);
  };

  const stepColor = (type: string) => ({
    think: 'var(--amber)', browse: 'var(--blue)', result: 'var(--green)', error: 'var(--red)',
  }[type] ?? 'var(--text2)');

  const stepIcon = (type: string) => ({ think: '◆', browse: '◎', result: '✓', error: '✗' }[type] ?? '·');

  return (
    <div style={{ background: 'var(--glass)', border: '1px solid var(--glass-border)', borderRadius: 14, overflow: 'hidden', display: 'flex', flexDirection: 'column', height: 480 }}>
      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 14, fontWeight: 700 }}>Browser Agent</span>
        <span style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 'auto' }}>Claude controls Chrome autonomously</span>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', fontFamily: 'monospace', fontSize: 12, lineHeight: 1.7 }}>
        {steps.length === 0 && !running && (
          <div style={{ color: 'var(--text3)', fontStyle: 'italic' }}>Give the agent a task — it will browse the web autonomously.</div>
        )}
        {steps.map((s, i) => (
          <div key={i} style={{ marginBottom: 6 }}>
            <div style={{ display: 'flex', gap: 8, color: stepColor(s.type) }}>
              <span>{stepIcon(s.type)}</span>
              <span style={{ color: 'var(--text)' }}>{s.content}</span>
            </div>
            {s.screenshot && (
              <img src={`data:image/png;base64,${s.screenshot}`} alt="Screenshot" style={{ maxWidth: '100%', borderRadius: 6, marginTop: 6, border: '1px solid var(--glass-border)' }} />
            )}
          </div>
        ))}
        {running && (
          <div style={{ display: 'flex', gap: 4, alignItems: 'center', color: 'var(--amber)' }}>
            <span>⟳</span> <span>Agent working…</span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <div style={{ padding: '12px 16px', borderTop: '1px solid var(--glass-border)', display: 'flex', gap: 8 }}>
        <input
          value={task}
          onChange={e => setTask(e.target.value)}
          placeholder="e.g. Go to example.com and tell me the page title…"
          onKeyDown={e => { if (e.key === 'Enter') runAgent(); }}
          style={{ flex: 1, background: 'var(--glass)', border: '1px solid var(--glass-border)', borderRadius: 8, color: 'var(--text)', padding: '8px 12px', fontSize: 13, fontFamily: 'inherit', outline: 'none' }}
        />
        <button
          onClick={runAgent}
          disabled={running}
          style={{ background: running ? 'var(--glass)' : 'var(--amber)', color: running ? 'var(--text3)' : '#000', border: 'none', borderRadius: 8, padding: '8px 16px', fontWeight: 700, fontSize: 13, cursor: running ? 'not-allowed' : 'pointer' }}
        >
          {running ? '⟳' : 'Run'}
        </button>
      </div>
    </div>
  );
}

// ── Browser Tools Panel ───────────────────────────────────────

function BrowserPanel() {
  const [action, setAction] = useState<'screenshot' | 'content' | 'scrape'>('screenshot');
  const [url, setUrl] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const [imageB64, setImageB64] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setResult(null);
    setImageB64(null);

    try {
      const res = await fetch('/api/browser', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, url }),
      });
      const data = await res.json() as { image?: string; content?: string; title?: string; url?: string };
      if (data.image) setImageB64(data.image);
      else setResult(JSON.stringify(data, null, 2));
    } catch (e) {
      setResult(String(e));
    }
    setLoading(false);
  };

  return (
    <div style={{ background: 'var(--glass)', border: '1px solid var(--glass-border)', borderRadius: 14, overflow: 'hidden', display: 'flex', flexDirection: 'column', height: 480 }}>
      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--glass-border)' }}>
        <span style={{ fontSize: 14, fontWeight: 700 }}>Browser Tools</span>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
        {/* Action tabs */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
          {(['screenshot', 'content', 'scrape'] as const).map(a => (
            <button
              key={a}
              onClick={() => setAction(a)}
              style={{ background: action === a ? 'rgba(212,165,116,0.15)' : 'var(--glass)', border: action === a ? '1px solid var(--amber)' : '1px solid var(--glass-border)', color: action === a ? 'var(--amber)' : 'var(--text2)', borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontSize: 12, textTransform: 'capitalize' }}
            >
              {a}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <input
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="https://example.com"
            onKeyDown={e => { if (e.key === 'Enter') run(); }}
            style={{ flex: 1, background: 'var(--glass)', border: '1px solid var(--glass-border)', borderRadius: 8, color: 'var(--text)', padding: '8px 12px', fontSize: 13, fontFamily: 'inherit', outline: 'none' }}
          />
          <button
            onClick={run}
            disabled={loading}
            style={{ background: loading ? 'var(--glass)' : 'var(--amber)', color: loading ? 'var(--text3)' : '#000', border: 'none', borderRadius: 8, padding: '8px 16px', fontWeight: 700, fontSize: 13, cursor: loading ? 'not-allowed' : 'pointer' }}
          >
            {loading ? '⟳' : 'Go'}
          </button>
        </div>

        {imageB64 && (
          <img src={`data:image/png;base64,${imageB64}`} alt="Screenshot" style={{ width: '100%', borderRadius: 8, border: '1px solid var(--glass-border)' }} />
        )}
        {result && (
          <pre style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--text2)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.5 }}>{result}</pre>
        )}
        {!imageB64 && !result && !loading && (
          <div style={{ color: 'var(--text3)', fontSize: 12, fontStyle: 'italic' }}>Enter a URL and run an action.</div>
        )}
      </div>
    </div>
  );
}

// ── G0DM0D3 Status ────────────────────────────────────────────

function GodmodePanel() {
  const [status, setStatus] = useState<'unknown' | 'online' | 'offline'>('unknown');
  const [checking, setChecking] = useState(false);

  const checkStatus = async () => {
    setChecking(true);
    try {
      const res = await fetch('/api/godmode/status');
      const data = await res.json() as { online: boolean };
      setStatus(data.online ? 'online' : 'offline');
    } catch {
      setStatus('offline');
    }
    setChecking(false);
  };

  useEffect(() => { checkStatus(); }, []);

  return (
    <div style={{ background: 'var(--glass)', border: '1px solid var(--glass-border)', borderRadius: 14, padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>G0DM0D3 Backend</h3>
          <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--text3)' }}>Optional LLM backend • OpenAI-compatible API</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: status === 'online' ? 'var(--green)' : status === 'offline' ? 'var(--red)' : 'var(--text3)', animation: status === 'unknown' ? 'pulse 1.5s infinite' : 'none' }} />
          <span style={{ fontSize: 12, color: 'var(--text2)', textTransform: 'capitalize' }}>{checking ? 'Checking…' : status}</span>
        </div>
      </div>

      {status === 'offline' && (
        <div style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '12px 14px', fontSize: 12, color: 'var(--text2)', lineHeight: 1.6 }}>
          <strong style={{ color: 'var(--red)' }}>Not running.</strong> Start G0DM0D3 locally:<br />
          <code style={{ color: 'var(--amber)', fontFamily: 'monospace', fontSize: 11, display: 'block', marginTop: 6 }}>
            git clone https://github.com/elder-plinius/G0DM0D3.git<br />
            cd G0DM0D3 &amp;&amp; docker build -t g0dm0d3-api .<br />
            docker run -p 7860:7860 -e OPENROUTER_API_KEY=your-key g0dm0d3-api
          </code>
        </div>
      )}

      {status === 'online' && (
        <div style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: 'var(--green)' }}>
          ✓ G0DM0D3 API is running at http://localhost:7860/v1<br />
          <span style={{ color: 'var(--text3)' }}>Available as an optional backend in the chat panel.</span>
        </div>
      )}

      <button onClick={checkStatus} disabled={checking} style={{ marginTop: 12, background: 'var(--glass)', border: '1px solid var(--glass-border)', color: 'var(--text2)', borderRadius: 6, padding: '6px 14px', fontSize: 12, cursor: checking ? 'not-allowed' : 'pointer' }}>
        {checking ? 'Checking…' : 'Refresh Status'}
      </button>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────

export default function ToolsPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', fontFamily: 'Inter, system-ui, sans-serif', display: 'flex' }}>
      {/* Sidebar */}
      <aside style={{ width: 220, borderRight: '1px solid var(--glass-border)', display: 'flex', flexDirection: 'column', position: 'fixed', top: 0, left: 0, bottom: 0, background: 'var(--bg)' }}>
        <div style={{ padding: '20px 16px', borderBottom: '1px solid var(--glass-border)' }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg, var(--amber), #e8b882)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 16, color: '#000' }}>M</div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--text)' }}>Mamour Media</div>
              <div style={{ fontSize: 10, color: 'var(--text3)' }}>AI Platform</div>
            </div>
          </Link>
        </div>

        <nav style={{ padding: '12px 8px' }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 6, textDecoration: 'none', color: 'var(--text2)', fontSize: 13 }}>
            <span>⊞</span> Dashboard
          </Link>
          <div style={{ background: 'rgba(212,165,116,0.1)', borderRadius: 6, padding: '8px 12px', color: 'var(--amber)', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, marginTop: 1 }}>
            <span>⚙</span> Tools
          </div>
        </nav>
      </aside>

      {/* Main */}
      <main style={{ flex: 1, marginLeft: 220, padding: '40px 48px' }}>
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ margin: '0 0 8px', fontSize: 26, fontWeight: 800 }}>Tools</h1>
          <p style={{ margin: 0, color: 'var(--text2)', fontSize: 14 }}>Autonomous browser agent, browser automation, and optional AI backends.</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
          <AgentPanel />
          <BrowserPanel />
        </div>

        <GodmodePanel />
      </main>
    </div>
  );
}
