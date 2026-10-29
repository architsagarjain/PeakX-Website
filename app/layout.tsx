import type { Metadata, Viewport } from "next";
import { display, sans } from "@/lib/fonts";
import { site } from "@/lib/config";
import Pixel from "@/components/site/pixel";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: "PeakX by Bhavika Agarwal | Online Fat Loss Coaching for Working Women",
    template: "%s | PeakX",
  },
  description:
    "1-on-1 online fat loss coaching for working women. Lose 5–8 kg in 12 weeks with a plan built around the food you love, weekly check-ins and form reviews. Coached by Bhavika Agarwal.",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "PeakX",
    locale: "en_IN",
    url: "/",
    title: "Lose 5–8 kg in 12 weeks. Keep your chai. | PeakX",
    description: "1-on-1 online fat loss coaching for working women, by Bhavika Agarwal.",
    images: [{ url: "/og.jpg", width: 1200, height: 630, alt: "PeakX — Lose 5–8 kg in 12 weeks. Keep your chai." }],
  },
  twitter: { card: "summary_large_image", images: ["/og.jpg"] },
  icons: { icon: "/favicon.svg", apple: "/apple-touch-icon.png" },
  robots: { index: true, follow: true, "max-image-preview": "large" },
};

export const viewport: Viewport = { themeColor: "#000000", width: "device-width", initialScale: 1, viewportFit: "cover" };

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "ProfessionalService",
      "@id": `${site.url}/#business`,
      name: "PeakX",
      url: `${site.url}/`,
      image: `${site.url}/og.jpg`,
      logo: `${site.url}/brand/peakx-logo.svg`,
      description: "1-on-1 online fat loss coaching for working women: custom training, diet and cardio plans, weekly check-ins and form reviews.",
      areaServed: ["IN", "US", "Worldwide"],
      address: { "@type": "PostalAddress", addressLocality: "Bengaluru", addressRegion: "Karnataka", addressCountry: "IN" },
      founder: { "@id": `${site.url}/#bhavika` },
      sameAs: [site.instagramBrand, site.instagram],
    },
    {
      "@type": "Person",
      "@id": `${site.url}/#bhavika`,
      name: "Bhavika Agarwal",
      jobTitle: "Online fitness and fat loss coach",
      description: "Former national-level badminton player and certified fitness and nutrition coach.",
      worksFor: { "@id": `${site.url}/#business` },
      sameAs: [site.instagram],
    },
    {
      "@type": "Service",
      name: "1-on-1 online fat loss coaching",
      serviceType: "Online fitness coaching",
      provider: { "@id": `${site.url}/#business` },
      audience: { "@type": "PeopleAudience", audienceType: "Working women aged 28–40" },
      areaServed: "Worldwide",
    }
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" className={`${display.variable} ${sans.variable}`}>
      <head>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      </head>
      <body>
        <a href="#main" className="fixed left-3 -top-16 z-[100] rounded-full bg-green px-4 py-2 font-bold text-ink focus:top-3">Skip to content</a>
        {children}
        <Pixel id={site.metaPixelId} />
      </body>
    </html>
  );
}
