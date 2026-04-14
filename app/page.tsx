"use client";

import { useState } from "react";

const projects = [
  { id: "cine-labs", name: "Cine Labs" },
  { id: "admanager", name: "AdManager" },
  { id: "handle", name: "Handle" },
  { id: "tax-platform", name: "Tax Platform" },
];

const features = [
  {
    icon: "📝",
    title: "Script & Content",
    description: "Write, expand, manage scripts",
  },
  {
    icon: "🎬",
    title: "Storyboard",
    description: "Visual keyframes & shot lists",
  },
  {
    icon: "🎙️",
    title: "Voice & Audio",
    description: "TTS, voice cloning, SFX",
  },
  {
    icon: "🎥",
    title: "Video Generation",
    description: "Text-to-video, I2V, compositing",
  },
  {
    icon: "👥",
    title: "Character Library",
    description: "Face locks, consistency engine",
  },
  {
    icon: "⚡",
    title: "Pipeline Status",
    description: "Batch jobs, queue monitoring",
  },
];

const activeSkills = [
  "GrowthBook",
  "PostHog",
  "Fire Enrich",
  "HubSpot MCP",
  "Salesforce MCP",
];

const navItems = ["Dashboard", "Claude", "Settings"];

export default function Home() {
  const [activeProject, setActiveProject] = useState("admanager");
  const [activeNav, setActiveNav] = useState("Dashboard");

  const currentProject = projects.find((p) => p.id === activeProject);

  return (
    <div className="flex h-screen bg-gray-950 text-white overflow-hidden">
      {/* Sidebar */}
      <aside className="w-56 bg-gray-900 border-r border-gray-800 flex flex-col shrink-0">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-gray-800">
          <span className="text-lg font-bold tracking-tight text-white">
            Mamour Media
          </span>
        </div>

        {/* Nav */}
        <nav className="px-3 pt-4 space-y-0.5">
          {navItems.map((item) => (
            <button
              key={item}
              onClick={() => setActiveNav(item)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeNav === item
                  ? "bg-gray-800 text-white"
                  : "text-gray-400 hover:text-white hover:bg-gray-800"
              }`}
            >
              {item}
            </button>
          ))}
        </nav>

        {/* Projects */}
        <div className="px-3 pt-6 flex-1">
          <p className="px-3 pb-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Projects
          </p>
          <div className="space-y-0.5">
            {projects.map((project) => (
              <button
                key={project.id}
                onClick={() => setActiveProject(project.id)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                  activeProject === project.id
                    ? "bg-indigo-600 text-white font-medium"
                    : "text-gray-400 hover:text-white hover:bg-gray-800"
                }`}
              >
                {project.name}
              </button>
            ))}
            <button className="w-full text-left px-3 py-2 rounded-lg text-sm text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors">
              + New Project
            </button>
          </div>
        </div>

        {/* User */}
        <div className="px-4 py-4 border-t border-gray-800 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-sm font-bold shrink-0">
            M
          </div>
          <span className="text-sm text-gray-300 font-medium">Mamour</span>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col overflow-y-auto">
        {/* Header */}
        <header className="px-8 py-6 border-b border-gray-800 flex items-center justify-between shrink-0">
          <div>
            <h1 className="text-2xl font-bold text-white">
              {currentProject?.name ?? "Dashboard"}
            </h1>
            {activeProject === "admanager" && (
              <p className="text-sm text-gray-400 mt-0.5">AI Ad Platform</p>
            )}
          </div>
          <button className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
            Open Claude
          </button>
        </header>

        {/* Content */}
        <div className="px-8 py-8 flex-1">
          {/* Feature Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
            {features.map((feature) => (
              <button
                key={feature.title}
                className="text-left bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-gray-700 rounded-xl p-5 transition-all group"
              >
                <div className="text-2xl mb-3">{feature.icon}</div>
                <h3 className="text-sm font-semibold text-white group-hover:text-indigo-400 transition-colors">
                  {feature.title}
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  {feature.description}
                </p>
              </button>
            ))}
          </div>

          {/* Active Skills */}
          <div>
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Active Skills
            </h2>
            <div className="flex flex-wrap gap-2">
              {activeSkills.map((skill) => (
                <span
                  key={skill}
                  className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-full text-xs font-medium text-gray-300"
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
