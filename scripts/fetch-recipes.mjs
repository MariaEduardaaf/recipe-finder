// PROTOTYPE ONLY. Uses TheMealDB's free developer test key "1", which TheMealDB allows for development.
// Before publishing the site you MUST get TheMealDB's paid key (https://www.themealdb.com/api.php) and
// follow their terms. Run once: `node scripts/fetch-recipes.mjs`. Images are hot-linked, never downloaded.
// Instruction text (strInstructions) is deliberately dropped: the product links out to the recipe.
//
// `--reindex` rebuilds ingredient-index.json from the saved recipes.json (after tweaking normalize.ts) without refetching.
// `--check-links` (no refetch) requests each source host once and replaces links on dead hosts with the recipe's
// TheMealDB page (recipes spec 10). Dead hosts are kept in dead-hosts.json, so a later refetch replaces them too.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { normalize, groupOf, ASSUMED } from '../src/components/recipes/normalize.ts';

const KEY = '1';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const out = new URL('../src/data/recipes/', import.meta.url);
const mealPage = (id) => `https://www.themealdb.com/meal/${id}`;
const hostOf = (url) => new URL(url).hostname;
const readJson = async (file, fallback) => {
  try { return JSON.parse(await readFile(new URL(file, out), 'utf8')); } catch { return fallback; }
};
const deadHosts = new Set(await readJson('dead-hosts.json', []));

if (process.argv.includes('--check-links')) {
  await checkLinks();
  process.exit(0);
}

const reindex = process.argv.includes('--reindex');
const byId = new Map();
for (const letter of reindex ? '' : 'abcdefghijklmnopqrstuvwxyz') {
  const url = `https://www.themealdb.com/api/json/v1/${KEY}/search.php?f=${letter}`;
  let meals = null;
  for (let attempt = 0; attempt < 2 && !meals; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      meals = (await res.json()).meals ?? [];
    } catch (e) {
      console.warn(`letter ${letter} attempt ${attempt + 1}: ${e.message}`);
      await sleep(2000);
    }
  }
  for (const m of meals ?? []) {
    const ingredients = [];
    for (let i = 1; i <= 20; i++) {
      const name = (m[`strIngredient${i}`] ?? '').trim();
      if (name) ingredients.push({ name, measure: (m[`strMeasure${i}`] ?? '').trim() });
    }
    const source = m.strSource?.trim();
    byId.set(m.idMeal, {
      id: m.idMeal,
      title: m.strMeal,
      category: m.strCategory,
      area: m.strArea,
      image: m.strMealThumb,
      ingredients,
      sourceUrl: source && !deadHosts.has(hostOf(source)) ? source : mealPage(m.idMeal),
      youtube: m.strYoutube?.trim() || null,
    });
  }
  console.log(letter, meals?.length ?? 'FAILED');
  await sleep(1000);
}

const recipes = reindex ? await readJson('recipes.json', []) : [...byId.values()];
const counts = new Map();
for (const r of recipes) for (const k of new Set(r.ingredients.map((i) => normalize(i.name)))) if (k) counts.set(k, (counts.get(k) ?? 0) + 1);
const index = [...counts]
  .map(([key, count]) => ({ key, count, group: groupOf(key) }))
  .filter((i) => !ASSUMED.has(i.key))
  .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));

await mkdir(out, { recursive: true });
await writeFile(new URL('recipes.json', out), JSON.stringify(recipes));
await writeFile(new URL('ingredient-index.json', out), JSON.stringify(index));
console.log(`recipes: ${recipes.length}, normalized ingredients (excl. assumed): ${index.length}`);

// ---------- --check-links ----------

