import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { releaseFor } from '../data/roadmap';

type Toast = { id: number; text: string; tone: 'info' | 'good' };
const Ctx = createContext<(text: string, tone?: Toast['tone']) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((text: string, tone: Toast['tone'] = 'info') => {
    const id = Date.now() + Math.random();
    setItems((xs) => [...xs.slice(-2), { id, text, tone }]);
    setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), 3600);
  }, []);
  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="app-toasts" role="status" aria-live="polite">
        {items.map((t) => <div key={t.id} className={`app-toast ${t.tone}`}>{t.text}</div>)}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() { return useContext(Ctx); }

/** For controls that aren't built yet: says which release delivers them, instead of doing nothing. */
export function useSoon() {
  const toast = useToast();
  return useCallback((label: string) => {
    const { release, area } = releaseFor(label);
    toast(`“${label.replace(/\s+/g, ' ').trim()}” arrives with ${area} in ${release}.`);
  }, [toast]);
}
