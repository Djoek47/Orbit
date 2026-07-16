import type { HouseholdTask, TaskDifficulty } from '@/types/orbit';

export type TaskPreset = {
  id: string;
  title: string;
  category: string;
  baseXp: number;
  difficulty: TaskDifficulty;
  weight: number;
  repeat: HouseholdTask['repeat'];
  proofRequired: boolean;
  description?: string;
  roomKind?: 'kitchen' | 'living' | 'bathroom' | 'bedroom' | 'laundry' | 'outdoor' | 'custom';
};

/** Catalog shown first on Create Task — custom mint is admin-only. */
export const TASK_PRESETS: TaskPreset[] = [
  {
    id: 'preset-recycling',
    title: 'Take out recycling',
    category: 'Kitchen',
    baseXp: 15,
    difficulty: 'easy',
    weight: 1,
    repeat: 'Weekly',
    proofRequired: false,
    roomKind: 'kitchen',
  },
  {
    id: 'preset-dishes',
    title: 'Load dishwasher',
    category: 'Kitchen',
    baseXp: 15,
    difficulty: 'easy',
    weight: 1,
    repeat: 'Daily',
    proofRequired: false,
    roomKind: 'kitchen',
  },
  {
    id: 'preset-laundry',
    title: 'Laundry fold and put away',
    category: 'Laundry',
    baseXp: 20,
    difficulty: 'medium',
    weight: 1.5,
    repeat: 'Weekly',
    proofRequired: true,
    description: 'Photo of folded stacks before complete.',
    roomKind: 'laundry',
  },
  {
    id: 'preset-vacuum',
    title: 'Vacuum living room',
    category: 'Cleaning',
    baseXp: 25,
    difficulty: 'medium',
    weight: 1.5,
    repeat: 'Weekly',
    proofRequired: false,
    roomKind: 'living',
  },
  {
    id: 'preset-bathroom-trash',
    title: 'Empty bathroom trash',
    category: 'Cleaning',
    baseXp: 15,
    difficulty: 'easy',
    weight: 1,
    repeat: 'Weekly',
    proofRequired: false,
    roomKind: 'bathroom',
  },
  {
    id: 'preset-bathroom-garbage',
    title: 'Take bathroom garbage to bin',
    category: 'Cleaning',
    baseXp: 15,
    difficulty: 'easy',
    weight: 1,
    repeat: 'Weekly',
    proofRequired: false,
    roomKind: 'bathroom',
  },
  {
    id: 'preset-homework',
    title: 'Math homework check',
    category: 'Homework',
    baseXp: 25,
    difficulty: 'medium',
    weight: 1.5,
    repeat: 'Weekdays',
    proofRequired: true,
  },
  {
    id: 'preset-pets',
    title: 'Feed Luna',
    category: 'Pets',
    baseXp: 10,
    difficulty: 'easy',
    weight: 1,
    repeat: 'Daily',
    proofRequired: false,
  },
  {
    id: 'preset-trash',
    title: 'Take out trash',
    category: 'Cleaning',
    baseXp: 15,
    difficulty: 'easy',
    weight: 1,
    repeat: 'Weekly',
    proofRequired: false,
  },
  {
    id: 'preset-bathroom',
    title: 'Clean bathroom sink',
    category: 'Cleaning',
    baseXp: 30,
    difficulty: 'hard',
    weight: 2,
    repeat: 'Weekly',
    proofRequired: true,
    roomKind: 'bathroom',
  },
  {
    id: 'preset-school-bag',
    title: 'Pack school bag',
    category: 'School',
    baseXp: 15,
    difficulty: 'easy',
    weight: 1,
    repeat: 'Weekdays',
    proofRequired: false,
  },
];

/** Kids need this much XP before they can add wishlist grocery items. */
export const CHILD_GROCERY_WISHLIST_XP = 100;

/** Default late completion XP penalty (fraction of awarded XP). */
export const LATE_XP_PENALTY_RATE = 0.25;
