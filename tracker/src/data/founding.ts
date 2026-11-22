/**
 * Prices and the early bird offer: the one place the website, pricing page, checkout server and lock
 * screens read from. The early bird offer (internally the 'founding' kind) is 50% off the first month
 * of Pro for the first EARLY.places paying members, counted from 19 Oct 2026; it closes after that.
 * `taken` is the starting count; once payments are on, the live count comes from the server (/api/pay)
 * and setLiveTaken() updates it.
 */
export const FOUNDING = { name: 'Early bird offer', places: 5, taken: 0, price: 99, discount: 50 } as const;
export const PRO = { monthly: 199, yearly: 1999 } as const;
/** Coached price isn't decided yet: null shows "On request" and keeps Coached checkout off. */
export const COACHED: { monthly: number | null } = { monthly: null };

let liveTaken: number | null = null;
export function setLiveTaken(n: number | null) { liveTaken = n; }
export function takenNow(): number { return liveTaken ?? FOUNDING.taken; }
export function placesLeft(): number { return Math.max(0, FOUNDING.places - takenNow()); }
export const earlyBirdOpen = () => placesLeft() > 0;

/** "3 of 5 slots left" / "Early bird closed" */
export function placesLine(): string {
  const left = placesLeft();
  return left === 0 ? 'Early bird closed' : `${left} of ${FOUNDING.places} slots left`;
}

export const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;
