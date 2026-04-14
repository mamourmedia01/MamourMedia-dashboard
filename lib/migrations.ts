import { createClient } from '@supabase/supabase-js';

async function safeRpc(supabase: ReturnType<typeof createClient>, query: string) {
  try {
    await supabase.rpc('run_sql', { query });
  } catch {
    // ignore — table may already exist
  }
}

export async function runMigrations() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.warn('[migrations] Skipping — SUPABASE_SERVICE_ROLE_KEY not set');
    return;
  }

  const supabase = createClient(url, key);

  // ── Projects table ──
  await safeRpc(supabase, `
    create table if not exists projects (
      id          text primary key,
      name        text not null,
      subtitle    text,
      description text,
      status      text default 'active',
      accent      text default '#d4a574',
      features    text[] default '{}',
      progress    integer default 0,
      created_at  timestamptz default now(),
      updated_at  timestamptz default now()
    );
  `);

  // ── Messages table ──
  await safeRpc(supabase, `
    create table if not exists messages (
      id          uuid primary key default gen_random_uuid(),
      project_id  text references projects(id) on delete cascade,
      role        text not null check (role in ('user', 'assistant')),
      content     text not null,
      created_at  timestamptz default now()
    );
    create index if not exists messages_project_idx
      on messages(project_id, created_at desc);
  `);

  // ── RLS ──
  await safeRpc(supabase, `
    alter table if exists projects enable row level security;
    alter table if exists messages enable row level security;
    do $$ begin
      if not exists (select 1 from pg_policies where tablename='projects' and policyname='Public read projects') then
        create policy "Public read projects" on projects for select using (true);
      end if;
      if not exists (select 1 from pg_policies where tablename='messages' and policyname='Public read messages') then
        create policy "Public read messages" on messages for select using (true);
      end if;
      if not exists (select 1 from pg_policies where tablename='messages' and policyname='Public insert messages') then
        create policy "Public insert messages" on messages for insert with check (true);
      end if;
    end $$;
  `);

  // ── Seed default projects ──
  const { error } = await supabase.from('projects').upsert([
    {
      id: 'cine-labs',
      name: 'Cine Labs',
      subtitle: 'Cinema Labs — AI Content Studio',
      description: 'End-to-end AI content automation studio. Script-to-screen pipeline with voice cloning, storyboarding, video generation, and character consistency.',
      status: 'active',
      accent: '#d4a574',
      features: ['Script & Content', 'Storyboard', 'Voice & Audio', 'Video Generation', 'Character Library', 'Pipeline Status'],
      progress: 65,
    },
    {
      id: 'admanager',
      name: 'AdManager',
      subtitle: 'AI Ad Platform',
      description: 'AI-powered ad platform for campaign creation, targeting, A/B testing, and performance analytics at scale.',
      status: 'active',
      accent: '#60a5fa',
      features: ['Campaign Builder', 'A/B Testing', 'Analytics', 'Audience Targeting'],
      progress: 40,
    },
  ], { onConflict: 'id', ignoreDuplicates: true });

  if (error) {
    console.error('[migrations] Seed error:', error.message);
  } else {
    console.log('[migrations] ✓ Schema and seed complete');
  }
}
