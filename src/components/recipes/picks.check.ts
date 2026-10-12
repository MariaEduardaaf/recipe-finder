// Run: node --experimental-strip-types src/components/recipes/picks.check.ts
// The curated picks (recipes spec 10, RC-02), the category fix (RC-25) and the diet rule (RC-09).
// @ts-ignore: no @types/node in this project; Node provides the module at runtime
import assert from 'node:assert/strict';
import { recipes, counted, kind, diet, meal, DEAD_HOSTS } from './data.ts';
import { PICKS } from './picks.ts';

const byId = new Map(recipes.map((r) => [r.id, r]));
assert.deepEqual(PICKS, ['52982', '53164', '52773', '52765', '52854', '53064'], 'the six picks, in this order');
const picks = PICKS.map((id) => {
  const r = byId.get(id);
  assert.ok(r, `pick ${id} is in recipes.json`);
  return r;
});
for (const r of picks) {
  assert.ok(counted(r).length <= 6, `${r.title}: ${counted(r).length} non-assumed ingredients (at most 6)`);
  assert.match(r.image, /^https:\/\//, `${r.title}: has a photo`);
  assert.ok(!DEAD_HOSTS.has(new URL(r.sourceUrl).hostname), `${r.title}: source host ${new URL(r.sourceUrl).hostname} is dead`);
}
const perCategory = new Map<string, number>();
for (const r of picks) perCategory.set(r.category, (perCategory.get(r.category) ?? 0) + 1);
for (const [c, n] of perCategory) assert.ok(n <= 2, `${n} picks in ${c} (at most 2)`);
assert.ok(picks.some((r) => r.category === 'Breakfast' || r.category === 'Dessert'), 'at least one breakfast or dessert');
const titles = picks.map((r) => r.title);
assert.notDeepEqual(titles, [...titles].sort((a, b) => a.localeCompare(b)), 'the order is not alphabetical');

// Category fix: pancakes are breakfast (RC-25).
assert.equal(kind(byId.get('52854')!), 'American breakfast');
assert.equal(meal(byId.get('52855')!), 'Breakfast');

// Diet rule on known recipes: 0 neither, 1 vegetarian, 2 vegan.
const dietOf = (id: string) => diet(byId.get(id)!);
assert.equal(dietOf('53164'), 0, 'Spanish Chicken is not vegetarian');
assert.equal(dietOf('52886'), 0, 'Spotted Dick (suet) is not vegetarian');
assert.equal(dietOf('52854'), 1, 'Pancakes are vegetarian, not vegan');
assert.equal(dietOf('53357'), 2, 'Jamaican Rice and Peas (kidney beans) is vegan');
assert.equal(dietOf('52794'), 2, 'Vegan Chocolate Cake (flax egg, almond milk) is vegan');
console.log('picks.check OK');
