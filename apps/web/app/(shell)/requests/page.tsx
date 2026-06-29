// /requests — Builder inbox (Phase 3, §2.1).
//
// Server gate mirrors apps/web/app/(shell)/wanted/[id]/matches/page.tsx:
//   1. getUser() → redirect('/sign-in') if no session
//   2. isWantedEnabled() → notFound() if the flag is off
//   3. accepts_requests === false → opt-in empty state
//   4. otherwise load the builder's PENDING matches and render the inbox

import { notFound, redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getUser } from '@/lib/auth';
import { isWantedEnabled } from '@hatch/shared';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { listBuilderRequests } from '@/lib/wanted/match-repo';
import { RequestsClient } from './_components/requests-client';

export const dynamic = 'force-dynamic';

export default async function RequestsPage() {
  // 1. Session gate.
  const result = await getUser();
  if (!result) redirect('/sign-in');

  // 2. Feature flag gate (mirrors matches/page.tsx).
  const flags =
    result.profile.feature_flags !== null &&
    typeof result.profile.feature_flags === 'object' &&
    !Array.isArray(result.profile.feature_flags)
      ? (result.profile.feature_flags as Record<string, unknown>)
      : null;

  if (!isWantedEnabled({ feature_flags: flags }, process.env as { WANTED_V1_ENABLED?: string })) {
    notFound();
  }

  const t = await getTranslations('Wanted.InboxRequests');

  // 3. Opt-in state: builder is not currently receiving requests.
  if (result.profile.accepts_requests === false) {
    return (
      <div className="gal-head">
        <div>
          <h1>{t('pageTitle')}</h1>
          <p className="gal-sub">{t('emptyTitle')}</p>
          <p style={{ marginTop: '14px' }}>
            <a className="btn btn-primary" href="/settings/requests">
              {t('emptyCta')}
            </a>
          </p>
        </div>
      </div>
    );
  }

  // 4. Load the builder's incoming PENDING matches.
  const session = await createSupabaseServerClient();
  const requests = await listBuilderRequests(session, result.profile.id);

  return (
    <>
      <div className="gal-head">
        <div>
          <h1>
            {t('pageTitle')}{' '}
            <span className="gal-count">{t('pendingCount', { count: requests.length })}</span>
          </h1>
          <p className="gal-sub">{t('subtitle')}</p>
        </div>
      </div>

      <RequestsClient initial={requests} capacity={result.profile.request_capacity ?? 0} />
    </>
  );
}
