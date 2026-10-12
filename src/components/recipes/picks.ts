// The six dishes a first visit shows (recipes spec 10, flag 1), in display order: food a US visitor names at a
// glance. Replace one only by the familiarity rule in the spec; picks.check.ts asserts this list, and
// `node scripts/fetch-recipes.mjs --check-links` confirms each photo and source answers 200.
// Spaghetti alla Carbonara, Spanish Chicken, Honey Teriyaki Salmon, Chicken Enchilada Casserole, Pancakes, Fettuccine Alfredo.
export const PICKS: readonly string[] = ['52982', '53164', '52773', '52765', '52854', '53064'];
