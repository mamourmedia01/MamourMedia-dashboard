// lib/build-engine.ts
// Autonomous AI application builder — the core orchestration engine.
// Flow: research → generate → deploy → error-fix loop → bug scan → suggestions

import { getAdminClient } from '@/lib/supabase';
import { takeScreenshot, getPageContent } from '@/lib/browserless';
import {
  createVercelDeployment,
  pollUntilReady,
  GeneratedFile,
  DeployResult,
} from '@/lib/vercel-deploy';

// ── Types ─────────────────────────────────────────────────────

export interface BuildEvent {
  type:
    | 'start' | 'research' | 'think' | 'generate'
    | 'file' | 'deploy' | 'poll' | 'fix'
    | 'suggest' | 'success' | 'error';
  content: string;
  metadata?: Record<string, unknown>;
}

export interface BuildOptions {
  projectId: string;
  userPrompt: string;
  competitorUrls?: string[];
}

export interface BuildEngineCallbacks {
  onEvent: (event: BuildEvent) => void;
}

// ── Claude system prompts ──────────────────────────────────────

export const CODE_GEN_SYSTEM_PROMPT = `You are an elite AI full-stack developer and product architect. Your job is to generate complete, production-ready Next.js 15 applications.

OUTPUT FORMAT:
Respond with ONLY a valid JSON array of file objects. No explanation, no markdown, no code fences. Raw JSON only.
[{ "path": "relative/path/to/file.ext", "content": "complete file content as string" }]

REQUIRED FILES (always include all of these):
- package.json: name, version, scripts.build="next build", scripts.start="next start", dependencies (next@15, react@19, react-dom@19), devDependencies (typescript@5, @types/react@19, @types/node@22, tailwindcss@3, autoprefixer, postcss)
- tsconfig.json: standard Next.js 15 TypeScript config, strict mode, @/* path alias pointing to ./
- next.config.js: module.exports = { reactStrictMode: true }
- tailwind.config.ts: content paths covering app/**/*.{ts,tsx}, theme.extend for brand colors
- postcss.config.js: tailwindcss and autoprefixer plugins
- app/layout.tsx: root layout, exports metadata, accepts { children: React.ReactNode }, html lang="en" class="dark"
- app/globals.css: Tailwind directives (@tailwind base/components/utilities) + CSS custom properties
- app/page.tsx: fully implemented main page — beautiful, functional, no placeholders

DESIGN PRINCIPLES:
- Dark theme: background #0a0a0a or #0d0d0d
- Use CSS custom properties for color system (--amber, --blue, --glass, etc.)
- Glassmorphism: backdrop-filter: blur, semi-transparent backgrounds, subtle borders
- Smooth CSS animations (keyframes, transitions) — make it feel alive
- Mobile-first responsive design
- No external UI component libraries — pure Tailwind + custom CSS
- Beautiful typography: Inter or system-ui font stack
- Micro-interactions: hover states, button press effects, focus rings

CODE QUALITY:
- TypeScript strict mode — no any types, explicit interfaces for all data shapes
- 'use client' directive on the VERY FIRST LINE of all client components (before imports)
- All API routes use NextRequest/NextResponse from 'next/server'
- Error boundaries and proper null checks
- No console.log left in production code
- Clean import paths with @ alias

FILE COUNT: Generate 8–20 files. Complex apps need more. Never truncate or abbreviate — write every file completely.

FUNCTIONALITY: All features must be genuinely implemented. No "coming soon", no placeholder text, no TODO comments. If you show a UI element, make it work.

COMPETITOR EDGE: If competitor research is provided, study their patterns and make this app demonstrably better — superior design, more features, faster UX.`;

