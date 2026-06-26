import { describe, it, expect } from 'vitest';
import { isWantedEnabled } from './feature-flags';

describe('isWantedEnabled', () => {
  it('returns true when WANTED_V1_ENABLED is "true" and profile is null', () => {
    expect(isWantedEnabled(null, { WANTED_V1_ENABLED: 'true' })).toBe(true);
  });

  it('returns true when WANTED_V1_ENABLED is "true" and profile has no feature_flags', () => {
    const profile = { feature_flags: null };
    expect(isWantedEnabled(profile, { WANTED_V1_ENABLED: 'true' })).toBe(true);
  });

  it('returns true when WANTED_V1_ENABLED is "true" and profile does not have the wanted flag', () => {
    const profile = { feature_flags: { some_other_flag: true } };
    expect(isWantedEnabled(profile, { WANTED_V1_ENABLED: 'true' })).toBe(true);
  });

  it('returns true via per-user canary when env is empty and profile.feature_flags.wanted_v1_enabled is true', () => {
    const profile = { feature_flags: { wanted_v1_enabled: true } };
    expect(isWantedEnabled(profile, {})).toBe(true);
  });

  it('returns true when WANTED_V1_ENABLED is "false" but profile.feature_flags.wanted_v1_enabled is true (canary overrides global-off)', () => {
    const profile = { feature_flags: { wanted_v1_enabled: true } };
    expect(isWantedEnabled(profile, { WANTED_V1_ENABLED: 'false' })).toBe(true);
  });

  it('returns false when env is empty and profile has no feature_flags', () => {
    const profile = { feature_flags: null };
    expect(isWantedEnabled(profile, {})).toBe(false);
  });

  it('returns false when env is empty and profile is null', () => {
    expect(isWantedEnabled(null, {})).toBe(false);
  });

  it('returns false when env is empty and profile is undefined', () => {
    expect(isWantedEnabled(undefined, {})).toBe(false);
  });

  it('returns false when env is empty and profile has other flags but not wanted_v1_enabled', () => {
    const profile = { feature_flags: { beta_ui: true } };
    expect(isWantedEnabled(profile, {})).toBe(false);
  });

  it('returns false when WANTED_V1_ENABLED is "false" and profile has no flag', () => {
    const profile = { feature_flags: null };
    expect(isWantedEnabled(profile, { WANTED_V1_ENABLED: 'false' })).toBe(false);
  });

  it('returns false when WANTED_V1_ENABLED is "1" (not exactly "true") and no canary', () => {
    expect(isWantedEnabled(null, { WANTED_V1_ENABLED: '1' })).toBe(false);
  });

  it('returns false when wanted_v1_enabled is "true" (string, not boolean) in profile flags', () => {
    const profile = { feature_flags: { wanted_v1_enabled: 'true' } };
    expect(isWantedEnabled(profile, {})).toBe(false);
  });
});
