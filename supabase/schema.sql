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