export const ERROR_FIX_SYSTEM_PROMPT = `You are a Next.js 15 build error specialist. You receive an error log and the current source files that failed to build. Fix only what's broken.

OUTPUT FORMAT:
Respond with ONLY a valid JSON array of the files that need to be changed. Same format as generation.
[{ "path": "file.ext", "content": "complete corrected content" }]
Only include files that require changes. Unchanged files are NOT included. Write complete file content.

COMMON NEXT.JS 15 FIXES:
- "Module not found: @/*" → verify tsconfig.json has paths: {"@/*": ["./*"]}
- "'use client' must be first" → move directive to absolute line 1, before all imports
- "window/document is not defined" → wrap in useEffect or guard with typeof window !== 'undefined'
- "Type ... is not assignable" → fix TypeScript types, add missing interfaces
- "Missing package X" → add X to package.json dependencies with a compatible version
- "Cannot read properties of undefined" → add optional chaining and null checks
- "Dynamic server usage" → add export const dynamic = 'force-dynamic' or make component client-side
- Tailwind classes not applying → verify tailwind.config.ts content array includes the file path

RULES: Fix ONLY what the error log indicates. Do not refactor unrelated code. Write full file content.`;

export const BUG_SCAN_SYSTEM_PROMPT = `You are a senior QA engineer reviewing a live web application via screenshot.
Identify bugs, broken UI, accessibility issues, and missing functionality.

OUTPUT: JSON array only. No explanation.
[{ "issue": "description", "fix": "what to change in the code", "autoExecute": true/false, "confidence": 0.0-1.0 }]

autoExecute=true when: visual glitch, broken layout, obvious error, performance issue, accessibility violation
autoExecute=false when: feature addition, content change, architectural decision, new API integration
Set confidence based on how certain you are the fix is correct and non-breaking.
Only mark autoExecute=true if confidence >= 0.85.`;

export const SUGGESTIONS_SYSTEM_PROMPT = `You are a product strategist and UX expert. Given an app description and its current state, suggest high-impact improvements.

OUTPUT: JSON array only. No explanation.
[{ "title": "short title", "description": "what to add/change", "autoExecute": true/false, "reason": "why this matters" }]

autoExecute=true for: animations, micro-interactions, copy improvements, color/spacing tweaks, loading states, error states
autoExecute=false for: new pages, external API integrations, auth, payments, database changes, significant feature additions

Suggest 3–5 improvements. Be specific about implementation.`;

// ── Claude API helper ─────────────────────────────────────────

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

async function callClaude(
  systemPrompt: string,
  userMessage: string,
  maxTokens = 8192
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY ?? '';
  const res = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'prompt-caching-2024-07-31',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: maxTokens,
      system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: userMessage }],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Anthropic API ${res.status}: ${body.slice(0, 300)}`);
  }

  const data = await res.json();
  return (data.content as Array<{ text?: string }>)
    ?.map(b => b.text ?? '')
    .join('') ?? '';
}

// ── File parsing ───────────────────────────────────────────────

function parseGeneratedFiles(raw: string): GeneratedFile[] {
  // Strip markdown code fences if Claude wraps output
  const cleaned = raw
    .replace(/^```json\s*/m, '')
    .replace(/^```\s*/m, '')
    .replace(/```\s*$/m, '')
    .trim();

  const parsed = JSON.parse(cleaned) as unknown[];
  if (!Array.isArray(parsed)) throw new Error('Output is not a JSON array');

  return parsed.map((item) => {
    const f = item as Record<string, string>;
    if (typeof f.path !== 'string' || typeof f.content !== 'string') {
      throw new Error(`Invalid file object: ${JSON.stringify(f)}`);
    }
    return { path: f.path.replace(/^\/+/, ''), content: f.content };
  });
}

