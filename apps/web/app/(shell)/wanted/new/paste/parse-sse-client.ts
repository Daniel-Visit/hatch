/**
 * Browser SSE consumer for the Wanted Parser endpoint.
 *
 * Connects to `POST /api/v1/briefs/:id/parse` which responds with a
 * `text/event-stream`. Frames are separated by `\n\n`; each frame has one
 * `event:` line and one `data:` line (JSON). Mirrors the shared refine SSE
 * client's framing, but with the Parser's event set:
 *
 *   structured_update – { patch }                         (one event)
 *   parser_summary    – { summary, extractedFields, missingFields, parserConfidence }
 *   done              – { nextAction: 'review_health' }
 *   error             – server-side error
 *
 * Client-safe: does NOT import 'server-only'.
 */

export type ParseHandlers = {
  onStructuredUpdate?: (d: { patch: Record<string, unknown> }) => void;
  onParserSummary?: (d: {
    summary: string;
    extractedFields: string[];
    missingFields: string[];
    parserConfidence: number;
  }) => void;
  onDone?: (d: { nextAction: string }) => void;
  onError?: (d: { type: string; message?: string }) => void;
};

type SseFrame = { event: string; data: string };

function parseFrame(raw: string): SseFrame | null {
  const lines = raw.split('\n');
  let event = 'message';
  const dataLines: string[] = [];
  let hasEventLine = false;
  let hasDataLine = false;

  for (const line of lines) {
    if (line.startsWith('event:')) {
      event = line.slice('event:'.length).trim();
      hasEventLine = true;
    } else if (line.startsWith('data:')) {
      dataLines.push(line.slice('data:'.length).trimStart());
      hasDataLine = true;
    }
  }

  if (!hasEventLine && !hasDataLine) return null;
  return { event, data: dataLines.join('\n') };
}

function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

function dispatch(frame: SseFrame, handlers: ParseHandlers): void {
  let payload: unknown;
  try {
    payload = JSON.parse(frame.data);
  } catch {
    handlers.onError?.({
      type: 'parse_error',
      message: `Failed to parse SSE data for event "${frame.event}"`,
    });
    return;
  }
  if (typeof payload !== 'object' || payload === null) return;
  const p = payload as Record<string, unknown>;

  switch (frame.event) {
    case 'structured_update': {
      if (typeof p['patch'] === 'object' && p['patch'] !== null) {
        handlers.onStructuredUpdate?.({ patch: p['patch'] as Record<string, unknown> });
      }
      break;
    }
    case 'parser_summary': {
      handlers.onParserSummary?.({
        summary: typeof p['summary'] === 'string' ? p['summary'] : '',
        extractedFields: asStringArray(p['extractedFields']),
        missingFields: asStringArray(p['missingFields']),
        parserConfidence: typeof p['parserConfidence'] === 'number' ? p['parserConfidence'] : 0,
      });
      break;
    }
    case 'done': {
      handlers.onDone?.({
        nextAction: typeof p['nextAction'] === 'string' ? p['nextAction'] : 'review_health',
      });
      break;
    }
    case 'error': {
      handlers.onError?.({
        type: typeof p['type'] === 'string' ? p['type'] : 'server_error',
        message: typeof p['message'] === 'string' ? p['message'] : undefined,
      });
      break;
    }
  }
}

/**
 * Stream a Parser pass for the given brief. Opens a `POST /:id/parse` request
 * that returns `text/event-stream` and dispatches each event until the stream
 * closes.
 */
export async function streamParse(briefId: string, handlers: ParseHandlers): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`/api/v1/briefs/${briefId}/parse`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
  } catch (err: unknown) {
    handlers.onError?.({
      type: 'network_error',
      message: err instanceof Error ? err.message : String(err),
    });
    return;
  }

  if (!res.ok || !res.body) {
    handlers.onError?.({ type: 'http_error', message: `HTTP ${res.status} ${res.statusText}` });
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        const trailing = buffer.trim();
        if (trailing.length > 0) {
          const frame = parseFrame(trailing);
          if (frame) dispatch(frame, handlers);
        }
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split('\n\n');
      buffer = parts.pop() ?? '';
      for (const part of parts) {
        const trimmed = part.trim();
        if (trimmed.length === 0) continue;
        const frame = parseFrame(trimmed);
        if (frame) dispatch(frame, handlers);
      }
    }
  } catch (err: unknown) {
    handlers.onError?.({
      type: 'stream_error',
      message: err instanceof Error ? err.message : String(err),
    });
  } finally {
    reader.releaseLock();
  }
}
