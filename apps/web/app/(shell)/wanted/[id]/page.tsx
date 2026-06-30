// /wanted/[id] — Private brief detail page (Phase 3, Task 7).
//
// Server gate mirrors apps/web/app/(shell)/wanted/[id]/matches/page.tsx:
//   1. getUser() → redirect('/sign-in') if no session
//   2. isWantedEnabled() → notFound() if flag is off
//   3. getBrief() → RLS scopes visibility (author OR matched builder); null → notFound()
//
// Two views, distinguished by brief.author_id === result.profile.id:
//   - Author view: full detail + status line + health/matches links.
//   - Matched-builder view: problem / desired end state / constraints WITHOUT
//     seeker PII (no author identity, no health/matches links), plus a CTA card
//     pointing to the requests inbox.

import { notFound, redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getUser } from '@/lib/auth';
import { isWantedEnabled, BriefContentSchema } from '@hatch/shared';
import type { BriefContent } from '@hatch/shared';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getBrief } from '@/lib/wanted/brief-repo';

export const dynamic = 'force-dynamic';

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function BriefDetailPage({ params }: PageProps) {
  const { id } = await params;

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

  // 3. Load brief. RLS already hid it from non-author / non-matched callers.
  const session = await createSupabaseServerClient();
  const brief = await getBrief(session, id);
  if (!brief) notFound();

  const isAuthor = brief.author_id === result.profile.id;

  // 4. Parse structured content; fall back to scalar columns only on failure.
  const parsed = BriefContentSchema.safeParse(brief.content);
  const content: BriefContent | undefined = parsed.success ? parsed.data : undefined;

  // 5. i18n.
  const t = await getTranslations('Wanted.BriefDetail');
  const tl = await getTranslations('Wanted.labels');

  const heading = brief.title ?? content?.title ?? t('pageTitle');

  const mustHaves = content?.desiredOutcome?.mustHaves ?? [];
  const outOfScope = content?.desiredOutcome?.outOfScope ?? [];
  const solutionTypes = brief.solution_types ?? [];

  return (
    <>
      <div className="gal-head">
        <div>
          <h1>{heading}</h1>
          {isAuthor && (
            <p className="gal-sub">
              {t('statusLabel')}: {brief.status}
            </p>
          )}
        </div>
      </div>

      <article className="card-request">
        <div className="card-request-body">
          {content?.problem?.trigger && (
            <div className="card-request-section">
              <h5>{tl('trigger')}</h5>
              <p>{content.problem.trigger}</p>
            </div>
          )}

          {content?.desiredOutcome?.definitionOfGoodEnough && (
            <div className="card-request-section">
              <h5>{tl('endState')}</h5>
              <p>{content.desiredOutcome.definitionOfGoodEnough}</p>
            </div>
          )}

          {mustHaves.length > 0 && (
            <div className="card-request-section">
              <h5>{tl('mustHaves')}</h5>
              <div className="card-request-meta-row">
                {mustHaves.map((item, i) => (
                  <span className="meta-pill" key={i}>
                    {item}
                  </span>
                ))}
              </div>
            </div>
          )}

          {outOfScope.length > 0 && (
            <div className="card-request-section">
              <h5>{tl('outOfScope')}</h5>
              <div className="card-request-meta-row">
                {outOfScope.map((item, i) => (
                  <span className="meta-pill" key={i}>
                    {item}
                  </span>
                ))}
              </div>
            </div>
          )}

          {brief.technical_level && (
            <div className="card-request-section">
              <h5>{tl('technicalLevel')}</h5>
              <div className="card-request-meta-row">
                <span className="meta-pill">
                  <i>⚙</i>
                  {brief.technical_level}
                </span>
              </div>
            </div>
          )}

          {solutionTypes.length > 0 && (
            <div className="card-request-section">
              <h5>{tl('solutionPreference')}</h5>
              <div className="card-request-meta-row">
                {solutionTypes.map((item, i) => (
                  <span className="meta-pill" key={i}>
                    <i>◐</i>
                    {item}
                  </span>
                ))}
              </div>
            </div>
          )}

          {(brief.budget_band || brief.timeline) && (
            <div className="card-request-section">
              <h5>{tl('budgetTimeline')}</h5>
              <div className="card-request-meta-row">
                {brief.budget_band && (
                  <span className="meta-pill">
                    <i>$</i>
                    {brief.budget_band}
                  </span>
                )}
                {brief.timeline && (
                  <span className="meta-pill">
                    <i>⏱</i>
                    {brief.timeline}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {isAuthor ? (
          <footer className="card-request-foot">
            <a className="btn btn-ghost" href={'/wanted/' + id + '/health'}>
              {t('viewHealth')}
            </a>
            <a className="btn btn-ghost" href={'/wanted/' + id + '/matches'}>
              {t('viewMatches')}
            </a>
          </footer>
        ) : (
          <div className="card-request-rationale">
            <b>{t('builderCtaTitle')}</b> {t('builderCtaBody')}{' '}
            <a href="/requests">{t('builderCtaLink')}</a>
          </div>
        )}
      </article>
    </>
  );
}
