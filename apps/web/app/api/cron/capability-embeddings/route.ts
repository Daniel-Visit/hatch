import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { recomputeAllCapabilities, sweepNullEmbeddings } from '@/lib/wanted/embeddings/capability';

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

  try {
    const admin = createSupabaseAdminClient();
    const capabilities = await recomputeAllCapabilities(admin, 100);
    const backfilled = await sweepNullEmbeddings(admin, 100);
    return NextResponse.json({ ok: true, capabilities, backfilled });
  } catch (err) {
    console.error('cron capability-embeddings failed', err);
    return NextResponse.json({ ok: false, error: 'cron_failed' }, { status: 500 });
  }
}
