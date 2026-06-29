import { describe, it, expect } from 'vitest';
import { RequestPreferencesInput } from '@/lib/zod/request-preferences';

const validPayload = {
  accepts_requests: true,
  request_capacity: 5,
  request_domains: ['ai', 'web'],
  inferred_capabilities: ['Next.js', 'Supabase'],
  request_rate_band: 'FROM_500_2K' as const,
};

describe('RequestPreferencesInput — request_capacity', () => {
  it('rejects capacity above max (21)', () => {
    const result = RequestPreferencesInput.safeParse({ ...validPayload, request_capacity: 21 });
    expect(result.success).toBe(false);
  });

  it('rejects capacity below min (-1)', () => {
    const result = RequestPreferencesInput.safeParse({ ...validPayload, request_capacity: -1 });
    expect(result.success).toBe(false);
  });
});

describe('RequestPreferencesInput — array item length', () => {
  it('rejects a request_domains item longer than 64 chars', () => {
    const longItem = 'a'.repeat(65);
    const result = RequestPreferencesInput.safeParse({
      ...validPayload,
      request_domains: [longItem],
    });
    expect(result.success).toBe(false);
  });

  it('rejects an inferred_capabilities item longer than 64 chars', () => {
    const longItem = 'b'.repeat(65);
    const result = RequestPreferencesInput.safeParse({
      ...validPayload,
      inferred_capabilities: [longItem],
    });
    expect(result.success).toBe(false);
  });
});

describe('RequestPreferencesInput — array max length', () => {
  it('rejects request_domains with more than 32 items', () => {
    const result = RequestPreferencesInput.safeParse({
      ...validPayload,
      request_domains: Array.from({ length: 33 }, (_, i) => `domain-${i}`),
    });
    expect(result.success).toBe(false);
  });

  it('rejects inferred_capabilities with more than 32 items', () => {
    const result = RequestPreferencesInput.safeParse({
      ...validPayload,
      inferred_capabilities: Array.from({ length: 33 }, (_, i) => `cap-${i}`),
    });
    expect(result.success).toBe(false);
  });
});

describe('RequestPreferencesInput — request_rate_band', () => {
  it('rejects an invalid enum value', () => {
    const result = RequestPreferencesInput.safeParse({
      ...validPayload,
      request_rate_band: 'INVALID_BAND',
    });
    expect(result.success).toBe(false);
  });

  it('accepts null for request_rate_band', () => {
    const result = RequestPreferencesInput.safeParse({
      ...validPayload,
      request_rate_band: null,
    });
    expect(result.success).toBe(true);
  });
});

describe('RequestPreferencesInput — full valid payload', () => {
  it('accepts a complete valid payload', () => {
    const result = RequestPreferencesInput.safeParse(validPayload);
    expect(result.success).toBe(true);
  });
});
