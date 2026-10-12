// Ingredient normalization: the #1 accuracy complaint about SuperCook-style tools.
// Pure TypeScript with erasable syntax only, so Node can run it directly (fetch script + self-check).

// Assumed to be in every kitchen (never counted as missing, never shown as chips).
export const ASSUMED = new Set(['salt', 'pepper', 'water', 'oil']);

const PREP = new Set([
  'fresh', 'freshly', 'chopped', 'diced', 'sliced', 'minced', 'grated', 'crushed', 'peeled', 'large', 'small',
  'medium', 'big', 'canned', 'tinned', 'can', 'finely', 'roughly', 'thinly', 'boneless', 'skinless', 'whole',
  'extra', 'virgin', 'to', 'taste', 'optional', 'of', 'a', 'pinch', 'cooked', 'raw', 'frozen', 'ripe', 'shredded',
  'melted',
]);

// Whole-phrase synonyms (applied after singularizing). Keep small; add as accuracy bugs show up.
const SYN: Record<string, string> = {
  'scallion': 'green onion', 'spring onion': 'green onion', 'green onion': 'green onion', 'salad onion': 'green onion',
  'coriander': 'cilantro', 'coriander leaf': 'cilantro', 'fresh coriander': 'cilantro',
  'aubergine': 'eggplant', 'courgette': 'zucchini', 'capsicum': 'bell pepper', 'rocket': 'arugula',
  'prawn': 'shrimp', 'king prawn': 'shrimp', 'tiger prawn': 'shrimp', 'garbanzo bean': 'chickpea',
  'plain flour': 'flour', 'all-purpose flour': 'flour', 'all purpose flour': 'flour', 'white flour': 'flour',
  'caster sugar': 'sugar', 'granulated sugar': 'sugar', 'white sugar': 'sugar', 'icing sugar': 'powdered sugar',
  'confectioner sugar': 'powdered sugar', 'confectioners sugar': 'powdered sugar',
  'double cream': 'heavy cream', 'whipping cream': 'heavy cream', 'single cream': 'light cream',
  'minced beef': 'ground beef', 'beef mince': 'ground beef', 'minced pork': 'ground pork', 'pork mince': 'ground pork',
  'minced lamb': 'ground lamb', 'lamb mince': 'ground lamb', 'chicken breast': 'chicken', 'chicken thigh': 'chicken',
  'black pepper': 'pepper', 'white pepper': 'pepper', 'ground pepper': 'pepper', 'ground black pepper': 'pepper',
  'sea salt': 'salt', 'table salt': 'salt', 'kosher salt': 'salt',
  'olive oil': 'oil', 'vegetable oil': 'oil', 'sunflower oil': 'oil', 'canola oil': 'oil', 'rapeseed oil': 'oil',
  'cooking oil': 'oil', 'tomato puree': 'tomato paste', 'passata': 'tomato sauce', 'chopped tomato': 'tomato',
  'plum tomato': 'tomato', 'cherry tomato': 'tomato', 'red chili': 'chili', 'red chilli': 'chili', 'chilli': 'chili',
  'green chilli': 'green chili', 'garlic clove': 'garlic', 'clove garlic': 'garlic', 'yoghurt': 'yogurt',
  'warm water': 'water', 'cold water': 'water', 'boiling water': 'water', 'unsalted butter': 'butter',
  'egg yolk': 'egg', 'egg white': 'egg', 'red pepper': 'bell pepper', 'green pepper': 'bell pepper',
  'yellow pepper': 'bell pepper', 'orange pepper': 'bell pepper', 'sweetcorn': 'corn', 'beetroot': 'beet',
  'natural yogurt': 'yogurt', 'plain yogurt': 'yogurt', 'greek yogurt': 'yogurt', 'bicarbonate of soda': 'baking soda',
  'self-raising flour': 'self rising flour', 'self raising flour': 'self rising flour', 'corn flour': 'cornstarch',
  'cornflour': 'cornstarch', 'corn starch': 'cornstarch', 'soy sauce': 'soy sauce', 'soya sauce': 'soy sauce',
  // Spelling and leaf variants that showed up as separate shelf chips ("Bay leave", "Egg plant", "Parmesan cheese").
  'basil leaf': 'basil', 'cilantro leaf': 'cilantro', 'egg plant': 'eggplant', 'challot': 'shallot',
  'hotsauce': 'hot sauce', 'parmesan cheese': 'parmesan',
};

