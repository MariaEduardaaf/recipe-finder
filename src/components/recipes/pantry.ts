// The recipe finder in the browser (recipes spec 9): My kitchen, matching, filters, the two views, the sheet and
// the KitchenBar. Server HTML already holds the picks, the editor and every control; this file wires them.
import { missing, normalize, ASSUMED } from './normalize';
import { cardHTML, chipHTML, type CardMatch, demoted } from './card';
import { setStatus } from '../ui/status';
import { openSheet, closeSheet } from '../ui/sheet';
import { icon, type IconName } from '../ui/icons';
import { esc } from '../ui/html';

type Row = [id: string, title: string, meal: string, area: string, kind: string, url: string, photo: string, keys: string[], diet: number];
interface Recipe { id: string; title: string; meal: string; area: string; kind: string; url: string; photo: string; keys: string[]; diet: number }

const STORE = 'ft-recipes-pantry';
const PAGE = 12;
const html = document.documentElement;
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const upper = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const list = (xs: string[]) => (xs.length < 3 ? xs.join(' and ') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);
const recipesN = (n: number) => `${n} recipe${n === 1 ? '' : 's'}`;
const photoUrl = (file: string) => `https://www.themealdb.com/images/media/meals/${file}.jpg/large`;
const wide = matchMedia('(min-width: 64rem)');

// ---------- state ----------
let recipes: Recipe[] = [];
let known = new Set<string>();
let loaded = false;
let failed = false;
let loading: Promise<void> | null = null;
const pantry = new Set<string>();
const exclude = new Set<string>();
let view: 'ready' | 'missing' = 'ready';
let shown = PAGE;
let lastAnswer = '';
let moduleOut = false;
let slow = false; // data still loading after 300ms

try { for (const k of JSON.parse(localStorage.getItem(STORE) ?? '[]') as string[]) if (typeof k === 'string') pantry.add(k); } catch { /* works without storage */ }
const save = () => { try { localStorage.setItem(STORE, JSON.stringify([...pantry])); } catch { /* storage failures are silent (DS 4.7) */ } };

// ---------- elements ----------
const editor = $('pantry');
const sheet = $<HTMLDialogElement>('pantry-sheet');
const col = $('pantry-col');
const grid = $('grid');
const answerBox = $('answer-box');
const answer = $('answer');
const meal = $<HTMLSelectElement>('meal');
const diet = $<HTMLSelectElement>('diet');
const cuisine = $<HTMLSelectElement>('cuisine');
const missingChip = $<HTMLButtonElement>('missing-chip');
const leaveChip = $<HTMLButtonElement>('leave-chip');
const moreBtn = $<HTMLButtonElement>('more');

function load(): Promise<void> {
  loading ??= fetch('/data.json')
    .then((res) => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json() as Promise<{ r: Row[] }>; })
    .then(({ r }) => {
      recipes = r.map(([id, title, meal, area, kind, url, photo, keys, diet]) => ({ id, title, meal, area, kind, url, photo, keys, diet }));
      known = new Set(recipes.flatMap((x) => x.keys));
      for (const k of [...pantry]) { pantry.delete(k); const n = normalize(k); if (known.has(n)) pantry.add(n); } // old or edited storage
      $('rf-ingredients').innerHTML = [...known].sort().map((k) => `<option value="${esc(k)}"></option>`).join('');
      loaded = true;
      failed = false;
    })
    .catch(() => { failed = true; loading = null; });
  return loading;
}
// Actions that need the data wait for it (spec 9, "actions meanwhile are queued").
async function whenLoaded(fn: () => void) {
  if (!loaded) await load();
  if (loaded) fn(); else render();
}

// ---------- matching ----------
const passes = (r: Recipe) => (!meal.value || r.meal === meal.value) && r.diet >= Number(diet.value || 0)
  && (!cuisine.value || r.area === cuisine.value) && !r.keys.some((k) => exclude.has(k));
