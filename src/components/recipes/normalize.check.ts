// Run: node --experimental-strip-types src/components/recipes/normalize.check.ts
// @ts-ignore: no @types/node in this project; Node provides the module at runtime
import assert from 'node:assert/strict';
import { normalize, missing, groupOf } from './normalize.ts';

const eq = (a: string, b: string) => assert.equal(normalize(a), b, `${a} -> ${normalize(a)} (want ${b})`);
eq('Scallions', 'green onion');
eq('Spring Onions', 'green onion');
eq('Tomatoes', 'tomato');
eq('Chopped Tomatoes', 'tomato');
eq('Large Eggs', 'egg');
eq('Fresh Parsley', 'parsley');
eq('Ground Cumin', 'cumin');
eq('Minced Beef', 'ground beef');
eq('Ground Beef', 'ground beef');
eq('Molasses', 'molasses');
eq('Cherries', 'cherry');
eq('Garlic Clove', 'garlic');
eq('Black Pepper', 'pepper');
eq('Olive Oil', 'oil');
eq('Plain Flour', 'flour');
eq('Coriander', 'cilantro');
eq('Red Pepper', 'bell pepper');
eq('Warm Water', 'water');
eq('Red Chilli Flakes', 'red chili flake');
eq('Bay Leaves', 'bay leaf');
eq('Bay Leaf', 'bay leaf');
eq('Basil Leaves', 'basil');
eq('Coriander Leaves', 'cilantro');
eq('Egg Plants', 'eggplant');
eq('Parmesan Cheese', 'parmesan');
eq('Melted Butter', 'butter');
eq('Jamón Ibérico', 'jamon iberico');
eq('Tomato Purée', 'tomato paste');
// the known bug in the original: green onion must NOT count as onion
assert.notEqual(normalize('Green Onions'), normalize('Onion'));

const pantry = new Set(['chicken', 'onion']);
assert.deepEqual(missing(['chicken', 'onion', 'salt', 'oil'], pantry), []); // assumed items are free
assert.deepEqual(missing(['chicken', 'green onion', 'pepper'], pantry), ['green onion']);
assert.equal(groupOf('chicken'), 'Meat & poultry');
console.log('normalize.check OK');