async function checkLinks() {
  setTimeout(() => { console.error('check-links: gave up after 90s'); process.exit(2); }, 90_000).unref();
  const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';
  const TIMEOUT = 15_000;
  const TLS = /^(ERR_SSL_|ERR_TLS_|CERT_|UNABLE_TO_VERIFY|DEPTH_ZERO|SELF_SIGNED)/;

  // One request per host: HEAD, then GET when HEAD fails or is refused (many servers mishandle HEAD).
  async function probe(url) {
    let last = { status: 0, error: 'no response' };
    for (const method of ['HEAD', 'GET']) {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), TIMEOUT);
      try {
        const res = await fetch(url, { method, redirect: 'follow', signal: ctl.signal, headers: { 'user-agent': UA, accept: 'text/html,application/xhtml+xml,image/*;q=0.9,*/*;q=0.8', 'accept-language': 'en-US,en;q=0.9' } });
        await res.body?.cancel().catch(() => {});
        last = { status: res.status };
        if (res.ok) return last;
      } catch (e) {
        const code = e.name === 'AbortError' ? 'timeout' : e.cause?.code ?? e.message;
        last = { status: 0, error: code };
        if (code === 'ENOTFOUND' || TLS.test(code)) return last; // no point retrying with GET
      } finally {
        clearTimeout(timer);
      }
    }
    return last;
  }
  // DNS failure or 404, 410, 5xx: dead. So is a TLS or certificate failure: a browser can't open the page either
  // (checked in headless Chrome, 2026-10-12). 401, 403 and 429 are bot blocks; timeouts are reported, not replaced.
  const isDead = (p) => p.error === 'ENOTFOUND' || TLS.test(p.error ?? '') || p.status === 404 || p.status === 410 || p.status >= 500;
  const pool = async (items, n, fn) => {
    const results = new Array(items.length);
    let next = 0;
    await Promise.all(Array.from({ length: n }, async () => { while (next < items.length) { const i = next++; results[i] = await fn(items[i]); } }));
    return results;
  };

  const recipes = await readJson('recipes.json', []);
  const sample = new Map(); // host -> first source URL on that host
  for (const r of recipes) { const h = hostOf(r.sourceUrl); if (!sample.has(h)) sample.set(h, r.sourceUrl); }
  const hosts = [...sample.keys()];
  console.log(`checking ${hosts.length} source hosts (one request each, ${TIMEOUT / 1000}s timeout)…`);
  const probes = await pool(hosts, 24, (h) => probe(sample.get(h)));

  const dead = [], blocked = [], unsure = [];
  hosts.forEach((h, i) => {
    const p = probes[i];
    const line = `${h} ${p.status || p.error}`;
    if (isDead(p)) { dead.push(h); deadHosts.add(h); } else if (p.status === 401 || p.status === 403 || p.status === 429) blocked.push(line); else if (!p.status || p.status >= 400) unsure.push(line);
  });

  const changed = [];
  for (const r of recipes) {
    if (deadHosts.has(hostOf(r.sourceUrl))) { changed.push(`${r.id} ${r.title}: ${r.sourceUrl}`); r.sourceUrl = mealPage(r.id); }
  }
  console.log(`dead hosts (${dead.length}): ${dead.map((h) => `${h} ${probes[hosts.indexOf(h)].status || probes[hosts.indexOf(h)].error}`).join(', ') || 'none'}`);
  console.log(`kept, bot block (${blocked.length}): ${blocked.join(', ') || 'none'}`);
  console.log(`kept, could not confirm (${unsure.length}): ${unsure.join(', ') || 'none'}`);
  console.log(`replaced ${changed.length} links with the TheMealDB meal page:`);
  for (const c of changed) console.log(`  ${c}`);
  await writeFile(new URL('recipes.json', out), JSON.stringify(recipes));
  await writeFile(new URL('dead-hosts.json', out), JSON.stringify([...deadHosts].sort(), null, 2) + '\n');

  // The six curated picks (src/components/recipes/picks.ts): photo, as the site requests it, and source must answer 200.
  const { PICKS } = await import('../src/components/recipes/picks.ts');
  const picks = PICKS.map((id) => recipes.find((r) => r.id === id));
  const checks = await pool(picks.flatMap((r) => [`${r.image}/large`, r.sourceUrl]), 12, probe);
  picks.forEach((r, i) => console.log(`pick ${r.id} ${r.title}: photo ${checks[2 * i].status || checks[2 * i].error}, source ${checks[2 * i + 1].status || checks[2 * i + 1].error} (${hostOf(r.sourceUrl)})`));
  if (checks.some((c) => c.status !== 200)) { console.error('a pick failed: choose a replacement by the familiarity rule (recipes spec 10)'); process.exitCode = 1; }
}
