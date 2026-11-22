import { describe, expect, it } from 'vitest';
import { DISHES, dishDiet } from '../domain/foods';
import { blogArticles, blogPages, blogSitemap, buildDay, canEat, compareSlug, DIETS, dish, portionText, verdictFor, walkKcal } from '../seo/blogPages';
import { foodPages, sitemapXml } from '../seo/foodPages';

const SITE = 'https://peakx.live';
const pages = blogPages(SITE);
const articles = blogArticles();

describe('blog pages', () => {
  it('builds at least 1,000 articles plus the blog home and topic hubs', () => {
    expect(articles.length).toBeGreaterThanOrEqual(1000);
    expect(pages[0].path).toBe('/blog/');
    expect(pages.filter((p) => p.path.startsWith('/blog/topic/'))).toHaveLength(8);
  });

  it('gives every page a unique clean path, file and title', () => {
    expect(new Set(pages.map((p) => p.path)).size).toBe(pages.length);
    expect(new Set(pages.map((p) => p.file)).size).toBe(pages.length);
    for (const p of pages) {
      expect(p.path).toMatch(/^\/blog\/([a-z0-9-]+\/)*$/);
      expect(p.file).toBe(`${p.path.slice(1)}index.html`);
    }
    const titles = pages.map((p) => p.html.match(/<title>(.*?)<\/title>/)![1]);
    expect(new Set(titles).size).toBe(pages.length);
  });

  it('sets a canonical link and article schema on each article', () => {
    expect(compareSlug(dish('roti'), dish('paratha'))).toBe('plain-paratha-vs-roti');
    const p = pages.find((x) => x.path === '/blog/plain-paratha-vs-roti/')!;
    expect(p.html).toContain('<link rel="canonical" href="https://peakx.live/blog/plain-paratha-vs-roti/" />');
    expect(p.html).toContain('"@type":"Article"');
    expect(p.html).not.toContain('undefined');
    expect(p.html).not.toContain('NaN');
  });

  it('has no broken internal links', () => {
    const known = new Set([...pages, ...foodPages(SITE)].map((p) => p.path));
    for (const p of pages) {
      for (const [, href] of p.html.matchAll(/href="(\/(?:blog|calories)\/[^"#?]*)"/g)) expect(known.has(href), `${p.path} → ${href}`).toBe(true);
    }
  });

  it('links every article from its topic hub', () => {
    const hubs = pages.filter((p) => p.path.startsWith('/blog/topic/')).map((p) => p.html).join('');
    for (const a of articles) expect(hubs).toContain(`href="/blog/${a.slug}/"`);
  });

  it('never prints undefined or NaN on any page', () => {
    for (const p of pages) expect(p.html, p.path).not.toMatch(/undefined|NaN|Infinity/);
  });
});

describe('buildDay', () => {
  it('keeps to the diet', () => {
    for (const diet of DIETS) for (const k of [1200, 2000, 3000]) {
      for (const l of buildDay(diet, k, 120, k / 100).lines) expect(canEat(diet, dish(l.id)), `${diet} ${l.id}`).toBe(true);
    }
    expect(buildDay('veg', 2000, 120).lines.some((l) => dishDiet(dish(l.id)) === 'nonveg')).toBe(false);
  });

  it('lands close to the calorie target across the diet-plan range', () => {
    for (const diet of DIETS) for (let k = 1200; k <= 3200; k += 100) {
      const d = buildDay(diet, k, 100, k / 100);
      expect(Math.abs(d.total.kcal - k), `${diet} ${k}`).toBeLessThanOrEqual(160);
    }
  });

  it('tops up protein toward the target', () => {
    expect(buildDay('nonveg', 2600, 180).total.protein).toBeGreaterThanOrEqual(174);
    expect(buildDay('veg', 2000, 110).total.protein).toBeGreaterThanOrEqual(104);
  });
});

describe('numbers and wording', () => {
  it('walks 10,000 steps at 70 kg for about 267 kcal', () => {
    expect(walkKcal(10000, 70)).toBe(267);
    expect(walkKcal(10000, 100)).toBeGreaterThan(walkKcal(10000, 70));
  });

  it('writes portions the way people count them', () => {
    expect(portionText(dish('roti'), 5)).toBe('5 roti');
    expect(portionText(dish('plain-rice'), 2.5)).toBe('2½ katori');
    expect(portionText(dish('chicken-tikka'), 2)).toBe('12 pieces');
    expect(portionText(dish('boiled-eggs'), 1.5)).toBe('3 eggs');
  });

  it('calls high-protein dishes good for both goals and fried snacks an occasional food', () => {
    expect(verdictFor(dish('chicken-tikka'), 'lose')).toMatch(/^Yes/);
    expect(verdictFor(dish('chicken-tikka'), 'gain')).toMatch(/full protein meal/);
    expect(verdictFor(dish('pakora'), 'lose')).toMatch(/now and then/);
    expect(DISHES.every((d) => verdictFor(d, 'lose') && verdictFor(d, 'gain'))).toBe(true);
  });

  it('puts every blog page in the sitemap with its own date', () => {
    const xml = sitemapXml(SITE, ['/', ...blogSitemap(pages)]);
    expect(xml.match(/<url>/g)).toHaveLength(pages.length + 1);
    expect(xml).toContain('<loc>https://peakx.live/blog/</loc><lastmod>2026-11-11</lastmod><changefreq>monthly</changefreq><priority>0.8</priority>');
    expect(xml).toContain('/blog/topic/steps/</loc><lastmod>2026-11-11</lastmod><changefreq>monthly</changefreq><priority>0.7</priority>');
  });
});
