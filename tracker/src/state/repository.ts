import type { AppData } from '../domain/types';
import { looksLikeDemo, makeFresh, makeSeed, SCHEMA_VERSION } from '../domain/seed';
import { migrate } from './migrate';

/**
 * Where app data lives. R0/R1 use LocalRepository (this browser only).
 * R2 adds a FirestoreRepository with the same interface, so screens don't change.
 *
 * A browser with nothing saved starts as a fresh account. The Arjun demo is opt-in (loadDemo).
 */
export interface Repository {
  load(): AppData;
  save(data: AppData): void;
  /** Wipe this device back to a fresh account. */
  reset(): AppData;
  /** Replace this device's data with the demo account. */
  loadDemo(): AppData;
}

const KEY = 'peakx.data.v1';

export class LocalRepository implements Repository {
  load(): AppData {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = migrate(JSON.parse(raw));
        if (parsed) {
          const data = parsed.demo === undefined ? { ...parsed, demo: looksLikeDemo(parsed) } : parsed;
          if (data.version === SCHEMA_VERSION) this.save(data);
          return data;
        }
      }
    } catch { /* storage blocked or corrupt: start fresh */ }
    return this.reset();
  }
  save(data: AppData): void {
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* private mode: keep in memory only */ }
  }
  reset(): AppData {
    const fresh = makeFresh();
    this.save(fresh);
    return fresh;
  }
  loadDemo(): AppData {
    const seed = makeSeed();
    this.save(seed);
    return seed;
  }
}
