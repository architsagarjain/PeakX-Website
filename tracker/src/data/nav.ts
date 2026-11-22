export type NavKey = 'week' | 'plan' | 'log' | 'insights' | 'reviews' | 'coach' | 'recipes' | 'form' | 'devices' | 'check' | 'account' | 'setup' | 'upgrade' | 'labs' | 'supps' | 'desk';

export const NAV: { key: NavKey; label: string; icon: string; to: string }[] = [
  { key: 'week', label: 'Home', icon: 'home', to: '/' },
  { key: 'plan', label: 'Plan', icon: 'list', to: '/app/plan/meals' },
  { key: 'log', label: 'Log', icon: 'bowl', to: '/app/log' },
  { key: 'insights', label: 'Insights', icon: 'trend', to: '/app/insights' },
  { key: 'reviews', label: 'Reviews', icon: 'doc', to: '/app/reviews/weekly/latest' },
  { key: 'coach', label: 'Coach', icon: 'spark', to: '/app/coach' },
];

export const SHORTCUTS: { key: NavKey; label: string; icon: string; to: string }[] = [
  { key: 'check', label: 'Plateau check', icon: 'target', to: '/app/plateau-check' },
  { key: 'form', label: 'Form Check', icon: 'video', to: '/app/reviews/form-check' },
  { key: 'labs', label: 'Blood work', icon: 'drop', to: '/app/reviews/blood-work' },
  { key: 'supps', label: 'Supplements', icon: 'hex', to: '/app/insights/supplements' },
  { key: 'devices', label: 'Devices', icon: 'pulse', to: '/app/devices' },
];

/** Mobile dock under 768px. Log is the raised mic in the middle; Tools and Reviews move into the avatar menu. */
export const DOCK = (['week', 'plan', 'log', 'insights', 'coach'] as NavKey[]).map((k) => NAV.find((n) => n.key === k)!);

/** Shown only to coaches. */
export const DESK = { key: 'desk' as NavKey, label: 'Coach desk', icon: 'list', to: '/app/coach-desk' };
