// Markup shared by the server and the browser (DESIGN-SYSTEM 3.7, 3.10; recipes spec 10): one template per item.
// Plain functions returning strings, every data string escaped. No data imports, so client bundles stay small.
import { icon } from '../ui/icons';
import { esc } from '../ui/html';

export interface CardRecipe { title: string; kind: string; url: string; img: string }
/** The card's match line: ready ("You have all 6"), missing view ("Missing: yeast") or neutral ("6 ingredients"). */
export type CardMatch = { ready: number } | { missing: string } | { count: number };

// Ranked last within their group: the weakest photo in the set and recipes whose only source is a social post
// (UI-REVIEW-final issue 1). Ids, so a data refresh can't silently re-rank them to the top.
export const DEMOTE = new Set(['52933', '52779', '52785', '52780']);
export const demoted = (id: string | number) => (DEMOTE.has(String(id)) ? 1 : 0);

export const domain = (url: string) => new URL(url).hostname.replace(/^www\./, '');
const ingredients = (n: number) => `${n} ingredient${n === 1 ? '' : 's'}`;

// Cards point their icons at one symbol each (SPRITE, rendered once per page): the drawing is the kit's icon()
// paths, unchanged, but /recipes/with/garlic/ carries 297 cards and must stay under 250 KB (RW-12).
const SYMBOLS = { 'rc-ext': 'external-link', 'rc-check': 'check', 'rc-plus': 'plus' } as const;
export const SPRITE = `<svg hidden aria-hidden="true" focusable="false">${Object.entries(SYMBOLS)
  .map(([id, name]) => icon(name).replace(/^<svg[^>]*?(fill="none"[^>]*)>/, `<symbol id="${id}" viewBox="0 0 24 24" $1>`).replace(/<\/svg>$/, '</symbol>'))
  .join('')}</svg>`;
const use = (id: keyof typeof SYMBOLS) => `<svg class="icon icon--sm" width="16" height="16" aria-hidden="true" focusable="false"><use href="#${id}"/></svg>`;

// TheMealDB titles come in three casings ("Red curry chicken kebabs", "kabse", "Spanish Chicken"). The grid shows
// one: Title Case with lowercase small words (English and the Romance ones in dish names), first word capped, and
// words that already carry capitals inside (BBQ, McCormick) left alone (UI-REVIEW-final issue 1).
const SMALL = new Set(['a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'from', 'in', 'into', 'of', 'on', 'or', 'the', 'to', 'with',
  'al', 'alla', 'all’', 'con', 'de', 'del', 'della', 'di', 'e', 'en', 'et', 'la', 'le', 'y']);
export const titleCase = (t: string) =>
  t.split(' ').map((w, i) => {
    if (/[A-Z]/.test(w.slice(1))) return w;
    const lower = w.toLowerCase();
    if (i > 0 && SMALL.has(lower.replace(/[(),]/g, ''))) return lower;
    return lower.replace(/(^|[-(“"])(\p{L})/gu, (_, p: string, c: string) => p + c.toUpperCase());
  }).join(' ');

export function cardHTML(r: CardRecipe, m: CardMatch, eager = false): string {
  const title = titleCase(r.title.replace(/'/g, '’')); // CRAFT-07: typographic apostrophes; one casing in the grid
  const host = domain(r.url);
  const [tone, glyph, text, spoken] =
    'ready' in m ? ['rcard__match--good', use('rc-check'), m.ready === 1 ? 'You have everything' : `You have all ${m.ready}`, `You have all ${ingredients(m.ready)}`]
    : 'missing' in m ? ['rcard__match--caution', use('rc-plus'), `Missing: ${m.missing}`, `Missing ${m.missing}`]
    : ['', '', ingredients(m.count), ingredients(m.count)];
  return `<li><a class="rcard" href="${esc(r.url)}" target="_blank" rel="noopener" aria-label="${esc(`${title}, ${r.kind}. ${spoken}. Opens ${host} in a new tab`)}">`
    + `<span class="rcard__photo"><img src="${esc(r.img)}" width="350" height="263" alt=""${eager ? '' : ' loading="lazy"'}></span>`
    + `<h3 class="rcard__title">${esc(title)}</h3><p class="rcard__kind">${esc(r.kind)}</p>`
    + `<p class="rcard__match${tone && ` ${tone}`}">${glyph}${esc(text)}</p>`
    + `<p class="rcard__source">${esc(host)}${use('rc-ext')}</p></a></li>`;
}

/** A toggle chip, the same markup as Chip.astro (kind "toggle"), for ingredient shelves and suggestions. */
export function chipHTML(key: string, label: string, pressed: boolean, count?: number, countUnit = 'recipes'): string {
  const n = count === undefined ? '' : `<span class="chip__count num"><span class="sr-only">, </span>${count}<span class="sr-only"> ${countUnit}</span></span>`;
  return `<button class="chip chip--lead" type="button" aria-pressed="${pressed}" data-key="${esc(key)}">${icon('plus', 20, 'chip__off')}${icon('check', 20, 'chip__on')}<span class="chip__text">${esc(label)}${n}</span></button>`;
}
