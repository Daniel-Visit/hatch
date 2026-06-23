// Wanted FORM mode page (/wanted/new/form) — server gate. §4.4.4a.
//
// Renders the feature gate only; the FormModeClient handles brief creation
// (POST /api/v1/briefs with mode:'form'), inline-editable fields, autosave via
// PATCH /content, the live completeness bar, and the "Validate & match" CTA.

import { notFound, redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';
import { isWantedEnabled } from '@hatch/shared';
import { FormModeClient } from './form-mode-client';

export const dynamic = 'force-dynamic';

export default async function WantedNewFormPage() {
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

  return <FormModeClient />;
}
