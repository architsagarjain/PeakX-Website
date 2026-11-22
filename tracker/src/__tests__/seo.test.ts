import { describe, expect, it } from 'vitest';
import { DISHES } from '../domain/foods';
import { CATEGORIES, dishNotes, foodPages, sitemapXml, slugOf, swapsFor } from '../seo/foodPages';

const SITE = 'https://peakx.live';
const dish = (id: string) => DISHES.find((d) => d.id === id)!;

describe('calorie guide pages', () => {
  const pages = foodPages(SITE);

  it('puts every dish in exactly one category', () => {
    const ids = CATEGORIES.flatMap((c) => c.ids);
    expect(new Set(ids).size).toBe(ids.length);
    expect([...ids].sort()).toEqual(DISHES.map((d) => d.id).sort());
  });

  it('builds a hub plus one page per dish, each at a unique clean path', () => {
    expect(pages).toHaveLength(DISHES.length + 1);
    expect(new Set(pages.map((p) => p.path)).size).toBe(pages.length);
    for (const p of pages) expect(p.path).toMatch(/^\/calories\/([a-z0-9-]+\/)?$/);
    expect(slugOf(dish('poha-dish'))).toBe('poha');
    expect(slugOf(dish('whey-shake'))).toBe('whey-shake');
  });

  it('gives each page its own title, canonical link and numbers', () => {
    const roti = pages.find((p) => p.path === '/calories/roti/')!.html;
    expect(roti).toContain('<link rel="canonical" href="https://peakx.live/calories/roti/" />');
    expect(roti).toContain('Roti calories and protein: 99 kcal, 3 g protein per 1 medium');
    expect(new Set(pages.map((p) => p.html.match(/<title>(.*?)<\/title>/)![1])).size).toBe(pages.length);
  });

  it('links every dish page from the hub', () => {
    const hub = pages[0].html;
    for (const p of pages.slice(1)) expect(hub).toContain(`href="${p.path}"`);
  });

  it('suggests only swaps with more protein per calorie that suit the same diet', () => {
    const swaps = swapsFor(dish('aloo-paratha'), DISHES);
    expect(swaps.map((s) => s.id)).toContain('paneer-paratha');
    expect(swapsFor(dish('dal-tadka'), DISHES).some((s) => s.id === 'chicken-curry')).toBe(false);
  });

  it('writes notes from the numbers', () => {
    expect(dishNotes(dish('chicken-tikka')).join(' ')).toContain('full protein meal');
    expect(dishNotes(dish('samosa')).join(' ')).toMatch(/Using half the cooking oil \(12 g in one serving\) saves about 54 kcal/);
  });
});

describe('sitemapXml', () => {
  it('lists the home page and every guide page under the site URL', () => {
    const xml = sitemapXml(SITE, ['/', '/calories/', '/calories/roti/']);
    expect(xml.match(/<url>/g)).toHaveLength(3);
    expect(xml).toContain('<loc>https://peakx.live/calories/roti/</loc>');
    expect(xml).toContain('<priority>1.0</priority>');
  });
});
