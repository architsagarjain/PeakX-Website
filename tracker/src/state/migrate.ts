import type { AppData } from '../domain/types';
import { emptyPlateau, R3_DEFAULTS, R5_DEFAULTS, R6_DEFAULTS, R7_DEFAULTS, SCHEMA_VERSION } from '../domain/seed';
import { draftFromProfile } from '../domain/onboarding';

/**
 * Bring saved data up to the current schema, so returning users keep their logs.
 * Returns null when the data is too old or unknown; the caller then starts from the seed.
 */
export function migrate(raw: unknown): AppData | null {
  if (!raw || typeof raw !== 'object') return null;
  let d = raw as AppData & { version?: number };
  if (d.version === 1) {
    const kg = d.weights?.[d.weights.length - 1]?.kg ?? 70;
    d = { ...d, version: 2, plateau: emptyPlateau(), onboarding: { step: 'plan', done: true, draft: draftFromProfile(d.profile, kg) } };
  }
  if (d.version === 2) d = { ...d, version: 3, sport: null };
  if (d.version === 3) d = { ...d, ...R3_DEFAULTS(), version: 4 };
  if (d.version === 4) d = { ...d, ...R5_DEFAULTS(), version: 5 };
  if (d.version === 5) d = { ...d, ...R6_DEFAULTS(), version: 6 };
  if (d.version === 6) d = { ...d, ...R7_DEFAULTS(), version: 7 };
  return d.version === SCHEMA_VERSION ? d : null;
}
