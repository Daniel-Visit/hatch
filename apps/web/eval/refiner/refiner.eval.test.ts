/* eslint-disable no-console -- eval runner intentionally prints pass/fail to stdout */
/**
 * Refiner eval harness — env-guarded live test.
 *
 * This test suite makes real calls to the Anthropic API and is therefore
 * guarded by two env vars:
 *   WANTED_EVAL_LIVE=1        — opt-in to running the live suite
 *   ANTHROPIC_API_KEY=<key>   — required for the Anthropic client
 *
 * Normal test runs (CI, local without creds) skip this suite cleanly.
 * To run:
 *   WANTED_EVAL_LIVE=1 ANTHROPIC_API_KEY=sk-... pnpm test
 *
 * Pass criterion: >=80% of the 5 seed cases must pass all assertions.
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

describe.skipIf(!LIVE)('refiner eval (live)', () => {
  it('passes >= 80% of eval cases', async () => {
    const anthropic = createAnthropic();
    const { passRate, results } = await runAll(anthropic);

    // Log results for visibility when running live
    for (const r of results) {
      const status = r.passed ? 'PASS' : 'FAIL';
      console.log(`[${status}] ${r.id} (${r.details.turns} turns)`);
      if (!r.passed) {
        for (const assertion of r.details.failedAssertions) {
          console.log(`  ✗ ${assertion}`);
        }
      }
    }

    console.log(
      `\nPass rate: ${(passRate * 100).toFixed(0)}% (${results.filter((r) => r.passed).length}/${results.length})`,
    );

    expect(passRate).toBeGreaterThanOrEqual(0.8);
  }, // Generous timeout — 5 cases × up to 6 turns × ~3-5s per turn
  120_000);
});
