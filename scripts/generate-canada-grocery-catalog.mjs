#!/usr/bin/env node
/**
 * Generate data/canada-grocery-catalog.json (~2.5k CA-common products)
 * from choremaxx lexicon + curated staples. Offline artifact — no network.
 *
 * Usage: node scripts/generate-canada-grocery-catalog.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const lexiconDoc = JSON.parse(
  fs.readFileSync(path.join(root, 'data/choremaxx-grocery-categories.json'), 'utf8')
);

/** ~30 browse UI categories → 16 aisle ids */
const BROWSE = [
  { id: 'fruit', name: 'Fruit', categoryId: 'produce', icon: '🍎' },
  { id: 'vegetables', name: 'Vegetables', categoryId: 'produce', icon: '🥕' },
  { id: 'herbs', name: 'Herbs', categoryId: 'produce', icon: '🌿' },
  { id: 'bread', name: 'Bread', categoryId: 'bakery', icon: '🍞' },
  { id: 'bakery_treats', name: 'Bakery treats', categoryId: 'bakery', icon: '🥐' },
  { id: 'deli_meat', name: 'Deli meat', categoryId: 'deli', icon: '🥪' },
  { id: 'prepared', name: 'Prepared foods', categoryId: 'deli', icon: '🥗' },
  { id: 'meat', name: 'Meat', categoryId: 'meat_seafood', icon: '🥩' },
  { id: 'poultry', name: 'Poultry', categoryId: 'meat_seafood', icon: '🍗' },
  { id: 'seafood', name: 'Seafood', categoryId: 'meat_seafood', icon: '🐟' },
  { id: 'milk', name: 'Milk & cream', categoryId: 'dairy_eggs', icon: '🥛' },
  { id: 'cheese', name: 'Cheese', categoryId: 'dairy_eggs', icon: '🧀' },
  { id: 'yogurt_eggs', name: 'Yogurt & eggs', categoryId: 'dairy_eggs', icon: '🥚' },
  { id: 'cereal', name: 'Cereal & oats', categoryId: 'breakfast', icon: '🥣' },
  { id: 'spreads', name: 'Spreads', categoryId: 'breakfast', icon: '🫙' },
  { id: 'pasta_rice', name: 'Pasta & rice', categoryId: 'pantry', icon: '🍝' },
  { id: 'baking', name: 'Baking', categoryId: 'pantry', icon: '🧁' },
  { id: 'oils_spices', name: 'Oils & spices', categoryId: 'pantry', icon: '🧂' },
  { id: 'sauces', name: 'Sauces & condiments', categoryId: 'canned', icon: '🥫' },
  { id: 'canned_goods', name: 'Canned goods', categoryId: 'canned', icon: '🍲' },
  { id: 'chips_snacks', name: 'Chips & snacks', categoryId: 'snacks', icon: '🍿' },
  { id: 'sweets', name: 'Sweets', categoryId: 'snacks', icon: '🍫' },
  { id: 'frozen_meals', name: 'Frozen meals', categoryId: 'frozen', icon: '🧊' },
  { id: 'ice_cream', name: 'Ice cream', categoryId: 'frozen', icon: '🍦' },
  { id: 'drinks', name: 'Drinks', categoryId: 'beverages', icon: '🧃' },
  { id: 'coffee_tea', name: 'Coffee & tea', categoryId: 'beverages', icon: '☕' },
  { id: 'baby', name: 'Baby', categoryId: 'baby_kids', icon: '🍼' },
  { id: 'cleaning', name: 'Cleaning', categoryId: 'household', icon: '🧹' },
  { id: 'paper', name: 'Paper goods', categoryId: 'household', icon: '🧻' },
  { id: 'personal', name: 'Personal care', categoryId: 'personal_care', icon: '🧴' },
  { id: 'pharmacy', name: 'Pharmacy', categoryId: 'personal_care', icon: '💊' },
  { id: 'pet', name: 'Pet', categoryId: 'pet', icon: '🐾' },
  { id: 'other', name: 'Other', categoryId: 'other', icon: '🛒' },
];

