import type { HouseholdRoom } from '@/types/orbit';

export const DEFAULT_HOUSEHOLD_ROOMS: HouseholdRoom[] = [
  { id: 'room-kitchen', name: 'Kitchen', emoji: '🍳', kind: 'kitchen' },
  { id: 'room-living', name: 'Living room', emoji: '🛋️', kind: 'living' },
  { id: 'room-bathroom', name: 'Bathroom', emoji: '🚿', kind: 'bathroom' },
  { id: 'room-bedroom', name: 'Bedrooms', emoji: '🛏️', kind: 'bedroom' },
  { id: 'room-laundry', name: 'Laundry', emoji: '👕', kind: 'laundry' },
];

export { ROOM_EMOJIS } from '@/constants/accent-themes';

export const GROCERY_CATEGORIES = [
  'Produce',
  'Dairy & Eggs',
  'Bakery',
  'Meat & Seafood',
  'Frozen',
  'Pantry',
  'Beverages',
  'Snacks',
  'Household',
  'Bathroom',
  'Cleaning',
  'Pets',
  'Baby',
  'Other',
] as const;

export const GROCERY_LOCATIONS = ['Fridge', 'Freezer', 'Pantry', 'Bathroom', 'Cleaning'] as const;

export function locationForGroceryCategory(category: string): (typeof GROCERY_LOCATIONS)[number] {
  if (category === 'Dairy & Eggs' || category === 'Dairy' || category === 'Meat & Seafood') {
    return 'Fridge';
  }
  if (category === 'Frozen') {
    return 'Freezer';
  }
  if (category === 'Bathroom' || category === 'Baby') {
    return 'Bathroom';
  }
  if (category === 'Cleaning' || category === 'Household') {
    return 'Cleaning';
  }
  return 'Pantry';
}
