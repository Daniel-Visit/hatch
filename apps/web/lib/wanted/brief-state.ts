import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@hatch/shared';
import { type BriefContent, computeCompletenessScore } from '@hatch/shared';

// ---------------------------------------------------------------------------
// Whitelisted dot-paths for setContentPath
// ---------------------------------------------------------------------------

export const BRIEF_CONTENT_PATHS: readonly string[] = [
  'title',
  'problem.trigger',
  'problem.affected',
  'problem.currentWorkaround',
  'problem.costOfNotSolving',
  'desiredOutcome.definitionOfGoodEnough',
  'desiredOutcome.mustHaves',
  'desiredOutcome.niceToHaves',
  'desiredOutcome.outOfScope',
  'context.industry',
  'context.useCase',
  'context.technicalLevel',
  'context.existingStack',
  'constraints.budgetBand',
  'constraints.timeline',
  'constraints.licensing',
  'constraints.geography',
  'preferredSolutionType',
] as const;

/**
 * Pure, immutable dot-path setter for BriefContent.
 *
 * Only whitelisted paths are accepted (see BRIEF_CONTENT_PATHS).
 * Throws Error('invalid_path') for any non-whitelisted path.
 *
 * Supports:
 * - 1-level paths (e.g. `title`, `preferredSolutionType`): sets the top-level key.
 * - 2-level paths (e.g. `problem.trigger`): copies the nested section and sets the field.
 *
 * NEVER mutates the input `content`.
 */
export function setContentPath(content: BriefContent, path: string, value: unknown): BriefContent {
  if (!BRIEF_CONTENT_PATHS.includes(path)) {
    throw new Error('invalid_path');
  }

  const parts = path.split('.');

  if (parts.length === 1) {
    // Top-level scalar or array replacement
    return { ...content, [parts[0]]: value };
  }

  // 2-level path: copy the parent section, then set the nested field
  const [section, field] = parts;
  const existingSection =
    ((content as unknown as Record<string, unknown>)[section] as Record<string, unknown>) ?? {};
  return {
    ...content,
    [section]: {
      ...existingSection,
      [field]: value,
    },
  } as BriefContent;
}

type SessionClient = SupabaseClient<Database>;

/**
 * Pure, immutable deep merge of a BriefContent patch onto existing content.
 *
 * Merge rules:
 * - Top-level scalar fields (e.g. `title`): replaced when present in patch.
 * - Nested objects (`problem`, `desiredOutcome`, `context`, `constraints`):
 *   merged field-by-field — patch fields win; absent patch fields keep existing.
 * - Arrays (`mustHaves`, `niceToHaves`, `outOfScope`, `existingStack`,
 *   `preferredSolutionType`): REPLACED entirely, not concatenated.
 * - Absent/undefined sections in patch: existing content is preserved as-is.
 * - Does NOT mutate the input `content`.
 */
export function applyDraftPatch(content: BriefContent, patch: Partial<BriefContent>): BriefContent {
  return {
    // title: scalar — replace if present in patch
    ...(patch.title !== undefined
      ? { title: patch.title }
      : content.title !== undefined
        ? { title: content.title }
        : {}),

    // problem: merge object field-by-field
    problem: {
      ...(content.problem ?? {}),
      ...(patch.problem ?? {}),
    },

    // desiredOutcome: merge object field-by-field; arrays replaced (not concatenated)
    desiredOutcome: {
      ...(content.desiredOutcome ?? {}),
      ...(patch.desiredOutcome ?? {}),
    },

    // context: merge object field-by-field; existingStack array replaced
    context: {
      ...(content.context ?? {}),
      ...(patch.context ?? {}),
    },

    // constraints: merge object field-by-field
    constraints: {
      ...(content.constraints ?? {}),
      ...(patch.constraints ?? {}),
    },

    // preferredSolutionType: top-level array — replaced entirely when present in patch
    preferredSolutionType:
      patch.preferredSolutionType !== undefined
        ? patch.preferredSolutionType
        : (content.preferredSolutionType ?? []),
  };
}

/**
 * Persist updated content + derived completeness score to the briefs table.
 * Uses the session client — briefs has RLS "author all" (author_id = auth.uid()).
 */
export async function computeAndPersistContent(
  session: SessionClient,
  briefId: string,
  newContent: BriefContent,
): Promise<{ completenessScore: number }> {
  const completenessScore = computeCompletenessScore(newContent);

  const { error } = await session
    .from('briefs')
    .update({
      content: newContent as Database['public']['Tables']['briefs']['Update']['content'],
      completeness_score: completenessScore,
    })
    .eq('id', briefId);

  if (error) throw error;
  return { completenessScore };
}

/**
 * Transition a brief's status based on a lifecycle event.
 *
 * Events:
 * - `'first_refine'`: DRAFT → REFINING. No-op if already REFINING (or later).
 * - `'approve'`:      REFINING | DRAFT → MATCHING (sets matching_started_at).
 *                     Throws Error('invalid_transition') from any other status.
 *
 * Uses the session client — briefs has RLS "author all".
 */
export async function transition(
  session: SessionClient,
  brief: { id: string; status: string },
  event: 'first_refine' | 'approve',
): Promise<void> {
  if (event === 'first_refine') {
    // Idempotent: only transition from DRAFT; already REFINING or further is a no-op.
    if (brief.status !== 'DRAFT') return;

    const { error } = await session
      .from('briefs')
      .update({
        status: 'REFINING' as Database['public']['Enums']['brief_status'],
      })
      .eq('id', brief.id);

    if (error) throw error;
    return;
  }

  if (event === 'approve') {
    if (brief.status !== 'REFINING' && brief.status !== 'DRAFT') {
      throw new Error('invalid_transition');
    }

    const { error } = await session
      .from('briefs')
      .update({
        status: 'MATCHING' as Database['public']['Enums']['brief_status'],
        matching_started_at: new Date().toISOString(),
      })
      .eq('id', brief.id);

    if (error) throw error;
    return;
  }

  // TypeScript exhaustiveness — should never reach here at runtime.
  event satisfies never;
}