const countReady = () => recipes.filter((r) => !missing(r.keys, pantry).length && passes(r)).length;
type Answer = 'picks' | 'loading' | 'error' | 'ready' | 'missing' | 'nothing-yet' | 'nothing' | 'filtered';
interface Result { state: Answer; items: [Recipe, CardMatch][]; zeroCount: number; oneAway: number; suggestions: [string, number][] }

function compute(): Result {
  if (!pantry.size) return { state: 'picks', items: [], zeroCount: 0, oneAway: 0, suggestions: [] };
  if (!loaded) return { state: failed ? 'error' : 'loading', items: [], zeroCount: 0, oneAway: 0, suggestions: [] };
  const ready: Recipe[] = [], one: [Recipe, string][] = [];
  let ready0 = 0, one0 = 0;
  for (const r of recipes) {
    const miss = missing(r.keys, pantry);
    if (miss.length > 1) continue;
    if (!miss.length) { ready0++; if (passes(r)) ready.push(r); } else { one0++; if (passes(r)) one.push([r, miss[0]]); }
  }
  const used = (r: Recipe) => r.keys.filter((k) => pantry.has(k)).length;
  const main = (r: Recipe) => (r.meal === 'main' ? 1 : 0);
  // Ready: more of your ingredients used, then main dishes, then fewer ingredients, then lower id. Never A to Z.
  ready.sort((x, y) => demoted(x.id) - demoted(y.id) || used(y) - used(x) || main(y) - main(x) || x.keys.length - y.keys.length || +x.id - +y.id);
  // Missing view: grouped by the missing ingredient, bigger groups first (ties A to Z), then ingredients used, then id.
  const groups = new Map<string, Recipe[]>();
  for (const [r, k] of one) groups.set(k, [...(groups.get(k) ?? []), r]);
  const order = [...groups].sort((x, y) => y[1].length - x[1].length || x[0].localeCompare(y[0]));
  const oneItems = order.flatMap(([k, rs]) => rs.sort((x, y) => demoted(x.id) - demoted(y.id) || used(y) - used(x) || +x.id - +y.id).map((r): [Recipe, CardMatch] => [r, { missing: k }]));
  const base = { oneAway: one.length, suggestions: order.slice(0, 6).map(([k, rs]): [string, number] => [k, rs.length]) };

  if (view === 'missing') {
    if (one.length) return { state: 'missing', items: oneItems, zeroCount: 0, ...base };
    if (one0) return { state: 'filtered', items: [], zeroCount: one0, ...base };
    view = 'ready'; // nothing is one away any more
  }
  if (ready.length) return { state: 'ready', items: ready.map((r) => [r, { ready: r.keys.length }]), zeroCount: 0, ...base };
  if (ready0) return { state: 'filtered', items: [], zeroCount: ready0, ...base };
  if (one.length) return { state: 'nothing-yet', items: [], zeroCount: 0, ...base };
  if (one0) return { state: 'filtered', items: [], zeroCount: one0, ...base };
  return { state: 'nothing', items: [], zeroCount: 0, ...base };
}

// ---------- rendering ----------

function emptyState(tile: IconName, title: string, body: string, action = '') {
  answerBox.classList.add('empty');
  answer.classList.add('empty__title');
  answer.classList.remove('rf-answer__title');
  $('answer-text').textContent = title;
  $('answer-tile').innerHTML = icon(tile, 24);
  $('answer-tile').hidden = false;
  $('answer-body').textContent = body;
  $('answer-body').hidden = false;
  $('answer-actions').innerHTML = action;
  $('answer-actions').hidden = !action;
}

