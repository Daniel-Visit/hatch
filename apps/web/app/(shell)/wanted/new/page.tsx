// Wanted mode picker page (/wanted/new) — server gate. §4.4.0.
//
// Sits under the (shell) route group so it inherits the topbar/shell from
// (shell)/layout.tsx. This component renders ONLY the feature gate: it requires
// an authenticated user, narrows the profile feature flags, and verifies the
// Wanted feature is enabled before handing off to the mode-picker client.
//
// The picker shows three cards (Talk to AI / Fill it in / Paste a brief) and
// routes to /wanted/new/{chat,form,paste}. Each downstream route is responsible
// for creating a brief with the matching `mode` via POST /api/v1/briefs.

import { notFound, redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';
import { isWantedEnabled } from '@hatch/shared';
import { ModePicker } from './_components/mode-picker';

export const dynamic = 'force-dynamic';

export default async function WantedNewPage() {
  const result = await getUser();
  if (!result) redirect('/sign-in');

  // profile.feature_flags is typed as Json (string | number | boolean | null |
  // object). isWantedEnabled expects Record<string, unknown> | null, so we
  // narrow it the same way apps/web/app/api/v1/briefs/route.ts does.
  const flags =
    result.profile.feature_flags !== null &&
    typeof result.profile.feature_flags === 'object' &&
    !Array.isArray(result.profile.feature_flags)
      ? (result.profile.feature_flags as Record<string, unknown>)
      : null;

  if (!isWantedEnabled({ feature_flags: flags }, process.env as { WANTED_V1_ENABLED?: string })) {
    notFound();
  }

  return <ModePicker />;
}
