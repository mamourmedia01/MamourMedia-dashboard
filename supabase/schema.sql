-- ─────────────────────────────────────────
-- Mamour Media — Master Dashboard Schema
-- Run this in Supabase → SQL Editor
-- ─────────────────────────────────────────

-- Projects table
create table if not exists projects (
  id           text primary key,
  name         text not null,
  subtitle     text,
  description  text,
  status       text default 'active',
  accent       text default '#d4a574',
  features     text[] default '{}',
  progress     integer default 0,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

-- Seed default projects
insert into projects (id, name, subtitle, description, status, accent, features, progress)
values
  (
    'cine-labs',
    'Cine Labs',
    'Cinema Labs — AI Content Studio',
    'End-to-end AI content automation studio. Script-to-screen pipeline with voice cloning, storyboarding, video generation, and character consistency.',
    'active',
    '#d4a574',
    array['Script & Content', 'Storyboard', 'Voice & Audio', 'Video Generation', 'Character Library', 'Pipeline Status'],
    65
  ),
  (
    'admanager',
    'AdManager',
    'AI Ad Platform',
    'AI-powered ad platform for campaign creation, targeting, A/B testing, and performance analytics at scale.',
    'active',
    '#60a5fa',
    array['Campaign Builder', 'A/B Testing', 'Analytics', 'Audience Targeting'],
    40
  )
on conflict (id) do nothing;

-- Chat messages table (Claude-Mem persistent history)
create table if not exists messages (
  id           uuid primary key default gen_random_uuid(),
  project_id   text references projects(id) on delete cascade,
  role         text not null check (role in ('user', 'assistant')),
  content      text not null,
  created_at   timestamptz default now()
);

-- Index for fast message lookup per project
create index if not exists messages_project_id_idx on messages(project_id, created_at desc);

-- Enable Row Level Security
alter table projects enable row level security;
alter table messages enable row level security;

-- Allow public read/write for now (tighten with auth later)
create policy "Public read projects"  on projects for select using (true);
create policy "Public read messages"  on messages for select using (true);
create policy "Public insert messages" on messages for insert with check (true);

-- ─────────────────────────────────────────────────────────────
-- AI Build Platform — Extended Schema (Phase 2)
-- Run AFTER the base schema above
-- ─────────────────────────────────────────────────────────────

-- Extend projects with build platform columns
alter table projects
  add column if not exists user_prompt        text,
  add column if not exists deployment_url     text,
  add column if not exists vercel_project_id  text,
  add column if not exists competitor_urls    text[] default '{}',
  add column if not exists build_count        integer default 0,
  add column if not exists last_build_at      timestamptz;

-- builds: one row per deploy attempt (retries each create a new row)
create table if not exists builds (
  id               uuid primary key default gen_random_uuid(),
  project_id       text not null references projects(id) on delete cascade,
  status           text not null default 'pending'
    check (status in ('pending','researching','generating','deploying','success','error')),
  attempt          integer not null default 1,
  vercel_deploy_id text,
  deployment_url   text,
  error_log        text,
  competitor_data  jsonb,
  file_count       integer default 0,
  created_at       timestamptz default now(),
  completed_at     timestamptz
);
create index if not exists builds_project_id_idx on builds(project_id, created_at desc);

-- build_events: persisted SSE stream log for replay after timeout
create table if not exists build_events (
  id         bigserial primary key,
  build_id   uuid not null references builds(id) on delete cascade,
  type       text not null check (type in (
    'start','research','think','generate','file','deploy','poll','fix','suggest','success','error'
  )),
  content    text not null,
  metadata   jsonb,
  created_at timestamptz default now()
);
create index if not exists build_events_build_id_idx on build_events(build_id, id asc);

-- project_files: generated source files per build
create table if not exists project_files (
  id         uuid primary key default gen_random_uuid(),
  build_id   uuid not null references builds(id) on delete cascade,
  project_id text not null references projects(id) on delete cascade,
  file_path  text not null,
  content    text not null,
  created_at timestamptz default now()
);
create index if not exists project_files_build_id_idx  on project_files(build_id);
create index if not exists project_files_project_id_idx on project_files(project_id, file_path);

-- RLS
alter table builds        enable row level security;
alter table build_events  enable row level security;
alter table project_files enable row level security;

create policy "Public builds"         on builds        for all using (true);
create policy "Public build_events"   on build_events  for all using (true);
create policy "Public project_files"  on project_files for all using (true);
