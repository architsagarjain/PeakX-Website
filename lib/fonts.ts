import localFont from "next/font/local";

/** Archivo at 125% width — the same extended grotesk as the PeakX wordmark. */
export const display = localFont({
  src: "../public/fonts/peakx-display.woff2",
  variable: "--font-peakx-display",
  weight: "100 900",
  display: "swap",
  adjustFontFallback: false,
  preload: true,
});

export const sans = localFont({
  src: "../public/fonts/archivo.woff2",
  variable: "--font-archivo",
  weight: "100 900",
  display: "swap",
  preload: true,
});

/** Just the generated family name, without the fallback stack (Glyph Portal measures one face). */
export const displayFamily = display.style.fontFamily.split(",")[0].trim();
