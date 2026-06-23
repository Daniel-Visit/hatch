// Wanted PASTE mode page (/wanted/new/paste) — server gate. §4.4.4b.
//
// Renders the feature gate only; the PasteModeClient handles the textarea +
// live counter, brief creation (POST /api/v1/briefs with mode:'paste' once the
// text is 80–4000 chars), the Parser SSE pass, the live-filling review form,
// and the parser banner + "Validate & match" CTA.

import { notFound, redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';
import { isWantedEnabled } from '@hatch/shared';
import { PasteModeClient } from './paste-mode-client';

export const dynamic = 'force-dynamic';

export default async function WantedNewPastePage() {
  const result = await getUser();
  if (!result) redirect('/sign-in');

  const flags =
    result.profile.feature_flags !== null &&
    typeof result.profile.feature_flags === 'object' &&
    !Array.isArray(result.profile.feature_flags)
      ? (result.profile.feature_flags as Record<string, unknown>)
      : null;

  if (!isWantedEnabled({ feature_flags: flags }, process.env as { WANTED_V1_ENABLED?: string })) {
    notFound();
  }

  return <PasteModeClient />;
}
