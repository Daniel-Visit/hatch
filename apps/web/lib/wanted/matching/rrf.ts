/**
 * Reciprocal Rank Fusion (RRF) — Wanted Matcher, Task 5 (semantic retrieval).
 *
 * The semantic retriever fuses two independently-ranked id lists (an FTS /
 * structured arm and a vector arm) into a single ranking. RRF is the standard
 * rank-aggregation method: it scores each id by the sum of `1 / (k + rank)`
 * across every list it appears in, then sorts by descending score. It needs
 * only the RANK of each id in each list — not comparable raw scores — so it
 * fuses heterogeneous signals (BM25-ish FTS rank vs. cosine-distance rank)
 * without normalization.
 *
 * Pure module: no DB, no `server-only`. Unit-tested in `rrf.test.ts`.
 */

/**
 * Fuse several ranked id lists into one ranking via Reciprocal Rank Fusion.
 *
 * @param lists Ranked id lists, each ordered best-first. An id may appear in
 *   several lists (its contributions sum) and at most once per list (only its
 *   first occurrence in a given list counts).
 * @param k RRF damping constant (default 60, the value from the original RRF
 *   paper). Larger `k` flattens the contribution of top ranks.
 * @returns Ids sorted by descending fused score. Ties preserve first-seen order
 *   (the order in which ids were first encountered while scanning the lists),
 *   making the result deterministic and stable.
 *
 * Rank convention: 1-BASED. The first id in a list has rank 1 and contributes
 * `1 / (k + 1)`; the second contributes `1 / (k + 2)`; and so on.
 */
export function reciprocalRankFusion(lists: string[][], k = 60): string[] {
  const scoreById = new Map<string, number>();
  // Track first-seen order to break ties deterministically (stable for ties).
  const firstSeen = new Map<string, number>();
  let seenCounter = 0;

  for (const list of lists) {
    // Guard against a duplicate id within a single list: only its first
    // (best) rank in that list contributes.
    const seenInThisList = new Set<string>();
    for (let i = 0; i < list.length; i++) {
      const id = list[i];
      if (seenInThisList.has(id)) continue;
      seenInThisList.add(id);

      const rank = i + 1; // 1-based
      scoreById.set(id, (scoreById.get(id) ?? 0) + 1 / (k + rank));
      if (!firstSeen.has(id)) firstSeen.set(id, seenCounter++);
    }
  }

  return [...scoreById.keys()].sort((a, b) => {
    const diff = (scoreById.get(b) ?? 0) - (scoreById.get(a) ?? 0);
    if (diff !== 0) return diff;
    // Stable tie-break: earlier first-seen id wins.
    return (firstSeen.get(a) ?? 0) - (firstSeen.get(b) ?? 0);
  });
}