function render() {
  const n = pantry.size;
  html.classList.toggle('has-pantry', n > 0);
  renderKitchen(n);
  const res = compute();

  // Answer header: a plain H2, or the EmptyState drawn around the same H2 (one heading, always #answer).
  answerBox.classList.remove('empty');
  answer.classList.remove('empty__title');
  answer.classList.add('rf-answer__title');
  for (const id of ['answer-tile', 'answer-body', 'answer-actions']) $(id).hidden = true;
  const basicsIn = PACKS.Basics.every((k) => pantry.has(k));
  const text = {
    picks: '', loading: slow ? 'Loading recipes…' : '', error: '',
    ready: `You can cook ${recipesN(res.items.length)}`, missing: 'Recipes missing one ingredient', 'nothing-yet': '', nothing: '', filtered: '',
  }[res.state];
  $('answer-text').textContent = text;
  if (res.state === 'error') emptyState('circle-alert', 'Recipes didn’t load', 'Check your connection and try again.', '<button class="btn btn--quiet btn--sm" type="button" data-retry>Try again</button>');
  if (res.state === 'nothing-yet') emptyState('utensils', 'Nothing you can cook yet', 'Recipes show up when you have everything a dish needs, apart from salt, pepper, oil and water. Some are missing one ingredient.', '<button class="btn btn--secondary" type="button" data-see-missing>See recipes missing one ingredient</button>');
  if (res.state === 'nothing') emptyState('utensils', 'Add a few more ingredients', 'Recipes show up when you have everything a dish needs, apart from salt, pepper, oil and water. A starter pack is a quick way to begin.',
    // Phones only: at 1024px and up the column already shows the starter packs and every shelf (spec 9).
    `<span class="rf-phone-only">${basicsIn ? '<button class="btn btn--secondary" type="button" data-open-pantry aria-haspopup="dialog">Browse all ingredients</button>' : '<button class="btn btn--secondary" type="button" data-pack="Basics">Start with basics</button>'}</span>`);
  if (res.state === 'filtered') emptyState('sliders-horizontal', 'No recipes match your filters', `${res.zeroCount === 1 ? '1 recipe matches' : `${res.zeroCount} recipes match`} your kitchen without them.`, '<button class="btn btn--secondary" type="button" data-clear-filters>Clear filters</button>');

  // Filter pills: the one-away count lives only on this chip (RC-04).
  setCount(missingChip, loaded ? res.oneAway : undefined, 'recipes');
  missingChip.disabled = loaded && !res.oneAway && view !== 'missing';
  missingChip.setAttribute('aria-pressed', String(view === 'missing'));
  setCount(leaveChip, exclude.size || undefined, 'left out');
  $('diet-note').hidden = !diet.value;

  // Suggestions ("Do you have any of these?") in the missing view.
  $('suggest-block').hidden = res.state !== 'missing';
  if (res.state === 'missing') $('suggest').innerHTML = res.suggestions.map(([k, c]) => chipHTML(k, upper(k), false, c)).join('');

  // Grid: skeletons while loading, cards when there are results, nothing for empty states.
  const items = res.items.slice(0, shown);
  if (res.state !== 'loading') grid.innerHTML = items.map(([r, m]) => cardHTML({ title: r.title, kind: r.kind, url: r.url, img: photoUrl(r.photo) }, m)).join('');
  grid.hidden = res.state !== 'loading' && !items.length;
  const left = res.items.length - items.length;
  moreBtn.hidden = left <= 0;
  moreBtn.textContent = left > PAGE ? `Show ${PAGE} more recipes` : left === 1 ? 'Show the last recipe' : `Show the last ${left} recipes`;
  $('report').hidden = !items.length;

  // Sheet footer: one primary, named by what it shows.
  const total = res.items.length;
  $('sheet-show').textContent = total ? `Show ${recipesN(total)}` : 'Show results';

  // Polite announcement of the answer (the grid itself is never live).
  const said = res.state === 'picks' ? '' : (text || $('answer-text').textContent || '') + '.';
  if (said !== lastAnswer) { lastAnswer = said; $('announce').textContent = said === '.' ? '' : said; }
}

// The count markup of Chip.astro, added or removed in place.
function setCount(chip: HTMLElement, n: number | undefined, unit: string) {
  chip.querySelector('.chip__count')?.remove();
  if (n !== undefined) chip.querySelector('.chip__text')!.insertAdjacentHTML('beforeend', `<span class="chip__count num"><span class="sr-only">, </span>${n}<span class="sr-only"> ${unit}</span></span>`);
}