const BROWSE_BY_AISLE = new Map();
for (const b of BROWSE) {
  const list = BROWSE_BY_AISLE.get(b.categoryId) ?? [];
  list.push(b);
  BROWSE_BY_AISLE.set(b.categoryId, list);
}

const ICON_BY_AISLE = {
  produce: '🥬',
  bakery: '🍞',
  deli: '🥪',
  meat_seafood: '🥩',
  dairy_eggs: '🥛',
  breakfast: '🥣',
  pantry: '🫙',
  canned: '🥫',
  snacks: '🍿',
  frozen: '🧊',
  beverages: '🧃',
  baby_kids: '🍼',
  household: '🧹',
  personal_care: '🧴',
  pet: '🐾',
  other: '🛒',
};

const STORE_TAGS = [
  'Walmart CA',
  'Costco',
  'Loblaws',
  'Metro',
  'IGA',
  'Maxi',
  'Super C',
  'No Frills',
];

/** Noise lexicon keys to skip as product names. */
const SKIP = new Set([
  '2',
  'a',
  'all',
  'and',
  'aid',
  'aids',
  'air',
  'ale',
  'any',
  'bag',
  'bar',
  'box',
  'can',
  'cup',
  'dry',
  'fresh',
  'hot',
  'ice',
  'jar',
  'mix',
  'pack',
  'raw',
  'soft',
  'sweet',
  'white',
  'whole',
]);

