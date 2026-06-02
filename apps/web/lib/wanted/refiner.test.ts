/**
 * Unit tests for runRefinerTurn — the Anthropic client is injected so we
 * pass a hand-built fake. NO network calls are made.
 *
 * Fake shape must match what refiner.ts actually reads:
 *   stream   — AsyncIterable of stream events + .finalMessage() → Message
 *   create   — (body) → Message
 *
 * Stream events consumed by refiner.ts:
 *   { type: 'content_block_delta', delta: { type: 'text_delta', text: string } }
 *
 * Message shape consumed by refiner.ts:
 *   { content: ContentBlock[], usage: { input_tokens: number, output_tokens: number } }
 *
 * ContentBlock shapes refiner.ts checks:
 *   { type: 'text', text: string }
 *   { type: 'tool_use', name: string, input: unknown }
 */

import { describe, it, expect } from 'vitest';
import type { BriefContent } from '@hatch/shared';
import { runRefinerTurn } from './agents/refiner';

// ---------------------------------------------------------------------------
// Helpers — fake Anthropic client builders
// ---------------------------------------------------------------------------

/** A minimal fake stream event (text delta). */
function makeDeltaEvent(text: string) {
  return {
    type: 'content_block_delta' as const,
    delta: { type: 'text_delta' as const, text },
  };
}

/** Build a fake Anthropic Message with a tool_use block for update_brief_draft. */
function makeUpdateMessage(patch: object, tokensIn = 10, tokensOut = 5) {
  return {
    content: [
      { type: 'text', text: 'Here is an update.' },
      {
        type: 'tool_use',
        name: 'update_brief_draft',
        input: { patch },
      },
    ],
    usage: { input_tokens: tokensIn, output_tokens: tokensOut },
  };
}

/** Build a fake Anthropic Message with a mark_ready_for_matching tool_use. */
function makeMarkReadyMessage(tokensIn = 8, tokensOut = 3) {
  return {
    content: [
      { type: 'text', text: 'All done!' },
      {
        type: 'tool_use',
        name: 'mark_ready_for_matching',
        input: {},
      },
    ],
    usage: { input_tokens: tokensIn, output_tokens: tokensOut },
  };
}

/** Build a malformed Message (no tool_use at all). */
function makeMalformedMessage(tokensIn = 6, tokensOut = 2) {
  return {
    content: [{ type: 'text', text: 'Hmm, no tool.' }],
    usage: { input_tokens: tokensIn, output_tokens: tokensOut },
  };
}

/** Common shape for all fake messages passed to makeFakeStream / messages.create. */
type FakeMessage = {
  content: Array<{ type: string; text?: string; name?: string; input?: unknown }>;
  usage: { input_tokens: number; output_tokens: number };
};

/**
 * Build a fake stream object:
 * - AsyncIterable yielding the supplied events.
 * - `.finalMessage()` resolving to the supplied message.
 */
function makeFakeStream(
  events: Array<{ type: string; delta?: { type: string; text: string } }>,
  finalMsg: FakeMessage,
) {
  return {
    [Symbol.asyncIterator]() {
      let index = 0;
      return {
        async next() {
          if (index < events.length) {
            return { value: events[index++], done: false };
          }
          return { value: undefined as unknown, done: true };
        },
      };
    },
    finalMessage: async () => finalMsg,
  };
}

/** A base draft used across tests. */
const baseDraft: BriefContent = {
  problem: {},
  desiredOutcome: { mustHaves: [], niceToHaves: [], outOfScope: [] },
  context: { existingStack: [] },
  constraints: { licensing: 'no_pref', geography: null },
  preferredSolutionType: [],
};

// ---------------------------------------------------------------------------
// Test 1: Happy path — update_brief_draft tool call
// ---------------------------------------------------------------------------

describe('runRefinerTurn — happy path (update_brief_draft)', () => {
  it('yields token(s), then structured_update, then agent_message_done', async () => {
    const patch = { title: 'X', problem: { trigger: 't' } };
    const finalMsg = makeUpdateMessage(patch, 10, 5);
    const fakeStream = makeFakeStream(
      [makeDeltaEvent('Here '), makeDeltaEvent('is an update.')],
      finalMsg,
    );

    const fakeAnthropic = {
      messages: {
        stream: () => fakeStream,
        create: async () => {
          throw new Error('messages.create should NOT be called on happy path');
        },
      },
    };

    const events = [];
    for await (const event of runRefinerTurn({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      anthropic: fakeAnthropic as any,
      history: [],
      draft: baseDraft,
      userMessage: 'I need an invoicing tool',
    })) {
      events.push(event);
    }

    // Must have at least one token event
    const tokens = events.filter((e) => e.type === 'token');
    expect(tokens.length).toBeGreaterThanOrEqual(1);

    // Must have exactly one structured_update
    const updates = events.filter((e) => e.type === 'structured_update');
    expect(updates.length).toBe(1);
    const update = updates[0];
    expect(update.type).toBe('structured_update');
    if (update.type === 'structured_update') {
      expect(update.patch.title).toBe('X');
      expect(update.patch.problem?.trigger).toBe('t');
    }

    // Must NOT have mark_ready
    expect(events.filter((e) => e.type === 'mark_ready')).toHaveLength(0);

    // Must end with agent_message_done carrying correct token counts
    const done = events[events.length - 1];
    expect(done.type).toBe('agent_message_done');
    if (done.type === 'agent_message_done') {
      expect(done.tokensIn).toBe(10);
      expect(done.tokensOut).toBe(5);
    }

    // Order: tokens come before structured_update, structured_update before done
    const tokenIdx = events.findIndex((e) => e.type === 'token');
    const updateIdx = events.findIndex((e) => e.type === 'structured_update');
    const doneIdx = events.findIndex((e) => e.type === 'agent_message_done');
    expect(tokenIdx).toBeLessThan(updateIdx);
    expect(updateIdx).toBeLessThan(doneIdx);
  });
});

