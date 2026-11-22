import type { Diet, Macros } from '../domain/types';
import { DISHES, dishDiet, dishMacros, ingredient, type Dish } from '../domain/foods';
import { rounded, scale } from '../domain/nutrition';

/**
 * Static SEO pages: one "calories and protein in <dish>" page per food-table dish, plus a hub at /calories/.
 * Built at `vite build` time (see vite.config.ts) as plain HTML, so search engines get real URLs instead of
 * the app's hash routes. Numbers come from the same IFCT-based table the app uses and are marked estimated.
 */

export const CONTENT_UPDATED = '2026-11-12';
/** Where the app itself is served: '/' on its own domain, '/app/' when it runs inside peakx.in (set PEAKX_APP_PATH at build). */
export const APP: string = ((globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.PEAKX_APP_PATH) || '/';
const REF = 'calories';

interface Category { slug: string; name: string; ids: string[] }
export const CATEGORIES: Category[] = [
  { slug: 'breads', name: 'Rotis and breads', ids: ['roti', 'ghee-roti', 'paratha', 'aloo-paratha', 'paneer-paratha', 'naan', 'tandoori-roti', 'rumali-roti', 'garlic-naan', 'lachha-paratha', 'puri', 'bhatura', 'kulcha'] },
  { slug: 'regional-breads', name: 'Millet rotis and stuffed parathas', ids: ['gobi-paratha', 'methi-paratha', 'mooli-paratha', 'egg-paratha', 'thepla', 'missi-roti', 'makki-roti', 'bajra-roti', 'jowar-roti', 'ragi-roti'] },
  { slug: 'rice', name: 'Rice and khichdi', ids: ['plain-rice', 'jeera-rice', 'veg-pulao', 'chicken-biryani', 'veg-biryani', 'khichdi', 'mutton-biryani', 'egg-biryani', 'veg-fried-rice', 'egg-fried-rice', 'chicken-fried-rice', 'lemon-rice', 'curd-rice', 'tamarind-rice', 'tomato-rice', 'bisi-bele-bath', 'pongal'] },
  { slug: 'dals', name: 'Dals and curries', ids: ['dal-tadka', 'moong-dal', 'dal-makhani', 'rajma', 'chole', 'sambar', 'kadhi', 'palak-paneer', 'paneer-butter-masala', 'matar-paneer', 'paneer-bhurji', 'chicken-curry', 'butter-chicken', 'egg-curry', 'fish-curry', 'mutton-curry'] },
  { slug: 'lentils', name: 'More dals and lentils', ids: ['dal-palak', 'masoor-dal', 'chana-dal-fry', 'urad-dal', 'sabut-moong', 'panchmel-dal', 'gujarati-dal', 'lobia-curry', 'kala-chana-curry', 'rasam', 'soya-curry'] },
  { slug: 'paneer-veg', name: 'Paneer and veg curries', ids: ['kadai-paneer', 'paneer-tikka-masala', 'paneer-do-pyaza', 'chilli-paneer', 'malai-kofta', 'navratan-korma', 'dum-aloo', 'aloo-matar', 'methi-malai-matar', 'sarson-saag', 'mushroom-masala', 'matar-mushroom', 'veg-kolhapuri', 'tofu-bhurji', 'gatte-ki-sabzi'] },
  { slug: 'chicken', name: 'Chicken dishes', ids: ['kadai-chicken', 'chicken-tikka-masala', 'chicken-korma', 'chicken-do-pyaza', 'chicken-chettinad', 'palak-chicken', 'chicken-keema', 'chicken-65', 'chilli-chicken', 'chicken-lollipop', 'chicken-noodles', 'chicken-momos', 'chicken-roll', 'chicken-shawarma', 'chicken-soup', 'chicken-stew'] },
  { slug: 'mutton-fish', name: 'Mutton, fish and seafood', ids: ['rogan-josh', 'mutton-keema', 'keema-matar', 'mutton-korma', 'bhuna-gosht', 'nihari', 'laal-maas', 'prawn-masala', 'goan-fish-curry', 'machher-jhol', 'fish-fry', 'amritsari-fish', 'pomfret-fry', 'bangda-fry'] },
  { slug: 'sabzi', name: 'Sabzis', ids: ['aloo-gobi', 'bhindi', 'baingan-bharta', 'mix-veg', 'jeera-aloo', 'lauki-sabzi', 'aloo-methi', 'karela-sabzi', 'tinda-masala', 'arbi-fry', 'kaddu-sabzi', 'cabbage-sabzi', 'beans-sabzi', 'aloo-shimla', 'gobi-matar', 'avial', 'veg-stew'] },
  { slug: 'grills', name: 'Grills and eggs', ids: ['chicken-tikka', 'tandoori-chicken', 'egg-bhurji', 'boiled-eggs', 'omelette', 'chicken-seekh-kebab', 'mutton-seekh-kebab', 'chicken-malai-tikka', 'grilled-chicken', 'fish-tikka', 'grilled-fish', 'paneer-tikka', 'egg-white-omelette'] },
  { slug: 'breakfast', name: 'Breakfast and snacks', ids: ['poha-dish', 'upma', 'idli', 'dosa', 'masala-dosa', 'besan-chilla', 'moong-chilla', 'oats-porridge', 'veg-sandwich', 'paneer-sandwich', 'pb-toast', 'samosa', 'pakora', 'chana-chaat', 'sprouts'] },
  { slug: 'south-breakfast', name: 'South Indian and quick breakfasts', ids: ['uttapam', 'medu-vada', 'rava-dosa', 'appam', 'sabudana-khichdi', 'dhokla', 'veg-daliya', 'semiya-upma', 'overnight-oats', 'ragi-porridge', 'bread-omelette', 'egg-sandwich'] },
  { slug: 'street', name: 'Street food and Indo-Chinese', ids: ['pav-bhaji', 'vada-pav', 'misal-pav', 'pani-puri', 'bhel-puri', 'aloo-tikki', 'dahi-vada', 'kachori', 'bread-pakora', 'veg-cutlet', 'dabeli', 'veg-momos', 'veg-noodles', 'veg-manchurian', 'gobi-manchurian', 'spring-roll', 'paneer-roll', 'egg-roll'] },
  { slug: 'thali', name: 'Thalis and combos', ids: ['chole-bhature', 'rajma-chawal', 'dal-chawal', 'kadhi-chawal', 'puri-sabzi', 'veg-thali'] },
  { slug: 'healthy-snacks', name: 'Healthy snacks', ids: ['roasted-makhana', 'roasted-chana-snack', 'peanut-chaat', 'fruit-chaat', 'corn-chaat', 'dry-fruits'] },
  { slug: 'sweets', name: 'Sweets and desserts', ids: ['gulab-jamun', 'rasgulla', 'rasmalai', 'kheer', 'seviyan', 'gajar-halwa', 'sooji-halwa', 'moong-dal-halwa', 'besan-ladoo', 'motichoor-ladoo', 'jalebi', 'kaju-katli', 'barfi', 'shrikhand', 'kulfi', 'mishti-doi'] },
  { slug: 'drinks', name: 'Curd and drinks', ids: ['curd-bowl', 'raita', 'chai', 'coffee', 'lassi', 'banana-shake', 'whey-shake', 'chaas', 'salted-lassi', 'nimbu-pani', 'mango-shake', 'cold-coffee', 'badam-milk', 'haldi-doodh', 'sugarcane-juice', 'orange-juice', 'whey-milk-shake', 'pb-banana-shake'] },
];

const DIET_LABEL: Record<Diet, string> = { vegan: 'Vegetarian, with no dairy in this recipe', veg: 'Vegetarian', egg: 'Contains egg', nonveg: 'Non-vegetarian' };
/** Swaps a dish can suggest: never meat or egg for a vegetarian dish (most people eating a vegan dish still eat dairy). */
const EATS: Record<Diet, Diet[]> = { vegan: ['vegan', 'veg'], veg: ['vegan', 'veg'], egg: ['vegan', 'veg', 'egg'], nonveg: ['vegan', 'veg', 'egg', 'nonveg'] };
const FATS = new Set(['oil', 'ghee', 'butter']);

export const slugOf = (d: Dish) => d.name.toLowerCase().replace(/\([^)]*\)/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export const pathOf = (d: Dish) => `/calories/${slugOf(d)}/`;
export const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const servingText = (d: Dish) => (d.serving.includes(' · ') ? d.serving.replace(' · ', ' (') + ')' : d.serving);
const perHundredKcal = (m: Macros) => (m.kcal ? (m.protein / m.kcal) * 100 : 0);
const one = (n: number) => (Math.round(n * 10) / 10).toString();
const categoryOf = (d: Dish) => CATEGORIES.find((c) => c.ids.includes(d.id))!;

export interface Page { path: string; file: string; html: string }

/** Every static page: the hub first, then one page per dish. */
export function foodPages(site: string): Page[] {
  const dishes = CATEGORIES.flatMap((c) => c.ids.map((id) => DISHES.find((d) => d.id === id)!));
  const hub: Page = { path: '/calories/', file: 'calories/index.html', html: hubHtml(site, dishes) };
  return [hub, ...dishes.map((d) => ({ path: pathOf(d), file: `calories/${slugOf(d)}/index.html`, html: dishHtml(site, d, dishes) }))];
}

export interface SitemapEntry { path: string; lastmod: string }

export function sitemapXml(site: string, paths: (string | SitemapEntry)[]): string {
  const rows = paths.map((e) => {
    const { path: p, lastmod } = typeof e === 'string' ? { path: e, lastmod: CONTENT_UPDATED } : e;
    const priority = p === '/' ? '1.0' : p === '/calories/' || p === '/blog/' ? '0.8' : p.startsWith('/blog/topic/') ? '0.7' : '0.6';
    return `  <url><loc>${site}${p}</loc><lastmod>${lastmod}</lastmod><changefreq>monthly</changefreq><priority>${priority}</priority></url>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${rows.join('\n')}\n</urlset>\n`;
}

/** Plain-language notes worked out from the numbers, so each page says something specific about its dish. */
export function dishNotes(d: Dish): string[] {
  const m = dishMacros(d);
  const r = rounded(m);
  const density = perHundredKcal(m);
  const notes: string[] = [];
  const kind = density >= 8 ? 'a strong protein source' : density >= 4 ? 'a moderate protein source' : 'mostly an energy food, not a protein source';
  notes.push(`${d.name} gives ${one(density)} g protein per 100 kcal, which makes it ${kind}.`);

  const fatShare = m.kcal ? (m.fat * 9) / m.kcal : 0;
  const fats = d.parts.filter(([id]) => FATS.has(id));
  if (fatShare >= 0.4 && fats.length) {
    const [id, g] = fats.reduce((a, b) => (b[1] > a[1] ? b : a));
    const saved = Math.round((ingredient(id).per100g.kcal * g) / 200);
    notes.push(`Fat gives ${Math.round(fatShare * 100)}% of the calories. Using half the ${ingredient(id).name.toLowerCase()} (${g} g in one serving) saves about ${saved} kcal.`);
  } else if (fatShare >= 0.4) {
    notes.push(`Fat gives ${Math.round(fatShare * 100)}% of the calories, so watch the portion when you are cutting.`);
  }

  if (r.protein >= 25) {
    notes.push(`One serving already covers a full protein meal (25 g or more).`);
  } else if (r.protein >= 5) {
    const servings = Math.ceil(25 / m.protein);
    notes.push(servings <= 3
      ? `${servings} servings get you to a 25 g protein meal (about ${Math.round(m.kcal * servings)} kcal).`
      : `Reaching 25 g protein from ${d.name.toLowerCase()} alone takes ${servings} servings, so pair it with a protein-rich dish.`);
  } else {
    notes.push(`It has under 5 g protein a serving, so pair it with a protein-rich dish to build a full meal.`);
  }
  return notes;
}

/** Same-category dishes with more protein per calorie that suit the same diet, best first. */
export function swapsFor(d: Dish, all: Dish[]): Dish[] {
  const ok = EATS[dishDiet(d)];
  const base = perHundredKcal(dishMacros(d));
  return categoryOf(d).ids.map((id) => all.find((x) => x.id === id)!)
    .filter((x) => x.id !== d.id && ok.includes(dishDiet(x)) && perHundredKcal(dishMacros(x)) > base + 0.5)
    .sort((a, b) => perHundredKcal(dishMacros(b)) - perHundredKcal(dishMacros(a)))
    .slice(0, 3);
}

function dishHtml(site: string, d: Dish, all: Dish[]): string {
  const r = rounded(dishMacros(d));
  const cat = categoryOf(d);
  const serving = servingText(d);
  const title = `${d.name} calories and protein: ${r.kcal} kcal, ${r.protein} g protein per ${serving}`;
  const description = `${d.name}: about ${r.kcal} kcal, ${r.protein} g protein, ${r.carbs} g carbs and ${r.fat} g fat in ${serving}. Portion table in katori and pieces, what is in it, and higher-protein swaps.`;
  const portions = d.portions.map((p) => {
    const pm = rounded(scale(dishMacros(d), p.grams / 100));
    return `<tr><th scope="row">${esc(p.label)}</th><td>${pm.kcal}</td><td>${pm.protein} g</td><td>${pm.carbs} g</td><td>${pm.fat} g</td></tr>`;
  }).join('');
  const parts = d.parts.map(([id, g]) => {
    const i = ingredient(id);
    const pm = rounded(scale(i.per100g, g / 100));
    return `<tr><th scope="row">${esc(i.name)}</th><td>${g} g</td><td>${pm.kcal}</td><td>${pm.protein} g</td></tr>`;
  }).join('');
  const swaps = swapsFor(d, all);
  const swapList = swaps.length
    ? `<h2>Higher-protein picks in ${esc(cat.name.toLowerCase())}</h2><ul class="list">${swaps.map((x) => item(x)).join('')}</ul>`
    : '';
  const related = cat.ids.filter((id) => id !== d.id && !swaps.some((s) => s.id === id)).map((id) => all.find((x) => x.id === id)!);
  const relatedList = related.length ? `<h2>More ${esc(cat.name.toLowerCase())}</h2><ul class="list">${related.map((x) => item(x)).join('')}</ul>` : '';
  const crumbs = breadcrumbs(site, [['PeakX', APP], ['Calorie guide', '/calories/'], [d.name, pathOf(d)]]);

  const body = `
<nav class="crumbs" aria-label="Breadcrumb"><a href="${APP}">PeakX</a> › <a href="/calories/">Calorie guide</a> › <span>${esc(d.name)}</span></nav>
<h1>Calories and protein in ${esc(d.name.toLowerCase())}</h1>
<p class="lede">One serving is ${esc(serving)}. ${esc(DIET_LABEL[dishDiet(d)])}.</p>
<div class="stats">
  <div class="stat hero"><b>${r.kcal}</b><span>kcal</span></div>
  <div class="stat"><b>${r.protein} g</b><span>protein</span></div>
  <div class="stat"><b>${r.carbs} g</b><span>carbs</span></div>
  <div class="stat"><b>${r.fat} g</b><span>fat</span></div>
</div>
<ul class="notes">${dishNotes(d).map((n) => `<li>${esc(n)}</li>`).join('')}</ul>
<h2>By portion</h2>
<div class="scroll"><table><thead><tr><th scope="col">Portion</th><th scope="col">kcal</th><th scope="col">Protein</th><th scope="col">Carbs</th><th scope="col">Fat</th></tr></thead><tbody>${portions}</tbody></table></div>
<h2>What is in one serving</h2>
<div class="scroll"><table><thead><tr><th scope="col">Ingredient</th><th scope="col">Amount</th><th scope="col">kcal</th><th scope="col">Protein</th></tr></thead><tbody>${parts}</tbody></table></div>
<p class="fine">Home recipes vary, most of all in oil and ghee. Change the amounts in the app and the numbers follow.</p>
${swapList}
${relatedList}`;
  return layout(site, pathOf(d), title, description, body, crumbs);
}

function hubHtml(site: string, dishes: Dish[]): string {
  const title = `Calories and protein in Indian food: ${dishes.length} dishes by katori, roti and plate`;
  const description = 'Calories, protein, carbs and fat for everyday Indian dishes: roti, dal, rice, paneer, chicken, eggs, poha, dosa and more, by the portion you actually eat.';
  const top = [...dishes].sort((a, b) => perHundredKcal(dishMacros(b)) - perHundredKcal(dishMacros(a))).slice(0, 10);
  const sections = CATEGORIES.map((c) => `<h2 id="${c.slug}">${esc(c.name)}</h2><ul class="list">${c.ids.map((id) => item(dishes.find((d) => d.id === id)!)).join('')}</ul>`).join('');
  const body = `
<nav class="crumbs" aria-label="Breadcrumb"><a href="${APP}">PeakX</a> › <span>Calorie guide</span></nav>
<h1>Calories and protein in Indian food</h1>
<p class="lede">${dishes.length} everyday dishes, each by the portion you actually eat: a katori of dal, a roti, a plate of poha. Pick a dish for its portion table and what is in it.</p>
<h2>Most protein per calorie</h2>
<ol class="list">${top.map((d) => item(d, true)).join('')}</ol>
${sections}`;
  return layout(site, '/calories/', title, description, body, breadcrumbs(site, [['PeakX', APP], ['Calorie guide', '/calories/']]));
}

function item(d: Dish, density = false): string {
  const m = dishMacros(d);
  const r = rounded(m);
  const extra = density ? ` · ${one(perHundredKcal(m))} g per 100 kcal` : '';
  return `<li><a href="${pathOf(d)}">${esc(d.name)}</a><span>${r.kcal} kcal · ${r.protein} g protein · ${esc(d.serving)}${extra}</span></li>`;
}

export function breadcrumbs(site: string, items: [string, string][]): string {
  return jsonLd({
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: items.map(([name, path], i) => ({ '@type': 'ListItem', position: i + 1, name, item: `${site}${path}` })),
  });
}

/** JSON-LD safe to drop inside a script tag. */
export function jsonLd(data: unknown): string { return JSON.stringify(data).replace(/</g, '\\u003c'); }

const FINE = 'Estimated from IFCT 2017 (National Institute of Nutrition) values, rounded, and not yet reviewed by the PeakX nutrition team. For guidance, not medical advice.';

export function layout(site: string, path: string, title: string, description: string, body: string, ld: string, ref = REF, fine = FINE, updated = CONTENT_UPDATED): string {
  const url = `${site}${path}`;
  return `<!doctype html>
<html lang="en-IN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<meta name="theme-color" content="#F5F5F2" />
<title>${esc(title)} · PeakX</title>
<meta name="description" content="${esc(description)}" />
<link rel="canonical" href="${url}" />
<meta name="robots" content="index, follow" />
<meta property="og:type" content="article" />
<meta property="og:site_name" content="PeakX" />
<meta property="og:locale" content="en_IN" />
<meta property="og:url" content="${url}" />
<meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="${esc(description)}" />
<meta property="og:image" content="${site}${APP}og.png?v=3" />
<meta name="twitter:card" content="summary_large_image" />
<link rel="icon" href="${APP}favicon.svg" type="image/svg+xml" />
<link rel="apple-touch-icon" href="${APP}icons/apple-touch-icon.png" />
<style>${CSS}</style>
<script type="text/javascript">
  (function(c,l,a,r,i,t,y){
      c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
      t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
      y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
  })(window, document, "clarity", "script", "z01otzf1d7");
</script>
<script type="application/ld+json">${ld}</script>
</head>
<body>
<header class="top"><a class="mark" href="${APP}?ref=${ref}">PeakX</a><a class="cta" href="${APP}?ref=${ref}#/app/plateau-check">Free plateau check</a></header>
<main>${body}
<section class="band">
  <h2>Log it in seconds</h2>
  <p>Say “2 roti, 1 katori dal” in English or Hindi and PeakX logs the calories and protein. Stuck at the gym? The free 2-minute plateau check tells you what to change.</p>
  <a class="cta" href="${APP}?ref=${ref}#/app/plateau-check">Take the plateau check</a>
</section>
<p class="fine">${esc(fine)} Updated ${updated}.</p>
</main>
<footer><a href="/calories/">Calorie guide</a> · <a href="/blog/">Blog</a> · <a href="${APP}?ref=${ref}">PeakX</a> · <a href="${APP}#/privacy">Privacy</a> · <a href="${APP}#/terms">Terms</a> · <a href="${APP}#/contact">Contact</a></footer>
</body>
</html>
`;
}

export const CSS = `
:root{--canvas:#F5F5F2;--surface:#fff;--text:#0E0F0C;--text-2:#55564F;--text-3:#7A7B73;--band:#0E0F0C;--lime:#C6F432;--line:rgba(14,15,12,.08);--font-display:"Manrope",system-ui,-apple-system,"Segoe UI",sans-serif;--font-body:"Inter",system-ui,-apple-system,"Segoe UI",sans-serif}
*{box-sizing:border-box}
body{margin:0;background:var(--canvas);color:var(--text);font:16px/1.55 var(--font-body);-webkit-font-smoothing:antialiased}
a{color:inherit}
.top{display:flex;align-items:center;justify-content:space-between;gap:12px;max-width:760px;margin:0 auto;padding:16px}
.mark{font:700 20px/1 var(--font-display);text-decoration:none;letter-spacing:-.02em}
.cta{display:inline-flex;align-items:center;min-height:40px;padding:0 18px;border-radius:9999px;background:var(--lime);color:var(--text);font-weight:600;font-size:14px;text-decoration:none;white-space:nowrap}
main{max-width:760px;margin:0 auto;padding:0 16px 40px}
.crumbs{font-size:13px;color:var(--text-3);margin:8px 0 16px}
.crumbs a{color:var(--text-2)}
h1{font:600 clamp(28px,6vw,40px)/1.15 var(--font-display);letter-spacing:-.03em;margin:0 0 8px}
h2{font:600 20px/1.3 var(--font-display);letter-spacing:-.01em;margin:32px 0 12px}
.lede{color:var(--text-2);margin:0 0 20px}
.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
.stat{background:var(--surface);border-radius:16px;padding:14px 12px;box-shadow:0 8px 32px -4px rgba(14,15,12,.06)}
.stat b{display:block;font:500 clamp(20px,5vw,28px)/1.1 var(--font-display);letter-spacing:-.03em;font-variant-numeric:tabular-nums}
.stat span{font-size:12px;color:var(--text-3)}
.stat.hero{background:var(--band);color:#F2F1EB}
.stat.hero span{color:rgba(242,241,235,.64)}
.notes{margin:20px 0 0;padding-left:20px;color:var(--text-2)}
.notes li{margin:6px 0}
.scroll{overflow-x:auto;background:var(--surface);border-radius:16px}
table{width:100%;border-collapse:collapse;font-size:14px;font-variant-numeric:tabular-nums}
th,td{padding:10px 12px;text-align:right;border-bottom:1px solid var(--line);white-space:nowrap}
th:first-child{text-align:left;white-space:normal}
thead th{font-weight:500;color:var(--text-3);font-size:12px}
tbody tr:last-child th,tbody tr:last-child td{border-bottom:0}
.list{list-style:none;margin:0;padding:0;background:var(--surface);border-radius:16px}
.list li{display:flex;flex-direction:column;gap:2px;padding:12px 14px;border-bottom:1px solid var(--line)}
.list li:last-child{border-bottom:0}
.list a{font-weight:600;text-decoration:none}
.list a:hover{text-decoration:underline}
.list span{font-size:13px;color:var(--text-3)}
.band{margin:40px 0 0;padding:24px;border-radius:24px;background:var(--band);color:#F2F1EB}
.band h2{margin:0 0 8px}
.band p{color:rgba(242,241,235,.72);margin:0 0 16px}
.fine{font-size:13px;color:var(--text-3)}
footer{max-width:760px;margin:0 auto;padding:16px 16px 32px;font-size:13px;color:var(--text-3)}
@media (max-width:480px){.stats{grid-template-columns:repeat(2,1fr)}}
`;
