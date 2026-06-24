/**
 * Unit tests for the capability-embeddings cron route.
 *
 * All external dependencies (DB, embedding network calls) are mocked.
 * Tests assert:
 *  (a) 500 when CRON_SECRET is unset
 *  (b) 401 when Authorization header is missing or incorrect
 *  (c) 200 with both function results when the bearer token is valid
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — declared before the module under test is imported so vi.mock hoisting
// picks them up.
// ---------------------------------------------------------------------------

vi.mock('@/lib/wanted/embeddings/capability', () => ({
  recomputeAllCapabilities: vi.fn(),
  sweepNullEmbeddings: vi.fn(),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createSupabaseAdminClient: vi.fn(() => ({})),
}));

// Import AFTER mocks are registered.
import { GET } from './route';
import { recomputeAllCapabilities, sweepNullEmbeddings } from '@/lib/wanted/embeddings/capability';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(authorization?: string): Request {
  const headers = new Headers();
  if (authorization !== undefined) {
    headers.set('authorization', authorization);
  }
  return new Request('http://localhost/api/cron/capability-embeddings', { headers });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/cron/capability-embeddings', () => {
  const originalSecret = process.env.CRON_SECRET;

  beforeEach(() => {
    vi.mocked(recomputeAllCapabilities).mockResolvedValue({ updated: 3, failed: 1 });
    vi.mocked(sweepNullEmbeddings).mockResolvedValue({ updated: 7, failed: 0 });
  });

  afterEach(() => {
    // Restore the original CRON_SECRET after each test.
    if (originalSecret === undefined) {
      delete process.env.CRON_SECRET;
    } else {
      process.env.CRON_SECRET = originalSecret;
    }
    vi.clearAllMocks();
  });

  it('returns 500 when CRON_SECRET is not set', async () => {
    delete process.env.CRON_SECRET;

    const res = await GET(makeRequest('Bearer anything'));

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({ error: 'cron_secret_not_configured' });
    expect(recomputeAllCapabilities).not.toHaveBeenCalled();
    expect(sweepNullEmbeddings).not.toHaveBeenCalled();
  });

  it('returns 401 when Authorization header is missing', async () => {
    process.env.CRON_SECRET = 'test-secret';

    const res = await GET(makeRequest(/* no header */));

    expect(res.status).toBe(401);
    const text = await res.text();
    expect(text).toBe('unauthorized');
    expect(recomputeAllCapabilities).not.toHaveBeenCalled();
  });

  it('returns 401 when Authorization header has wrong token', async () => {
    process.env.CRON_SECRET = 'test-secret';

    const res = await GET(makeRequest('Bearer wrong-token'));

    expect(res.status).toBe(401);
    const text = await res.text();
    expect(text).toBe('unauthorized');
    expect(recomputeAllCapabilities).not.toHaveBeenCalled();
  });

  it('returns 401 when Authorization header uses wrong scheme', async () => {
    process.env.CRON_SECRET = 'test-secret';

    const res = await GET(makeRequest('Basic test-secret'));

    expect(res.status).toBe(401);
    expect(recomputeAllCapabilities).not.toHaveBeenCalled();
  });

  it('calls both functions and returns their counts on valid bearer token', async () => {
    process.env.CRON_SECRET = 'test-secret';

    const res = await GET(makeRequest('Bearer test-secret'));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      ok: true,
      capabilities: { updated: 3, failed: 1 },
      backfilled: { updated: 7, failed: 0 },
    });
    expect(recomputeAllCapabilities).toHaveBeenCalledTimes(1);
    expect(recomputeAllCapabilities).toHaveBeenCalledWith(expect.anything(), 100);
    expect(sweepNullEmbeddings).toHaveBeenCalledTimes(1);
    expect(sweepNullEmbeddings).toHaveBeenCalledWith(expect.anything(), 100);
  });

  it('returns 500 with cron_failed when recomputeAllCapabilities throws', async () => {
    process.env.CRON_SECRET = 'test-secret';
    vi.mocked(recomputeAllCapabilities).mockRejectedValueOnce(new Error('embedding explosion'));

    const res = await GET(makeRequest('Bearer test-secret'));

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({ ok: false, error: 'cron_failed' });
  });

  it('returns 500 with cron_failed when sweepNullEmbeddings throws', async () => {
    process.env.CRON_SECRET = 'test-secret';
    vi.mocked(sweepNullEmbeddings).mockRejectedValueOnce(new Error('sweep boom'));

    const res = await GET(makeRequest('Bearer test-secret'));

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({ ok: false, error: 'cron_failed' });
  });
});
