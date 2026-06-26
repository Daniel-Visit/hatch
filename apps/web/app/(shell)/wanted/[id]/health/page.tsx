// /wanted/[id]/health — Brief Health Card (Validator output review). §4.4.5.
//
// Server gate mirrors /wanted/[id]/matches:
//   1. getUser() → redirect('/sign-in') if no session
//   2. isWantedEnabled() → notFound() if the flag is off
//   3. author-only: brief must exist and be owned by the caller → notFound()
//   4. Load the persisted Validator output (quality_score, quality_by_section,
//      match_potential_estimate) + suggestions, then render the client.

import { notFound, redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';
import { isWantedEnabled } from '@hatch/shared';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getBrief } from '@/lib/wanted/brief-repo';
import { listSuggestions } from '@/lib/wanted/suggestion-repo';
import { HealthCardClient, type InitialHealth } from './health-card-client';
import type { SuggestionView } from '../../_components/suggestion-row';

export const dynamic = 'force-dynamic';

type PageProps = { params: Promise<{ id: string }> };

export default async function HealthPage({ params }: PageProps) {
  const { id } = await params;

  // 1. Session gate.
  const result = await getUser();
  if (!result) redirect('/sign-in');

  // 2. Feature flag gate.
  const flags =
    result.profile.feature_flags !== null &&
    typeof result.profile.feature_flags === 'object' &&
    !Array.isArray(result.profile.feature_flags)
      ? (result.profile.feature_flags as Record<string, unknown>)
      : null;

  if (!isWantedEnabled({ feature_flags: flags }, process.env as { WANTED_V1_ENABLED?: string })) {
    notFound();
  }

  // 3. Author-only: brief must exist and be owned by the caller.
  const session = await createSupabaseServerClient();
  const brief = await getBrief(session, id);
  if (!brief || brief.author_id !== result.profile.id) {
    notFound();
  }

  // 4. Load persisted suggestions (author RLS). PENDING/APPLIED are shown on the
  //    card; DISMISSED rows are hidden (kept only for offline calibration).
  const suggestionRows = await listSuggestions(session, id);
  const suggestions: SuggestionView[] = suggestionRows
    .filter((s) => s.status === 'PENDING' || s.status === 'APPLIED')
    .map((s) => ({
      id: s.id,
      sectionPath: s.section_path,
      diagnosis: s.diagnosis,
      exampleBetter: s.example_better,
      status: s.status as SuggestionView['status'],
      appliedValue: s.applied_value,
    }));

  // The Validator persists these onto the brief; narrow the broad Json columns.
  const qualityBySection =
    brief.quality_by_section !== null &&
    typeof brief.quality_by_section === 'object' &&
    !Array.isArray(brief.quality_by_section)
      ? (brief.quality_by_section as Record<string, number>)
      : {};

  const estimate =
    brief.match_potential_estimate !== null &&
    typeof brief.match_potential_estimate === 'object' &&
    !Array.isArray(brief.match_potential_estimate)
      ? (brief.match_potential_estimate as { current?: number; withSuggestions?: number })
      : {};

  const initial: InitialHealth = {
    briefId: id,
    qualityScore: brief.quality_score ?? 0,
    qualityBySection,
    matchPotential: {
      current: estimate.current ?? 0,
      withSuggestions: estimate.withSuggestions ?? 0,
    },
    suggestions,
  };

  return <HealthCardClient initial={initial} />;
}
