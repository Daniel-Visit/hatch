// MatchCard — one swipeable card in the seeker's match deck.
//
// Verbatim port of .card-match from mockups.html #matches.
// Two variants:
//   APP     — cover art from app.cover_url / app's generative art; .cat-badge with
//             category glyph + label; semantic tags[]; sub-line "app · by {handle}"
//             label "Try {title} →"
//   BUILDER — avatar initials on a gradient; label "Connect →"; intent-pill-request
//
// CSS in apps/web/app/styles/wanted.css + prototype-cards.css (.cat-badge, .tag).
// NOTE: no Tailwind — prototype-port exception applies.

import { useTranslations } from 'next-intl';
import { IntentBadgeRequest } from './intent-badge-request';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AppCandidate {
  id: string;
  slug: string;
  title: string;
  tagline: string;
  coverUrl: string | null;
  accent: string;
  artKind: string;
  hue: number;
  /** Semantic tags from apps.tags[] */
  tags: string[];
  /** Category id from apps.category_id */
  categoryId: string;
  /** Category label resolved from categories table */
  categoryLabel: string;
  /** Category icon resolved from categories table */
  categoryIcon: string;
  /** Handle of the app author (from profiles.handle) */
  authorHandle: string;
}

export interface BuilderCandidate {
  id: string;
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  hue: number;
  emoji: string | null;
  bio: string | null;
  requestDomains: string[];
}

export interface MatchSummary {
  id: string;
  candidateType: 'APP' | 'BUILDER';
  candidate: AppCandidate | BuilderCandidate | null;
  agentConfidence: number;
  agentRationale: string | null;
  seekerAction: string | null;
  candidateAction: string | null;
  threadId: string | null;
}

type MatchCardProps = {
  match: MatchSummary;
  /** true when rendered in the seeker's deck; false for the builder's inbox view */
  seekerView: boolean;
  onSwipe?: (matchId: string, action: 'CONNECT' | 'SKIP') => void;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Derive builder initials from handle or display name (max 2 chars, uppercase). */
function builderInitials(candidate: BuilderCandidate): string {
  const name = candidate.displayName || candidate.handle;
  const parts = name.trim().split(/[\s._-]+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

/**
 * Builder gradient — seeded from hue so each builder gets a consistent colour.
 * Matches the mockup pattern: linear-gradient(135deg, oklch(72% .15 {h1}), oklch(60% .15 {h2}))
 */
function builderGradient(hue: number): string {
  const h2 = (hue + 70) % 360;
  return `linear-gradient(135deg,oklch(72% .15 ${hue}),oklch(60% .15 ${h2}))`;
}

// ── Sub-components ────────────────────────────────────────────────────────────

/** App thumbnail — small rounded cover/gradient square in the card header row. */
function AppThumb({ app }: { app: AppCandidate }) {
  if (app.coverUrl) {
    return (
      <div
        className="card-match-thumb"
        style={{ background: `url(${app.coverUrl}) center/cover no-repeat` }}
      />
    );
  }
  const h1 = app.hue;
  const h2 = (h1 + 80) % 360;
  const bg = `linear-gradient(135deg,oklch(72% .2 ${h1}),oklch(60% .18 ${h2}))`;
  return (
    <div className="card-match-thumb" style={{ background: bg, fontSize: 24 }}>
      ◍
    </div>
  );
}

/** Builder thumbnail — initials on a gradient, in the card header row. */
function BuilderThumb({ builder }: { builder: BuilderCandidate }) {
  return (
    <div className="card-match-thumb" style={{ background: builderGradient(builder.hue) }}>
      {builderInitials(builder)}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- reserved: builder inbox will use this to show the full brief
export function MatchCard({ match, seekerView, onSwipe }: MatchCardProps) {
  const t = useTranslations('Wanted.MatchDeck');

  const { candidateType, candidate, agentConfidence, agentRationale } = match;

  // Confidence pill: .is-high when >= 75 (§4.3 "confidence pill (`.is-high` when ≥75)").
  const confPct = Math.round(agentConfidence * 100);
  const isHigh = confPct >= 75;

  const isApp = candidateType === 'APP';
  const appCandidate = isApp ? (candidate as AppCandidate | null) : null;
  const builderCandidate = !isApp ? (candidate as BuilderCandidate | null) : null;

  // Title line
  const title = isApp
    ? (appCandidate?.title ?? t('noMatchesTitle'))
    : (builderCandidate?.handle ?? '');

  // Sub line verbatim from mockup:
  //   app:     "app · by {handle}"
  //   builder: "builder · {domains…}"
  const subLine = isApp
    ? `app · by ${appCandidate?.authorHandle ?? '—'}`
    : `builder · ${(builderCandidate?.requestDomains ?? []).join(' · ')}`;

  // Tags: app uses semantic apps.tags[]; builder uses requestDomains
  const tags: string[] = isApp
    ? (appCandidate?.tags ?? []).slice(0, 4)
    : (builderCandidate?.requestDomains ?? []).slice(0, 4);

  return (
    <article className="card-match">
      {/* Header row: thumb · identity · category/intent · confidence */}
      <div className="card-match-top">
        {isApp && appCandidate ? (
          <AppThumb app={appCandidate} />
        ) : builderCandidate ? (
          <BuilderThumb builder={builderCandidate} />
        ) : (
          <div className="card-match-thumb" />
        )}

        <div className="card-match-id">
          <h3 className="card-match-title">{title}</h3>
          <p className="card-match-sub">{subLine}</p>
        </div>

        {isApp && appCandidate?.categoryLabel && (
          <span className="cat-badge">
            <i>{appCandidate.categoryIcon}</i>
            {appCandidate.categoryLabel}
          </span>
        )}
        {!isApp && <IntentBadgeRequest />}

        <span className={`card-match-conf${isHigh ? ' is-high' : ''}`}>
          {t('confidenceLabel', { pct: confPct })}
        </span>
      </div>

      {agentRationale && (
        <div className="card-match-rationale">
          <span className="card-match-rationale-label">{t('whyThisMatch')}</span>
          {agentRationale}
        </div>
      )}

      {tags.length > 0 && (
        <div className="card-match-tags">
          {tags.map((tag) => (
            <span key={tag} className="tag">
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Footer — Skip / Connect, right-aligned */}
      <div className="card-match-foot">
        <button
          className="btn btn-skip"
          onClick={() => onSwipe?.(match.id, 'SKIP')}
          aria-label={t('skipCta')}
        >
          {t('skipCta')}
        </button>
        <button
          className="btn btn-connect"
          onClick={() => onSwipe?.(match.id, 'CONNECT')}
          aria-label={isApp ? t('tryAppCta', { title }) : t('connectCta')}
        >
          {isApp ? t('tryAppCta', { title }) : t('connectCta')}
        </button>
      </div>
    </article>
  );
}
