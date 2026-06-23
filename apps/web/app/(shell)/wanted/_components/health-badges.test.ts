import { describe, it, expect } from 'vitest';
import { healthBadgeFor } from './health-badges';

describe('healthBadgeFor', () => {
  it('classifies an unscored section as missing', () => {
    expect(healthBadgeFor(null)).toEqual({ cls: 'health-badge-missing', key: 'missing' });
  });

  it('classifies >= 0.6 as good (boundary inclusive)', () => {
    expect(healthBadgeFor(0.6).key).toBe('good');
    expect(healthBadgeFor(1).key).toBe('good');
  });

  it('classifies below 0.6 as weak', () => {
    expect(healthBadgeFor(0.59).key).toBe('weak');
    expect(healthBadgeFor(0).key).toBe('weak');
  });
});
