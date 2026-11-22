import { useEffect, useState } from 'react';

/** Food aliases coaches matched in the coach desk (config/aliases), loaded after sign-in. */
let aliases: Record<string, string> = {};
const listeners = new Set<() => void>();
export function setFoodAliases(m: Record<string, string>) { aliases = m; listeners.forEach((f) => f()); }
export function useFoodAliases(): Record<string, string> {
  const [, bump] = useState(0);
  useEffect(() => { const f = () => bump((x) => x + 1); listeners.add(f); return () => { listeners.delete(f); }; }, []);
  return aliases;
}
