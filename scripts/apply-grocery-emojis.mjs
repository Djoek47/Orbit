#!/usr/bin/env node
/**
 * Rebake product.icon in canada-grocery-catalog.json using the same
 * keyword rules as lib/grocery/item-emoji.ts (kept in sync here for Node).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const catalogPath = path.join(root, 'data/canada-grocery-catalog.json');

const RULES = [
  ['honeycrisp', '🍎'], ['ambrosia', '🍎'], ['spartan', '🍎'], ['green apple', '🍏'],
  ['apple', '🍎'], ['banana', '🍌'], ['blueberry', '🫐'], ['blueberries', '🫐'],
  ['strawberry', '🍓'], ['strawberries', '🍓'], ['raspberry', '🍓'], ['raspberries', '🍓'],
  ['grape', '🍇'], ['watermelon', '🍉'], ['cantaloupe', '🍈'], ['pineapple', '🍍'],
  ['mango', '🥭'], ['peach', '🍑'], ['pear', '🍐'], ['cherry', '🍒'], ['cherries', '🍒'],
  ['kiwi', '🥝'], ['lemon', '🍋'], ['lime', '🍋'], ['orange', '🍊'], ['clementine', '🍊'],
  ['apple juice', '🧃'], ['orange juice', '🧃'],
  ['avocado', '🥑'], ['coconut', '🥥'], ['tomato', '🍅'], ['olive', '🫒'],
  ['sweet potato', '🍠'], ['potato', '🥔'], ['carrot', '🥕'], ['broccoli', '🥦'],
  ['cauliflower', '🥦'], ['corn', '🌽'], ['cucumber', '🥒'], ['lettuce', '🥬'],
  ['romaine', '🥬'], ['spinach', '🥬'], ['kale', '🥬'], ['cabbage', '🥬'],
  ['bell pepper', '🫑'], ['pepper', '🫑'], ['chili', '🌶️'], ['garlic', '🧄'],
  ['onion', '🧅'], ['mushroom', '🍄'], ['eggplant', '🍆'], ['zucchini', '🥒'],
  ['chickpea', '🫘'], ['lentil', '🫘'], ['beans', '🫘'], ['celery', '🥬'],
  ['basil', '🌿'], ['cilantro', '🌿'], ['parsley', '🌿'], ['mint', '🌿'],
  ['dill', '🌿'], ['thyme', '🌿'], ['rosemary', '🌿'], ['herb', '🌿'],
  ['bagel', '🥯'], ['croissant', '🥐'], ['pretzel', '🥨'], ['donut', '🍩'],
  ['doughnut', '🍩'], ['muffin', '🧁'], ['cupcake', '🧁'], ['cake', '🍰'],
  ['pie', '🥧'], ['tart', '🥧'], ['cookie', '🍪'], ['biscuit', '🍪'],
  ['baguette', '🥖'], ['sourdough', '🍞'], ['bread', '🍞'], ['bun', '🍞'],
  ['tortilla', '🫓'], ['pita', '🫓'], ['naan', '🫓'], ['waffle', '🧇'], ['pancake', '🥞'],
  ['ice cream', '🍦'], ['gelato', '🍨'], ['popsicle', '🍧'],
  ['yogurt', '🥛'], ['yoghurt', '🥛'], ['yogourt', '🥛'],
  ['butter', '🧈'], ['margarine', '🧈'], ['cheese curd', '🧀'], ['cheddar', '🧀'],
  ['mozzarella', '🧀'], ['parmesan', '🧀'], ['brie', '🧀'], ['feta', '🧀'],
  ['cream cheese', '🧀'], ['cheese', '🧀'], ['egg', '🥚'], ['cream', '🥛'],
  ['milk', '🥛'], ['lait', '🥛'],
  ['bacon', '🥓'], ['ham', '🍖'], ['sausage', '🌭'], ['hot dog', '🌭'], ['hotdog', '🌭'],
  ['steak', '🥩'], ['beef', '🥩'], ['pork', '🥩'], ['lamb', '🥩'], ['veal', '🥩'],
  ['agneau', '🥩'], ['chicken wing', '🍗'], ['chicken', '🍗'], ['turkey', '🦃'],
  ['duck', '🦆'], ['shrimp', '🦐'], ['prawn', '🦐'], ['lobster', '🦞'], ['crab', '🦀'],
  ['oyster', '🦪'], ['salmon', '🐟'], ['tuna', '🐟'], ['cod', '🐟'], ['tilapia', '🐟'],
  ['fish', '🐟'], ['seafood', '🦐'],
  ['maple syrup', '🍁'], ['maple', '🍁'], ['honey', '🍯'],
  ['peanut butter', '🥜'], ['almond butter', '🥜'], ['nutella', '🍫'],
  ['jam', '🫙'], ['jelly', '🫙'], ['cereal', '🥣'], ['oat', '🥣'], ['granola', '🥣'],
  ['shreddies', '🥣'], ['pasta', '🍝'], ['spaghetti', '🍝'], ['penne', '🍝'],
  ['macaroni', '🍝'], ['lasagna', '🍝'], ['noodle', '🍜'], ['ramen', '🍜'],
  ['rice', '🍚'], ['couscous', '🍚'], ['quinoa', '🍚'], ['flour', '🌾'],
  ['sugar', '🧂'], ['salt', '🧂'], ['spice', '🧂'], ['oil', '🫒'], ['vinegar', '🍾'],
  ['ketchup', '🍅'], ['mustard', '🟡'], ['mayonnaise', '🫙'], ['mayo', '🫙'],
  ['salsa', '🫙'], ['sauce', '🥫'], ['soup', '🍲'], ['broth', '🍲'], ['stock', '🍲'],
  ['canned', '🥫'],
  ['popcorn', '🍿'], ['chip', '🥔'], ['crisp', '🥔'], ['cracker', '🍘'],
  ['nuts', '🥜'], ['almond', '🥜'], ['peanut', '🥜'], ['cashew', '🥜'],
  ['chocolate', '🍫'], ['candy', '🍬'], ['gummy', '🍬'], ['smarties', '🍬'],
  ['pizza', '🍕'], ['fries', '🍟'], ['frites', '🍟'], ['poutine', '🍟'],
  ['burrito', '🌯'], ['taco', '🌮'], ['sushi', '🍣'], ['salad', '🥗'],
  ['sandwich', '🥪'], ['hamburger', '🍔'], ['burger', '🍔'], ['frozen', '🧊'],
  ['coffee', '☕'], ['espresso', '☕'], ['tea', '🍵'], ['juice', '🧃'],
  ['smoothie', '🧋'], ['soda', '🥤'], ['cola', '🥤'], ['ginger ale', '🧃'],
  ['lemonade', '🍋'], ['beer', '🍺'], ['wine', '🍷'], ['water', '💧'],
  ['diaper', '🧷'], ['wipe', '🧻'], ['formula', '🍼'], ['baby', '🍼'],
  ['dog', '🐶'], ['cat', '🐱'], ['litter', '🐱'], ['pet', '🐾'],
  ['shampoo', '🧴'], ['conditioner', '🧴'], ['toothpaste', '🪥'], ['toothbrush', '🪥'],
  ['deodorant', '🧴'], ['soap', '🧼'], ['lotion', '🧴'], ['razor', '🪒'],
  ['advil', '💊'], ['tylenol', '💊'], ['vitamin', '💊'], ['bandage', '🩹'],
  ['detergent', '🫧'], ['bleach', '🧪'], ['cleaner', '🧹'], ['laundry', '🫧'],
  ['toilet paper', '🧻'], ['paper towel', '🧻'], ['tissue', '🤧'],
  ['foil', '📦'], ['garbage', '🗑️'], ['trash', '🗑️'],
];

const SORTED = [...RULES].sort((a, b) => b[0].length - a[0].length || a[0].localeCompare(b[0]));

const AISLE = {
  produce: '🥬', bakery: '🍞', deli: '🥪', meat_seafood: '🥩', dairy_eggs: '🥛',
  breakfast: '🥣', pantry: '🫙', canned: '🥫', snacks: '🍿', frozen: '🧊',
  beverages: '🧃', baby_kids: '🍼', household: '🧹', personal_care: '🧴', pet: '🐾', other: '🛒',
};

function normalize(raw) {
  return String(raw)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function emojiFor(name, categoryId) {
  const n = normalize(name);
  for (const [kw, emoji] of SORTED) {
    if (n.includes(kw)) return emoji;
  }
  return AISLE[categoryId] || '🛒';
}

const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
let changed = 0;
for (const p of catalog.products) {
  const next = emojiFor(p.name, p.categoryId);
  if (p.icon !== next) {
    p.icon = next;
    changed += 1;
  }
}
fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2) + '\n');

const sample = ['Banana', 'Shampoo', 'Chicken Breasts', '2% Milk', 'Apple Juice', 'Potato', 'Coffee'];
console.log(`Updated ${changed}/${catalog.products.length} icons`);
for (const s of sample) {
  const hit = catalog.products.find((p) => p.name.toLowerCase().includes(s.toLowerCase()));
  if (hit) console.log(`  ${hit.icon} ${hit.name}`);
}
const uniq = new Set(catalog.products.map((p) => p.icon));
console.log(`Unique icons: ${uniq.size}`);
