import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldPath, getFirestore } from 'firebase-admin/firestore';
import { HttpError } from './http.js';
import { supaUser } from './supa.js';
import { joinData, type DayDoc, type RootDoc } from '../../src/domain/cloudData.js';
import type { AppData } from '../../src/domain/types.js';

/** Firebase Admin for server jobs. Env: FIREBASE_SERVICE_ACCOUNT = the service-account JSON (one line). */
export function admin() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new HttpError(503, 'Server data access is not configured');
  if (!getApps().length) initializeApp({ credential: cert(JSON.parse(raw)) });
  return { db: getFirestore(), auth: getAuth() };
}

/** A user's data with day logs from `since` on (enough history for reports without reading everything). */
export async function loadUserData(uid: string, since: string): Promise<AppData | null> {
  const { db } = admin();
  const root = await db.doc(`users/${uid}`).get();
  if (!root.exists) return null;
  const days = await db.collection(`users/${uid}/days`).where(FieldPath.documentId(), '>=', since).get();
  const map: Record<string, DayDoc> = {};
  days.forEach((d) => { map[d.id] = d.data() as DayDoc; });
  const { updatedAt: _u, ...rest } = root.data() as RootDoc & { updatedAt?: unknown };
  return joinData(rest as RootDoc, map);
}

/** Every user id, in pages. */
export async function* userIds(page = 200): AsyncGenerator<string> {
  const { db } = admin();
  let last: string | null = null;
  for (;;) {
    let q = db.collection('users').orderBy(FieldPath.documentId()).limit(page);
    if (last) q = q.startAfter(last);
    const snap = await q.get();
    if (snap.empty) return;
    for (const d of snap.docs) yield d.id;
    last = snap.docs[snap.docs.length - 1].id;
    if (snap.size < page) return;
  }
}

/** The signed-in user. Accounts are on Supabase, so the token is a Supabase access token. */
export const userFrom = (req: Request) => supaUser(req);

export interface CoachDoc { uid: string; name: string; email: string | null; whatsapp: string | null; bookingUrl: string | null; addedAt: string }
/** The signed-in coach (coaches/{uid} exists), or 403. */
export async function coachFrom(req: Request): Promise<CoachDoc> {
  const u = await userFrom(req);
  const snap = await admin().db.doc(`coaches/${u.uid}`).get();
  if (!snap.exists) throw new HttpError(403, 'This account isn’t a coach');
  return { ...(snap.data() as CoachDoc), uid: u.uid };
}

/** The Storage bucket for uploads (env FIREBASE_STORAGE_BUCKET, else the project's default bucket). */
export async function bucket() {
  admin();
  const { getStorage } = await import('firebase-admin/storage');
  const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT ?? '{}') as { project_id?: string };
  return getStorage().bucket(process.env.FIREBASE_STORAGE_BUCKET || `${sa.project_id}.firebasestorage.app`);
}
