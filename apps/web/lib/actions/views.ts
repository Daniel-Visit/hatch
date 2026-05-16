'use server';

import { createHash } from 'crypto';
import { headers } from 'next/headers';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getUser } from '@/lib/auth';

// Records a view for an app. Deduped per viewer per UTC day via the
// app_views PK; trigger bumps apps.views_count on actual insert.
// Authed viewers identified by user.id; anon viewers by salted SHA-256 of
// ip + user-agent (one bucket per browser+IP per day).
export async function recordView(appId: string): Promise<void> {
  const sb = await createSupabaseServerClient();
  const result = await getUser();

  let viewerKey: string;
  if (result) {
    viewerKey = `u:${result.user.id}`;
  } else {
    const h = await headers();
    const ip = h.get('x-forwarded-for')?.split(',')[0].trim() || h.get('x-real-ip') || 'unknown';
    const ua = h.get('user-agent') ?? 'unknown';
    const salt = process.env.VIEW_HASH_SALT ?? 'hatch-view-v1';
    const digest = createHash('sha256').update(`${salt}|${ip}|${ua}`).digest('hex');
    viewerKey = `a:${digest.slice(0, 32)}`;
  }

  // PK on (app_id, viewer_key, viewed_date) — duplicate inserts return a
  // unique-violation error which we treat as a no-op.
  await sb.from('app_views').insert({ app_id: appId, viewer_key: viewerKey });
}
