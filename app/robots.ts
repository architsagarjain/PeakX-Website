import type { MetadataRoute } from "next";
import { site } from "@/lib/config";

export default function robots(): MetadataRoute.Robots {
  return {
    // /_pages/ holds the files behind /calories/… and /blog/…; crawl those URLs instead
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/_pages/"] }],
    sitemap: [`${site.url}/sitemap.xml`, `${site.url}/sitemap-app.xml`],
  };
}