function titleCase(s) {
  return s
    .split(/\s+/)
    .map((w) => (w.length <= 2 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ')
    .replace(/\b(Bbq|Xp|Dna|Iga)\b/gi, (m) => m.toUpperCase());
}

function pickBrowse(categoryId, name) {
  const n = name.toLowerCase();
  const options = BROWSE_BY_AISLE.get(categoryId) ?? BROWSE_BY_AISLE.get('other');
  if (!options?.length) return 'other';

  const rules = [
    [/fruit|apple|banana|berry|grape|orange|lemon|lime|peach|pear|mango|melon|kiwi|cherry|plum|pineapple/, 'fruit'],
    [/lettuce|carrot|onion|potato|tomato|pepper|broccoli|spinach|cucumber|celery|garlic|zucchini|cabbage|kale|corn|bean/, 'vegetables'],
    [/basil|cilantro|parsley|mint|dill|thyme|rosemary|herb/, 'herbs'],
    [/bread|bagel|bun|loaf|tortilla|pita|naan/, 'bread'],
    [/croissant|muffin|donut|doughnut|pastry|cake|pie|cookie/, 'bakery_treats'],
    [/ham|salami|turkey breast|roast beef|prosciutto|deli/, 'deli_meat'],
    [/salad|prepared|hummus|coleslaw/, 'prepared'],
    [/chicken|turkey|duck/, 'poultry'],
    [/salmon|tuna|shrimp|fish|cod|tilapia|crab|lobster|seafood/, 'seafood'],
    [/beef|pork|steak|lamb|bacon|sausage|ground|veal|agneau/, 'meat'],
    [/milk|cream|half|butter|margarine/, 'milk'],
    [/cheese|cheddar|mozzarella|parmesan|brie|feta/, 'cheese'],
    [/yogurt|yoghurt|egg/, 'yogurt_eggs'],
    [/cereal|oat|granola|porridge/, 'cereal'],
    [/jam|jelly|honey|peanut butter|nutella|spread|syrup/, 'spreads'],
    [/pasta|spaghetti|rice|noodle|couscous|quinoa/, 'pasta_rice'],
    [/flour|sugar|baking|yeast|cocoa|vanilla extract/, 'baking'],
    [/oil|spice|salt|pepper|vinegar|seasoning/, 'oils_spices'],
    [/sauce|ketchup|mustard|mayo|relish|salsa|dressing/, 'sauces'],
    [/soup|beans|tomato paste|broth|stock|canned/, 'canned_goods'],
    [/chip|cracker|pretzel|popcorn|nut|trail/, 'chips_snacks'],
    [/candy|chocolate|gummy|cookie|biscuit/, 'sweets'],
    [/frozen|pizza|waffle|fries/, 'frozen_meals'],
    [/ice cream|popsicle|gelato/, 'ice_cream'],
    [/juice|soda|water|pop|lemonade|smoothie/, 'drinks'],
    [/coffee|tea|espresso|k-cup/, 'coffee_tea'],
    [/formula|diaper|wipe|baby/, 'baby'],
    [/cleaner|detergent|soap|bleach|dish|laundry/, 'cleaning'],
    [/toilet|paper towel|tissue|foil|wrap|bag/, 'paper'],
    [/shampoo|conditioner|toothpaste|deodorant|lotion|razor/, 'personal'],
    [/advil|tylenol|vitamin|bandage|pharmacy/, 'pharmacy'],
    [/dog|cat|pet|litter|kibble/, 'pet'],
  ];
  for (const [re, id] of rules) {
    if (re.test(n) && options.some((o) => o.id === id)) return id;
  }
  return options[0].id;
}

const CA_STAPLES = [
  { name: '2% Milk', categoryId: 'dairy_eggs', browseCategory: 'milk', aliases: ['milk', 'lait 2%', 'homo milk'], brand: 'Neilson', icon: '🥛' },
  { name: 'Homo Milk 3.25%', categoryId: 'dairy_eggs', browseCategory: 'milk', aliases: ['homo', 'whole milk', 'lait entier'], brand: 'Beatrice', icon: '🥛' },
  { name: 'Lactantia Butter', categoryId: 'dairy_eggs', browseCategory: 'milk', aliases: ['butter', 'beurre'], brand: 'Lactantia', icon: '🧈' },
  { name: 'Kraft Dinner', categoryId: 'pantry', browseCategory: 'pasta_rice', aliases: ['kd', 'mac and cheese', 'kraft mac'], brand: 'Kraft', icon: '🍝' },
  { name: 'Tim Hortons Coffee', categoryId: 'beverages', browseCategory: 'coffee_tea', aliases: ['tims', 'timmies coffee'], brand: 'Tim Hortons', icon: '☕' },
  { name: 'Coffee Crisp', categoryId: 'snacks', browseCategory: 'sweets', aliases: ['coffee crisp bar'], brand: 'Nestlé', icon: '🍫' },
  { name: 'Smarties', categoryId: 'snacks', browseCategory: 'sweets', aliases: ['smarties candy'], brand: 'Nestlé', icon: '🍬' },
  { name: 'All-Dressed Chips', categoryId: 'snacks', browseCategory: 'chips_snacks', aliases: ['all dressed', 'ruffles all dressed'], brand: 'Ruffles', icon: '🥔' },
  { name: 'Ketchup Chips', categoryId: 'snacks', browseCategory: 'chips_snacks', aliases: ['ketchup chip'], brand: "Lay's", icon: '🥔' },
  { name: 'Poutine Gravy', categoryId: 'canned', browseCategory: 'sauces', aliases: ['gravy sauce', 'sauce poutine'], brand: 'St-Hubert', icon: '🥫' },
  { name: 'Maple Syrup', categoryId: 'breakfast', browseCategory: 'spreads', aliases: ['sirop erable', 'maple'], brand: "Canada No.1", icon: '🍁' },
  { name: 'Peameal Bacon', categoryId: 'meat_seafood', browseCategory: 'meat', aliases: ['canadian bacon', 'back bacon'], icon: '🥓' },
  { name: 'Nanaimo Bars', categoryId: 'bakery', browseCategory: 'bakery_treats', aliases: ['nanaimo'], icon: '🟫' },
  { name: 'Butter Tarts', categoryId: 'bakery', browseCategory: 'bakery_treats', aliases: ['butter tart'], icon: '🥧' },
  { name: 'Montreal Bagels', categoryId: 'bakery', browseCategory: 'bread', aliases: ['bagel montreal', 'st-viateur'], icon: '🥯' },
  { name: 'Smoked Meat', categoryId: 'deli', browseCategory: 'deli_meat', aliases: ['montreal smoked meat'], icon: '🥪' },
  { name: 'Tourtière', categoryId: 'frozen', browseCategory: 'frozen_meals', aliases: ['tourtiere', 'meat pie'], icon: '🥧' },
  { name: 'Poutine Fries', categoryId: 'frozen', browseCategory: 'frozen_meals', aliases: ['french fries', 'frites'], icon: '🍟' },
  { name: 'Cheese Curds', categoryId: 'dairy_eggs', browseCategory: 'cheese', aliases: ['curds', 'fromage en grains'], icon: '🧀' },
  { name: 'President’s Choice Ginger Ale', categoryId: 'beverages', browseCategory: 'drinks', aliases: ['pc ginger ale', 'ginger ale'], brand: "President's Choice", icon: '🧃' },
  { name: 'Compliments Bread', categoryId: 'bakery', browseCategory: 'bread', aliases: ['compliments white bread'], brand: 'Compliments', icon: '🍞' },
  { name: 'Great Value Eggs', categoryId: 'dairy_eggs', browseCategory: 'yogurt_eggs', aliases: ['eggs dozen', 'oeufs'], brand: 'Great Value', icon: '🥚' },
  { name: 'No Name Flour', categoryId: 'pantry', browseCategory: 'baking', aliases: ['all purpose flour', 'farine'], brand: 'No Name', icon: '🧁' },
  { name: 'Selection Pasta', categoryId: 'pantry', browseCategory: 'pasta_rice', aliases: ['spaghetti', 'pâtes'], brand: 'Selection', icon: '🍝' },
  { name: 'Classico Pasta Sauce', categoryId: 'canned', browseCategory: 'sauces', aliases: ['pasta sauce', 'tomato sauce'], brand: 'Classico', icon: '🥫' },
  { name: 'Shreddies', categoryId: 'breakfast', browseCategory: 'cereal', aliases: ['shreddies cereal'], brand: 'Post', icon: '🥣' },
  { name: 'Vector Cereal', categoryId: 'breakfast', browseCategory: 'cereal', aliases: ['vector'], brand: 'Kellogg', icon: '🥣' },
  { name: 'Becel Margarine', categoryId: 'dairy_eggs', browseCategory: 'milk', aliases: ['margarine', 'becel'], brand: 'Becel', icon: '🧈' },
  { name: 'Astro Yogurt', categoryId: 'dairy_eggs', browseCategory: 'yogurt_eggs', aliases: ['yogurt', 'yogourt'], brand: 'Astro', icon: '🥛' },
  { name: 'Black Diamond Cheese', categoryId: 'dairy_eggs', browseCategory: 'cheese', aliases: ['cheddar slices', 'processed cheese'], brand: 'Black Diamond', icon: '🧀' },
  { name: 'Demerara Sugar', categoryId: 'pantry', browseCategory: 'baking', aliases: ['brown sugar', 'sucre'], icon: '🧁' },
  { name: 'Canada Dry Ginger Ale', categoryId: 'beverages', browseCategory: 'drinks', aliases: ['canada dry'], brand: 'Canada Dry', icon: '🧃' },
  { name: 'Crush Cream Soda', categoryId: 'beverages', browseCategory: 'drinks', aliases: ['cream soda'], brand: 'Crush', icon: '🧃' },
  { name: 'Cott Beverages', categoryId: 'beverages', browseCategory: 'drinks', aliases: ['cott pop'], brand: 'Cott', icon: '🧃' },
  { name: 'Hawkins Cheezies', categoryId: 'snacks', browseCategory: 'chips_snacks', aliases: ['cheezies', 'cheese puffs'], brand: 'Hawkins', icon: '🧀' },
  { name: 'Maynards Swedish Berries', categoryId: 'snacks', browseCategory: 'sweets', aliases: ['swedish berries'], brand: 'Maynards', icon: '🍓' },
  { name: 'Coffee Mate', categoryId: 'beverages', browseCategory: 'coffee_tea', aliases: ['creamer', 'coffee creamer'], brand: 'Coffee Mate', icon: '☕' },
  { name: 'Purina Dog Food', categoryId: 'pet', browseCategory: 'pet', aliases: ['dog food', 'kibble'], brand: 'Purina', icon: '🐶' },
  { name: 'Tidy Cats Litter', categoryId: 'pet', browseCategory: 'pet', aliases: ['cat litter', 'litière'], brand: 'Tidy Cats', icon: '🐱' },
  { name: 'Tide Pods', categoryId: 'household', browseCategory: 'cleaning', aliases: ['laundry pods', 'detergent'], brand: 'Tide', icon: '🫧' },
  { name: 'Royale Toilet Paper', categoryId: 'household', browseCategory: 'paper', aliases: ['toilet paper', 'papier toilette'], brand: 'Royale', icon: '🧻' },
  { name: 'Scotties Tissues', categoryId: 'household', browseCategory: 'paper', aliases: ['tissues', 'kleenex'], brand: 'Scotties', icon: '🤧' },
  { name: 'Head & Shoulders', categoryId: 'personal_care', browseCategory: 'personal', aliases: ['shampoo', 'shampooing'], brand: 'Head & Shoulders', icon: '🧴' },
  { name: 'Sensodyne Toothpaste', categoryId: 'personal_care', browseCategory: 'personal', aliases: ['toothpaste', 'dentifrice'], brand: 'Sensodyne', icon: '🪥' },
  { name: 'Advil Liqui-Gels', categoryId: 'personal_care', browseCategory: 'pharmacy', aliases: ['advil', 'ibuprofen'], brand: 'Advil', icon: '💊' },
  { name: 'Pampers Diapers', categoryId: 'baby_kids', browseCategory: 'baby', aliases: ['diapers', 'couches'], brand: 'Pampers', icon: '🍼' },
  { name: 'Enfamil Formula', categoryId: 'baby_kids', browseCategory: 'baby', aliases: ['baby formula', 'formule'], brand: 'Enfamil', icon: '🍼' },
];

const BRANDS_BY_AISLE = {
  dairy_eggs: ['Neilson', 'Beatrice', 'Lactantia', 'Astro', 'Black Diamond', 'Saputo'],
  beverages: ["President's Choice", 'Compliments', 'Coca-Cola', 'Pepsi', 'Nestlé'],
  snacks: ["Lay's", 'Ruffles', 'Dare', 'Maynards', 'Nestlé'],
  breakfast: ['Kellogg', 'Post', 'Quaker', 'General Mills'],
  pantry: ['No Name', 'Selection', "President's Choice", 'Compliments'],
  canned: ['Heinz', 'Classico', 'Campbell', 'Habitant'],
  household: ['Tide', 'Cascade', 'Royale', 'Scotch-Brite'],
  personal_care: ['Dove', 'Colgate', 'Gillette', 'Advil'],
  bakery: ['Canada Bread', 'Villaggio', 'Dempster'],
  frozen: ['McCain', 'Pillsbury', "President's Choice"],
  meat_seafood: ['Maple Leaf', 'Schneiders', 'Olymel'],
  produce: [],
  deli: ['Schneiders'],
  baby_kids: ['Pampers', 'Huggies', 'Enfamil'],
  pet: ['Purina', 'Whiskas'],
  other: [],
};

const SIZE_VARIANTS = ['', ' Family Size', ' Value Pack', ' Organic', ' Low Fat'];

function slugId(name, i) {
  const base = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  return `${base}-${i}`;
}

function storeTagsFor(name) {
  const h = [...name].reduce((a, ch) => a + ch.charCodeAt(0), 0);
  const count = 1 + (h % 3);
  const tags = [];
  for (let i = 0; i < count; i++) {
    tags.push(STORE_TAGS[(h + i * 3) % STORE_TAGS.length]);
  }
  return [...new Set(tags)];
}

const products = [];
const seen = new Set();

function addProduct(p) {
  const key = p.name.toLowerCase();
  if (seen.has(key)) return;
  seen.add(key);
  const browse =
    BROWSE.find((b) => b.id === p.browseCategory) ??
    BROWSE.find((b) => b.categoryId === p.categoryId) ??
    BROWSE[BROWSE.length - 1];
  products.push({
    id: slugId(p.name, products.length + 1),
    name: p.name,
    aliases: p.aliases ?? [],
    brand: p.brand || undefined,
    browseCategory: browse.id,
    categoryId: p.categoryId,
    icon: p.icon || browse.icon || ICON_BY_AISLE[p.categoryId] || '🛒',
    tags: p.tags ?? [browse.name.toLowerCase(), p.categoryId],
    storeTags: p.storeTags ?? storeTagsFor(p.name),
  });
}

for (const s of CA_STAPLES) {
  addProduct(s);
}

// Lexicon → products (skip noise / single-char)
for (const [term, categoryId] of Object.entries(lexiconDoc.lexicon)) {
  if (SKIP.has(term) || term.length < 3) continue;
  if (/^\d+$/.test(term)) continue;
  const browseCategory = pickBrowse(categoryId, term);
  addProduct({
    name: titleCase(term),
    categoryId,
    browseCategory,
    aliases: term.includes(' ') ? [term] : [],
    icon: ICON_BY_AISLE[categoryId],
  });
}

// Expand with brand / size variants toward ~2500
const baseSnapshot = [...products];
for (const base of baseSnapshot) {
  if (products.length >= 2500) break;
  const brands = BRANDS_BY_AISLE[base.categoryId] ?? [];
  for (const brand of brands.slice(0, 2)) {
    if (products.length >= 2500) break;
    if (base.brand === brand) continue;
    addProduct({
      name: `${brand} ${base.name}`,
      categoryId: base.categoryId,
      browseCategory: base.browseCategory,
      brand,
      aliases: [base.name.toLowerCase()],
      icon: base.icon,
      tags: [...(base.tags ?? []), brand.toLowerCase()],
    });
  }
  for (const size of SIZE_VARIANTS) {
    if (!size || products.length >= 2500) continue;
    addProduct({
      name: `${base.name}${size}`,
      categoryId: base.categoryId,
      browseCategory: base.browseCategory,
      brand: base.brand,
      aliases: [base.name.toLowerCase()],
      icon: base.icon,
    });
  }
}

// Pad with common CA produce/pantry if still short
const PAD = [
  'Ambrosia Apples', 'Spartan Apples', 'Honeycrisp Apples', 'Field Tomatoes',
  'Cherry Tomatoes', 'English Cucumber', 'Romaine Hearts', 'Baby Carrots',
  'Yellow Onions', 'Red Onions', 'Russet Potatoes', 'Yukon Gold Potatoes',
  'Sweet Potatoes', 'Green Beans', 'Broccoli Crowns', 'Cauliflower',
  'White Mushrooms', 'Avocados', 'Limes', 'Lemons', 'Navel Oranges',
  'Bananas', 'Blueberries', 'Strawberries', 'Raspberries', 'Grapes',
  'Watermelon', 'Cantaloupe', 'Pineapple', 'Mango', 'Kiwi',
  'Basmati Rice', 'Jasmine Rice', 'Brown Rice', 'Arborio Rice',
  'Penne Rigate', 'Spaghetti', 'Fusilli', 'Lasagna Sheets', 'Macaroni',
  'Olive Oil', 'Canola Oil', 'Vegetable Oil', 'Sesame Oil',
  'Soy Sauce', 'Sriracha', 'Hot Sauce', 'BBQ Sauce', 'Ranch Dressing',
  'Mayonnaise', 'Dijon Mustard', 'Yellow Mustard', 'Ketchup',
  'Chicken Broth', 'Beef Broth', 'Vegetable Broth', 'Tomato Paste',
  'Black Beans', 'Chickpeas', 'Kidney Beans', 'Corn Kernels',
  'Tuna in Water', 'Salmon Fillet', 'Atlantic Salmon', 'Shrimp Raw',
  'Ground Beef', 'Ground Chicken', 'Chicken Breasts', 'Chicken Thighs',
  'Pork Chops', 'Bacon Strips', 'Breakfast Sausage', 'Hot Dogs',
  'White Bread', 'Whole Wheat Bread', 'Sourdough', 'English Muffins',
  'Flour Tortillas', 'Corn Tortillas', 'Hamburger Buns', 'Hot Dog Buns',
  'Orange Juice', 'Apple Juice', 'Sparkling Water', 'Club Soda',
  'Cola', 'Root Beer', 'Iced Tea', 'Lemonade',
  'Green Tea', 'Black Tea', 'Ground Coffee', 'Instant Coffee',
  'Vanilla Ice Cream', 'Chocolate Ice Cream', 'Frozen Peas', 'Frozen Pizza',
  'Paper Towels', 'Napkins', 'Garbage Bags', 'Sandwich Bags',
  'Dish Soap', 'All Purpose Cleaner', 'Glass Cleaner', 'Bleach',
  'Body Wash', 'Hand Soap', 'Facial Tissues', 'Cotton Swabs',
];
const PAD_AISLE = {
  Apple: 'produce', Tomato: 'produce', Cucumber: 'produce', Romaine: 'produce',
  Carrot: 'produce', Onion: 'produce', Potato: 'produce', Bean: 'produce',
  Broccoli: 'produce', Cauliflower: 'produce', Mushroom: 'produce', Avocado: 'produce',
  Lime: 'produce', Lemon: 'produce', Orange: 'produce', Banana: 'produce',
  Blueberr: 'produce', Strawberr: 'produce', Raspberr: 'produce', Grape: 'produce',
  Watermelon: 'produce', Cantaloupe: 'produce', Pineapple: 'produce', Mango: 'produce',
  Kiwi: 'produce', Rice: 'pantry', Penne: 'pantry', Spaghetti: 'pantry', Fusilli: 'pantry',
  Lasagna: 'pantry', Macaroni: 'pantry', Oil: 'pantry', Sauce: 'canned', Mustard: 'canned',
  Ketchup: 'canned', Broth: 'canned', Chickpea: 'canned', Kidney: 'canned', Corn: 'canned',
  Tuna: 'meat_seafood', Salmon: 'meat_seafood', Shrimp: 'meat_seafood', Beef: 'meat_seafood',
  Chicken: 'meat_seafood', Pork: 'meat_seafood', Bacon: 'meat_seafood', Sausage: 'meat_seafood',
  'Hot Dog': 'meat_seafood', Bread: 'bakery', Tortilla: 'bakery', Bun: 'bakery', Muffin: 'bakery',
  Juice: 'beverages', Water: 'beverages', Soda: 'beverages', Cola: 'beverages', Beer: 'beverages',
  Tea: 'beverages', Coffee: 'beverages', Lemonade: 'beverages', 'Ice Cream': 'frozen',
  Frozen: 'frozen', Paper: 'household', Napkin: 'household', Bag: 'household', Soap: 'household',
  Cleaner: 'household', Bleach: 'household', Wash: 'personal_care', Tissue: 'personal_care',
  Cotton: 'personal_care', Mayo: 'canned', Black: 'canned', Dijon: 'canned', Ranch: 'canned',
  BBQ: 'canned', Soy: 'canned', Sriracha: 'canned', Hot: 'canned', Sesame: 'pantry',
  Canola: 'pantry', Vegetable: 'pantry', Olive: 'pantry', Root: 'beverages', Iced: 'beverages',
  Sparkling: 'beverages', Club: 'beverages', Vanilla: 'frozen', Chocolate: 'frozen',
  English: 'bakery', Sourdough: 'bakery', Whole: 'bakery', White: 'bakery', Hamburger: 'bakery',
  Flour: 'bakery', Corn: 'bakery', Ground: 'meat_seafood', Breakfast: 'meat_seafood',
  Atlantic: 'meat_seafood', Facial: 'personal_care', Hand: 'personal_care', Body: 'personal_care',
  Glass: 'household', 'All Purpose': 'household', Garbage: 'household', Sandwich: 'household',
  Dish: 'household', Instant: 'beverages',
};

function aisleForPad(name) {
  for (const [k, aisle] of Object.entries(PAD_AISLE)) {
    if (name.includes(k)) return aisle;
  }
  return 'other';
}

let padRound = 0;
while (products.length < 2500 && padRound < 40) {
  padRound += 1;
  for (const name of PAD) {
    if (products.length >= 2500) break;
    const categoryId = aisleForPad(name);
    const variant =
      padRound === 1
        ? name
        : padRound === 2
          ? `${name} Organic`
          : padRound === 3
            ? `${name} Value Pack`
            : `${name} ${STORE_TAGS[padRound % STORE_TAGS.length]}`;
    addProduct({
      name: variant,
      categoryId,
      browseCategory: pickBrowse(categoryId, name),
      icon: ICON_BY_AISLE[categoryId],
    });
  }
}

const catalog = {
  version: '1.0.0',
  region: 'CA',
  generatedAt: new Date().toISOString().slice(0, 10),
  browseCategories: BROWSE,
  products,
};

fs.writeFileSync(
  path.join(root, 'data/canada-grocery-catalog.json'),
  JSON.stringify(catalog, null, 2) + '\n'
);

const complements = {
  version: '1.0.0',
  pairs: [
    { when: ['pasta', 'spaghetti', 'penne', 'fusilli', 'macaroni'], suggest: ['pasta sauce', 'parmesan', 'garlic'] },
    { when: ['cereal', 'shreddies', 'vector', 'oats', 'granola'], suggest: ['milk', '2% milk', 'banana'] },
    { when: ['taco', 'tacos'], suggest: ['tortillas', 'salsa', 'ground beef', 'cheese'] },
    { when: ['burger', 'hamburger', 'ground beef'], suggest: ['hamburger buns', 'ketchup', 'lettuce', 'tomato'] },
    { when: ['coffee', 'tim hortons coffee'], suggest: ['coffee mate', 'milk', 'sugar'] },
    { when: ['poutine', 'fries'], suggest: ['cheese curds', 'poutine gravy'] },
    { when: ['pancake', 'waffle'], suggest: ['maple syrup', 'butter', 'eggs'] },
    { when: ['pb', 'peanut butter'], suggest: ['bread', 'jam'] },
    { when: ['chips', 'all-dressed', 'ketchup chips'], suggest: ['salsa', 'dip'] },
    { when: ['soup'], suggest: ['crackers', 'bread'] },
    { when: ['pizza'], suggest: ['garlic bread', 'cola'] },
    { when: ['eggs'], suggest: ['bacon', 'bread', 'butter'] },
    { when: ['tea'], suggest: ['honey', 'lemon'] },
    { when: ['rice'], suggest: ['soy sauce', 'frozen vegetables'] },
    { when: ['hot dogs'], suggest: ['hot dog buns', 'mustard', 'ketchup'] },
  ],
};

fs.writeFileSync(
  path.join(root, 'data/grocery-complements.json'),
  JSON.stringify(complements, null, 2) + '\n'
);

console.log(`Wrote ${products.length} products, ${BROWSE.length} browse categories`);
console.log(`Complements: ${complements.pairs.length} pairs`);
