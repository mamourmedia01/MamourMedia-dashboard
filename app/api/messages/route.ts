import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// GET /api/messages?project_id=cine-labs
export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get('project_id');

  const query = supabase
    .from('messages')
    .select('*')
    .order('created_at', { ascending: true })
    .limit(100);

  if (projectId) query.eq('project_id', projectId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ messages: data });
}

// POST /api/messages
export async function POST(req: NextRequest) {
  const { project_id, role, content } = await req.json();

  const { data, error } = await supabase
    .from('messages')
    .insert({ project_id: project_id ?? null, role, content })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ message: data });
}
