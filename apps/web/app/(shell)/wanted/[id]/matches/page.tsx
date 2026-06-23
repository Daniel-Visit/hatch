// /wanted/[id]/matches — Seeker's match deck (§4.4.1 / §4.4.2).
//
// Server gate mirrors apps/web/app/(shell)/wanted/new/page.tsx:
//   1. getUser() → redirect('/sign-in') if no session
//   2. isWantedEnabled() → notFound() if flag is off
//   3. author-only: brief must exist and be owned by the caller → notFound()
//   4. Load initial matches: enriched with tags, author handle, category
//   5. Render <MatchDeckClient> with initial data

import { notFound, redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getUser } from '@/lib/auth';
import { isWantedEnabled } from '@hatch/shared';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getBrief } from '@/lib/wanted/brief-repo';
import { listMatchesForBrief } from '@/lib/wanted/match-repo';
import { MatchDeckClient } from './match-deck-client';
import type { MatchSummary, AppCandidate, BuilderCandidate } from '../../_components/match-card';
import type { Database } from '@hatch/shared';

export const dynamic = 'force-dynamic';

type CandidateType = Database['public']['Enums']['candidate_type'];

// ── Relative time helper ──────────────────────────────────────────────────────

/**
 * Returns a short human-readable relative time string for a timestamp.
 * Used for brief.updated_at in the sub-meta line.
 */
