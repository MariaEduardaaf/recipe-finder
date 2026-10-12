// Server-side recipe data: TheMealDB plus our fixes (recipes spec 10). Never import this from client code, because
// it pulls in all of recipes.json; the browser gets /recipes/data.json (pages/recipes/data.json.ts) instead.
// Node-runnable (explicit extensions, JSON import attributes), so picks.check.ts can import it.
import raw from '../../data/recipes/recipes.json' with { type: 'json' };
import indexRaw from '../../data/recipes/ingredient-index.json' with { type: 'json' };
import deadHosts from '../../data/recipes/dead-hosts.json' with { type: 'json' };
import { RECIPE_DISPLAY } from '../../data/recipe-display.ts';
import { normalize, slugify, ASSUMED } from './normalize.ts';

export interface Recipe {
  id: string; title: string; category: string; area: string; image: string; sourceUrl: string;
  keys: string[]; // normalized, de-duplicated ingredient names, assumed items included
}
export interface Ingredient { key: string; count: number; group: string }

// TheMealDB mixes country names and demonyms, and 1 in 4 recipes has no area; unify so filters are clean.
const AREA: Record<string, string> = { Argentina: 'Argentinian', Netherlands: 'Dutch', Venezuela: 'Venezuelan', Norway: 'Norwegian', India: 'Indian', 'United States': 'American', France: 'French', Slovakia: 'Slovak' };
// TheMealDB files these under Dessert, but a US visitor eats pancakes at breakfast (recipes spec 10).
const CATEGORY_FIX: Record<string, string> = { '52854': 'Breakfast', '52855': 'Breakfast' };
// Group overrides: the name regexes in normalize.ts put these on the wrong shelf ("powder", "chicken", "milk").
// The first six are the spec's; the rest are names the regexes misread ("kidney", "beef tomato", "butter bean").
const GROUP_FIX: Record<string, string> = {
  'baking powder': 'Pantry & baking', 'baking soda': 'Pantry & baking', 'coconut milk': 'Pantry & baking',
  'chicken stock': 'Sauces & condiments', 'beef stock': 'Sauces & condiments', 'tomato paste': 'Sauces & condiments',
  'kidney bean': 'Vegetables', 'butter bean': 'Vegetables', 'beef tomato': 'Vegetables', 'oyster mushroom': 'Vegetables',
  'duck sauce': 'Sauces & condiments', 'peanut butter': 'Pantry & baking', 'coconut cream': 'Pantry & baking',
};

export const DEAD_HOSTS = new Set<string>(deadHosts);
export const UPDATED = '2026-10-12'; // "Last updated" on the recipe pages: the day the data and its fixes were last checked

export const recipes: Recipe[] = raw.map((r) => ({
  id: r.id, title: r.title.trim(), category: CATEGORY_FIX[r.id] ?? r.category, area: AREA[r.area ?? ''] ?? r.area ?? 'Unknown',
  image: r.image, sourceUrl: r.sourceUrl,
  keys: [...new Set(r.ingredients.map((i) => normalize(i.name)).filter(Boolean))],
}));
export const ingredients: Ingredient[] = indexRaw.map((i) => ({ ...i, group: GROUP_FIX[i.key] ?? i.group }));
const GROUP = new Map(ingredients.map((i) => [i.key, i.group]));

export const topIngredients = (n: number) => ingredients.slice(0, n);
export { slugify };
/** Ingredients a recipe asks for, apart from salt, pepper, oil and water. */
export const counted = (r: Recipe) => r.keys.filter((k) => !ASSUMED.has(k));

// Meal filter (recipes spec 10). Everything that isn't breakfast, a starter, a side or a dessert is a main dish.
export const MAIN = new Set(['Beef', 'Chicken', 'Pork', 'Lamb', 'Goat', 'Seafood', 'Pasta', 'Vegetarian', 'Vegan', 'Miscellaneous']);
export const meal = (r: Recipe) => (MAIN.has(r.category) ? 'main' : r.category);
export const MEALS = [
  { value: '', label: 'Any meal' }, { value: 'main', label: 'Main dishes' }, { value: 'Breakfast', label: 'Breakfast' },
  { value: 'Starter', label: 'Starters' }, { value: 'Side', label: 'Sides' }, { value: 'Dessert', label: 'Desserts' },
];