// ---------------------------------------------------------------------------
// Test 2: mark_ready_for_matching tool call
// ---------------------------------------------------------------------------

describe('runRefinerTurn — mark_ready path', () => {
  it('yields mark_ready event and agent_message_done when model calls mark_ready_for_matching', async () => {
    const finalMsg = makeMarkReadyMessage(8, 3);
    const fakeStream = makeFakeStream([makeDeltaEvent('All done!')], finalMsg);

    const fakeAnthropic = {
      messages: {
        stream: () => fakeStream,
        create: async () => {
          throw new Error('messages.create should NOT be called on mark_ready path');
        },
      },
    };

    const events = [];
    for await (const event of runRefinerTurn({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      anthropic: fakeAnthropic as any,
      history: [],
      draft: baseDraft,
      userMessage: 'Everything looks good',
    })) {
      events.push(event);
    }

    // Must have mark_ready
    const markReadyEvents = events.filter((e) => e.type === 'mark_ready');
    expect(markReadyEvents.length).toBe(1);

    // structured_update must NOT be present (no patch)
    expect(events.filter((e) => e.type === 'structured_update')).toHaveLength(0);

    // Must end with agent_message_done
    const done = events[events.length - 1];
    expect(done.type).toBe('agent_message_done');
    if (done.type === 'agent_message_done') {
      expect(done.tokensIn).toBe(8);
      expect(done.tokensOut).toBe(3);
    }
  });
});

// ---------------------------------------------------------------------------
// Test 3: Retry path — first response is malformed, retry provides valid patch
// ---------------------------------------------------------------------------

describe('runRefinerTurn — retry path', () => {
  it('does NOT throw when first message is malformed; retry provides a valid patch', async () => {
    // Attempt 1: malformed (no tool_use)
    const malformedMsg = makeMalformedMessage(6, 2);
    const fakeStream = makeFakeStream([makeDeltaEvent('Hmm, no tool.')], malformedMsg);

    // Attempt 2 (retry via messages.create): valid update_brief_draft
    const retryPatch = { title: 'Retry result' };
    const retryMsg = makeUpdateMessage(retryPatch, 7, 4);

    const fakeAnthropic = {
      messages: {
        stream: () => fakeStream,
        create: async () => retryMsg,
      },
    };

    const events = [];
    for await (const event of runRefinerTurn({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      anthropic: fakeAnthropic as any,
      history: [],
      draft: baseDraft,
      userMessage: 'Please refine',
    })) {
      events.push(event);
    }

    // Must not throw — generator must complete
    expect(events.length).toBeGreaterThan(0);

    // Must end with agent_message_done
    const done = events[events.length - 1];
    expect(done.type).toBe('agent_message_done');

    // Token counts are accumulated (attempt 1 + retry)
    if (done.type === 'agent_message_done') {
      // 6+7 = 13 input tokens total
      expect(done.tokensIn).toBe(13);
      // 2+4 = 6 output tokens total
      expect(done.tokensOut).toBe(6);
    }

    // The retry's patch should appear as a structured_update
    const updates = events.filter((e) => e.type === 'structured_update');
    expect(updates.length).toBe(1);
    if (updates[0].type === 'structured_update') {
      expect(updates[0].patch.title).toBe('Retry result');
    }
  });

  it('does NOT throw when both attempts are malformed (double-malformed degrades gracefully)', async () => {
    // Attempt 1: malformed
    const malformedMsg1 = makeMalformedMessage(4, 1);
    const fakeStream = makeFakeStream([], malformedMsg1);

    // Attempt 2 (retry): also malformed
    const malformedMsg2 = makeMalformedMessage(3, 1);

    const fakeAnthropic = {
      messages: {
        stream: () => fakeStream,
        create: async () => malformedMsg2,
      },
    };

    // Collect events directly — the generator must complete without throwing.
    const events = [];
    for await (const event of runRefinerTurn({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      anthropic: fakeAnthropic as any,
      history: [],
      draft: baseDraft,
      userMessage: 'test',
    })) {
      events.push(event);
    }

    // Must always end with agent_message_done regardless
    expect(events.length).toBeGreaterThan(0);
    const done = events[events.length - 1];
    expect(done.type).toBe('agent_message_done');

    // No structured_update when both are malformed
    expect(events.filter((e) => e.type === 'structured_update')).toHaveLength(0);
    // No mark_ready when both are malformed
    expect(events.filter((e) => e.type === 'mark_ready')).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Test 4: History is threaded correctly (smoke test — no assertion on content,
// just that the function accepts and processes history without error)
// ---------------------------------------------------------------------------

describe('runRefinerTurn — history threading', () => {
  it('accepts non-empty history and runs without error', async () => {
    const patch = { problem: { trigger: 'Monthly chaos' } };
    const finalMsg = makeUpdateMessage(patch, 12, 6);
    const fakeStream = makeFakeStream([makeDeltaEvent('Got it.')], finalMsg);

    const fakeAnthropic = {
      messages: { stream: () => fakeStream, create: async () => finalMsg },
    };

    const events = [];
    for await (const event of runRefinerTurn({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      anthropic: fakeAnthropic as any,
      history: [
        { role: 'USER', content: 'I need something for invoicing.' },
        { role: 'AGENT', content: 'What triggers the problem?' },
      ],
      draft: baseDraft,
      userMessage: 'End of month chaos',
    })) {
      events.push(event);
    }

    expect(events[events.length - 1].type).toBe('agent_message_done');
  });
});