function renderKitchen(n: number) {
  const title = n ? `My kitchen (${n})` : 'My kitchen';
  for (const id of ['module-title', 'kitchen-bar-label', 'col-title', 'pantry-sheet-title']) $(id).textContent = title;
  const names = [...pantry];
  $('module-summary').textContent = upper(names.length <= 3 ? list(names) : `${names.slice(0, 3).join(', ')} and ${names.length - 3} more`);
  $('have').hidden = !n;
  $('have-label').textContent = n === 1 ? '1 ingredient' : `${n} ingredients`;
  $('tokens').innerHTML = [...pantry].sort().map((k) =>
    `<li><button class="token" type="button" aria-label="Remove ${esc(k)}" data-remove="${esc(k)}"><span>${esc(upper(k))}</span>${icon('x', 16)}</button></li>`).join('');
  document.querySelectorAll<HTMLButtonElement>('.pantry__shelves [data-key]').forEach((b) => b.setAttribute('aria-pressed', String(pantry.has(b.dataset.key!))));
  document.querySelectorAll<HTMLDetailsElement>('.pantry__shelf').forEach((s) => {
    const keys = s.dataset.keys!.split(',');
    const on = keys.filter((k) => pantry.has(k)).length;
    s.querySelector('.disclosure__value')!.textContent = `${on}/${keys.length}`;
    s.querySelector('.sr-only')!.textContent = `${on} of ${keys.length} selected`;
  });
  $('leave-tokens').innerHTML = [...exclude].sort().map((k) =>
    `<li><button class="token token--exclude" type="button" aria-label="Remove filter: without ${esc(k)}" data-unexclude="${esc(k)}">${icon('ban', 16)}<span>Without ${esc(k)}</span>${icon('x', 16)}</button></li>`).join('');
  updateBar();
}

function updateBar() {
  const show = !wide.matches && pantry.size > 0 && moduleOut;
  $('kitchen-bar').hidden = !show;
  html.classList.toggle('has-kitchen-bar', show);
}

// ---------- actions ----------
const PACKS: Record<string, string[]> = JSON.parse(editor.dataset.packs!);
const statusIn = (el: Element) => (el.closest('#pantry-module') ? $('add-m-status') : $('add-status'));
const changed = () => { save(); shown = PAGE; render(); };

function addPack(name: string, statusEl: HTMLElement) {
  whenLoaded(() => {
    const added = PACKS[name].filter((k) => known.has(k) && !pantry.has(k));
    added.forEach((k) => pantry.add(k));
    const what = name === 'Basics' ? 'basics' : `${name.toLowerCase()} basics`;
    setStatus(statusEl, added.length ? 'success' : 'info',
      added.length === 1 ? `Added ${added[0]} to your kitchen.` : added.length ? `Added ${added.length} ${what} to your kitchen.` : `Everything in ${name} is already in your kitchen.`);
    changed();
  });
}

function addTyped(form: HTMLFormElement) {
  const input = form.querySelector('input')!;
  const statusEl = form.querySelector<HTMLElement>('.status')!;
  const parts = input.value.split(',').map((s) => s.trim()).filter(Boolean);
  if (!parts.length) return;
  whenLoaded(() => {
    const added: string[] = [], already: string[] = [], unknown: string[] = [];
    let assumed = false;
    for (const p of parts) {
      const k = normalize(p);
      if (!k) continue;
      if (ASSUMED.has(k)) assumed = true;
      else if (!known.has(k)) unknown.push(p);
      else if (pantry.has(k) || added.includes(k)) already.push(k);
      else { pantry.add(k); added.push(k); }
    }
    input.setAttribute('aria-invalid', String(unknown.length > 0));
    if (unknown.length) {
      setStatus(statusEl, 'error', `We don’t have “${unknown[0]}” in any recipe. Check the spelling, or try a simpler name like “cheese”.`);
      input.value = unknown.join(', '); // input is never lost on error (DS 4.1)
    } else {
      input.value = '';
      if (added.length) setStatus(statusEl, 'success', `Added ${list(added)}.`);
      else if (already.length) setStatus(statusEl, 'info', `${upper(list(already))} ${already.length === 1 ? 'is' : 'are'} already in your kitchen.`);
      else if (assumed) setStatus(statusEl, 'info', 'Salt, pepper, oil and water are always assumed.');
    }
    if (added.length) changed();
  });
}

