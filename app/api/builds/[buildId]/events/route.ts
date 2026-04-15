// app/api/builds/[buildId]/events/route.ts
// Polling fallback for SSE timeout — returns persisted build_events from Supabase.
// Client switches to this endpoint when the SSE connection drops (Vercel 60s Hobby limit).

import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ buildId: string }> }
) {
  const { buildId } = await params;
  const since = req.nextUrl.searchParams.get('since'); // last seen event id (bigserial)

  const db = getAdminClient();

  let query = db
    .from('build_events')
    .select('*')
    .eq('build_id', buildId)
    .order('id', { ascending: true })
    .limit(200);

  if (since) {
    query = query.gt('id', parseInt(since, 10));
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ events: data ?? [] });
}
