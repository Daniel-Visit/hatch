// Feature flags — pure, dependency-free helpers.
// Global env flag wins; per-user canary is the fallback.

/**
 * Returns true if the Wanted / Brief & Match feature is enabled for a given
 * profile and environment.
 *
 * - `env.WANTED_V1_ENABLED === 'true'` turns the feature on globally.
 * - `profile.feature_flags.wanted_v1_enabled === true` enables it per-user
 *   (canary rollout).
 *
 * Neither side effect nor I/O — callers supply both arguments.
 */
export function isWantedEnabled(
  profile: { feature_flags?: Record<string, unknown> | null } | null | undefined,
  env: { WANTED_V1_ENABLED?: string },
): boolean {
  if (env.WANTED_V1_ENABLED === 'true') return true; // global on
  return profile?.feature_flags?.wanted_v1_enabled === true; // per-user canary
}
