import 'server-only';
import { runMatching, type MatchMode, type RunMatchingArgs } from './matching/run';

/**
 * triggerMatching — the public matcher entry point (Wanted feature, §2.1).
 *
 * Wraps `runMatching` (the Phase A / Phase B orchestrator) and returns a stable
 * `{ matchingJobId }` envelope. The `approve` route and the `POST /briefs/:id/match`
 * re-trigger route both call through here so they share identical matcher wiring.
 *
 * `runMatching` self-constructs the real Anthropic client and FTS retriever when
 * they are not injected, so the default call path is fully wired to production.
 * Tests can inject fakes via `args` (mirrors `runMatching`'s injectable shape).
 *
 * NOTE: `matchingJobId` is a correlation id only — matching runs inline (awaited)
 * for now, so a completed call means matches are already persisted. The id is kept
 * for the API contract (§2.1 `POST /approve` → `{ matchingJobId }`) and for future
 * out-of-band job tracking.
 */
export async function triggerMatching(
  briefId: string,
  mode: MatchMode = 'both',
  args: RunMatchingArgs = {},
): Promise<{ matchingJobId: string }> {
  const matchingJobId = crypto.randomUUID();
  await runMatching(briefId, mode, args);
  return { matchingJobId };
}
