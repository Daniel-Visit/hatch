// Run with: SUPABASE_SERVICE_ROLE_KEY=... NEXT_PUBLIC_SUPABASE_URL=... pnpm test brief-repo.integration

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@hatch/shared';
import { MAX_ACTIVE_BRIEFS } from './invariants';
import { BriefQuotaExceededError } from './invariants';
import { countActiveBriefs, createBrief, getBrief } from './brief-repo';

// ---------------------------------------------------------------------------
// Environment guard — skip the whole suite when no live DB creds are present.
// Normal `pnpm test` runs (CI, local without creds) will SKIP cleanly.
// ---------------------------------------------------------------------------
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RUN = Boolean(URL && KEY);

describe.skipIf(!RUN)('brief-repo integration (live Supabase)', () => {
  // Client is created lazily inside beforeAll so that module-level evaluation
  // (which happens even for skipped suites) does NOT call createClient with
  // undefined URL/KEY and throw "supabaseUrl is required".
  let client: ReturnType<typeof createClient<Database>>;
  let authorId = '';
  const createdIds: string[] = [];

  // -------------------------------------------------------------------------
  // Setup: create the service-role client and resolve a real profile id.
  // -------------------------------------------------------------------------
  beforeAll(async () => {
    // Service-role client bypasses RLS so inserts with a real author_id work.
    client = createClient<Database>(URL!, KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await client
      .from('profiles')
      .select('id')
      .limit(1)
      .single();

    if (error || !data) {
      throw new Error(
        `brief-repo integration: could not fetch a real profile id — ${error?.message ?? 'no rows'}`,
      );
    }
    authorId = data.id;
  });

  // -------------------------------------------------------------------------
  // Teardown: delete only the rows this suite created.
  // -------------------------------------------------------------------------
  afterAll(async () => {
    if (createdIds.length > 0) {
      await client.from('briefs').delete().in('id', createdIds);
    }
  });

  // -------------------------------------------------------------------------
  // Test 1: quota guard blocks the 4th active brief.
  //
  // Strategy:
  //   - Read the current active count N for the real author.
  //   - Create max(0, MAX_ACTIVE_BRIEFS - N) PASTE briefs (status=PARSING, which
  //     IS in ACTIVE_BRIEF_STATUSES), pushing each returned id for cleanup.
  //   - Now active count >= MAX_ACTIVE_BRIEFS (3).
  //   - Attempt one more createBrief → must throw BriefQuotaExceededError.
  // -------------------------------------------------------------------------
  it('quota guard blocks the 4th active brief', async () => {
    const currentActive = await countActiveBriefs(client, authorId);
    const toCreate = Math.max(0, MAX_ACTIVE_BRIEFS - currentActive);

    for (let i = 0; i < toCreate; i++) {
      const brief = await createBrief(client, authorId, {
        entryMode: 'PASTE',
        parsedFrom: `integration test paste text (slot ${i + 1})`,
        content: { __test__: 'wanted-p0-integration' } as unknown as Parameters<typeof createBrief>[2]['content'],
      });
      createdIds.push(brief.id);
    }

    // Sanity: active count is now at the cap.
    const activeAfter = await countActiveBriefs(client, authorId);
    expect(activeAfter).toBeGreaterThanOrEqual(MAX_ACTIVE_BRIEFS);

    // The blocking assertion — must throw the quota error.
    await expect(
      createBrief(client, authorId, {
        entryMode: 'PASTE',
        parsedFrom: 'x',
        content: { __test__: 'wanted-p0-integration' } as unknown as Parameters<typeof createBrief>[2]['content'],
      }),
    ).rejects.toBeInstanceOf(BriefQuotaExceededError);
  });

  // -------------------------------------------------------------------------
  // Test 2: getBrief round-trips correctly.
  //
  // Depends on at least one brief having been created in test 1.
  // If test 1 created nothing (real data already at cap), we skip the happy
  // path but still verify the null-for-unknown-id path.
  // -------------------------------------------------------------------------
  it('getBrief round-trips a created brief and returns null for unknown id', async () => {
    if (createdIds.length > 0) {
      const fetched = await getBrief(client, createdIds[0]);
      expect(fetched).not.toBeNull();
      expect(fetched?.id).toBe(createdIds[0]);
    }

    const missing = await getBrief(client, '00000000-0000-0000-0000-000000000000');
    expect(missing).toBeNull();
  });
});