// Card kind line: "Spanish chicken dish", "Polish dessert", "Chicken dish" (recipes spec 10).
const DISH = new Set(['Beef', 'Chicken', 'Pork', 'Lamb', 'Goat', 'Seafood', 'Pasta', 'Vegetarian', 'Vegan']);
const WORDS: Record<string, string> = { Dessert: 'dessert', Side: 'side dish', Starter: 'starter', Breakfast: 'breakfast', Miscellaneous: 'dish' };
export const kind = (r: Pick<Recipe, 'area' | 'category'>) => {
  const k = DISH.has(r.category) ? `${r.category.toLowerCase()} dish` : WORDS[r.category] ?? 'dish';
  return r.area === 'Unknown' ? upper(k) : `${r.area} ${k}`;
};

// Diet filter (recipes spec 10, flag 11), from ingredient names; the page says so next to the filter.
// 0 = neither, 1 = vegetarian, 2 = vegan (and vegetarian). Beyond the spec's lists, found in the data: suet,
// mincemeat, goose fat, codfish, jamon and the rest below are not vegetarian; flax eggs, peanut butter and cream of
// tartar are vegan; and a recipe TheMealDB files under a meat or seafood category is never vegetarian.
const ANIMAL = /\b(chicken stock|beef stock|fish sauce|oyster sauce|anchovy|gelatine?|lard|worcestershire sauce|dashi|bonito|suet|mincemeat|goose fat|codfish|monkfish|jamon|oxtail|frog|trotter|chicken bouillon|bouillon cube)\b/;
const NOT_VEGAN = /\b(honey|butter|cream|cheese|yogurt|ghee|mayonnaise|custard)\b/;
const PLANT = /\b(soy|soya|almond|oat|coconut|rice|vegan|plant|peanut|flax|cream (of )?tartar)\b/;
const MEAT_CATEGORY = new Set(['Beef', 'Chicken', 'Pork', 'Lamb', 'Goat', 'Seafood']);
export type Diet = 0 | 1 | 2;
export function diet(r: Pick<Recipe, 'category' | 'keys'>): Diet {
  const group = (k: string) => GROUP.get(k);
  if (MEAT_CATEGORY.has(r.category) || r.keys.some((k) => group(k) === 'Meat & poultry' || group(k) === 'Fish & seafood' || ANIMAL.test(k))) return 0;
  if (r.keys.some((k) => (group(k) === 'Dairy & eggs' || NOT_VEGAN.test(k)) && !PLANT.test(k))) return 1;
  return 2;
}
export const DIETS = [{ value: '', label: 'Any diet' }, { value: '1', label: 'Vegetarian' }, { value: '2', label: 'Vegan' }];

// Display names for the 30 ingredient pages ("eggs", "bell peppers"); every other key displays as it is.
export const display = (key: string) => RECIPE_DISPLAY[key]?.name ?? key;
export const upper = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
export const photo = (r: Recipe) => `${r.image}/large`; // TheMealDB sizes: /small 150, /medium 350, /large 500, original 800px

// Starter packs (recipes spec 10). Unknown keys are dropped on the client.
export const packs = [
  { name: 'Basics', keys: ['onion', 'garlic', 'tomato', 'potato', 'carrot', 'butter', 'egg', 'milk', 'rice', 'chicken', 'flour', 'sugar', 'chicken stock', 'lemon', 'parsley', 'bell pepper', 'paprika', 'cumin'] },
  { name: 'Breakfast', keys: ['egg', 'milk', 'butter', 'bacon', 'flour', 'sugar', 'bread', 'banana', 'honey', 'cinnamon', 'oat'] },
  { name: 'Baking', keys: ['flour', 'sugar', 'brown sugar', 'butter', 'egg', 'milk', 'baking powder', 'baking soda', 'vanilla extract', 'cocoa', 'cinnamon', 'powdered sugar'] },
];
