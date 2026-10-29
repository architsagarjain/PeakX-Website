/* ─────────────────────────────────────────────────────────────
   Client stories, shown on the home page and /apply in this order.
   Put media in /public/clients/ and reference it as "/clients/file.mp4".

   { type: "video", src: "/clients/neha.mp4", poster: "/clients/neha.webp",
     name: "Neha S.", meta: "Product manager, Pune", result: "−6.2 kg in 12 weeks" }
   { type: "photo", src: "/clients/ritu.webp", name: "Ritu K.", meta: "…", result: "−5 kg" }
   { type: "quote", quote: "Exact words from the client", name: "Ananya", meta: "…", result: "−7 kg" }

   - Only publish with the client's written consent.
   - Videos: vertical 9:16, under 30 s, ~720×1280 H.264 MP4 under 4 MB, plus a poster image.
   - No side-by-side before/after photos if this page runs Meta ads.
   - Use the real result and timeframe. Never round up.
   Placeholder entries show an empty slot. Delete them once real stories are in.
   ───────────────────────────────────────────────────────────── */
export type Story =
  | { type: "video"; src: string; poster: string; name: string; meta?: string; result?: string }
  | { type: "photo"; src: string; name: string; meta?: string; result?: string }
  | { type: "quote"; quote: string; name: string; meta?: string; result?: string }
  | { type: "placeholder"; kind: "video" | "photo" | "quote" };

export const stories: Story[] = [
  { type: "placeholder", kind: "video" },
  { type: "placeholder", kind: "quote" },
  { type: "placeholder", kind: "video" },
  { type: "placeholder", kind: "photo" },
  { type: "placeholder", kind: "quote" },
  { type: "placeholder", kind: "video" },
];
