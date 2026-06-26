/**
 * Unit tests for streamRefine / SSE client.
 *
 * No network calls are made. `global.fetch` is replaced by a vi.fn() stub
 * that returns a synthetic ReadableStream built from raw SSE bytes. The
 * original fetch is restored after each test via afterEach.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { streamRefine } from './sse-client';
import type { RefineHandlers } from './sse-client';

// ---------------------------------------------------------------------------
// Helpers — ReadableStream factory
// ---------------------------------------------------------------------------

/**
 * Encode a plain string as UTF-8 bytes (Uint8Array).
 * This mirrors what a real server sends over the wire.
 */
function encode(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

/**
 * Build a ReadableStream that emits the provided byte chunks in order,
 * then closes.  Each element in `chunks` is one "network packet".
 */
function makeBodyStream(chunks: Uint8Array[]): ReadableStream<Uint8Array> {
  let index = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (index < chunks.length) {
        controller.enqueue(chunks[index++]);
      } else {
        controller.close();
      }
    },
  });
}

/**
 * Stub global.fetch to return a synthetic SSE response built from `chunks`.
 * Returns a vi.fn so callers can assert on call args.
 */
function stubFetch(
  chunks: Uint8Array[],
  options: { ok?: boolean; status?: number } = {},
): ReturnType<typeof vi.fn> {
  const { ok = true, status = 200 } = options;
  const fn = vi.fn().mockResolvedValue({
    ok,
    status,
    statusText: ok ? 'OK' : 'Internal Server Error',
    body: ok ? makeBodyStream(chunks) : null,
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  global.fetch = fn as any;
  return fn;
}

// ---------------------------------------------------------------------------
// afterEach — restore fetch
// ---------------------------------------------------------------------------

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Test 1: Full happy-path stream in a single chunk
// ---------------------------------------------------------------------------

describe('streamRefine — full happy-path (single chunk)', () => {
  it('dispatches token, structured_update, completeness_score, and done handlers in order', async () => {
    const ssePayload =
      'event: token\ndata: {"delta":"Hi"}\n\n' +
      'event: structured_update\ndata: {"patch":{"title":"Invoicing"}}\n\n' +
      'event: completeness_score\ndata: {"score":0.65}\n\n' +
      'event: done\ndata: {"shouldStop":false,"completeness":0.65,"nextAction":"continue"}\n\n';

    stubFetch([encode(ssePayload)]);

    const calls: string[] = [];
    const handlers: RefineHandlers = {
      onToken: (d) => {
        calls.push('token');
        expect(d.delta).toBe('Hi');
      },
      onStructuredUpdate: (d) => {
        calls.push('structured_update');
        expect(d.patch).toEqual({ title: 'Invoicing' });
      },
      onCompleteness: (d) => {
        calls.push('completeness_score');
        expect(d.score).toBe(0.65);
      },
      onDone: (d) => {
        calls.push('done');
        expect(d.shouldStop).toBe(false);
        expect(d.completeness).toBe(0.65);
        expect(d.nextAction).toBe('continue');
      },
      onError: (d) => {
        throw new Error(`Unexpected error event: ${JSON.stringify(d)}`);
      },
    };

    await streamRefine('brief-abc', 'hello', handlers);

    expect(calls).toEqual(['token', 'structured_update', 'completeness_score', 'done']);
  });
});

// ---------------------------------------------------------------------------
// Test 2: Frame split across two chunks (partial buffer handling)
// ---------------------------------------------------------------------------

describe('streamRefine — partial buffer (frame split across chunks)', () => {
  it('correctly assembles and dispatches a frame that was split mid-way', async () => {
    // Split the first SSE frame right in the middle of the data line.
    const part1 = encode('event: token\ndata: {"del');
    const part2 = encode('ta":"Hello"}\n\n');
    const part3 = encode(
      'event: done\ndata: {"shouldStop":true,"completeness":1,"nextAction":"stop"}\n\n',
    );

    stubFetch([part1, part2, part3]);

    const tokens: string[] = [];
    let doneReceived = false;

    const handlers: RefineHandlers = {
      onToken: (d) => tokens.push(d.delta),
      onDone: (d) => {
        doneReceived = true;
        expect(d.shouldStop).toBe(true);
        expect(d.completeness).toBe(1);
        expect(d.nextAction).toBe('stop');
      },
      onError: (d) => {
        throw new Error(`Unexpected error event: ${JSON.stringify(d)}`);
      },
    };

    await streamRefine('brief-xyz', 'test', handlers);

    expect(tokens).toEqual(['Hello']);
    expect(doneReceived).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Test 3: Server-sent error event
// ---------------------------------------------------------------------------

describe('streamRefine — server error event', () => {
  it('calls onError when server sends an error event', async () => {
    const ssePayload =
      'event: error\ndata: {"type":"quota_exceeded","message":"Too many briefs"}\n\n';

    stubFetch([encode(ssePayload)]);

    let errorReceived: { type: string; message?: string } | null = null;

    await streamRefine('brief-err', 'msg', {
      onError: (d) => {
        errorReceived = d;
      },
    });

    expect(errorReceived).not.toBeNull();
    expect(errorReceived!.type).toBe('quota_exceeded');
    expect(errorReceived!.message).toBe('Too many briefs');
  });
});

// ---------------------------------------------------------------------------
// Test 4: Non-OK HTTP response triggers onError
// ---------------------------------------------------------------------------

describe('streamRefine — HTTP error', () => {
  it('calls onError with http_error type when response is not ok', async () => {
    stubFetch([], { ok: false, status: 500 });

    let errorReceived: { type: string; message?: string } | null = null;

    await streamRefine('brief-500', 'msg', {
      onError: (d) => {
        errorReceived = d;
      },
    });

    expect(errorReceived).not.toBeNull();
    expect(errorReceived!.type).toBe('http_error');
    expect(errorReceived!.message).toContain('500');
  });
});

// ---------------------------------------------------------------------------
// Test 5: fetch() throws (network failure)
// ---------------------------------------------------------------------------

describe('streamRefine — network failure', () => {
  it('calls onError with network_error when fetch rejects', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('Failed to fetch'));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    global.fetch = fn as any;

    let errorReceived: { type: string; message?: string } | null = null;

    await streamRefine('brief-net', 'msg', {
      onError: (d) => {
        errorReceived = d;
      },
    });

    expect(errorReceived).not.toBeNull();
    expect(errorReceived!.type).toBe('network_error');
    expect(errorReceived!.message).toBe('Failed to fetch');
  });
});

// ---------------------------------------------------------------------------
// Test 6: Comment lines and blank frames are ignored
// ---------------------------------------------------------------------------

describe('streamRefine — tolerates SSE comments and blank lines', () => {
  it('ignores : comment lines and blank frames without calling onError', async () => {
    // A comment frame (SSE spec: lines starting with `:` are comments)
    const ssePayload =
      ': this is a comment\n\n' +
      'event: token\ndata: {"delta":"World"}\n\n' +
      '\n\n' + // blank frame
      'event: done\ndata: {"shouldStop":true,"completeness":1,"nextAction":"stop"}\n\n';

    stubFetch([encode(ssePayload)]);

    const tokens: string[] = [];
    let doneReceived = false;
    let errorCalled = false;

    await streamRefine('brief-comments', 'msg', {
      onToken: (d) => tokens.push(d.delta),
      onDone: () => {
        doneReceived = true;
      },
      onError: () => {
        errorCalled = true;
      },
    });

    expect(tokens).toEqual(['World']);
    expect(doneReceived).toBe(true);
    expect(errorCalled).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Test 7: fetch is called with correct URL and body
// ---------------------------------------------------------------------------

describe('streamRefine — request shape', () => {
  it('POSTs to the correct URL with JSON body containing userMessage', async () => {
    const ssePayload =
      'event: done\ndata: {"shouldStop":true,"completeness":1,"nextAction":"stop"}\n\n';
    const fetchStub = stubFetch([encode(ssePayload)]);

    await streamRefine('brief-id-123', 'What do you need?', {});

    expect(fetchStub).toHaveBeenCalledOnce();
    const [url, init] = fetchStub.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/v1/briefs/brief-id-123/refine');
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({ 'content-type': 'application/json' });
    expect(JSON.parse(init.body as string)).toEqual({
      userMessage: 'What do you need?',
    });
  });
});

// ---------------------------------------------------------------------------
// Test 8: AbortSignal is forwarded to fetch
// ---------------------------------------------------------------------------

describe('streamRefine — AbortSignal forwarded', () => {
  it('passes the signal to fetch init', async () => {
    const ssePayload =
      'event: done\ndata: {"shouldStop":true,"completeness":1,"nextAction":"stop"}\n\n';
    const fetchStub = stubFetch([encode(ssePayload)]);

    const controller = new AbortController();
    await streamRefine('brief-abort', 'hi', {}, controller.signal);

    const [, init] = fetchStub.mock.calls[0] as [string, RequestInit];
    expect(init.signal).toBe(controller.signal);
  });
});
