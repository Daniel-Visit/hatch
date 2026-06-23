// Wanted Refiner page (CHAT mode) — server gate.
//
// Sits under the (shell) route group so it inherits the topbar/shell from
// (shell)/layout.tsx. This component renders ONLY the feature gate: it requires
// an authenticated user, narrows the profile feature flags, and verifies the
// Wanted feature is enabled before handing off to the client orchestrator.
//
// Routing: /wanted/new (mode picker) → "Talk to AI" → here. The orchestrator
// (RefinerClient) lazily creates the brief with mode:'chat' on the first turn.

import { notFound, redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';
import { isWantedEnabled } from '@hatch/shared';
import { RefinerClient } from '../refiner-client';

export const dynamic = 'force-dynamic';

export default async function WantedNewChatPage() {
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

  return <RefinerClient />;
}