function removeToken(btn: HTMLElement) {
  const next = (btn.closest('li')!.nextElementSibling ?? btn.closest('li')!.previousElementSibling)?.querySelector('button');
  const key = btn.dataset.remove!;
  pantry.delete(key);
  changed();
  // Focus the token that took its place, or the add field (DS 4.8).
  const again = next && [...$('tokens').querySelectorAll<HTMLButtonElement>('[data-remove]')].find((b) => b.dataset.remove === next.dataset.remove);
  (again ?? $('add')).focus();
}

function clearKitchen() {
  const before = [...pantry];
  pantry.clear();
  changed();
  setStatus($('add-status'), 'info', 'Kitchen cleared.', {
    label: 'Undo',
    onClick: () => { before.forEach((k) => pantry.add(k)); changed(); setStatus($('add-status'), 'info', 'Kitchen restored.'); },
  });
  $('add').focus();
}

function leaveOut() {
  const input = $<HTMLInputElement>('leave');
  const raw = input.value.trim();
  if (!raw) return;
  whenLoaded(() => {
    const k = normalize(raw);
    input.setAttribute('aria-invalid', String(!known.has(k)));
    if (!known.has(k)) { setStatus($('leave-status'), 'error', `We don’t have “${raw}” in any recipe, so there’s nothing to leave out.`); return; }
    exclude.add(k);
    input.value = '';
    setStatus($('leave-status'), 'info', `Hiding recipes with ${k}.`);
    changed();
  });
}

function clearFilters() {
  for (const s of [meal, diet, cuisine]) { s.selectedIndex = 0; s.dispatchEvent(new Event('change', { bubbles: true })); }
  exclude.clear();
  setStatus($('leave-status'), 'info', '');
  changed();
}

function showMore() {
  const first = shown;
  shown += PAGE;
  render();
  grid.querySelectorAll<HTMLAnchorElement>('.rcard')[first]?.focus();
}

function openPantry(opener: HTMLElement) { openSheet(sheet, opener); }

