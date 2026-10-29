import type { MetadataRoute } from "next";
import { site } from "@/lib/config";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: `${site.url}/`, lastModified: now, priority: 1 },
    { url: `${site.url}/apply`, lastModified: now, priority: 0.9 },
    { url: `${site.url}/privacy`, lastModified: now, priority: 0.2 },
  ];
}
