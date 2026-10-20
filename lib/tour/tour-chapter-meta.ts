/**
 * Premium chapter picker presentation — icon + tone per chapter id.
 */
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import type { TourChapter } from '@/lib/tour/tour-types';

type IconName = keyof typeof MaterialIcons.glyphMap;

export type TourChapterPresentation = {
  id: string;
  name: string;
  subtitle: string;
  icon: IconName;
  tone: string;
};

const BY_ID: Record<string, { icon: IconName; tone: string; blurb?: string }> = {
  home: { icon: 'home', tone: '#FF8A3D', blurb: 'Today, groceries, and Settings' },
  tasks: { icon: 'checklist', tone: '#38BDF8', blurb: 'Assign, hold, and Sidekicks' },
  homework: { icon: 'menu-book', tone: '#A78BFA', blurb: 'Homework board and walkthrough' },
  plan: { icon: 'map', tone: '#34D399', blurb: 'Trips and the week ahead' },
  groceries: { icon: 'shopping-cart', tone: '#F472B6', blurb: 'Shared list and shopping' },
  rewards: { icon: 'emoji-events', tone: '#FBBF24', blurb: 'Ranks, XP, and rewards' },
  poppins: { icon: 'auto-awesome', tone: '#FB923C', blurb: 'Talk to your co-manager' },
  people: { icon: 'groups', tone: '#60A5FA', blurb: 'Members and shared devices' },
  finish: { icon: 'flag', tone: '#4ADE80', blurb: 'Wrap up and checklist' },
  sidekick_home: { icon: 'wb-sunny', tone: '#FF8A3D', blurb: 'Your jobs, streak, and ranks' },
  ipad_pick: { icon: 'tablet-mac', tone: '#A78BFA', blurb: 'Faces on a shared tablet' },
};

function fallbackIcon(index: number): { icon: IconName; tone: string } {
  const tones = ['#FF8A3D', '#38BDF8', '#A78BFA', '#34D399', '#F472B6', '#FBBF24'];
  return { icon: 'play-circle-outline', tone: tones[index % tones.length]! };
}

export function presentTourChapters(chapters: readonly TourChapter[]): TourChapterPresentation[] {
  return chapters.map((ch, index) => {
    const meta = BY_ID[ch.id] ?? fallbackIcon(index);
    const steps = ch.steps.length;
    const stepLabel = steps === 1 ? '1 step' : `${steps} steps`;
    return {
      id: ch.id,
      name: ch.name,
      subtitle: meta.blurb ? `${meta.blurb} · ${stepLabel}` : stepLabel,
      icon: meta.icon,
      tone: meta.tone,
    };
  });
}
