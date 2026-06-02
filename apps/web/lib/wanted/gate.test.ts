import { describe, it, expect } from 'vitest';
import { assertWantedEnabled, WantedDisabledError } from './gate';

// ---------------------------------------------------------------------------
// assertWantedEnabled — pure, no DB, no network
// ---------------------------------------------------------------------------

describe('assertWantedEnabled', () => {
  // -------------------------------------------------------------------------
  // Global env flag overrides everything
  // -------------------------------------------------------------------------
  it('does NOT throw when WANTED_V1_ENABLED=true (any profile)', () => {
    const env = { WANTED_V1_ENABLED: 'true' };
    expect(() => assertWantedEnabled(null, env)).not.toThrow();
    expect(() => assertWantedEnabled(undefined, env)).not.toThrow();
    expect(() => assertWantedEnabled({ feature_flags: null }, env)).not.toThrow();
    expect(() =>
      assertWantedEnabled({ feature_flags: { wanted_v1_enabled: false } }, env),
    ).not.toThrow();
  });

  it('does NOT throw when env flag is true and profile has no feature_flags', () => {
    const env = { WANTED_V1_ENABLED: 'true' };
    expect(() => assertWantedEnabled({}, env)).not.toThrow();
  });

  // -------------------------------------------------------------------------
  // Per-user canary — profile flag enables when env is off
  // -------------------------------------------------------------------------
  it('does NOT throw when env off but profile.feature_flags.wanted_v1_enabled === true', () => {
    const env = { WANTED_V1_ENABLED: 'false' };
    const profile = { feature_flags: { wanted_v1_enabled: true } };
    expect(() => assertWantedEnabled(profile, env)).not.toThrow();
  });

  it('does NOT throw when env absent but profile.feature_flags.wanted_v1_enabled === true', () => {
    const env: { WANTED_V1_ENABLED?: string } = {};
    const profile = { feature_flags: { wanted_v1_enabled: true } };
    expect(() => assertWantedEnabled(profile, env)).not.toThrow();
  });

  // -------------------------------------------------------------------------
  // Disabled — throws WantedDisabledError
  // -------------------------------------------------------------------------
  it('throws WantedDisabledError when env off and profile is null', () => {
    const env = { WANTED_V1_ENABLED: 'false' };
    expect(() => assertWantedEnabled(null, env)).toThrow(WantedDisabledError);
  });

  it('throws WantedDisabledError when env off and profile is undefined', () => {
    const env = { WANTED_V1_ENABLED: 'false' };
    expect(() => assertWantedEnabled(undefined, env)).toThrow(WantedDisabledError);
  });

  it('throws WantedDisabledError when env off and profile has no feature_flags', () => {
    const env = { WANTED_V1_ENABLED: 'false' };
    expect(() => assertWantedEnabled({}, env)).toThrow(WantedDisabledError);
  });

  it('throws WantedDisabledError when env off and profile.feature_flags is null', () => {
    const env = { WANTED_V1_ENABLED: 'false' };
    expect(() => assertWantedEnabled({ feature_flags: null }, env)).toThrow(WantedDisabledError);
  });

  it('throws WantedDisabledError when env off and wanted_v1_enabled flag is false', () => {
    const env = { WANTED_V1_ENABLED: 'false' };
    const profile = { feature_flags: { wanted_v1_enabled: false } };
    expect(() => assertWantedEnabled(profile, env)).toThrow(WantedDisabledError);
  });

  it('throws WantedDisabledError when env absent and profile has no canary flag', () => {
    const env: { WANTED_V1_ENABLED?: string } = {};
    expect(() => assertWantedEnabled(null, env)).toThrow(WantedDisabledError);
  });

  it('throws WantedDisabledError with name "WantedDisabledError"', () => {
    const env = { WANTED_V1_ENABLED: 'false' };
    let thrown: unknown;
    try {
      assertWantedEnabled(null, env);
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(WantedDisabledError);
    expect((thrown as WantedDisabledError).name).toBe('WantedDisabledError');
  });

  it('throws WantedDisabledError with message "wanted_disabled"', () => {
    const env = { WANTED_V1_ENABLED: 'false' };
    let thrown: unknown;
    try {
      assertWantedEnabled(null, env);
    } catch (e) {
      thrown = e;
    }
    expect((thrown as Error).message).toBe('wanted_disabled');
  });

  // -------------------------------------------------------------------------
  // Edge: WANTED_V1_ENABLED must be exactly the string 'true' — not '1' etc.
  // -------------------------------------------------------------------------
  it('treats WANTED_V1_ENABLED="1" as off (not exactly "true")', () => {
    const env = { WANTED_V1_ENABLED: '1' };
    // Per-user flag also off → must throw
    expect(() => assertWantedEnabled(null, env)).toThrow(WantedDisabledError);
  });

  it('treats WANTED_V1_ENABLED="TRUE" as off (case-sensitive)', () => {
    const env = { WANTED_V1_ENABLED: 'TRUE' };
    expect(() => assertWantedEnabled(null, env)).toThrow(WantedDisabledError);
  });
});
