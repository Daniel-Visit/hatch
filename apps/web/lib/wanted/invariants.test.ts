import { describe, it, expect } from 'vitest';
import {
  MAX_ACTIVE_BRIEFS,
  isQuotaExceeded,
  meetsQualityGate,
  chatRequiresUserTurn,
  BriefQuotaExceededError,
} from './invariants';

describe('MAX_ACTIVE_BRIEFS', () => {
  it('is 3', () => {
    expect(MAX_ACTIVE_BRIEFS).toBe(3);
  });
});

describe('isQuotaExceeded', () => {
  it('returns false when activeCount is 0', () => {
    expect(isQuotaExceeded(0)).toBe(false);
  });

  it('returns false when activeCount is 2 (below the limit)', () => {
    expect(isQuotaExceeded(2)).toBe(false);
  });

  it('returns true when activeCount equals MAX_ACTIVE_BRIEFS (3)', () => {
    expect(isQuotaExceeded(3)).toBe(true);
  });

  it('returns true when activeCount exceeds MAX_ACTIVE_BRIEFS (4)', () => {
    expect(isQuotaExceeded(4)).toBe(true);
  });
});

describe('meetsQualityGate', () => {
  it('returns true when both scores are exactly 0.5', () => {
    expect(meetsQualityGate(0.5, 0.5)).toBe(true);
  });

  it('returns false when completenessScore is below 0.5 (0.49)', () => {
    expect(meetsQualityGate(0.49, 0.9)).toBe(false);
  });

  it('returns false when qualityScore is below 0.5 (0.4)', () => {
    expect(meetsQualityGate(0.9, 0.4)).toBe(false);
  });

  it('returns true when both scores are 1', () => {
    expect(meetsQualityGate(1, 1)).toBe(true);
  });

  it('returns false when both scores are below 0.5', () => {
    expect(meetsQualityGate(0.3, 0.3)).toBe(false);
  });
});

describe('chatRequiresUserTurn', () => {
  it('returns false for CHAT entry mode with 0 user turns (invariant not satisfied)', () => {
    expect(chatRequiresUserTurn('CHAT', 0)).toBe(false);
  });

  it('returns true for CHAT entry mode with 1 user turn (invariant satisfied)', () => {
    expect(chatRequiresUserTurn('CHAT', 1)).toBe(true);
  });

  it('returns true for FORM entry mode regardless of user turn count (invariant does not apply)', () => {
    expect(chatRequiresUserTurn('FORM', 0)).toBe(true);
  });

  it('returns true for PASTE entry mode regardless of user turn count (invariant does not apply)', () => {
    expect(chatRequiresUserTurn('PASTE', 0)).toBe(true);
  });

  it('returns true for CHAT entry mode with multiple user turns', () => {
    expect(chatRequiresUserTurn('CHAT', 5)).toBe(true);
  });
});

describe('BriefQuotaExceededError', () => {
  it('has name "BriefQuotaExceededError"', () => {
    const err = new BriefQuotaExceededError(3);
    expect(err.name).toBe('BriefQuotaExceededError');
  });

  it('includes the active count in the message', () => {
    const err = new BriefQuotaExceededError(3);
    expect(err.message).toContain('3');
  });

  it('is an instance of Error', () => {
    const err = new BriefQuotaExceededError(3);
    expect(err).toBeInstanceOf(Error);
  });

  it('message includes the max limit', () => {
    const err = new BriefQuotaExceededError(3);
    expect(err.message).toContain(String(MAX_ACTIVE_BRIEFS));
  });
});
