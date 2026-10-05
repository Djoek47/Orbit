/**
 * Edit-task category chips use friendly labels (Kitchen, Laundry…).
 * Assigned library tasks store domain ids (kitchen_dining). Map both ways
 * so chips highlight correctly and save doesn’t wipe the domain id.
 */
import { categoryDisplayLabel } from '@/lib/tasks/task-library';

export const EDIT_CATEGORY_CHIPS = [
  'Cleaning',
  'Kitchen',
  'Laundry',
  'School',
  'Homework',
  'Groceries',
  'Pets',
  'Maintenance',
  'General',
] as const;

export type EditCategoryChip = (typeof EDIT_CATEGORY_CHIPS)[number];

const CHIP_TO_DOMAIN: Record<EditCategoryChip, string> = {
  Cleaning: 'floors_deep_cleaning',
  Kitchen: 'kitchen_dining',
  Laundry: 'laundry',
  School: 'homework_education',
  Homework: 'homework_education',
  Groceries: 'meals_groceries',
  Pets: 'pets',
  Maintenance: 'home_maintenance',
  General: 'General',
};

/** Short labels that aren’t on the chip row → nearest chip. */
const LABEL_ALIASES: Record<string, EditCategoryChip> = {
  trash: 'Cleaning',
  bathroom: 'Cleaning',
  bedroom: 'Cleaning',
  floors: 'Cleaning',
  living: 'Cleaning',
  outdoors: 'General',
  yard: 'General',
  hygiene: 'General',
  routine: 'General',
  car: 'Maintenance',
};

export function editCategoryChip(category: string | null | undefined): EditCategoryChip {
  const label = categoryDisplayLabel(category);
  const exact = EDIT_CATEGORY_CHIPS.find((chip) => chip.toLowerCase() === label.toLowerCase());
  if (exact) return exact;
  const token = label.toLowerCase().split(/\s+/)[0] ?? '';
  return LABEL_ALIASES[token] ?? 'General';
}

/** Keep the previous domain id when the chip didn’t change; otherwise map chip → domain. */
export function resolveSavedCategory(chip: string, previous: string): string {
  if (editCategoryChip(previous) === chip) return previous;
  if ((EDIT_CATEGORY_CHIPS as readonly string[]).includes(chip)) {
    return CHIP_TO_DOMAIN[chip as EditCategoryChip] ?? chip;
  }
  return chip;
}
