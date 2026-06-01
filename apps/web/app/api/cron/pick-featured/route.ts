import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json({ error: 'cron_secret_not_configured' }, { status: 500 });
  }
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${expected}`) {
    return new NextResponse('unauthorized', { status: 401 });
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc('pick_featured_app');
  if (error) {
    console.error('cron pick_featured_app failed', { message: error.message, code: error.code });
    return NextResponse.json({ ok: false, error: 'rpc_failed' }, { status: 500 });
  }
  return NextResponse.json({ ok: true, picked: data });
}
