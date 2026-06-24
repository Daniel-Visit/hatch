import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { appEmbeddingText, BriefContentSchema } from '@hatch/shared';
import type { Database } from '@/lib/supabase/types';
import { embedCapabilityBestEffort, embedBriefBestEffort, embedAppBestEffort } from './embed';

// ---------------------------------------------------------------------------
// recomputeCapability
// ---------------------------------------------------------------------------

/**
 * Fetch the builder's top-5 most-loved published apps (ordered by
 * `likes_count` desc, then `created_at` desc as tiebreak), build the
 * capability text, embed it, and UPDATE profiles.capability_embedding.
 *
 * Returns true on success, false if the builder has no published apps or if
 * the embedding call fails.
 */
export async function recomputeCapability(
  admin: SupabaseClient<Database>,
  builderId: string,
): Promise<boolean> {
  // Fetch top-5 published apps for this builder ordered by likes_count desc.
  const { data: apps, error } = await admin
    .from('apps')
    .select('title, tagline, description, solves_problems, category_id')
    .eq('author_id', builderId)
    .eq('is_published', true)
    .order('likes_count', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    console.warn('[capability] failed to fetch apps for builder', builderId, error);
    return false;
  }

  if (!apps || apps.length === 0) {
    return false;
  }

  // Build the embedding text for each app.
  const appTexts = apps.map((app) =>
    appEmbeddingText({
      name: app.title,
      oneLiner: app.tagline,
      description: app.description,
      solvesProblems: app.solves_problems,
      category: app.category_id,
    }),
  );

  const vec = await embedCapabilityBestEffort(appTexts);
  if (vec === null) {
    return false;
  }

  // pgvector accepts the JS array serialized as a vector literal string.
  const vectorLiteral = '[' + vec.join(',') + ']';

  const { error: updateError } = await admin
    .from('profiles')
    .update({ capability_embedding: vectorLiteral })
    .eq('id', builderId);

  if (updateError) {
    console.warn(
      '[capability] failed to update capability_embedding for builder',
      builderId,
      updateError,
    );
    return false;
  }

  return true;
}

// ---------------------------------------------------------------------------
// recomputeAllCapabilities
// ---------------------------------------------------------------------------

/**
 * Iterate up to `batchLimit` builders who have at least one published app
 * and recompute their capability embeddings.
 *
 * Never throws out of the loop — per-builder errors are counted as `failed`.
 */
export async function recomputeAllCapabilities(
  admin: SupabaseClient<Database>,
  batchLimit = 100,
): Promise<{ updated: number; failed: number }> {
  // Fetch distinct builder IDs that have at least one published app.
  // We select from apps grouped by author_id. Since supabase-js doesn't
  // expose GROUP BY, we select author_id with is_published=true and deduplicate
  // in memory after fetching up to batchLimit * 5 rows (over-fetch then trim).
  const { data: rows, error } = await admin
    .from('apps')
    .select('author_id')
    .eq('is_published', true)
    .limit(batchLimit * 10);

  if (error || !rows) {
    console.warn('[capability] failed to list builders', error);
    return { updated: 0, failed: 0 };
  }

  // Deduplicate builder IDs, taking at most batchLimit.
  const builderIds = [...new Set(rows.map((r) => r.author_id))].slice(0, batchLimit);

  let updated = 0;
  let failed = 0;

  for (const builderId of builderIds) {
    try {
      const ok = await recomputeCapability(admin, builderId);
      if (ok) {
        updated++;
      } else {
        failed++;
      }
    } catch (err) {
      console.warn('[capability] unexpected error for builder', builderId, err);
      failed++;
    }
  }

  return { updated, failed };
}

// ---------------------------------------------------------------------------
// sweepNullEmbeddings
// ---------------------------------------------------------------------------

/**
 * Backfill NULL embeddings for existing briefs and apps.
 *
 * Phase 1: find up to `batchLimit` briefs with embedding IS NULL,
 *          parse their content via BriefContentSchema, embed, and update.
 * Phase 2: find up to `batchLimit` apps with embedding IS NULL,
 *          map to appEmbeddingText, embed, and update.
 *
 * Per-row errors are caught and counted; a single row failing never aborts
 * the batch. Returns totals across both phases.
 */
export async function sweepNullEmbeddings(
  admin: SupabaseClient<Database>,
  batchLimit = 100,
): Promise<{ updated: number; failed: number }> {
  let updated = 0;
  let failed = 0;

  // --- Phase 1: briefs ---
  const { data: briefs, error: briefsError } = await admin
    .from('briefs')
    .select('id, content, title')
    .is('embedding', null)
    .limit(batchLimit);

  if (briefsError) {
    console.warn('[capability/sweep] failed to fetch null-embedding briefs', briefsError);
  } else if (briefs) {
    for (const row of briefs) {
      try {
        const parsed = BriefContentSchema.safeParse(row.content);
        const content = parsed.success ? parsed.data : undefined;

        const vec = await embedBriefBestEffort({
          title: content?.title ?? row.title ?? undefined,
          trigger: content?.problem?.trigger,
          affected: content?.problem?.affected,
          costOfNotSolving: content?.problem?.costOfNotSolving,
          definitionOfGoodEnough: content?.desiredOutcome?.definitionOfGoodEnough,
          mustHaves: content?.desiredOutcome?.mustHaves,
        });

        if (vec === null) {
          failed++;
          continue;
        }

        const vectorLiteral = '[' + vec.join(',') + ']';
        const { error: updateError } = await admin
          .from('briefs')
          .update({ embedding: vectorLiteral })
          .eq('id', row.id);

        if (updateError) {
          console.warn('[capability/sweep] failed to update brief', row.id, updateError);
          failed++;
        } else {
          updated++;
        }
      } catch (err) {
        console.warn('[capability/sweep] unexpected error on brief', row.id, err);
        failed++;
      }
    }
  }

  // --- Phase 2: apps ---
  const { data: apps, error: appsError } = await admin
    .from('apps')
    .select('id, title, tagline, description, solves_problems, category_id')
    .is('embedding', null)
    .limit(batchLimit);

  if (appsError) {
    console.warn('[capability/sweep] failed to fetch null-embedding apps', appsError);
  } else if (apps) {
    for (const row of apps) {
      try {
        const vec = await embedAppBestEffort({
          name: row.title,
          oneLiner: row.tagline,
          description: row.description,
          solvesProblems: row.solves_problems,
          category: row.category_id,
        });

        if (vec === null) {
          failed++;
          continue;
        }

        const vectorLiteral = '[' + vec.join(',') + ']';
        const { error: updateError } = await admin
          .from('apps')
          .update({ embedding: vectorLiteral })
          .eq('id', row.id);

        if (updateError) {
          console.warn('[capability/sweep] failed to update app', row.id, updateError);
          failed++;
        } else {
          updated++;
        }
      } catch (err) {
        console.warn('[capability/sweep] unexpected error on app', row.id, err);
        failed++;
      }
    }
  }

  return { updated, failed };
}
