/**
 * Unit tests for high-level embed helpers.
 *
 * The `./voyage` module is mocked — NO live Voyage API calls.
 * Tests assert:
 *  - recipe text is built from the correct input fields,
 *  - the correct input_type is passed to Voyage,
 *  - best-effort variants return null on any error.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock the voyage client before importing the module under test.
// ---------------------------------------------------------------------------

const mockEmbedText = vi.fn<(text: string, inputType: 'query' | 'document') => Promise<number[]>>();

vi.mock('./voyage', () => ({
  embedText: (text: string, inputType: 'query' | 'document') => mockEmbedText(text, inputType),
  VoyageError: class VoyageError extends Error {
    name = 'VoyageError';
    status?: number;
    constructor(message: string, status?: number) {
      super(message);
      this.status = status;
    }
  },
}));

// Import AFTER the mock is registered. VoyageError resolves to the mock class.
import {
  embedBrief,
  embedApp,
  embedCapability,
  embedBriefBestEffort,
  embedAppBestEffort,
  embedCapabilityBestEffort,
} from './embed';
import { VoyageError } from './voyage';
import { briefEmbeddingText, appEmbeddingText, userCapabilityText } from '@hatch/shared';

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

const FAKE_VECTOR: number[] = [0.1, 0.2, 0.3];

beforeEach(() => {
  mockEmbedText.mockReset();
  mockEmbedText.mockResolvedValue(FAKE_VECTOR);
});

// ---------------------------------------------------------------------------
// embedBrief
// ---------------------------------------------------------------------------

describe('embedBrief', () => {
  it('calls embedText with the recipe text and input_type query', async () => {
    const input = {
      title: 'Invoicing tool',
      trigger: 'End of month',
      affected: 'Finance team',
      costOfNotSolving: 'Late payments',
      definitionOfGoodEnough: 'Sends invoices automatically',
      mustHaves: ['PDF export', 'Email delivery'],
    };

    const result = await embedBrief(input);

    expect(mockEmbedText).toHaveBeenCalledOnce();
    const [text, inputType] = mockEmbedText.mock.calls[0];
    expect(text).toBe(briefEmbeddingText(input));
    expect(inputType).toBe('query');
    expect(result).toEqual(FAKE_VECTOR);
  });

  it('handles partial input (optional fields omitted)', async () => {
    const input = { title: 'Minimal brief' };

    await embedBrief(input);

    const [text] = mockEmbedText.mock.calls[0];
    expect(text).toBe(briefEmbeddingText(input));
  });
});

// ---------------------------------------------------------------------------
// embedApp
// ---------------------------------------------------------------------------

describe('embedApp', () => {
  it('calls embedText with the recipe text and input_type document', async () => {
    const input = {
      name: 'InvoiceMaster',
      oneLiner: 'Automated invoicing',
      description: 'Send invoices in one click',
      solvesProblems: ['late payments', 'manual billing'],
      category: 'Finance',
    };

    const result = await embedApp(input);

    expect(mockEmbedText).toHaveBeenCalledOnce();
    const [text, inputType] = mockEmbedText.mock.calls[0];
    expect(text).toBe(appEmbeddingText(input));
    expect(inputType).toBe('document');
    expect(result).toEqual(FAKE_VECTOR);
  });

  it('handles partial input (optional fields omitted)', async () => {
    const input = { name: 'Minimal App' };

    await embedApp(input);

    const [text] = mockEmbedText.mock.calls[0];
    expect(text).toBe(appEmbeddingText(input));
  });
});

// ---------------------------------------------------------------------------
// embedCapability
// ---------------------------------------------------------------------------

describe('embedCapability', () => {
  it('calls embedText with the joined appTexts and input_type document', async () => {
    const appTexts = ['InvoiceMaster\nAutomated invoicing', 'HR Bot\nEmployee onboarding'];

    const result = await embedCapability(appTexts);

    expect(mockEmbedText).toHaveBeenCalledOnce();
    const [text, inputType] = mockEmbedText.mock.calls[0];
    expect(text).toBe(userCapabilityText({ appTexts }));
    expect(inputType).toBe('document');
    expect(result).toEqual(FAKE_VECTOR);
  });

  it('handles empty appTexts array', async () => {
    await embedCapability([]);

    const [text] = mockEmbedText.mock.calls[0];
    expect(text).toBe(userCapabilityText({ appTexts: [] }));
  });
});

// ---------------------------------------------------------------------------
// Best-effort variants — happy path
// ---------------------------------------------------------------------------

describe('best-effort variants — happy path', () => {
  it('embedBriefBestEffort returns the vector on success', async () => {
    const result = await embedBriefBestEffort({ title: 'X' });
    expect(result).toEqual(FAKE_VECTOR);
  });

  it('embedAppBestEffort returns the vector on success', async () => {
    const result = await embedAppBestEffort({ name: 'Y' });
    expect(result).toEqual(FAKE_VECTOR);
  });

  it('embedCapabilityBestEffort returns the vector on success', async () => {
    const result = await embedCapabilityBestEffort(['text']);
    expect(result).toEqual(FAKE_VECTOR);
  });
});

// ---------------------------------------------------------------------------
// Best-effort variants — error suppression
// ---------------------------------------------------------------------------

describe('best-effort variants — return null on error', () => {
  it('embedBriefBestEffort returns null when embedText throws VoyageError', async () => {
    mockEmbedText.mockRejectedValueOnce(new VoyageError('API key missing'));

    const result = await embedBriefBestEffort({ title: 'X' });
    expect(result).toBeNull();
  });

  it('embedBriefBestEffort returns null when embedText throws a generic Error', async () => {
    mockEmbedText.mockRejectedValueOnce(new Error('network error'));

    const result = await embedBriefBestEffort({ title: 'X' });
    expect(result).toBeNull();
  });

  it('embedAppBestEffort returns null when embedText throws VoyageError', async () => {
    mockEmbedText.mockRejectedValueOnce(new VoyageError('Rate limited', 429));

    const result = await embedAppBestEffort({ name: 'Y' });
    expect(result).toBeNull();
  });

  it('embedAppBestEffort returns null when embedText throws a generic Error', async () => {
    mockEmbedText.mockRejectedValueOnce(new Error('timeout'));

    const result = await embedAppBestEffort({ name: 'Y' });
    expect(result).toBeNull();
  });

  it('embedCapabilityBestEffort returns null when embedText throws VoyageError', async () => {
    mockEmbedText.mockRejectedValueOnce(new VoyageError('Server error', 503));

    const result = await embedCapabilityBestEffort(['text']);
    expect(result).toBeNull();
  });

  it('embedCapabilityBestEffort returns null when embedText throws a generic Error', async () => {
    mockEmbedText.mockRejectedValueOnce(new Error('unexpected'));

    const result = await embedCapabilityBestEffort(['text']);
    expect(result).toBeNull();
  });
});
