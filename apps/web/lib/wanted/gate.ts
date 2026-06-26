import { isWantedEnabled } from '@hatch/shared';

export class WantedDisabledError extends Error {
  constructor() {
    super('wanted_disabled');
    this.name = 'WantedDisabledError';
  }
}

export function assertWantedEnabled(
  profile: { feature_flags?: Record<string, unknown> | null } | null | undefined,
  env: { WANTED_V1_ENABLED?: string } = process.env as { WANTED_V1_ENABLED?: string },
): void {
  if (!isWantedEnabled(profile, env)) throw new WantedDisabledError();
}
