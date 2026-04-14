"use client";

import { useState, useRef, useEffect } from "react";
import { supabase } from "@/lib/supabase";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface Project {
  id: string;
  name: string;
  subtitle: string;
  description: string;
  status: string;
  accent: string;
  features: string[];
  progress: number;
}

const defaultProjects: Project[] = [
  {
    id: "cine-labs",
    name: "Cine Labs",
    subtitle: "Cinema Labs — AI Content Studio",
    description:
      "End-to-end AI content automation studio. Script-to-screen pipeline with voice cloning, storyboarding, video generation, and character consistency.",
    status: "active",
    accent: "#d4a574",
    features: ["Script & Content", "Storyboard", "Voice & Audio", "Video Generation", "Character Library", "Pipeline Status"],
    progress: 65,
  },
  {
    id: "admanager",
    name: "AdManager",
    subtitle: "AI Ad Platform",
    description:
      "AI-powered ad platform for campaign creation, targeting, A/B testing, and performance analytics at scale.",
    status: "active",
    accent: "#60a5fa",
    features: ["Campaign Builder", "A/B Testing", "Analytics", "Audience Targeting"],
    progress: 40,
  },
];

const activeSkills = [
  "vercel-composition-patterns", "deploy-to-vercel", "vercel-react-best-practices",
  "mem-search", "knowledge-agent", "make-plan", "smart-explore",
  "web-design-guidelines", "vercel-react-view-transitions", "vercel-cli-with-tokens",
  "timeline-report", "do", "claude-code-plugin-release", "vercel-react-native-skills",
];

