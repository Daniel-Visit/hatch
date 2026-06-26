import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { assertWantedEnabled, WantedDisabledError } from '@/lib/wanted/gate';
import { problemResponse } from '@/lib/wanted/problem';
import { checkRateLimit } from '@/lib/rate-limit';
import { getBrief } from '@/lib/wanted/brief-repo';
import { listMatchesForBrief } from '@/lib/wanted/match-repo';
import type { Database } from '@hatch/shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  Vary: 'Origin',
};

function jsonResponse(body: unknown, status: number, extraHeaders: Record<string, string> = {}) {
  return NextResponse.json(body, {
    status,
    headers: { ...CORS_HEADERS, ...extraHeaders },
  });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

type CandidateType = Database['public']['Enums']['candidate_type'];

/** Lightweight summary of an app candidate shown in the match deck (§2.1). */
interface AppSummary {
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
  /** Category id */
  categoryId: string;
  /** Category label resolved from categories table */
  categoryLabel: string;
  /** Category icon resolved from categories table */
  categoryIcon: string;
  /** Handle of the app's author */
  authorHandle: string;
}

/** Lightweight summary of a builder candidate (no PII beyond the public profile). */
interface BuilderSummary {
  id: string;
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  hue: number;
  emoji: string | null;
  bio: string | null;
  requestDomains: string[];
}

function parseType(value: string | null): CandidateType | undefined {
  if (value === 'app') return 'APP';
  if (value === 'builder') return 'BUILDER';
  return undefined; // 'all' or anything else → no filter
}

/**
 * GET /api/v1/briefs/:id/matches — list matches for a brief (§2.1, author-only).
 *
 * Query: `?type=app|builder|all` (default `all`).
 *
 * App summaries now include `tags`, `categoryId`, `categoryLabel`, `categoryIcon`,
 * and `authorHandle` — resolved via two additional batch queries (categories,
 * profiles). These are additive; no existing fields changed.
 *
 * Reads use the session client so RLS does the heavy lifting: the
 * "matches brief author read" policy returns matches only to the brief author,
 * and "matches candidate builder read own" returns a builder their own rows. We
 * additionally guard `author_id` so this endpoint is strictly the seeker's deck
 * (a matched builder uses the inbox endpoint, not this one).
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // 1. Authenticate.
  let profile: Awaited<ReturnType<typeof requireUser>>['profile'];
  try {
    ({ profile } = await requireUser());
  } catch {
    return problemResponse('unauthorized', 'Unauthorized', 401, 'Sign in to view matches.');
  }

  // 2. Feature gate — flag-off yields 404.
  try {
    assertWantedEnabled(
      { feature_flags: profile.feature_flags as Record<string, unknown> | null },
      process.env as { WANTED_V1_ENABLED?: string },
    );
  } catch (err) {
    if (err instanceof WantedDisabledError) {
      return problemResponse(
        'wanted_disabled',
        'Not found',
        404,
        'The Wanted feature is not enabled for this account.',
      );
    }
    throw err;
  }

  // 3. Rate-limit: default window — the enrichment fan-out (multiple queries)
  //    makes this more expensive than a plain row read, so cap polling loops.
  const rl = await checkRateLimit(`briefs:matches:${id}`);
  if (!rl.ok) {
    return problemResponse(
      'rate_limit_exceeded',
      'Too many requests',
      429,
      "You are fetching this brief's matches too quickly. Try again shortly.",
    );
  }

  // 4. AuthZ: brief must exist, be visible, and be authored by the caller.
  const session = await createSupabaseServerClient();
  const brief = await getBrief(session, id);
  if (!brief || brief.author_id !== profile.id) {
    return problemResponse('brief_not_found', 'Brief not found', 404, `No brief with id ${id}.`);
  }

  // 5. Read matches (session client — RLS author-read scopes visibility).
  const typeFilter = parseType(new URL(req.url).searchParams.get('type'));
  const rows = await listMatchesForBrief(session, id, typeFilter);

  // 6. Enrich each match with its candidate summary (XOR-safe: read app OR builder).
  const appIds = rows
    .filter((r) => r.candidate_type === 'APP' && r.candidate_app_id)
    .map((r) => r.candidate_app_id as string);
  const builderIds = rows
    .filter((r) => r.candidate_type === 'BUILDER' && r.candidate_builder_id)
    .map((r) => r.candidate_builder_id as string);

  // ── App enrichment ──────────────────────────────────────────────────────────
  const appsById = new Map<string, AppSummary>();

  if (appIds.length > 0) {
    const { data: apps, error: appsErr } = await session
      .from('apps')
      .select(
        'id, slug, title, tagline, cover_url, accent, art_kind, hue, tags, category_id, author_id',
      )
      .in('id', appIds);
    if (appsErr) throw appsErr;

    const typedApps = apps ?? [];

    // Collect unique category_ids and author_ids for batch resolution.
    const categoryIds = [...new Set(typedApps.map((a) => a.category_id))];
    const appAuthorIds = [...new Set(typedApps.map((a) => a.author_id))];

    // Batch-fetch categories (static table — small, cheap).
    const categoriesById = new Map<string, { label: string; icon: string }>();
    if (categoryIds.length > 0) {
      const { data: cats, error: catsErr } = await session
        .from('categories')
        .select('id, label, icon')
        .in('id', categoryIds);
      if (catsErr) throw catsErr;
      for (const c of cats ?? []) {
        categoriesById.set(c.id, { label: c.label, icon: c.icon });
      }
    }

    // Batch-fetch app author handles.
    const profileHandlesById = new Map<string, string>();
    if (appAuthorIds.length > 0) {
      const { data: authorProfiles, error: authorsErr } = await session
        .from('profiles')
        .select('id, handle')
        .in('id', appAuthorIds);
      if (authorsErr) throw authorsErr;
      for (const p of authorProfiles ?? []) {
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
        tags: (a.tags as string[]) ?? [],
        categoryId: a.category_id,
        categoryLabel: cat?.label ?? a.category_id,
        categoryIcon: cat?.icon ?? '',
        authorHandle: profileHandlesById.get(a.author_id) ?? '—',
      });
    }
  }

  // ── Builder enrichment ──────────────────────────────────────────────────────
  const buildersById = new Map<string, BuilderSummary>();

  if (builderIds.length > 0) {
    const { data: builders, error: buildersErr } = await session
      .from('profiles')
      .select('id, handle, display_name, avatar_url, hue, emoji, bio, request_domains')
      .in('id', builderIds);
    if (buildersErr) throw buildersErr;
    for (const b of builders ?? []) {
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

  const matches = rows.map((r) => ({
    id: r.id,
    candidateType: r.candidate_type,
    candidate:
      r.candidate_type === 'APP'
        ? (appsById.get(r.candidate_app_id ?? '') ?? null)
        : (buildersById.get(r.candidate_builder_id ?? '') ?? null),
    agentConfidence: r.agent_confidence,
    agentRationale: r.agent_rationale,
    seekerAction: r.seeker_action,
    candidateAction: r.candidate_action,
    threadId: r.thread_id,
  }));

  return jsonResponse({ matches }, 200);
}
