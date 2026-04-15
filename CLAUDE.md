# Mamour Media Dashboard — Claude Code Instructions

## Project
Mamour Media Master Dashboard — an autonomous AI development platform at mamourmedia.com.
One Vercel project only. Do not create a second dashboard project on Vercel.
When users build apps *inside* the platform via the build engine, those get their own Vercel projects (named `mm-{projectId}-{timestamp}`).

## Stack
- Next.js 15 App Router, TypeScript strict, Tailwind CSS v3
- Supabase (projects, builds, build_events, project_files tables)
- Anthropic claude-sonnet-4-6 with prompt caching
- Vercel Files API for generated-app deployments
- Browserless BaaS v1 (`?token=` query param auth, NOT Bearer header)
- G0DM0D3 optional LLM backend at http://localhost:7860/v1 (OpenAI-compatible)

## Branch
All development goes to: `claude/setup-dashboard-repo-Ebt7T`
Never push to a different branch without explicit permission.

## Key rules
- Before asking the user to do anything, try to do it yourself first.
- Only ask when it is genuinely impossible to proceed without user input.
- Do not create duplicate Vercel projects for the dashboard itself.
- Keep the build engine autonomous: research → generate → deploy → fix (3 attempts) → bug scan → suggestions.

---

## gstack Skills

Use the following skill routing when the matching trigger is detected. These skills live at `~/.claude/skills/gstack/`.

### /browse
**Trigger:** user asks to visit, read, or research a URL  
**Skill:** `~/.claude/skills/gstack/browse`  
Use Browserless to screenshot + extract content, then summarize.

### /ship
**Trigger:** user says "ship it", "deploy", "push live", or similar  
**Skill:** `~/.claude/skills/gstack/ship`  
Runs pre-flight checks, commits staged changes, pushes branch, triggers Vercel deploy.

### /autoplan
**Trigger:** user describes a feature or asks "how should we build X"  
**Skill:** `~/.claude/skills/gstack/autoplan`  
Generates a phased implementation plan before writing any code.

### /do
**Trigger:** user says "execute the plan", "do it", or "carry out the plan"  
**Skill:** `~/.claude/skills/gstack/do`  
Executes a previously created plan using subagents in phases.

### /review
**Trigger:** user says "review this", "check my code", "audit the PR"  
**Skill:** `~/.claude/skills/gstack/review`  
Performs a code review focusing on correctness, security, and performance.

### /security-review
**Trigger:** user asks for a security audit or "check for vulnerabilities"  
**Skill:** `~/.claude/skills/gstack/security-review`  
Runs OWASP-focused security review on changed files.

### /simplify
**Trigger:** user says "clean this up", "simplify", "refactor for quality"  
**Skill:** `~/.claude/skills/gstack/simplify`  
Reviews changed code for reuse, quality, and efficiency, then fixes issues found.

### /insights
**Trigger:** user asks "how am I using Claude", "show my session stats", or "insights"  
**Skill:** `~/.claude/skills/gstack/insights`  
Generates a report analysing Claude Code session usage.

### /mem-search
**Trigger:** user asks "did we solve this before?", "how did we do X last time?"  
**Skill:** `~/.claude/skills/gstack/mem-search`  
Searches persistent cross-session memory for relevant past work.

### /timeline-report
**Trigger:** user asks for "project history", "development journey", or "timeline report"  
**Skill:** `~/.claude/skills/gstack/timeline-report`  
Generates a narrative report of the project's full development history.

### /init
**Trigger:** user says "init CLAUDE.md", "document the codebase", "create project docs"  
**Skill:** `~/.claude/skills/gstack/init`  
Initialises or refreshes CLAUDE.md with codebase documentation.
