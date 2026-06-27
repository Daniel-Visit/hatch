// Builder request-preferences page (/settings/requests) — server gate. Wanted Phase 3.
//
// Sits under the (shell) route group so it inherits the topbar/shell from
// (shell)/layout.tsx. Mirrors the feature gate used by /wanted/new: requires an
// authenticated user, narrows the profile feature flags, and verifies the Wanted
// feature is enabled before handing off to the preferences client form.

import { notFound, redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getUser } from '@/lib/auth';
import { isWantedEnabled } from '@hatch/shared';
import { RequestsForm } from './requests-form';

export const dynamic = 'force-dynamic';

export default async function SettingsRequestsPage() {
  const result = await getUser();
  if (!result) redirect('/sign-in');

  // profile.feature_flags is typed as Json (string | number | boolean | null |
  // object). isWantedEnabled expects Record<string, unknown> | null, so we narrow
  // it the same way /wanted/new and api/v1/briefs/route.ts do.
  const flags =
    result.profile.feature_flags !== null &&
    typeof result.profile.feature_flags === 'object' &&
    !Array.isArray(result.profile.feature_flags)
      ? (result.profile.feature_flags as Record<string, unknown>)
      : null;

  if (!isWantedEnabled({ feature_flags: flags }, process.env as { WANTED_V1_ENABLED?: string })) {
    notFound();
  }

  // result.profile is the full profiles row (getUser selects '*'). The five
  // preference columns are strongly typed in lib/supabase/types.ts.
  const initial = {
    accepts_requests: result.profile.accepts_requests ?? false,
    request_capacity: result.profile.request_capacity ?? 3,
    request_domains: result.profile.request_domains ?? [],
    inferred_capabilities: result.profile.inferred_capabilities ?? [],
    request_rate_band: result.profile.request_rate_band ?? null,
  };

  const t = await getTranslations('Wanted.RequestPrefs');

  return (
    <>
      <h1>{t('pageTitle')}</h1>
      <RequestsForm initial={initial} />
    </>
  );
}
