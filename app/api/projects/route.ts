// app/api/projects/route.ts
// Full CRUD for projects.

import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase';

// GET /api/projects — list all projects with latest build
export async function GET() {
  const db = getAdminClient();
  const { data, error } = await db
    .from('projects')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ projects: data ?? [] });
}

// POST /api/projects — create a new project
export async function POST(req: NextRequest) {
  const body = await req.json() as {
    name: string;
    description?: string;
    userPrompt: string;
    competitorUrls?: string[];
    accent?: string;
  };

  const { name, description, userPrompt, competitorUrls = [], accent = '#d4a574' } = body;

  if (!name || !userPrompt) {
    return NextResponse.json({ error: 'name and userPrompt are required' }, { status: 400 });
  }

  const db = getAdminClient();
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 36);
  const id = `${slug}-${Date.now().toString(36)}`;

  const { data, error } = await db.from('projects').insert({
    id,
    name,
    subtitle: 'AI-generated app',
    description: description || userPrompt.slice(0, 200),
    status: 'building',
    accent,
    features: [],
    progress: 0,
    user_prompt: userPrompt,
    competitor_urls: competitorUrls,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ project: data });
}

// PATCH /api/projects?id=xxx — partial update
export async function PATCH(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const body = await req.json() as Record<string, unknown>;
  const db = getAdminClient();

  const { data, error } = await db
    .from('projects')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ project: data });
}

// DELETE /api/projects?id=xxx
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const db = getAdminClient();
  const { error } = await db.from('projects').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
