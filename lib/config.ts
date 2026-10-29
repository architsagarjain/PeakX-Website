/* ─────────────────────────────────────────────────────────────
   PeakX settings — edit before going live.
   ───────────────────────────────────────────────────────────── */
export const site = {
  url: "https://peakx.in",
  name: "PeakX",
  coach: "Bhavika Agarwal",
  instagram: "https://www.instagram.com/fitwithbhavika/",
  instagramBrand: "https://www.instagram.com/peakx_fit/",
  email: "hello@peakx.in",

  // Meta Pixel ID from Events Manager. Leave "" to switch the pixel off.
  metaPixelId: process.env.NEXT_PUBLIC_META_PIXEL_ID ?? "",
  // Where qualified applicants book their discovery call (Calendly, Cal.com…).
  bookingUrl: process.env.NEXT_PUBLIC_BOOKING_URL ?? "https://calendly.com/REPLACE-ME/discovery-call",
  // Free guide for people who aren't ready yet.
  leadMagnetUrl: process.env.NEXT_PUBLIC_LEAD_MAGNET_URL ?? "https://www.instagram.com/fitwithbhavika/",
  // WhatsApp number, digits only with country code (e.g. 919876543210). Fallback if the form fails.
  whatsapp: process.env.NEXT_PUBLIC_WHATSAPP ?? "",
};

export const faqs: { q: string; a: string }[] = [
  { q: "How much does coaching cost?", a: "It depends on the length of your program: 12, 24 or 48 weeks. Longer programs cost less per month. Bhavika walks you through the options on your discovery call, and part-payment is available." },
  { q: "Will I really keep eating rice and sweets?", a: "Yes. Your diet plan is built from the food you already eat. You learn portions and balance, not a list of banned foods." },
  { q: "How much weight can I lose in 12 weeks?", a: "Clients who complete every check-in typically lose 5–8 kg of fat in 12 weeks. If your goal is bigger, the 24-week program is the realistic route, and it costs less per month." },
  { q: "Do I need a gym?", a: "No. Plans work at home with a pair of dumbbells, or in a gym. Tell us what you have access to in your application." },
  { q: "I'm vegetarian, Jain or vegan. Will that work?", a: "Yes. Every diet plan is written for your preferences, including protein targets that work without meat." },
  { q: "I live in the US. Can I join?", a: "Yes. Many clients are in the US. Check-ins happen on WhatsApp and email, so time zones aren't a problem, and calls are scheduled at a time that suits you." },
  { q: "I have a medical condition. Can I still apply?", a: "Mention it in your application. Bhavika will tell you honestly on the call whether coaching is right for you, and may ask you to check with your doctor first." },
  { q: "What if I miss a week?", a: "Check in anyway. A bad week is information, not failure. Your plan gets adjusted and you keep going." },
];
