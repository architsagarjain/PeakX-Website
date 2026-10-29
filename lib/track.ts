type Fbq = (cmd: string, ev: string, data?: Record<string, unknown>) => void;

/** Fire a Meta Pixel standard event if the pixel is loaded. Safe to call anywhere on the client. */
export function track(event: string, data?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  const fbq = (window as unknown as { fbq?: Fbq }).fbq;
  try { fbq?.("track", event, data); } catch { /* ignore */ }
}