// Meats where "ground" is part of the name; elsewhere "ground cumin" == "cumin".
const GROUND_KEEP = new Set(['beef', 'pork', 'lamb', 'turkey', 'chicken', 'veal', 'almond']);

function singular(w: string): string {
  if (w.length < 4 || /(ss|us|is)$|^molasses$/.test(w)) return w; // hummus, asparagus
  if (w === 'leaves') return 'leaf'; // bay leaves
  if (w.endsWith('ies')) return w.slice(0, -3) + 'y'; // berries
  if (w.endsWith('oes')) return w.slice(0, -2); // tomatoes
  if (/(ches|shes|xes)$/.test(w)) return w.slice(0, -2); // radishes
  if (w.endsWith('s')) return w.slice(0, -1);
  return w;
}

export function normalize(raw: string): string {
  let s = raw.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() // jamón -> jamon, purée -> puree
    .replace(/\(.*?\)/g, ' ').replace(/[^a-z\s-]/g, ' ').replace(/\s+/g, ' ').trim();
  s = s.replace(/chilli/g, 'chili').replace(/yoghurt/g, 'yogurt');
  s = s.split(' ').map(singular).join(' ');
  s = SYN[s] ?? s;
  let words = s.split(' ').filter((w) => w && !PREP.has(w));
  if (words[0] === 'ground' && words.length > 1 && !GROUND_KEEP.has(words[1])) words = words.slice(1);
  s = words.join(' ');
  return SYN[s] ?? s;
}

// How many non-assumed ingredients of a recipe the pantry lacks.
export function missing(keys: string[], pantry: Set<string>): string[] {
  return keys.filter((k) => !ASSUMED.has(k) && !pantry.has(k));
}

const GROUPS: [string, RegExp][] = [
  ['Herbs & spices', /\b(powder|paprika|cumin|cinnamon|nutmeg|turmeric|oregano|thyme|basil|parsley|cilantro|mint|rosemary|sage|dill|bay|clove|cardamom|saffron|vanilla|mustard seed|chili flake|allspice|coriander|fennel|garam|curry|seasoning|herb|spice|tarragon|chive)\b/],
  ['Dairy & eggs', /\b(milk|cream|butter|cheese|cheddar|parmesan|mozzarella|yogurt|egg|feta|ricotta|ghee|mascarpone|custard)\b/],
  ['Meat & poultry', /\b(chicken|beef|pork|lamb|bacon|sausage|ham|turkey|duck|steak|veal|mince|chorizo|prosciutto|goat|rib|liver|kidney|meat)\b/],
  ['Fish & seafood', /\b(fish|salmon|tuna|cod|shrimp|prawn|anchov|mussel|clam|crab|squid|haddock|mackerel|sardine|seafood|oyster|lobster|scallop|trout|tilapia|herring)\b/],
  ['Fruit', /\b(avocado|strawberry|blackberry|prune|apple|lemon|lime|orange|banana|berry|cherry|raisin|grape|pear|peach|mango|pineapple|apricot|date|fig|plum|coconut|currant|sultana|pomegranate|melon|cranberry|raspberry)\b/],
  ['Vegetables', /\b(jalapeno|swede|celeriac|plantain|tofu|pak choi|lemongrass|sauerkraut|beet|onion|garlic|tomato|potato|carrot|pepper|celery|mushroom|spinach|cabbage|broccoli|cauliflower|pea|bean|corn|cucumber|eggplant|zucchini|squash|pumpkin|leek|lettuce|chili|ginger|beet|kale|olive|pepper|radish|turnip|yam|parsnip|arugula|shallot|cilantro|asparagus|artichoke|lentil|chickpea|okra|sweet potato)\b/],
  ['Sauces & condiments', /\b(sauce|vinegar|paste|ketchup|mayonnaise|mustard|honey|syrup|stock|broth|jam|chutney|miso|tahini|pesto|relish|wine|beer|sherry|brandy|rum|mirin)\b/],
  ['Pantry & baking', /\b(flour|sugar|rice|pasta|noodle|bread|oil|oat|yeast|baking|cornstarch|breadcrumb|cocoa|chocolate|nut|almond|walnut|cashew|peanut|pecan|pistachio|seed|spaghetti|tortilla|pastry|dough|couscous|lasagne|macaroni|cracker|biscuit|gelatin|cereal)\b/],
];

export function groupOf(key: string): string {
  return GROUPS.find(([, re]) => re.test(key))?.[0] ?? 'Other';
}

export const slugify = (key: string) => key.replace(/\s+/g, '-');
