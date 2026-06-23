/**
 * Unit test for the thin `triggerMatching` wrapper. We mock `./matching/run` so
 * no Anthropic/DB is touched, and assert the wrapper:
 *  - delegates to runMatching with the briefId + mode (defaulting to 'both'),
 *  - forwards injected args (anthropic/retriever/admin) for testability,
 *  - returns a UUID matchingJobId regardless of runMatching's return value.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const runMatching = vi.fn();

vi.mock('./matching/run', () => ({
  runMatching: (...args: unknown[]) => runMatching(...args),
}));

// Import AFTER the mock is registered.
import { triggerMatching } from './matching';

describe('triggerMatching', () => {
  beforeEach(() => {
    runMatching.mockReset();
    runMatching.mockResolvedValue({ matches: [] });
  });

  it("defaults mode to 'both' and returns a uuid job id", async () => {
    const res = await triggerMatching('brief-1');

    expect(runMatching).toHaveBeenCalledTimes(1);
    expect(runMatching).toHaveBeenCalledWith('brief-1', 'both', {});
    expect(res.matchingJobId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  it('forwards an explicit mode and injected args', async () => {
    const args = { anthropic: {} as never, retriever: {} as never };
    await triggerMatching('brief-2', 'apps', args);

    expect(runMatching).toHaveBeenCalledWith('brief-2', 'apps', args);
  });

  it('awaits runMatching before returning (propagates rejection)', async () => {
    runMatching.mockRejectedValueOnce(new Error('boom'));
    await expect(triggerMatching('brief-3')).rejects.toThrow('boom');
  });
});
