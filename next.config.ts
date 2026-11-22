import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: { formats: ["image/avif", "image/webp"] },
  // The PeakX app (tracker/) and its calorie/blog pages use trailing-slash URLs; serve them without redirecting
  skipTrailingSlashRedirect: true,
  webpack(config) {
    // tracker/api imports its own files as "./x.js" (Node ESM style); resolve those to the .ts sources
    config.resolve.extensionAlias = { ".js": [".ts", ".tsx", ".js"] };
    return config;
  },
  async rewrites() {
    // Matched before public/ files, so folder URLs serve their index.html instead of redirecting
    const beforeFiles = [
      // The PeakX app, built into public/app by scripts/build-tracker.mjs
      { source: "/app", destination: "/app/index.html" },
      { source: "/app/", destination: "/app/index.html" },
      // Static calorie guide and blog pages, generated into public/_pages/ (folders with an index.html)
      { source: "/calories", destination: "/_pages/calories/index.html" },
      { source: "/calories/:slug", destination: "/_pages/calories/:slug/index.html" },
      { source: "/blog", destination: "/_pages/blog/index.html" },
      { source: "/blog/topic/:topic", destination: "/_pages/blog/topic/:topic/index.html" },
      { source: "/blog/:slug", destination: "/_pages/blog/:slug/index.html" },
    ];
    const afterFiles = [
      // The app's API names, mapped onto its combined functions
      { source: "/api/meal", destination: "/api/ai?task=meal" },
      { source: "/api/menu", destination: "/api/ai?task=menu" },
      { source: "/api/findings", destination: "/api/ai?task=findings" },
      { source: "/api/coach", destination: "/api/ai?task=coach" },
      { source: "/api/labs", destination: "/api/ai?task=labs" },
      { source: "/api/calendar.ics", destination: "/api/feed?type=ics" },
      { source: "/api/create-order", destination: "/api/pay?op=create-order" },
      { source: "/api/verify-payment", destination: "/api/pay?op=verify-payment" },
    ];
    return { beforeFiles, afterFiles, fallback: [] };
  },
  async redirects() {
    // Use peakx.in/coach in the Instagram "COACH" DM bot so those leads are tagged.
    return [{ source: "/coach", destination: "/apply?src=coach", permanent: false }];
  },
  async headers() {
    return [
      {
        source: "/media/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
      // The app needs the microphone (voice meal logging) and camera (Form Check uploads)
      {
        source: "/app/:path*",
        headers: [{ key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=()" }],
      },
      { source: "/app", headers: [{ key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=()" }] },
      { source: "/app/sw.js", headers: [{ key: "Cache-Control", value: "no-cache" }] },
      { source: "/app/assets/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }] },
    ];
  },
};

export default nextConfig;
