/**
 * Unit tests for the Voyage embeddings client.
 *
 * Global `fetch` is stubbed — NO live network calls.
 * `process.env.VOYAGE_API_KEY` is set/cleared per test as needed.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { embedTexts, embedText, VoyageError } from './voyage';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeVoyageResponse(embeddings: number[][]): Response {
  const data = embeddings.map((embedding, index) => ({ embedding, index }));
  return new Response(
    JSON.stringify({
      data,
      model: 'voyage-3',
      usage: { total_tokens: 10 },
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
}

function makeErrorResponse(status: number): Response {
  return new Response(JSON.stringify({ error: 'bad request' }), { status });
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

const ORIGINAL_KEY = process.env.VOYAGE_API_KEY;

beforeEach(() => {
  process.env.VOYAGE_API_KEY = 'test-voyage-key';
});

afterEach(() => {
  vi.unstubAllGlobals();
  if (ORIGINAL_KEY === undefined) {
    delete process.env.VOYAGE_API_KEY;
  } else {
    process.env.VOYAGE_API_KEY = ORIGINAL_KEY;
  }
});

// ---------------------------------------------------------------------------
// embedTexts — request shape
// ---------------------------------------------------------------------------

describe('embedTexts — request shape', () => {
  it('calls POST https://api.voyageai.com/v1/embeddings', async () => {
    const fakeFetch = vi.fn().mockResolvedValue(makeVoyageResponse([[0.1, 0.2]]));
    vi.stubGlobal('fetch', fakeFetch);

    await embedTexts(['hello'], 'query');

    expect(fakeFetch).toHaveBeenCalledOnce();
    const [url] = fakeFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.voyageai.com/v1/embeddings');
  });

  it('sends model: voyage-3', async () => {
    const fakeFetch = vi.fn().mockResolvedValue(makeVoyageResponse([[0.1, 0.2]]));
    vi.stubGlobal('fetch', fakeFetch);

    await embedTexts(['text'], 'document');

    const [, init] = fakeFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body.model).toBe('voyage-3');
  });

  it('sends the texts as the input array', async () => {
    const texts = ['first text', 'second text', 'third text'];
    const embeddings = [[0.1], [0.2], [0.3]];
    const fakeFetch = vi.fn().mockResolvedValue(makeVoyageResponse(embeddings));
    vi.stubGlobal('fetch', fakeFetch);

    await embedTexts(texts, 'document');

    const [, init] = fakeFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body.input).toEqual(texts);
  });

  it('sends input_type: query when inputType is query', async () => {
    const fakeFetch = vi.fn().mockResolvedValue(makeVoyageResponse([[0.1]]));
    vi.stubGlobal('fetch', fakeFetch);

    await embedTexts(['q'], 'query');

    const [, init] = fakeFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body.input_type).toBe('query');
  });

  it('sends input_type: document when inputType is document', async () => {
    const fakeFetch = vi.fn().mockResolvedValue(makeVoyageResponse([[0.1]]));
    vi.stubGlobal('fetch', fakeFetch);

    await embedTexts(['doc'], 'document');

    const [, init] = fakeFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body.input_type).toBe('document');
  });

  it('includes Authorization: Bearer <key> header', async () => {
    const fakeFetch = vi.fn().mockResolvedValue(makeVoyageResponse([[0.1]]));
    vi.stubGlobal('fetch', fakeFetch);

    await embedTexts(['text'], 'query');

    const [, init] = fakeFetch.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer test-voyage-key');
  });
});

// ---------------------------------------------------------------------------
// embedTexts — response parsing
// ---------------------------------------------------------------------------

describe('embedTexts — response parsing', () => {
  it('returns embeddings in input order when Voyage returns them out of order', async () => {
    // Voyage returns index 2, 0, 1 — we must re-sort to match input order.
    const outOfOrder = new Response(
      JSON.stringify({
        data: [
          { embedding: [0.3], index: 2 },
          { embedding: [0.1], index: 0 },
          { embedding: [0.2], index: 1 },
        ],
        model: 'voyage-3',
        usage: { total_tokens: 30 },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(outOfOrder));

    const result = await embedTexts(['a', 'b', 'c'], 'document');

    expect(result).toEqual([[0.1], [0.2], [0.3]]);
  });

  it('returns embeddings in the correct order when Voyage returns them in order', async () => {
    const fakeFetch = vi.fn().mockResolvedValue(
      makeVoyageResponse([
        [1, 2],
        [3, 4],
        [5, 6],
      ]),
    );
    vi.stubGlobal('fetch', fakeFetch);

    const result = await embedTexts(['a', 'b', 'c'], 'query');

    expect(result).toEqual([
      [1, 2],
      [3, 4],
      [5, 6],
    ]);
  });

  it('throws VoyageError when the response shape is malformed (no data array)', async () => {
    // Fresh Response per call — a Response body can only be read once.
    const makeMalformed = () =>
      new Response(JSON.stringify({ model: 'voyage-3' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    vi.stubGlobal('fetch', vi.fn().mockImplementation(makeMalformed));

    await expect(embedTexts(['a'], 'query')).rejects.toThrow(VoyageError);
    await expect(embedTexts(['a'], 'query')).rejects.toThrow('Voyage returned malformed response');
  });
});

// ---------------------------------------------------------------------------
// embedText — single-text convenience
// ---------------------------------------------------------------------------

describe('embedText', () => {
  it('returns the single embedding vector', async () => {
    const fakeFetch = vi.fn().mockResolvedValue(makeVoyageResponse([[0.9, 0.8, 0.7]]));
    vi.stubGlobal('fetch', fakeFetch);

    const result = await embedText('single text', 'query');

    expect(result).toEqual([0.9, 0.8, 0.7]);
  });

  it('throws VoyageError when Voyage returns an empty data array', async () => {
    // Fresh Response per call — a Response body can only be read once.
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() => makeVoyageResponse([])),
    );

    await expect(embedText('single text', 'query')).rejects.toThrow(VoyageError);
    await expect(embedText('single text', 'query')).rejects.toThrow(
      'Voyage returned no embeddings',
    );
  });
});

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

describe('VoyageError — missing API key', () => {
  it('throws VoyageError when VOYAGE_API_KEY is not set', async () => {
    delete process.env.VOYAGE_API_KEY;
    vi.stubGlobal('fetch', vi.fn()); // should never be called

    await expect(embedTexts(['text'], 'query')).rejects.toThrow(VoyageError);
    await expect(embedTexts(['text'], 'query')).rejects.toThrow(
      'VOYAGE_API_KEY environment variable is not set',
    );
  });

  it('does NOT call fetch when API key is missing', async () => {
    delete process.env.VOYAGE_API_KEY;
    const fakeFetch = vi.fn();
    vi.stubGlobal('fetch', fakeFetch);

    await expect(embedTexts(['text'], 'query')).rejects.toThrow(VoyageError);
    expect(fakeFetch).not.toHaveBeenCalled();
  });
});

describe('VoyageError — non-ok HTTP response', () => {
  it('throws VoyageError with the HTTP status on 4xx', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeErrorResponse(401)));

    const promise = embedTexts(['text'], 'query');

    await expect(promise).rejects.toThrow(VoyageError);
    await expect(promise).rejects.toMatchObject({ status: 401 });
  });

  it('throws VoyageError with the HTTP status on 5xx', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeErrorResponse(503)));

    const promise = embedTexts(['text'], 'query');

    await expect(promise).rejects.toThrow(VoyageError);
    await expect(promise).rejects.toMatchObject({ status: 503 });
  });

  it('VoyageError message includes the status code', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeErrorResponse(429)));

    await expect(embedTexts(['text'], 'query')).rejects.toThrow('429');
  });

  it('VoyageError has name VoyageError', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeErrorResponse(500)));

    try {
      await embedTexts(['text'], 'query');
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(VoyageError);
      expect((err as VoyageError).name).toBe('VoyageError');
    }
  });
});
