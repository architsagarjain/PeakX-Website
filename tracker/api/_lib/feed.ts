import { createHmac } from 'node:crypto';
import { sameSig } from './razorpay.js';

/** Signed links that work without signing in: the calendar feed and email unsubscribe (S22.1). */
const secret = () => process.env.FEED_SECRET || process.env.CRON_SECRET || '';
export type FeedType = 'ics' | 'unsub';
export const feedToken = (uid: string, type: FeedType) => createHmac('sha256', secret()).update(`${type}:${uid}`).digest('hex').slice(0, 32);
export const feedOk = (uid: string, type: FeedType, k: string) => !!secret() && !!uid && sameSig(feedToken(uid, type), k ?? '');
const site = () => (process.env.SITE_URL ?? 'https://peakx.live').replace(/\/$/, '');
export function feedUrl(uid: string, type: FeedType): string {
  const q = `u=${encodeURIComponent(uid)}&k=${feedToken(uid, type)}`;
  return type === 'ics' ? `${site()}/api/calendar.ics?${q}` : `${site()}/api/feed?type=unsub&${q}`;
}
