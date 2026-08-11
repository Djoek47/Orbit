// ChoreMaxx icon geometry - 29 marks on one 24x24 grid.
// Generated. Do not hand-edit path data.

export type IconName =
  | 'kitchen'
  | 'trash'
  | 'bathroom'
  | 'laundry'
  | 'bedroom'
  | 'livingRoom'
  | 'floors'
  | 'pets'
  | 'car'
  | 'yard'
  | 'hygiene'
  | 'dailyRoutine'
  | 'groceries'
  | 'maintenance'
  | 'homework'
  | 'firstStep'
  | 'weekWarrior'
  | 'homeworkAce'
  | 'teamPlayer'
  | 'cleanSweep'
  | 'earlyBird'
  | 'monthMaster'
  | 'poppinsFavorite'
  | 'tierMedal'
  | 'tierStar'
  | 'tierCup'
  | 'tierShield'
  | 'tierLaurel'
  | 'tierCrown';

export type IconShape =
  | { t: 'p'; d: string; accent?: true; fill?: true }
  | { t: 'c'; cx: number; cy: number; r: number; accent?: true; fill?: true };

/** Shapes marked `accent` carry the theme primary highlight in the duotone variant.
 *  Shapes marked `fill` are closed silhouettes; open paths must never be filled. */
export const ICONS: Record<IconName, IconShape[]> = {
  kitchen: [
    { t: 'p', d: 'M5 2.5v6.2a2 2 0 0 0 2 2h3.2a2 2 0 0 0 2-2V2.5' },
    { t: 'p', d: 'M8.6 10.7v10.8' },
    { t: 'p', d: 'M8.6 2.5v6', accent: true },
    { t: 'p', d: 'M19.4 14.4V2.6a4.6 4.6 0 0 0-4.6 4.6v5.2a2 2 0 0 0 2 2h2.6Z', fill: true },
    { t: 'p', d: 'M19.4 14.4v7' },
  ],
  trash: [
    { t: 'p', d: 'M4.5 6.6h15' },
    { t: 'p', d: 'M17.9 6.6l-.9 12.4a2 2 0 0 1-2 1.6H9a2 2 0 0 1-2-1.6L6.1 6.6Z', fill: true },
    { t: 'p', d: 'M9.3 6.6V4.9a1.3 1.3 0 0 1 1.3-1.3h2.8a1.3 1.3 0 0 1 1.3 1.3v1.7' },
    { t: 'p', d: 'M10.3 10.4v6.6', accent: true },
    { t: 'p', d: 'M13.7 10.4v6.6', accent: true },
  ],
  bathroom: [
    { t: 'p', d: 'M12 2.5v6' },
    { t: 'p', d: 'M4.9 8.5h14.2a.8.8 0 0 1 .77 1l-.66 2.4a1 1 0 0 1-.96.73H5.75a1 1 0 0 1-.96-.73L4.13 9.5a.8.8 0 0 1 .77-1Z', fill: true },
    { t: 'p', d: 'M8 15.6v1.4', accent: true },
    { t: 'p', d: 'M12 15.2v2.3', accent: true },
    { t: 'p', d: 'M16 15.6v1.4', accent: true },
    { t: 'p', d: 'M9.8 19.5v1.3', accent: true },
    { t: 'p', d: 'M14.2 19.5v1.3', accent: true },
  ],
  laundry: [
    { t: 'p', d: 'M4.6 2.9h14.8a1.8 1.8 0 0 1 1.8 1.8v14.6a1.8 1.8 0 0 1-1.8 1.8H4.6a1.8 1.8 0 0 1-1.8-1.8V4.7a1.8 1.8 0 0 1 1.8-1.8Z', fill: true },
    { t: 'p', d: 'M2.8 7.8h18.4' },
    { t: 'p', d: 'M12 10.2a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9Z', accent: true, fill: true },
    { t: 'c', cx: 6.2, cy: 5.3, r: 0.62, accent: true, fill: true },
    { t: 'c', cx: 8.8, cy: 5.3, r: 0.62, accent: true, fill: true },
  ],
  bedroom: [
    { t: 'p', d: 'M2.6 20V8.4' },
    { t: 'p', d: 'M2.6 11.6h15.2a3.6 3.6 0 0 1 3.6 3.6V20' },
    { t: 'p', d: 'M2.6 16.6h18.8' },
    { t: 'p', d: 'M6.8 11.6V9.9a1.2 1.2 0 0 1 1.2-1.2h3.4a1.2 1.2 0 0 1 1.2 1.2v1.7', accent: true },
  ],
  livingRoom: [
    { t: 'p', d: 'M19.6 9.4V6.2a2 2 0 0 0-2-2H6.4a2 2 0 0 0-2 2v3.2' },
    { t: 'p', d: 'M2.6 11.4v5a2 2 0 0 0 2 2h14.8a2 2 0 0 0 2-2v-5a2 2 0 0 0-3.8 0v2H6.4v-2a2 2 0 0 0-3.8 0Z', fill: true },
    { t: 'p', d: 'M12 4.2v9', accent: true },
    { t: 'p', d: 'M5.6 18.4v2', accent: true },
    { t: 'p', d: 'M18.4 18.4v2', accent: true },
  ],
  floors: [
    { t: 'p', d: 'M15.2 3.2 12.35 12' },
    { t: 'p', d: 'M7.6 12h8.8l-1.1 4.3H8.7L7.6 12Z', fill: true },
    { t: 'p', d: 'M9.4 16.5v3.3', accent: true },
    { t: 'p', d: 'M12 16.5v4.3', accent: true },
    { t: 'p', d: 'M14.6 16.5v3.3', accent: true },
  ],
  pets: [
    { t: 'p', d: 'M12 13.2c2.7 0 5 2 5 4.4 0 1.7-1.3 2.8-2.9 2.8-1 0-1.4-.4-2.1-.4s-1.1.4-2.1.4C8.3 20.4 7 19.3 7 17.6c0-2.4 2.3-4.4 5-4.4Z', fill: true },
    { t: 'c', cx: 6.4, cy: 11.2, r: 1.85, accent: true, fill: true },
    { t: 'c', cx: 9.9, cy: 7.9, r: 1.75, accent: true, fill: true },
    { t: 'c', cx: 14.1, cy: 7.9, r: 1.75, accent: true, fill: true },
    { t: 'c', cx: 17.6, cy: 11.2, r: 1.85, accent: true, fill: true },
  ],
  car: [
    { t: 'p', d: 'M19 16.6h2a1 1 0 0 0 1-1v-3c0-.9-.7-1.7-1.5-1.9-2-.5-4.5-1-4.5-1s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5.6c-.6 0-1.1.4-1.4.9l-1.4 2.9a3.7 3.7 0 0 0-.3 1.5v3.6a1 1 0 0 0 1 1h2', fill: true },
    { t: 'p', d: 'M9.4 16.6h5.2' },
    { t: 'c', cx: 7.2, cy: 16.8, r: 2.05, accent: true },
    { t: 'c', cx: 16.8, cy: 16.8, r: 2.05, accent: true },
  ],
  yard: [
    { t: 'p', d: 'M12 3.4c2.3 0 4.2 1.6 4.6 3.7 1.9.4 3.3 2.1 3.3 4.1 0 2.3-1.9 4.2-4.2 4.2H8.3C6 15.4 4.1 13.5 4.1 11.2c0-2 1.4-3.7 3.3-4.1C7.8 5 9.7 3.4 12 3.4Z', fill: true },
    { t: 'p', d: 'M10.8 15.4h2.4v5.4h-2.4Z', fill: true },
    { t: 'p', d: 'M8.2 20.9h7.6', accent: true },
  ],
  hygiene: [
    { t: 'p', d: 'M9.4 5.4h5.2v3.4H9.4Z', fill: true },
    { t: 'p', d: 'M10.7 8.8h2.6v10.4a1.3 1.3 0 0 1-2.6 0V8.8Z', fill: true },
    { t: 'p', d: 'M10.6 5.2V3', accent: true },
    { t: 'p', d: 'M12 5V2.6', accent: true },
    { t: 'p', d: 'M13.4 5.2V3', accent: true },
    { t: 'p', d: 'M18.4 9.2l.62 1.66 1.66.62-1.66.62-.62 1.66-.62-1.66-1.66-.62 1.66-.62.62-1.66Z', accent: true, fill: true },
  ],
  dailyRoutine: [
    { t: 'c', cx: 12, cy: 12, r: 4.2, fill: true },
    { t: 'p', d: 'M12 2.4v2.2', accent: true },
    { t: 'p', d: 'M12 19.4v2.2', accent: true },
    { t: 'p', d: 'M4.6 4.6 6.2 6.2', accent: true },
    { t: 'p', d: 'M17.8 17.8l1.6 1.6', accent: true },
    { t: 'p', d: 'M2.4 12h2.2', accent: true },
    { t: 'p', d: 'M19.4 12h2.2', accent: true },
    { t: 'p', d: 'M4.6 19.4 6.2 17.8', accent: true },
    { t: 'p', d: 'M17.8 6.2l1.6-1.6', accent: true },
  ],
  groceries: [
    { t: 'p', d: 'M5.4 7.6h13.2l1.05 11.3a2 2 0 0 1-2 2.2H6.35a2 2 0 0 1-2-2.2L5.4 7.6Z', fill: true },
    { t: 'p', d: 'M8.8 10V6.6a3.2 3.2 0 0 1 6.4 0V10', accent: true },
  ],
  maintenance: [
    { t: 'p', d: 'M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94Z', fill: true },
  ],
  homework: [
    { t: 'p', d: 'M12 6.6C10.4 5.2 8.4 4.6 5.4 4.6a1 1 0 0 0-1 1v11.6a1 1 0 0 0 1 1c3 0 5 .6 6.6 2 1.6-1.4 3.6-2 6.6-2a1 1 0 0 0 1-1V5.6a1 1 0 0 0-1-1c-3 0-5 .6-6.6 2Z', fill: true },
    { t: 'p', d: 'M12 6.6v13.6', accent: true },
  ],
  firstStep: [
    { t: 'p', d: 'M6.4 2.6v18.8' },
    { t: 'p', d: 'M6.4 4h11.9l-2.3 3.9 2.3 3.9H6.4Z', accent: true, fill: true },
  ],
  weekWarrior: [
    { t: 'p', d: 'M12 2.4c4.2 3.8 6.2 6.5 6.2 9.7a6.2 6.2 0 1 1-12.4 0c0-1.5.5-2.9 1.5-4.4.3 1.4 1.1 2.3 2.1 2.7C9.2 8 10.1 4.9 12 2.4Z', fill: true },
    { t: 'p', d: 'M12 12.6c1.4 1.7 2.6 2.9 2.6 4.5a2.6 2.6 0 0 1-5.2 0c0-1.6 1.2-2.8 2.6-4.5Z', accent: true, fill: true },
  ],
  homeworkAce: [
    { t: 'p', d: 'M4.6 4.6a2 2 0 0 1 2-2h11.8a1 1 0 0 1 1 1v13.8H6.6a2 2 0 0 0-2 2V4.6Z', fill: true },
    { t: 'p', d: 'M4.6 19.4a2 2 0 0 0 2 2h12.8' },
    { t: 'p', d: 'M8.6 6.6h6.4', accent: true },
    { t: 'p', d: 'M8.6 9.8h4.2', accent: true },
  ],
  teamPlayer: [
    { t: 'c', cx: 9, cy: 7.8, r: 3.35, fill: true },
    { t: 'p', d: 'M2.6 20.4a6.4 6.4 0 0 1 12.8 0' },
    { t: 'p', d: 'M16.2 4.8a3.4 3.4 0 0 1 0 6.2', accent: true },
    { t: 'p', d: 'M17.4 14.4a6.4 6.4 0 0 1 4 5.9', accent: true },
  ],
  cleanSweep: [
    { t: 'p', d: 'M5.2 4.4h13.6a1.6 1.6 0 0 1 1.6 1.6v14a1.6 1.6 0 0 1-1.6 1.6H5.2a1.6 1.6 0 0 1-1.6-1.6V6a1.6 1.6 0 0 1 1.6-1.6Z', fill: true },
    { t: 'p', d: 'M9 4.4V3.6a1.4 1.4 0 0 1 1.4-1.4h3.2a1.4 1.4 0 0 1 1.4 1.4v.8' },
    { t: 'p', d: 'M7.8 13.2l2.9 2.9 5.5-5.9', accent: true },
  ],
  earlyBird: [
    { t: 'p', d: 'M2.6 19.8h18.8' },
    { t: 'p', d: 'M6.4 15.7a5.6 5.6 0 0 1 11.2 0Z', fill: true },
    { t: 'p', d: 'M12 3.2v2.3', accent: true },
    { t: 'p', d: 'M5.2 6.4 6.9 8.1', accent: true },
    { t: 'p', d: 'M18.8 6.4 17.1 8.1', accent: true },
    { t: 'p', d: 'M2.8 15.7h1.7', accent: true },
    { t: 'p', d: 'M19.5 15.7h1.7', accent: true },
  ],
  monthMaster: [
    { t: 'p', d: 'M5.4 5.4h13.2a1.6 1.6 0 0 1 1.6 1.6v12.4a1.6 1.6 0 0 1-1.6 1.6H5.4a1.6 1.6 0 0 1-1.6-1.6V7a1.6 1.6 0 0 1 1.6-1.6Z', fill: true },
    { t: 'p', d: 'M3.8 9.8h16.4' },
    { t: 'p', d: 'M8 3v4' },
    { t: 'p', d: 'M16 3v4' },
    { t: 'p', d: 'M12.9 11.8 9.9 16.4h2.3l-.8 3.4 3.2-4.8h-2.4l.7-3.2Z', accent: true, fill: true },
  ],
  poppinsFavorite: [
    { t: 'p', d: 'M2.9 12.4a9.1 9.1 0 0 1 18.2 0Z', fill: true },
    { t: 'p', d: 'M12 12.4v6.3a2.6 2.6 0 0 1-5.2 0' },
    { t: 'p', d: 'M12 3.3V1.7', accent: true },
    { t: 'p', d: 'M12 3.4c-1.8 1.9-2.9 5-2.9 9', accent: true },
    { t: 'p', d: 'M12 3.4c1.8 1.9 2.9 5 2.9 9', accent: true },
  ],
  tierMedal: [
    { t: 'c', cx: 12, cy: 14.8, r: 5.4, fill: true },
    { t: 'p', d: 'M8.4 3.2 10.9 9.2', accent: true },
    { t: 'p', d: 'M15.6 3.2 13.1 9.2', accent: true },
    { t: 'p', d: 'M12 12.2l.95 1.95 2.15.3-1.55 1.5.37 2.15L12 16.9l-1.92 1.2.37-2.15-1.55-1.5 2.15-.3.95-1.95Z', accent: true, fill: true },
  ],
  tierStar: [
    { t: 'p', d: 'M12 3.2l2.65 5.7 6.15.8-4.5 4.3 1.15 6.1L12 17.2l-5.45 2.9 1.15-6.1-4.5-4.3 6.15-.8L12 3.2Z', fill: true },
  ],
  tierCup: [
    { t: 'p', d: 'M7.6 3.4h8.8v5.2a4.4 4.4 0 0 1-8.8 0V3.4Z', fill: true },
    { t: 'p', d: 'M12 13v4.2' },
    { t: 'p', d: 'M8.2 20.6h7.6' },
    { t: 'p', d: 'M9.8 17.2h4.4v3.4H9.8Z', accent: true, fill: true },
    { t: 'p', d: 'M7.6 5.4H5.2v1a3.6 3.6 0 0 0 2.9 3.5', accent: true },
    { t: 'p', d: 'M16.4 5.4h2.4v1a3.6 3.6 0 0 1-2.9 3.5', accent: true },
  ],
  tierShield: [
    { t: 'p', d: 'M12 2.6l7.4 2.9v5.4c0 4.7-3.1 8.9-7.4 10.5-4.3-1.6-7.4-5.8-7.4-10.5V5.5L12 2.6Z', fill: true },
    { t: 'p', d: 'M8.6 11.7l2.4 2.4 4.4-4.6', accent: true },
  ],
  tierLaurel: [
    { t: 'p', d: 'M12 21c-3.7-1.8-6-5.4-6-9.6 0-2.9 1.1-5.6 3-7.6' },
    { t: 'p', d: 'M12 21c3.7-1.8 6-5.4 6-9.6 0-2.9-1.1-5.6-3-7.6' },
    { t: 'p', d: 'M7.6 8.2c-1.9-1.1-3.7-.8-5.1.6 1.5 1.5 3.3 1.6 5.1-.6Z', accent: true, fill: true },
    { t: 'p', d: 'M6.8 13.6c-2-.6-3.7 0-4.9 1.6 1.7 1.1 3.5.8 4.9-1.6Z', accent: true, fill: true },
    { t: 'p', d: 'M16.4 8.2c1.9-1.1 3.7-.8 5.1.6-1.5 1.5-3.3 1.6-5.1-.6Z', accent: true, fill: true },
    { t: 'p', d: 'M17.2 13.6c2-.6 3.7 0 4.9 1.6-1.7 1.1-3.5.8-4.9-1.6Z', accent: true, fill: true },
  ],
  tierCrown: [
    { t: 'p', d: 'M3.4 7.4 7.4 12l4.6-6.6L16.6 12l4-4.6v9.8a1.6 1.6 0 0 1-1.6 1.6H5a1.6 1.6 0 0 1-1.6-1.6V7.4Z', fill: true },
    { t: 'c', cx: 12, cy: 14.4, r: 1.05, accent: true, fill: true },
    { t: 'c', cx: 7.4, cy: 15.2, r: 0.82, accent: true, fill: true },
    { t: 'c', cx: 16.6, cy: 15.2, r: 0.82, accent: true, fill: true },
  ],
};

export const DOMAIN_ICONS = [
  'kitchen','trash','bathroom','laundry','bedroom','livingRoom','floors','pets',
  'car','yard','hygiene','dailyRoutine','groceries','maintenance','homework',
] as const;

export const ACHIEVEMENT_ICONS = [
  'firstStep','weekWarrior','homeworkAce','teamPlayer',
  'cleanSweep','earlyBird','monthMaster','poppinsFavorite',
] as const;

/** 12 XP trophy tiers mapped onto 6 marks, ascending. Tier 11-12 = crown. */
/** Reordered so Eternal Laurel (tier index 10) lands on tierLaurel; Most Glorious on tierCrown. */
export const TIER_ICONS: IconName[] = [
  'tierMedal','tierMedal','tierStar','tierStar','tierCup','tierCup',
  'tierShield','tierShield','tierCup','tierCrown','tierLaurel','tierCrown',
];
