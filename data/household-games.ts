export type HouseholdGameNeed = 'phone' | 'camera' | 'speakers' | 'cards' | 'cups' | 'none';

export type HouseholdGameCard = {
  id: string;
  title: string;
  vibe: 'roommates' | 'family' | 'mixed';
  blurb: string;
  needs: HouseholdGameNeed[];
  comingSoon: true;
  emoji: string;
};

/** Scaffold catalog — playable engines land later. */
export const HOUSEHOLD_GAMES: HouseholdGameCard[] = [
  {
    id: 'game-drinking-classic',
    title: 'Roommate drinking games',
    vibe: 'roommates',
    blurb: 'Light party prompts for housemates. Rules packs and timers arrive next.',
    needs: ['phone', 'cups'],
    comingSoon: true,
    emoji: '🍻',
  },
  {
    id: 'game-uno-night',
    title: 'Uno night',
    vibe: 'family',
    blurb: 'Family-friendly card night tracker — scorekeeping and house rules coming soon.',
    needs: ['cards'],
    comingSoon: true,
    emoji: '🃏',
  },
  {
    id: 'game-guessing-social',
    title: 'Guessing & social',
    vibe: 'mixed',
    blurb: 'Charades-style and “who said it” rounds. Needs a phone for prompts.',
    needs: ['phone'],
    comingSoon: true,
    emoji: '🤔',
  },
  {
    id: 'game-camera-party',
    title: 'Camera party prompts',
    vibe: 'roommates',
    blurb: 'Snap challenges and photo scavenger hunts using the phone camera.',
    needs: ['phone', 'camera'],
    comingSoon: true,
    emoji: '📸',
  },
  {
    id: 'game-la-vakarm',
    title: 'La Vakarm',
    vibe: 'mixed',
    blurb: 'Social guessing energy for the whole household. Full rules land later.',
    needs: ['phone', 'speakers'],
    comingSoon: true,
    emoji: '🎉',
  },
  {
    id: 'game-family-trivia',
    title: 'Family trivia',
    vibe: 'family',
    blurb: 'Kid-safe trivia packs with household XP hooks — scaffold only for now.',
    needs: ['phone'],
    comingSoon: true,
    emoji: '🧠',
  },
];

export const GAME_VIBE_LABEL: Record<HouseholdGameCard['vibe'], string> = {
  roommates: 'Roommates',
  family: 'Family',
  mixed: 'Everyone',
};
