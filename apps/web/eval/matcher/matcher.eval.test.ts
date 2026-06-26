 
/**
 * Matcher eval harness — env-guarded live test.
 *
 * This test suite makes real calls to the Anthropic API (Haiku re-rank) and is
 * therefore guarded by two env vars:
 *   WANTED_EVAL_LIVE=1        — opt-in to running the live suite
 *   ANTHROPIC_API_KEY=<key>   — required for the Anthropic client
 *
 * The retrieval layer is replaced by a synthetic in-memory CandidateRetriever
 * (defined in runner.ts) so no Supabase connection is needed — only the LLM
 * re-rank call goes to the real Anthropic API.
 *
 * Normal test runs (CI, local without creds) skip this suite cleanly.
 * To run:
 *   WANTED_EVAL_LIVE=1 ANTHROPIC_API_KEY=sk-... pnpm test
 *
 * Pass criterion: >=85% of the 6 cases must pass all assertions.
 *
 * --- COVERAGE LIMITATION (semantic/vector arm) ---
 * The hermetic design means the synthetic CandidateRetriever always returns a
 * fixed pool regardless of the brief wording — FTS and pgvector retrieval are
 * NEVER exercised here. Case match_006_semantic_paraphrase documents the
 * paraphrase scenario the vector arm is designed to win (brief uses different
 * vocabulary than the matching app), but it only validates that Haiku's re-ranker
 * can identify paraphrased intent given the app in the pool — NOT that the vector
 * retriever would have surfaced the app in the first place.
 *
 * Vector arm coverage (RRF fusion ordering, null-embedding degradation, builder
 * intersection, vector-only materialization) lives in unit tests:
 *   apps/web/lib/wanted/matching/semantic-retriever.test.ts
 *   apps/web/lib/wanted/matching/rrf.test.ts
 *
 * True end-to-end validation of the vector arm requires a live DB populated with
 * embeddings + a Voyage API key — out of scope for this hermetic eval harness.
 */

import { describe, it, expect } from 'vitest';
import { createAnthropic } from '@/lib/wanted/anthropic';
import { runAll } from './runner';

// ---------------------------------------------------------------------------
// Environment guard
// ---------------------------------------------------------------------------

const LIVE = process.env.WANTED_EVAL_LIVE === '1' && !!process.env.ANTHROPIC_API_KEY;

// ---------------------------------------------------------------------------
// Live eval suite
// ---------------------------------------------------------------------------

describe.skipIf(!LIVE)('matcher eval (live)', () => {
  it('passes >= 85% of eval cases', async () => {
    const anthropic = createAnthropic();
    const { passRate, results } = await runAll(anthropic);

    // Log results for visibility when running live
    for (const r of results) {
      const status = r.passed ? 'PASS' : 'FAIL';
      console.log(
        `[${status}] ${r.id} (strongAppMatch=${r.details.phaseAHasStrongMatch}, apps=[${r.details.rankedAppIds.join(', ')}], builders=[${r.details.rankedBuilderIds.join(', ')}])`,
      );
      if (!r.passed) {
        for (const assertion of r.details.failedAssertions) {
          console.log(`  ✗ ${assertion}`);
        }
      }
    }

    console.log(
      `\nPass rate: ${(passRate * 100).toFixed(0)}% (${results.filter((r) => r.passed).length}/${results.length})`,
    );

    expect(passRate).toBeGreaterThanOrEqual(0.85);
  }, 150_000); // Generous timeout — 6 cases × 2 Haiku calls × ~3-5s per call
});
