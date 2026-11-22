import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { APP, foodPages, sitemapXml } from './src/seo/foodPages';
import { blogPages, blogSitemap } from './src/seo/blogPages';

/** Writes the static calorie-guide and blog pages, and a sitemap that lists them next to the app. */
function seoPages(site: string): Plugin {
  return {
    name: 'peakx-seo-pages',
    apply: 'build',
    generateBundle() {
      const pages = foodPages(site);
      const blog = blogPages(site);
      for (const p of [...pages, ...blog]) this.emitFile({ type: 'asset', fileName: p.file, source: p.html });
      this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: sitemapXml(site, [APP, ...pages.map((p) => p.path), ...blogSitemap(blog)]) });
    },
  };
}

export default defineConfig(({ mode }) => {
  const site = (loadEnv(mode, process.cwd(), 'VITE_').VITE_SITE_URL || 'https://peakx.live').replace(/\/$/, '');
  return {
    plugins: [
      react(),
      seoPages(site),
      // Canonical and share-image links point at wherever the app is served ('/' or '/app/')
      { name: 'peakx-app-path', transformIndexHtml: { order: 'pre', handler: (html) => html.replaceAll('%VITE_SITE_URL%/', `${site}${APP}`) } },
    ],
    base: './',
  };
});