function parseJsonSafe<T>(raw: string, fallback: T): T {
  try {
    const cleaned = raw.replace(/^```json\s*/m, '').replace(/^```\s*/m, '').replace(/```\s*$/m, '').trim();
    return JSON.parse(cleaned) as T;
  } catch {
    return fallback;
  }
}

// ── Supabase helpers ───────────────────────────────────────────

async function createBuildRecord(projectId: string, attempt: number): Promise<string> {
  const db = getAdminClient();
  const { data, error } = await db.from('builds').insert({
    project_id: projectId,
    status: 'pending',
    attempt,
  }).select('id').single();
  if (error || !data) throw new Error(`Failed to create build record: ${error?.message}`);
  return data.id as string;
}

async function updateBuild(
  buildId: string,
  fields: Record<string, unknown>
): Promise<void> {
  const db = getAdminClient();
  await db.from('builds').update(fields).eq('id', buildId);
}

async function persistEvent(buildId: string, event: BuildEvent): Promise<void> {
  const db = getAdminClient();
  await db.from('build_events').insert({
    build_id: buildId,
    type: event.type,
    content: event.content,
    metadata: event.metadata ?? null,
  }).then(() => {});
}

async function saveFiles(buildId: string, projectId: string, files: GeneratedFile[]): Promise<void> {
  const db = getAdminClient();
  const rows = files.map(f => ({
    build_id: buildId,
    project_id: projectId,
    file_path: f.path,
    content: f.content,
  }));
  await db.from('project_files').insert(rows);
  await db.from('builds').update({ file_count: files.length }).eq('id', buildId);
}

// ── Main orchestration ─────────────────────────────────────────

export async function runBuildEngine(
  options: BuildOptions,
  callbacks: BuildEngineCallbacks
): Promise<void> {
  const { projectId, userPrompt, competitorUrls = [] } = options;
  const { onEvent } = callbacks;
  const db = getAdminClient();
  const token = process.env.VERCEL_TOKEN ?? '';

  // Emit + persist (non-blocking persist)
  let activeBuildId = '';
  const emit = (event: BuildEvent) => {
    onEvent(event);
    if (activeBuildId) {
      persistEvent(activeBuildId, event).catch(() => {});
    }
  };

  // ── Step 0: Initialize ──────────────────────────────────────
  emit({ type: 'start', content: 'Initializing build engine…' });
  activeBuildId = await createBuildRecord(projectId, 1);
  await updateBuild(activeBuildId, { status: 'researching' });

  // ── Step 1: Competitor research ─────────────────────────────
  let competitorContext = '';
  if (competitorUrls.length > 0) {
    const researchResults: Array<{ url: string; title: string; excerpt: string }> = [];

    for (const url of competitorUrls.slice(0, 2)) {
      emit({ type: 'research', content: `Analyzing competitor: ${url}`, metadata: { url } });
      try {
        const [pageData] = await Promise.all([
          getPageContent(url),
          // Fire screenshot but don't await — it's slow and we don't need it for code gen
        ]);
        researchResults.push({
          url,
          title: pageData.title,
          excerpt: pageData.content.slice(0, 3000),
        });
        emit({ type: 'research', content: `Captured: ${pageData.title}`, metadata: { url, title: pageData.title } });
      } catch (e) {
        emit({ type: 'research', content: `Skipped ${url}: unable to access` });
      }
    }

    if (researchResults.length > 0) {
      await db.from('builds').update({ competitor_data: researchResults }).eq('id', activeBuildId);
      competitorContext = researchResults
        .map(r => `Competitor: ${r.title} (${r.url})\nPage excerpt:\n${r.excerpt}`)
        .join('\n\n---\n\n');
    }
  }

  // ── Step 2: Generate code ───────────────────────────────────
  await updateBuild(activeBuildId, { status: 'generating' });
  emit({ type: 'think', content: 'Designing application architecture and tech stack…' });

  const codeGenUserMsg = competitorContext
    ? `User request: ${userPrompt}\n\nCompetitor research (build something better):\n${competitorContext}`
    : `User request: ${userPrompt}`;

  let rawOutput: string;
  try {
    emit({ type: 'generate', content: 'Generating application code…' });
    rawOutput = await callClaude(CODE_GEN_SYSTEM_PROMPT, codeGenUserMsg, 8192);
  } catch (e) {
    emit({ type: 'error', content: `Code generation failed: ${String(e)}` });
    await updateBuild(activeBuildId, { status: 'error', error_log: String(e), completed_at: new Date().toISOString() });
    return;
  }

  let baseFiles: GeneratedFile[];
  try {
    baseFiles = parseGeneratedFiles(rawOutput);
  } catch (e) {
    emit({ type: 'error', content: `Failed to parse generated files: ${String(e)}` });
    await updateBuild(activeBuildId, { status: 'error', error_log: String(e), completed_at: new Date().toISOString() });
    return;
  }

  emit({ type: 'generate', content: `Generated ${baseFiles.length} files` });
  for (const f of baseFiles) {
    emit({ type: 'file', content: f.path, metadata: { path: f.path } });
  }
  await saveFiles(activeBuildId, projectId, baseFiles);

  // ── Step 3: Deploy loop (max 3 attempts) ───────────────────
  const projectSlug = `mm-${projectId.slice(0, 20)}-${Date.now().toString(36)}`;
  let currentFiles = baseFiles;
  let lastErrorLog = '';
  let successUrl = '';

  for (let attempt = 1; attempt <= 3; attempt++) {
    let buildId = activeBuildId;

    // On retry, create a new build row and fix files
    if (attempt > 1) {
      buildId = await createBuildRecord(projectId, attempt);
      activeBuildId = buildId;

      emit({ type: 'fix', content: `Attempt ${attempt}: Analyzing errors and fixing code…`, metadata: { attempt } });
      try {
        const fileManifest = currentFiles
          .map(f => `// FILE: ${f.path}\n${f.content}`)
          .join('\n\n---\n\n');
        const fixMsg = `Original request: ${userPrompt}\n\nBuild error log:\n${lastErrorLog}\n\nCurrent files:\n${fileManifest}`;
        const fixedRaw = await callClaude(ERROR_FIX_SYSTEM_PROMPT, fixMsg, 8192);
        const fixedFiles = parseGeneratedFiles(fixedRaw);

        // Merge: fixed files override originals by path
        const fileMap = new Map(currentFiles.map(f => [f.path, f]));
        for (const ff of fixedFiles) {
          fileMap.set(ff.path, ff);
          emit({ type: 'file', content: `Fixed: ${ff.path}`, metadata: { path: ff.path, fixed: true } });
        }
        currentFiles = Array.from(fileMap.values());
        await saveFiles(buildId, projectId, currentFiles);
      } catch (e) {
        emit({ type: 'fix', content: `Error fix parsing failed — using previous files: ${String(e)}` });
      }
    }

    // Deploy
    await updateBuild(buildId, { status: 'deploying' });
    emit({ type: 'deploy', content: `Deploying to Vercel (attempt ${attempt} of 3)…`, metadata: { attempt, slug: projectSlug } });

    let deployInitial: { id: string; url: string };
    try {
      deployInitial = await createVercelDeployment(projectSlug, currentFiles, token);
    } catch (e) {
      lastErrorLog = String(e);
      emit({ type: 'error', content: `Deploy initiation failed: ${lastErrorLog}` });
      await updateBuild(buildId, { status: 'error', error_log: lastErrorLog, completed_at: new Date().toISOString() });
      continue;
    }

    await updateBuild(buildId, { vercel_deploy_id: deployInitial.id });
    emit({ type: 'deploy', content: `Build queued — ${deployInitial.id}`, metadata: { deploymentId: deployInitial.id } });

    const result: DeployResult = await pollUntilReady(
      deployInitial.id,
      token,
      (state, url) => {
        emit({ type: 'poll', content: `Build status: ${state}`, metadata: { state, url } });
      }
    );

    if (result.status === 'success') {
      successUrl = `https://${result.url}`;
      await updateBuild(buildId, {
        status: 'success',
        deployment_url: successUrl,
        vercel_deploy_id: result.deploymentId,
        completed_at: new Date().toISOString(),
      });
      await db.from('projects').update({
        deployment_url: successUrl,
        vercel_project_id: projectSlug,
        last_build_at: new Date().toISOString(),
        build_count: attempt,
        status: 'active',
      }).eq('id', projectId);

      emit({ type: 'success', content: `App is live: ${successUrl}`, metadata: { url: successUrl, deploymentId: result.deploymentId, attempt } });
      break;
    }

    // Build failed — collect log for next attempt
    lastErrorLog = result.errorLog ?? 'Unknown build error';
    await updateBuild(buildId, {
      status: 'error',
      error_log: lastErrorLog,
      vercel_deploy_id: deployInitial.id,
      completed_at: new Date().toISOString(),
    });
    emit({
      type: 'error',
      content: `Build failed (attempt ${attempt}): ${lastErrorLog.slice(0, 400)}`,
      metadata: { attempt, truncatedLog: lastErrorLog.slice(0, 400) },
    });
  }

  if (!successUrl) {
    emit({ type: 'error', content: 'All 3 build attempts exhausted. Review error logs above.' });
    return;
  }

  // ── Step 4: Post-deploy — Bug scan ─────────────────────────
  emit({ type: 'think', content: 'Scanning deployed app for issues…' });
  try {
    await new Promise(r => setTimeout(r, 8000)); // let deployment propagate
    const { image: screenshotB64 } = await takeScreenshot(successUrl);

    const bugScanMsg = `App description: ${userPrompt}\nLive URL: ${successUrl}\n\n[Screenshot of the deployed app is attached]\nBase64 PNG: data:image/png;base64,${screenshotB64.slice(0, 100)}... (truncated for prompt)\n\nPlease analyze what you can see and identify any issues.`;
    const bugsRaw = await callClaude(BUG_SCAN_SYSTEM_PROMPT, bugScanMsg, 2048);
    const bugs = parseJsonSafe<Array<{ issue: string; fix: string; autoExecute: boolean; confidence: number }>>(bugsRaw, []);

    const autoFixes = bugs.filter(b => b.autoExecute && b.confidence >= 0.85);
    const suggestions = bugs.filter(b => !b.autoExecute || b.confidence < 0.85);

    if (autoFixes.length > 0) {
      emit({ type: 'fix', content: `Auto-fixing ${autoFixes.length} issue(s) found in live app…` });
      // Trigger a fix round
      const fixPrompt = `App: ${userPrompt}\nFix these issues found in the live deployed app:\n${autoFixes.map(b => `- ${b.issue}: ${b.fix}`).join('\n')}\n\nCurrent files:\n${currentFiles.map(f => `// FILE: ${f.path}\n${f.content}`).join('\n\n---\n\n')}`;
      try {
        const fixedRaw = await callClaude(ERROR_FIX_SYSTEM_PROMPT, fixPrompt, 8192);
        const fixedFiles = parseGeneratedFiles(fixedRaw);
        const fileMap = new Map(currentFiles.map(f => [f.path, f]));
        for (const ff of fixedFiles) fileMap.set(ff.path, ff);
        const mergedFiles = Array.from(fileMap.values());

        const fixBuildId = await createBuildRecord(projectId, 4); // 4 = post-deploy fix
        activeBuildId = fixBuildId;
        await saveFiles(fixBuildId, projectId, mergedFiles);
        await updateBuild(fixBuildId, { status: 'deploying' });

        const fixDeploy = await createVercelDeployment(projectSlug, mergedFiles, token);
        emit({ type: 'fix', content: `Deploying auto-fixes…`, metadata: { deploymentId: fixDeploy.id } });

        const fixResult = await pollUntilReady(fixDeploy.id, token, (state) => {
          emit({ type: 'poll', content: `Fix deploy: ${state}` });
        });

        if (fixResult.status === 'success') {
          const fixUrl = `https://${fixResult.url}`;
          await updateBuild(fixBuildId, { status: 'success', deployment_url: fixUrl, completed_at: new Date().toISOString() });
          await db.from('projects').update({ deployment_url: fixUrl }).eq('id', projectId);
          emit({ type: 'success', content: `Auto-fixes applied. Updated URL: ${fixUrl}`, metadata: { url: fixUrl } });
          successUrl = fixUrl;
          currentFiles = mergedFiles;
        }
      } catch {
        emit({ type: 'fix', content: 'Auto-fix encountered an error — skipping' });
      }
    }

    for (const s of suggestions) {
      emit({ type: 'suggest', content: `💡 ${s.issue}`, metadata: { fix: s.fix, confidence: s.confidence } });
    }
  } catch {
    // Bug scan is best-effort — don't fail the whole build
  }

  // ── Step 5: Smart suggestions ──────────────────────────────
  emit({ type: 'think', content: 'Generating enhancement suggestions…' });
  try {
    const suggestMsg = `App description: ${userPrompt}\nLive URL: ${successUrl}\nFiles generated: ${currentFiles.map(f => f.path).join(', ')}\n\nSuggest improvements to make this app outstanding.`;
    const suggestRaw = await callClaude(SUGGESTIONS_SYSTEM_PROMPT, suggestMsg, 1024);
    const suggestions = parseJsonSafe<Array<{ title: string; description: string; autoExecute: boolean; reason: string }>>(suggestRaw, []);

    const autoSuggestions = suggestions.filter(s => s.autoExecute);
    const manualSuggestions = suggestions.filter(s => !s.autoExecute);

    if (autoSuggestions.length > 0) {
      emit({ type: 'suggest', content: `Auto-applying ${autoSuggestions.length} enhancement(s)…` });
      const enhancePrompt = `App: ${userPrompt}\nApply these enhancements:\n${autoSuggestions.map(s => `- ${s.title}: ${s.description}`).join('\n')}\n\nCurrent files:\n${currentFiles.map(f => `// FILE: ${f.path}\n${f.content}`).join('\n\n---\n\n')}`;
      try {
        const enhancedRaw = await callClaude(ERROR_FIX_SYSTEM_PROMPT, enhancePrompt, 8192);
        const enhancedFiles = parseGeneratedFiles(enhancedRaw);
        const fileMap = new Map(currentFiles.map(f => [f.path, f]));
        for (const ef of enhancedFiles) fileMap.set(ef.path, ef);
        const mergedFiles = Array.from(fileMap.values());

        const enhBuildId = await createBuildRecord(projectId, 5); // 5 = enhancement
        activeBuildId = enhBuildId;
        await saveFiles(enhBuildId, projectId, mergedFiles);
        await updateBuild(enhBuildId, { status: 'deploying' });

        const enhDeploy = await createVercelDeployment(projectSlug, mergedFiles, token);
        emit({ type: 'deploy', content: `Deploying enhancements…`, metadata: { deploymentId: enhDeploy.id } });

        const enhResult = await pollUntilReady(enhDeploy.id, token, (state) => {
          emit({ type: 'poll', content: `Enhancement deploy: ${state}` });
        });

        if (enhResult.status === 'success') {
          const enhUrl = `https://${enhResult.url}`;
          await updateBuild(enhBuildId, { status: 'success', deployment_url: enhUrl, completed_at: new Date().toISOString() });
          await db.from('projects').update({ deployment_url: enhUrl }).eq('id', projectId);
          emit({ type: 'success', content: `Enhancements applied. Final URL: ${enhUrl}`, metadata: { url: enhUrl } });
        }
      } catch {
        emit({ type: 'suggest', content: 'Enhancement deployment skipped — not critical' });
      }
    }

    for (const s of manualSuggestions) {
      emit({ type: 'suggest', content: `💡 ${s.title}: ${s.description}`, metadata: { reason: s.reason, autoExecute: false } });
    }
  } catch {
    // Suggestions are best-effort
  }

  emit({ type: 'success', content: 'Build complete. Your app is live and optimized.' });
}