function formatRelativeTime(isoTimestamp: string): string {
  const now = Date.now();
  const then = new Date(isoTimestamp).getTime();
  const diffMs = now - then;

  if (diffMs < 0) return 'just now';

  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;

  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks} week${weeks === 1 ? '' : 's'} ago`;

  const months = Math.floor(days / 30);
  return `${months} month${months === 1 ? '' : 's'} ago`;
}

// ── Raw row shapes returned by Supabase selects ───────────────────────────────

interface AppRow {
  id: string;
  slug: string;
  title: string;
  tagline: string;
  cover_url: string | null;
  accent: string;
  art_kind: string;
  hue: number;
  tags: string[];
  category_id: string;
  author_id: string;
}

interface BuilderRow {
  id: string;
  handle: string;
  display_name: string;
  avatar_url: string | null;
  hue: number;
  emoji: string | null;
  bio: string | null;
  request_domains: unknown;
}

interface CategoryRow {
  id: string;
  label: string;
  icon: string;
}

interface ProfileHandleRow {
  id: string;
  handle: string;
}

// ── Enrichment ────────────────────────────────────────────────────────────────

async function loadMatches(briefId: string): Promise<MatchSummary[]> {
  const session = await createSupabaseServerClient();

  // listMatchesForBrief scopes via RLS; brief ownership confirmed in the page gate.
  const rows = await listMatchesForBrief(session, briefId, undefined);

  const appIds = rows
    .filter((r) => r.candidate_type === 'APP' && r.candidate_app_id)
    .map((r) => r.candidate_app_id as string);
  const builderIds = rows
    .filter((r) => r.candidate_type === 'BUILDER' && r.candidate_builder_id)
    .map((r) => r.candidate_builder_id as string);

  // ── App enrichment ──────────────────────────────────────────────────────────
  const appsById = new Map<string, AppCandidate>();

  if (appIds.length > 0) {
    const { data: apps } = await session
      .from('apps')
      .select(
        'id, slug, title, tagline, cover_url, accent, art_kind, hue, tags, category_id, author_id',
      )
      .in('id', appIds);

    const typedApps = (apps as AppRow[] | null) ?? [];

    // Collect unique category_ids and author_ids for batch resolution.
    const categoryIds = [...new Set(typedApps.map((a) => a.category_id))];
    const appAuthorIds = [...new Set(typedApps.map((a) => a.author_id))];

    // Batch-fetch categories.
    const categoriesById = new Map<string, { label: string; icon: string }>();
    if (categoryIds.length > 0) {
      const { data: cats } = await session
        .from('categories')
        .select('id, label, icon')
        .in('id', categoryIds);
      for (const c of (cats as CategoryRow[] | null) ?? []) {
        categoriesById.set(c.id, { label: c.label, icon: c.icon });
      }
    }

    // Batch-fetch app author handles.
    const profileHandlesById = new Map<string, string>();
    if (appAuthorIds.length > 0) {
      const { data: profiles } = await session
        .from('profiles')
        .select('id, handle')
        .in('id', appAuthorIds);
      for (const p of (profiles as ProfileHandleRow[] | null) ?? []) {
        profileHandlesById.set(p.id, p.handle);
      }
    }

    for (const a of typedApps) {
      const cat = categoriesById.get(a.category_id);
      appsById.set(a.id, {
        id: a.id,
        slug: a.slug,
        title: a.title,
        tagline: a.tagline,
        coverUrl: a.cover_url,
        accent: a.accent,
        artKind: a.art_kind,
        hue: a.hue,
        tags: a.tags ?? [],
        categoryId: a.category_id,
        categoryLabel: cat?.label ?? a.category_id,
        categoryIcon: cat?.icon ?? '',
        authorHandle: profileHandlesById.get(a.author_id) ?? '—',
      });
    }
  }

  // ── Builder enrichment ──────────────────────────────────────────────────────
  const buildersById = new Map<string, BuilderCandidate>();

  if (builderIds.length > 0) {
    const { data: builders } = await session
      .from('profiles')
      .select('id, handle, display_name, avatar_url, hue, emoji, bio, request_domains')
      .in('id', builderIds);
    for (const b of (builders as BuilderRow[] | null) ?? []) {
      buildersById.set(b.id, {
        id: b.id,
        handle: b.handle,
        displayName: b.display_name,
        avatarUrl: b.avatar_url,
        hue: b.hue,
        emoji: b.emoji,
        bio: b.bio,
        requestDomains: (b.request_domains as string[] | null) ?? [],
      });
    }
  }

  return rows.map((r) => ({
    id: r.id,
    candidateType: r.candidate_type as CandidateType,
    candidate:
      r.candidate_type === 'APP'
        ? (appsById.get(r.candidate_app_id ?? '') ?? null)
        : (buildersById.get(r.candidate_builder_id ?? '') ?? null),
    agentConfidence: r.agent_confidence ?? 0,
    agentRationale: r.agent_rationale ?? null,
    seekerAction: r.seeker_action ?? null,
    candidateAction: r.candidate_action ?? null,
    threadId: r.thread_id ?? null,
  }));
}

// ── Page ──────────────────────────────────────────────────────────────────────

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function MatchesPage({ params }: PageProps) {
  const { id } = await params;

  // 1. Session gate.
  const result = await getUser();
  if (!result) redirect('/sign-in');

  // 2. Feature flag gate (mirrors new/page.tsx).
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

  // 4. Load initial matches (enriched with tags, author handle, category).
  const initialMatches = await loadMatches(id);

  // 5. i18n for page heading.
  const t = await getTranslations('Wanted.MatchDeck');
  const matchCount = initialMatches.length;
  const briefIdShort = id.slice(0, 8);
  const updatedWhen = brief.updated_at ? formatRelativeTime(brief.updated_at) : 'recently';

  return (
    <>
      <div className="gal-head">
        <div>
          <h1>
            {brief.title ?? t('noMatchesTitle')}
            <span className="gal-count">
              {t('briefMeta', { id: briefIdShort, count: matchCount })}
            </span>
          </h1>
          <p className="gal-sub">
            {t('briefSubMeta', {
              when: updatedWhen,
              score: (brief.completeness_score ?? 0).toFixed(2),
              days: 14,
            })}
          </p>
        </div>
      </div>

      <MatchDeckClient briefId={id} initialMatches={initialMatches} />
    </>
  );
}
