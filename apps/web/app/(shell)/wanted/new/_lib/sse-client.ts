/**
 * Browser SSE consumer for the Wanted Refiner endpoint.
 *
 * Connects to `POST /api/v1/briefs/:id/refine` which responds with a
 * `text/event-stream`.  Frames are separated by `\n\n`; each frame may have
 * one `event:` line and one or more `data:` lines (multiple data lines are
 * joined with `\n` before JSON.parse, per the SSE spec).
 *
 * Supported server event names:
 *   token             – streaming text delta
 *   structured_update – patch object for the draft
 *   completeness_score– numeric score
 *   ui_call           – declarative UI component invocation (turnId/component/props)
 *   done              – terminal frame carrying shouldStop / nextAction
 *   error             – server-side error; also used for client-side errors
 *
 * Client-safe: does NOT import 'server-only'.
 */

// ---------------------------------------------------------------------------
// Public handler types
// ---------------------------------------------------------------------------

export type RefineHandlers = {
  onToken?: (d: { delta: string }) => void;
  onStructuredUpdate?: (d: { patch: Record<string, unknown> }) => void;
  onCompleteness?: (d: { score: number }) => void;
  /**
   * The agent invoked a declarative UI component (§3.1.5.1). `turnId` is the
   * AGENT turn the ui_response is POSTed back to; `props` are the validated
   * tool input. A `done` frame with nextAction='await_ui_response' follows.
   */
  onUiCall?: (d: { turnId: string; component: string; props: Record<string, unknown> }) => void;
  onDone?: (d: { shouldStop: boolean; completeness: number; nextAction: string }) => void;
  onError?: (d: { type: string; message?: string }) => void;
};

// ---------------------------------------------------------------------------
// SSE frame parser
// ---------------------------------------------------------------------------

/** A parsed SSE frame: the event name and the raw data string. */
type SseFrame = {
  event: string;
  data: string;
};

/**
 * Parse one complete SSE frame (i.e. the text between two `\n\n` separators).
 * Returns null for blank frames or pure comment frames (lines starting with `:`)
 * that carry no `event:` or `data:` lines.
 */
function parseFrame(raw: string): SseFrame | null {
  const lines = raw.split('\n');
  let event = 'message'; // SSE default event name when `event:` is absent
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
    // Lines starting with `:` are comments — intentionally ignored.
    // Empty lines inside a split chunk should not occur (frames are split on
    // `\n\n`), but we silently skip them.
  }

  if (!hasEventLine && !hasDataLine) {
    return null;
  }

  return { event, data: dataLines.join('\n') };
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

/**
 * Dispatch a parsed SSE frame to the appropriate handler.
 * JSON parse errors are forwarded to onError rather than thrown.
 */
function dispatch(frame: SseFrame, handlers: RefineHandlers): void {
  let payload: unknown;

  try {
    payload = JSON.parse(frame.data);
  } catch {
    handlers.onError?.({
      type: 'parse_error',
      message: `Failed to parse SSE data for event "${frame.event}": ${frame.data}`,
    });
    return;
  }

  if (typeof payload !== 'object' || payload === null) {
    handlers.onError?.({
      type: 'parse_error',
      message: `Unexpected SSE payload shape for event "${frame.event}"`,
    });
    return;
  }

  const p = payload as Record<string, unknown>;

  switch (frame.event) {
    case 'token': {
      if (typeof p['delta'] === 'string') {
        handlers.onToken?.({ delta: p['delta'] });
      }
      break;
    }

    case 'structured_update': {
      if (typeof p['patch'] === 'object' && p['patch'] !== null) {
        handlers.onStructuredUpdate?.({
          patch: p['patch'] as Record<string, unknown>,
        });
      }
      break;
    }

    case 'completeness_score': {
      if (typeof p['score'] === 'number') {
        handlers.onCompleteness?.({ score: p['score'] });
      }
      break;
    }

    case 'ui_call': {
      if (
        typeof p['turnId'] === 'string' &&
        typeof p['component'] === 'string' &&
        typeof p['props'] === 'object' &&
        p['props'] !== null
      ) {
        handlers.onUiCall?.({
          turnId: p['turnId'],
          component: p['component'],
          props: p['props'] as Record<string, unknown>,
        });
      }
      break;
    }

    case 'done': {
      if (
        typeof p['shouldStop'] === 'boolean' &&
        typeof p['completeness'] === 'number' &&
        typeof p['nextAction'] === 'string'
      ) {
        handlers.onDone?.({
          shouldStop: p['shouldStop'],
          completeness: p['completeness'],
          nextAction: p['nextAction'],
        });
      }
      break;
    }

    case 'error': {
      handlers.onError?.({
        type: typeof p['type'] === 'string' ? p['type'] : 'server_error',
        message: typeof p['message'] === 'string' ? p['message'] : undefined,
      });
      break;
    }

    // Unknown event names are silently ignored (forward compatibility).
  }
}

// ---------------------------------------------------------------------------
// Main streaming function
// ---------------------------------------------------------------------------

/**
 * Stream a refiner turn for the given brief.
 *
 * Opens a `POST /api/v1/briefs/:id/refine` request that returns
 * `text/event-stream` and dispatches each server-sent event to the supplied
 * handlers until the stream closes or the `signal` fires.
 *
 * @param briefId      UUID of the brief to refine.
 * @param userMessage  The user's latest message in the refiner conversation.
 * @param handlers     Event callbacks — any may be omitted.
 * @param signal       Optional AbortSignal to cancel the stream early.
 */
export async function streamRefine(
  briefId: string,
  userMessage: string,
  handlers: RefineHandlers,
  signal?: AbortSignal,
): Promise<void> {
  let res: Response;

  try {
    res = await fetch(`/api/v1/briefs/${briefId}/refine`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ userMessage }),
      signal,
    });
  } catch (err: unknown) {
    // Network failure or abort before a response arrived.
    const message = err instanceof Error ? err.message : String(err);
    handlers.onError?.({ type: 'network_error', message });
    return;
  }

  if (!res.ok || !res.body) {
    handlers.onError?.({
      type: 'http_error',
      message: `HTTP ${res.status} ${res.statusText}`,
    });
    return;
  }

  // ---------------------------------------------------------------------------
  // Stream reading loop
  // ---------------------------------------------------------------------------

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        // Flush any trailing incomplete frame (a well-formed SSE stream ends
        // with `\n\n`, but we handle the edge case defensively).
        const trailing = buffer.trim();
        if (trailing.length > 0) {
          const frame = parseFrame(trailing);
          if (frame) {
            dispatch(frame, handlers);
          }
        }
        break;
      }

      // Accumulate decoded bytes into the buffer.
      buffer += decoder.decode(value, { stream: true });

      // Split on `\n\n` to extract complete frames; keep any partial remainder.
      const parts = buffer.split('\n\n');

      // The last element is either empty (if the chunk ended with `\n\n`) or
      // an incomplete frame fragment — keep it in the buffer.
      buffer = parts.pop() ?? '';

      for (const part of parts) {
        const trimmed = part.trim();
        if (trimmed.length === 0) continue;

        const frame = parseFrame(trimmed);
        if (frame) {
          dispatch(frame, handlers);
        }
      }
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    handlers.onError?.({ type: 'stream_error', message });
  } finally {
    reader.releaseLock();
  }
}