export default function Home() {
  const [projects, setProjects] = useState<Project[]>(defaultProjects);
  const [activeProject, setActiveProject] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load projects from Supabase
  useEffect(() => {
    supabase
      .from("projects")
      .select("*")
      .order("created_at")
      .then(({ data }) => {
        if (data && data.length > 0) setProjects(data as Project[]);
      });
  }, []);

  // Load chat history when project changes
  useEffect(() => {
    if (!chatOpen) return;
    fetch(`/api/messages${activeProject ? `?project_id=${activeProject}` : ""}`)
      .then((r) => r.json())
      .then(({ messages: saved }) => {
        if (saved?.length) setMessages(saved);
        else setMessages([]);
      })
      .catch(() => setMessages([]));
  }, [activeProject, chatOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput("");
    const updatedMessages = [...messages, { role: "user" as const, content: userMsg }];
    setMessages(updatedMessages);
    setLoading(true);

    // Persist user message
    fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project_id: activeProject, role: "user", content: userMsg }),
    });

    try {
      const currentProject = projects.find((p) => p.id === activeProject);
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: updatedMessages,
          systemPrompt: `You are the AI operating system for Mamour Media's master dashboard at mamourmedia.com. You replace Emergent AI as the central platform. ${
            currentProject
              ? `The user is currently viewing the ${currentProject.name} project (${currentProject.subtitle}).`
              : "The user is on the main dashboard."
          } You have access to 14 active agent skills including mem-search, knowledge-agent, make-plan, smart-explore, and deploy-to-vercel. Help the user build, automate, and execute tasks across their projects: Cine Labs (AI content automation studio) and AdManager (AI ad platform). Be concise and action-oriented.`,
        }),
      });
      const data = await res.json();
      setMessages((prev) => [...prev, { role: "assistant", content: data.content }]);

      // Persist assistant message
      fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: activeProject, role: "assistant", content: data.content }),
      });
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Error connecting to Claude." }]);
    }
    setLoading(false);
  };

  return (
    <div className="app">
      {/* ── Sidebar ── */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-mark" />
          <span className="logo-text">Mamour Media</span>
        </div>
        <nav className="sidebar-nav">
          <button className="nav-item active"><span>Dashboard</span></button>
          <button className="nav-item"><span>Settings</span></button>
        </nav>
        <div className="sidebar-projects">
          <p className="sidebar-section-label">Projects</p>
          {projects.map((p) => (
            <button
              key={p.id}
              onClick={() => setActiveProject(p.id === activeProject ? null : p.id)}
              className={`project-item ${activeProject === p.id ? "active" : ""}`}
            >
              <div className="project-dot" style={{ background: p.accent }} />
              <span>{p.name}</span>
            </button>
          ))}
          <button className="project-item add-project"><span>+ New Project</span></button>
        </div>
        <div className="sidebar-footer">
          <div className="user-badge">
            <div className="user-avatar">M</div>
            <span style={{ fontSize: 13, color: "var(--text2)" }}>Mamour</span>
          </div>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className={`main-content ${chatOpen ? "chat-open" : ""}`}>
        <div className="content-header">
          <div>
            <h1 className="page-title">Mamour Media</h1>
            <p className="page-sub">AI Operating Platform — All projects launch from here</p>
          </div>
          <button className="btn-chat-toggle" onClick={() => setChatOpen(!chatOpen)}>
            {chatOpen ? "✕ Close Claude" : "◆ Open Claude"}
          </button>
        </div>

        {/* Project Cards */}
        <div className="dashboard-grid">
          {projects.map((p) => (
            <div
              key={p.id}
              className="project-card glass"
              style={{ "--accent": p.accent } as React.CSSProperties}
              onClick={() => setActiveProject(p.id === activeProject ? null : p.id)}
            >
              <div className="card-header">
                <span className="card-title">{p.name}</span>
                <span className={`status-badge ${p.status}`}>{p.status}</span>
              </div>
              <p style={{ fontSize: 11, color: p.accent, marginBottom: 6, fontWeight: 500 }}>
                {p.subtitle}
              </p>
              <p className="card-desc">{p.description}</p>
              <div className="card-skills">
                {p.features.slice(0, 3).map((f) => (
                  <span key={f} className="skill-tag">{f}</span>
                ))}
                {p.features.length > 3 && (
                  <span className="skill-tag more">+{p.features.length - 3}</span>
                )}
              </div>
              <div className="card-progress">
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{ width: `${p.progress}%`, background: `linear-gradient(90deg, ${p.accent}, ${p.accent}88)` }}
                  />
                </div>
                <span className="progress-label">{p.progress}%</span>
              </div>
            </div>
          ))}
          <button className="project-card add-card glass" style={{ cursor: "pointer" }}>
            <span style={{ fontSize: 28 }}>+</span>
            <span style={{ fontSize: 13 }}>New Project</span>
          </button>
        </div>

        {/* Active Skills */}
        <div className="detail-section" style={{ marginTop: 36 }}>
          <p className="detail-label">Active Skills ({activeSkills.length})</p>
          <div className="skills-grid">
            {activeSkills.map((s) => (
              <div key={s} className="skill-card glass">
                <span>⚡</span>
                <span>{s}</span>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* ── Claude Chat Panel ── */}
      {chatOpen && (
        <div className="chat-panel glass-dark">
          <div className="chat-header">
            <div className="chat-title">
              ◆ Claude
              {activeProject && (
                <span className="chat-context" style={{ color: "var(--text3)", marginLeft: 6 }}>
                  · {projects.find((p) => p.id === activeProject)?.name}
                </span>
              )}
            </div>
            <button className="chat-close" onClick={() => setChatOpen(false)}>✕</button>
          </div>
          <div className="chat-messages">
            {messages.length === 0 ? (
              <div className="chat-empty">
                <span style={{ fontSize: 32 }}>◆</span>
                <span>Ask Claude anything</span>
                <span style={{ fontSize: 12, color: "var(--text3)" }}>Build · Automate · Execute</span>
              </div>
            ) : (
              messages.map((m, i) => (
                <div key={i} className={`chat-msg ${m.role}`}>
                  <div className="msg-bubble">{m.content}</div>
                </div>
              ))
            )}
            {loading && (
              <div className="chat-msg assistant">
                <div className="msg-bubble typing"><span /><span /><span /></div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
          <div className="chat-input-area">
            <textarea
              className="chat-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              placeholder="Message Claude..."
              rows={1}
            />
            <button className="chat-send" onClick={sendMessage} disabled={loading || !input.trim()}>↑</button>
          </div>
        </div>
      )}
    </div>
  );
}
