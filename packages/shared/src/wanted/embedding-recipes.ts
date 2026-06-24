// Embedding text recipes — pure string builders, no I/O, no API calls.
// These assemble the text that gets passed to the embedding model.
// Decision D1 (deferred embeddings): functions only build text; callers
// are responsible for sending the text to the embedding API.
//
// Sources: 01-architecture-and-data.md §1.6

/**
 * Build the embedding text for a Brief.
 *
 * Maps to the Brief.embedding column (vector(1024) stored via pgvector).
 */
export function briefEmbeddingText(input: {
  title?: string;
  trigger?: string;
  affected?: string;
  costOfNotSolving?: string;
  definitionOfGoodEnough?: string;
  mustHaves?: string[];
}): string {
  const title = input.title ?? '';
  const trigger = input.trigger ?? '';
  const affected = input.affected ?? '';
  const costOfNotSolving = input.costOfNotSolving ?? '';
  const definitionOfGoodEnough = input.definitionOfGoodEnough ?? '';
  const mustHaves = input.mustHaves ?? [];

  return `${title}\n\n${trigger}\n${affected}\n${costOfNotSolving}\n\n${definitionOfGoodEnough}\n\nMust-haves: ${mustHaves.join(', ')}`;
}

/**
 * Build the embedding text for an App.
 *
 * Maps to the App.embedding column (vector(1024) stored via pgvector).
 */
export function appEmbeddingText(input: {
  name?: string;
  oneLiner?: string;
  description?: string;
  solvesProblems?: string[];
  category?: string;
}): string {
  const name = input.name ?? '';
  const oneLiner = input.oneLiner ?? '';
  const description = input.description ?? '';
  const solvesProblems = input.solvesProblems ?? [];
  const category = input.category ?? '';

  return `${name}\n${oneLiner}\n\n${description}\n\nSolves: ${solvesProblems.join(', ')}\nCategory: ${category}`;
}

/**
 * Build the capability embedding text for a User (builder).
 *
 * Maps to User.capability_embedding (vector(1024)). Per spec, capability
 * is the concatenation of the top loved apps' embedding texts (typically
 * the top 5 most-loved, weighted by recency — recomputed nightly + on
 * each new app published). Callers are responsible for selecting and
 * ordering the appTexts before passing them here.
 */
export function userCapabilityText(input: { appTexts: string[] }): string {
  return (input.appTexts ?? []).join('\n\n');
}
