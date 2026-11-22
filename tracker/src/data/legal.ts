/**
 * Business details used on the legal and contact pages (S24.2). CONFIRM before launch: the registered
 * entity name, address, phone and the grievance officer are placeholders until the founders fill them in.
 */
export const LEGAL = {
  brand: 'PeakX',
  entity: 'PeakX',                       // registered business name, e.g. "PeakX Fitness Private Limited"
  address: 'Gurugram, Haryana, India',   // full registered address
  email: 'support@peakx.live',
  phone: null as string | null,          // e.g. '+91 98xxx xxxxx' (Razorpay asks for one)
  grievance: { name: 'Grievance Officer, PeakX', email: 'grievance@peakx.live' },
  updated: '2026-10-15',
};
