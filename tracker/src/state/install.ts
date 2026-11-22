/** Add to home screen (S24.1): keep the browser's install prompt so a button can show it later. */
type PromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };
let deferred: PromptEvent | null = null;
const listeners = new Set<() => void>();

export function installGlobalInstallHandlers() {
  if (typeof window === 'undefined') return;
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e as PromptEvent; listeners.forEach((f) => f()); });
  window.addEventListener('appinstalled', () => { deferred = null; listeners.forEach((f) => f()); });
  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => { navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => undefined); });
  }
}
export const isInstalled = () => typeof window !== 'undefined' && (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);
export const canPromptInstall = () => !!deferred;
/** Show the install prompt if the browser offered one; otherwise return how to do it by hand. */
export async function promptInstall(): Promise<'installed' | 'dismissed' | string> {
  if (deferred) {
    const e = deferred; deferred = null;
    await e.prompt();
    const { outcome } = await e.userChoice;
    return outcome === 'accepted' ? 'installed' : 'dismissed';
  }
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua)) return 'In Safari, tap Share, then Add to Home Screen.';
  if (/Android/.test(ua)) return 'In Chrome, open the ⋮ menu and tap Add to Home screen.';
  return 'In Chrome or Edge, click the install icon in the address bar, or open the menu and choose Install PeakX.';
}
