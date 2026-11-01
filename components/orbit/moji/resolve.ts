/**
 * Stored emoji → Moji. Data keeps emoji strings (catalog, rooms, places, subjects, DB rows)
 * so nothing migrates; render sites pass them through `<Moji emoji=…>` and this table decides
 * the drawing. Avatar emojis (faces, animals picked as a member look) are deliberately absent:
 * those stay emoji / Image Playground images and render through `MemberAvatar`.
 *
 * Keys are stored WITHOUT the U+FE0F variation selector; lookups strip it.
 */
import type { MojiName } from '@/components/orbit/moji/art';

const TABLE: Record<string, MojiName> = {
  // Produce
  '🍎': 'apple', '🍏': 'apple', '🍌': 'banana', '🍊': 'citrus', '🥭': 'citrus', '🍑': 'citrus',
  '🥝': 'citrus', '🍋': 'lemon', '🟡': 'lemon', '🍇': 'grapes', '🫐': 'grapes', '🍓': 'berry',
  '🍒': 'cherries', '🍐': 'pear', '🍉': 'watermelon', '🍈': 'watermelon', '🍍': 'pineapple',
  '🥥': 'coconut', '🥑': 'avocado', '🥕': 'carrot', '🥦': 'broccoli', '🥬': 'lettuce',
  '🍅': 'tomato', '🥔': 'potato', '🍠': 'potato', '🧅': 'onion', '🧄': 'garlic', '🌽': 'corn',
  '🫑': 'pepper', '🍆': 'pepper', '🌶': 'chili', '🥒': 'cucumber', '🟢': 'cucumber',
  '🍄': 'mushroom', '🫒': 'olive', '🌿': 'herbs', '🍀': 'seedling', '🫘': 'beans', '🥜': 'peanut',
  // Bakery & prepared
  '🍞': 'bread', '🫓': 'bread', '🥐': 'croissant', '🥖': 'baguette', '🥯': 'bagel',
  '🥞': 'pancakes', '🧇': 'pancakes', '🥪': 'sandwich', '🍔': 'burger', '🍕': 'pizza',
  '🌮': 'taco', '🌯': 'taco', '🌭': 'hotdog', '🍣': 'sushi', '🍜': 'noodles', '🍝': 'pasta',
  '🍚': 'rice', '🍲': 'soup', '🥗': 'salad', '🥣': 'cereal',
  // Meat & seafood
  '🥩': 'steak', '🍖': 'steak', '🥓': 'bacon', '🍗': 'drumstick', '🦃': 'drumstick',
  '🦆': 'drumstick', '🐟': 'fish', '🦐': 'shrimp', '🦪': 'shrimp', '🦞': 'shrimp', '🦀': 'shrimp',
  // Dairy
  '🥛': 'milk', '🧀': 'cheese', '🥚': 'egg', '🧈': 'butter',
  // Pantry & sweets
  '🫙': 'jar', '🍯': 'honey', '🧂': 'salt', '🥫': 'can', '🍁': 'syrup', '🌾': 'flour',
  '🍟': 'chips', '🥨': 'chips', '🍘': 'chips', '🍿': 'popcorn', '🍫': 'chocolate',
  '🍬': 'candy', '🍪': 'cookie', '🍰': 'cake', '🥧': 'cake', '🧁': 'cupcake', '🍩': 'donut',
  '🍦': 'icecream', '🍨': 'icecream', '🍧': 'icecream', '🧊': 'ice',
  // Drinks
  '🧃': 'juice', '🥤': 'juice', '🧋': 'juice', '💧': 'water', '☕': 'coffee', '🍵': 'tea',
  '🍾': 'bottle', '🍷': 'bottle', '🍺': 'beer',
  // Household, personal, baby, pet
  '🧴': 'lotion', '🪒': 'lotion', '🧼': 'soap', '🫧': 'soap', '🪥': 'toothbrush',
  '🧻': 'toiletRoll', '🤧': 'tissue', '💊': 'pill', '🩹': 'bandage', '🍼': 'babyBottle',
  '🧷': 'babyBottle', '🐾': 'paw', '🐱': 'paw', '🐶': 'paw', '🗑': 'trashBag', '🧹': 'broom',
  '🛒': 'cart', '👕': 'shirt', '👟': 'sneaker', '🏃': 'sneaker',
  // Homework subjects
  '🔢': 'numbers', '📖': 'book', '📚': 'books', '🧪': 'flask', '🏛': 'column', '🎨': 'palette',
  '⚽': 'ball',
  // Places & trips
  '🏠': 'home', '🏡': 'houseGarden', '💼': 'briefcase', '🏫': 'school', '📦': 'box',
  '📍': 'pin', '👵': 'heartHome', '🎯': 'target', '🏋': 'dumbbell', '🗺': 'map', '📋': 'clipboard',
  // Rooms
  '🍳': 'pan', '🛋': 'sofa', '🚿': 'shower', '🛏': 'bed', '🧺': 'basket', '🌳': 'tree',
  '🚪': 'door', '🪴': 'plant', '🚗': 'car', '🧸': 'teddy', '📺': 'tv', '🛠': 'tools',
  '🌅': 'sunrise',
  // Markers: notifications, rewards, levels
  '✅': 'check', '✓': 'check', '⭐': 'star', '🌟': 'star', '♾': 'star', '📅': 'calendar',
  '🎁': 'gift', '🏷': 'tag', '⚖': 'scales', '🧾': 'receipt', '🌙': 'moon', '🌌': 'moon',
  '🔔': 'bell', '🎤': 'mic', '⏱': 'timer', '✨': 'sparkles', '⚡': 'bolt', '🎮': 'gamepad',
  '🎬': 'clapper', '💰': 'moneyBag', '🏆': 'trophy', '👑': 'crown', '🏅': 'medal', '🥇': 'medal',
  '🥉': 'medal', '🎖': 'medal', '💎': 'gem', '💠': 'gem', '🔮': 'gem', '🛡': 'shield',
  '⚔': 'shield', '🦸': 'shield', '🚀': 'rocket', '🔥': 'fire', '🌱': 'seedling', '📱': 'phone',
  '👤': 'person', '👋': 'person', '🤝': 'check', '🤖': 'poppins',
};

/** Moji for a stored emoji string, or undefined when it isn't one of ours (e.g. an avatar). */
export function mojiForEmoji(emoji: string | null | undefined): MojiName | undefined {
  if (!emoji) return undefined;
  const key = emoji.replace(/️/g, '').trim();
  return TABLE[key];
}

/** Every emoji the resolver knows (for the no-stray-emoji guard test). */
export const RESOLVABLE_EMOJIS: readonly string[] = Object.keys(TABLE);
