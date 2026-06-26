import 'server-only';

import { briefEmbeddingText, appEmbeddingText, userCapabilityText } from '@hatch/shared';
import { embedText } from './voyage';

// ---------------------------------------------------------------------------
// High-level embed helpers that combine recipe text builders with the
// Voyage client. "Best-effort" variants catch all errors and return null,
// safe to use on write paths where embedding failure must not block the user.
// ---------------------------------------------------------------------------

/**
 * Embed a Brief for use as a semantic search query.
 * Uses input_type 'query' because Briefs are the retrieval query side.
 */
export async function embedBrief(
  input: Parameters<typeof briefEmbeddingText>[0],
): Promise<number[]> {
  const text = briefEmbeddingText(input);
  return embedText(text, 'query');
}

/**
 * Embed an App for storage as a searchable document.
 * Uses input_type 'document' because Apps are the corpus side.
 */
export async function embedApp(input: Parameters<typeof appEmbeddingText>[0]): Promise<number[]> {
  const text = appEmbeddingText(input);
  return embedText(text, 'document');
}

/**
 * Embed a user's capability profile from their top-loved app texts.
 * Uses input_type 'document' because capability vectors are matched against.
 */
export async function embedCapability(appTexts: string[]): Promise<number[]> {
  const text = userCapabilityText({ appTexts });
  return embedText(text, 'document');
}

// ---------------------------------------------------------------------------
// Best-effort variants — catch VoyageError (and any unexpected error) and
// return null. Use on write paths that must not fail the user request.
// ---------------------------------------------------------------------------

export async function embedBriefBestEffort(
  input: Parameters<typeof briefEmbeddingText>[0],
): Promise<number[] | null> {
  try {
    return await embedBrief(input);
  } catch (err) {
    console.warn('[wanted/embed] best-effort brief embedding failed; storing null', err);
    return null;
  }
}

export async function embedAppBestEffort(
  input: Parameters<typeof appEmbeddingText>[0],
): Promise<number[] | null> {
  try {
    return await embedApp(input);
  } catch (err) {
    console.warn('[wanted/embed] best-effort app embedding failed; storing null', err);
    return null;
  }
}

export async function embedCapabilityBestEffort(appTexts: string[]): Promise<number[] | null> {
  try {
    return await embedCapability(appTexts);
  } catch (err) {
    console.warn('[wanted/embed] best-effort capability embedding failed; storing null', err);
    return null;
  }
}