// ---------- wiring ----------
document.addEventListener('click', (e) => {
  const t = (e.target as HTMLElement).closest<HTMLElement>('button, a');
  if (!t) return;
  if (t.matches('[data-open-pantry]')) openPantry(t);
  else if (t.dataset.pack) addPack(t.dataset.pack, t.closest('.rf-answer') ? $(wide.matches ? 'add-status' : 'add-m-status') : statusIn(t));
  else if (t.dataset.remove) removeToken(t);
  else if (t.dataset.unexclude) { exclude.delete(t.dataset.unexclude); setStatus($('leave-status'), 'info', ''); changed(); $('leave').focus(); }
  else if (t.closest('#suggest') && t.dataset.key) {
    const k = t.dataset.key, before = countReady();
    pantry.add(k);
    const more = countReady() - before;
    setStatus($('suggest-status'), 'success', `Added ${k}. ${more === 1 ? '1 more recipe is' : `${more} more recipes are`} ready to cook.`);
    changed();
  } else if (t.dataset.key) { const k = t.dataset.key; if (pantry.has(k)) pantry.delete(k); else pantry.add(k); changed(); }
  else if (t === missingChip) { view = view === 'missing' ? 'ready' : 'missing'; setStatus($('suggest-status'), 'info', ''); shown = PAGE; render(); }
  else if (t.matches('[data-see-missing]')) { view = 'missing'; shown = PAGE; render(); answer.focus(); }
  else if (t === leaveChip) {
    const open = leaveChip.getAttribute('aria-expanded') !== 'true';
    leaveChip.setAttribute('aria-expanded', String(open));
    $('leave-panel').hidden = !open;
    if (open) $('leave').focus();
  } else if (t.matches('[data-clear-filters]')) clearFilters();
  else if (t.matches('[data-retry]')) { void load().then(render); }
  else if (t === moreBtn) showMore();
  else if (t.id === 'clear') clearKitchen();
  else if (t.id === 'sheet-show') {
    sheet.addEventListener('close', () => answer.focus(), { once: true }); // after sheet.ts hands focus back to the opener
    closeSheet(sheet);
  }
});
document.querySelectorAll<HTMLFormElement>('form[data-add]').forEach((f) => f.addEventListener('submit', (e) => { e.preventDefault(); addTyped(f); }));
$<HTMLFormElement>('leave-form').addEventListener('submit', (e) => { e.preventDefault(); leaveOut(); });
document.querySelectorAll<HTMLInputElement>('#add, #add-m, #leave').forEach((i) => {
  i.setAttribute('aria-describedby', `${i.id}-status`);
  i.addEventListener('input', () => i.removeAttribute('aria-invalid'));
});
for (const s of [meal, diet, cuisine]) {
  s.addEventListener('change', () => {
    shown = PAGE;
    render();
    // The pill shows "Cuisine: Thai", not the option's "Thai (27)" (after PillSelect's own handler).
    if (s === cuisine) setTimeout(() => { s.closest('.pill-select')!.querySelector('.pill-select__value')!.textContent = s.selectedIndex ? `: ${s.value}` : ''; });
  });
}
// Shelves other than "Most used" fill in when first opened (keeps the page HTML small, RC-14).
document.querySelectorAll<HTMLDetailsElement>('.pantry__shelf').forEach((s) => s.addEventListener('toggle', () => {
  const body = s.querySelector('.disclosure__body')!;
  if (s.open && !body.childElementCount) body.innerHTML = s.dataset.keys!.split(',').map((k) => chipHTML(k, upper(k), pantry.has(k))).join('');
}));

// The editor lives in the sheet below 1024px and in the column from 1024px; in the sheet its Add is secondary,
// because "Show {n} recipes" is that view's one primary.
function place() {
  const addBtn = editor.querySelector('.pantry__add .btn')!;
  if (wide.matches) { if (sheet.open) sheet.close(); col.append(editor); } else sheet.querySelector('.sheet__body')!.append(editor);
  addBtn.classList.toggle('btn--primary', wide.matches);
  addBtn.classList.toggle('btn--secondary', !wide.matches);
  updateBar();
}
wide.addEventListener('change', place);
place();

new IntersectionObserver(([e]) => { moduleOut = !e.isIntersecting && e.boundingClientRect.bottom <= 0; updateBar(); }).observe($('pantry-module'));

// ---------- first render, links from elsewhere ----------
render();
const timer = setTimeout(() => { slow = true; if (!loaded) render(); }, 300);
const params = new URLSearchParams(location.search);
const pack = Object.keys(PACKS).find((p) => p.toLowerCase() === params.get('pack')?.toLowerCase());
const add = params.get('add');
void load().then(() => {
  clearTimeout(timer);
  const statusEl = $(wide.matches ? 'add-status' : 'add-m-status');
  if (pack) addPack(pack, statusEl);
  if (add) {
    const k = normalize(add);
    if (known.has(k)) {
      setStatus(statusEl, pantry.has(k) ? 'info' : 'success', pantry.has(k) ? `${upper(k)} is already in your kitchen.` : `Added ${k} to your kitchen.`);
      pantry.add(k);
    }
  }
  if (pack || add) { params.delete('pack'); params.delete('add'); history.replaceState(null, '', location.pathname + (params.size ? `?${params}` : '') + location.hash); }
  save();
  render();
});
