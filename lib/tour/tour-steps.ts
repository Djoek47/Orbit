/**
 * Pure tour step data per role — Work Order 9 D5–D8.
 * Copy rules: no emoji, no "!", title ≤5 words, admin body ≤20 words,
 * sidekick body sentence ≤14 words. Use VOCAB for kid terms.
 */

import { VOCAB } from '@/constants/vocabulary';
import type { TourChapter, TourDefinition, TourId, TourStep } from '@/lib/tour/tour-types';

function step(
  partial: Omit<TourStep, 'advance'> & { advance?: TourStep['advance'] }
): TourStep {
  return {
    advance: { kind: 'next' },
    ...partial,
  };
}

const ADMIN_HOME: TourChapter = {
  id: 'home',
  name: 'Home',
  steps: [
    step({
      id: 'home.today',
      targetId: 'home.todayTasks',
      title: 'Today at a glance',
      body: 'Everything due today, for everyone. Tap a task to open it.',
      route: '/(tabs)',
    }),
    step({
      id: 'home.grocery',
      targetId: 'home.groceryCard',
      title: 'Your grocery list',
      body: 'One shared list for the house. Tap to open it.',
      route: '/(tabs)',
    }),
    step({
      id: 'home.settings',
      targetId: 'header.settings',
      title: 'Settings',
      body: 'Members, devices, Poppins and your plan all live here.',
      route: '/(tabs)',
    }),
  ],
};

const ADMIN_TASKS: TourChapter = {
  id: 'tasks',
  name: 'Tasks',
  steps: [
    step({
      id: 'tasks.tab',
      targetId: 'tabbar.tasks',
      title: 'Tasks',
      body: 'Every chore in the house lives here.',
      route: '/(tabs)/tasks',
    }),
    step({
      id: 'tasks.assign',
      targetId: 'tasks.assignButton',
      title: 'Assign a chore',
      body: 'Pick a chore, pick who, pick when. Try one now.',
      route: '/(tabs)/tasks',
      advance: { kind: 'action' },
    }),
    step({
      id: 'tasks.form',
      targetId: 'assign.form',
      title: 'Your first task',
      body: 'Choose any chore and a Sidekick, then save.',
      // Stay on the tab route — /assign-task is a modal the overlay covers via FullWindowOverlay.
      route: '/(tabs)/tasks',
      centered: true,
      advance: { kind: 'event', event: 'task_created' },
    }),
    step({
      id: 'tasks.hold',
      targetId: 'tasks.firstRow',
      title: 'Press and hold',
      body: 'Hold a task to complete it, skip today, or delete it.',
      route: '/(tabs)/tasks',
    }),
  ],
};

const ADMIN_HOMEWORK: TourChapter = {
  id: 'homework',
  name: 'Homework',
  steps: [
    step({
      id: 'homework.segment',
      targetId: 'tasks.domainSegment',
      title: 'Homework has its own tab',
      body: "Switch here for schoolwork. It's tracked separately from chores.",
      route: '/(tabs)/tasks',
      when: 'homeworkEnabled',
      onEnter: 'tasks.homework',
    }),
    step({
      id: 'homework.assign',
      targetId: 'tasks.assignButton',
      title: 'Assign homework',
      body: 'Pick the child and subject. Photo proof is on by default, per child.',
      route: '/(tabs)/tasks',
      when: 'homeworkEnabled',
      onEnter: 'tasks.homework',
    }),
  ],
};

const ADMIN_PLAN: TourChapter = {
  id: 'plan',
  name: 'Plan',
  steps: [
    step({
      id: 'plan.tab',
      targetId: 'tabbar.plan',
      title: 'Plan',
      body: 'The family calendar and your trips, together.',
      route: '/(tabs)/plan',
    }),
    step({
      id: 'plan.add',
      targetId: 'plan.addButton',
      title: 'Add to the calendar',
      body: 'Appointments, practices, trips. Add one now if you like.',
      route: '/(tabs)/plan',
      advance: { kind: 'next_or_event', event: 'event_created' },
    }),
    step({
      id: 'plan.itineraries',
      targetId: 'plan.viewSegment',
      title: 'Itineraries',
      body: 'Plan a run of stops — school, pharmacy, store — in order.',
      route: '/(tabs)/plan',
    }),
  ],
};

const ADMIN_GROCERIES: TourChapter = {
  id: 'groceries',
  name: 'Groceries',
  steps: [
    step({
      id: 'groceries.search',
      targetId: 'groceries.search',
      title: 'Add groceries',
      body: 'Type anything. It lands in the right aisle by itself.',
      route: '/(tabs)/groceries',
      advance: { kind: 'event', event: 'grocery_added' },
    }),
    step({
      id: 'groceries.aisles',
      targetId: 'groceries.aisles',
      title: 'Browse by aisle',
      body: 'Or tap an aisle to pick from thousands of items.',
      route: '/(tabs)/groceries',
    }),
    step({
      id: 'groceries.store',
      targetId: 'groceries.storeRun',
      title: 'At the store',
      body: 'Open this in the store. The list sorts by aisle and checks off as you go.',
      route: '/(tabs)/groceries',
    }),
  ],
};

const ADMIN_REWARDS: TourChapter = {
  id: 'rewards',
  name: 'Rewards',
  steps: [
    step({
      id: 'rewards.tab',
      targetId: 'tabbar.rewards',
      title: 'Rewards',
      body: 'What the kids earn — and the family leaderboard.',
      route: '/(tabs)/rewards',
    }),
    step({
      id: 'rewards.segment',
      targetId: 'rewards.segment',
      title: 'Three views',
      body: 'Rewards, allowance and rankings each have their own page.',
      route: '/(tabs)/rewards',
      when: 'rewardSegmentsGte2',
    }),
    step({
      id: 'rewards.create',
      targetId: 'rewards.createReward',
      title: 'Make a reward',
      body: "Screen time, choose dinner, a trip — you decide what it's worth.",
      route: '/(tabs)/rewards',
      when: 'showRewards',
    }),
    step({
      id: 'rewards.allowance',
      targetId: 'rewards.createAllowance',
      title: 'Allowance',
      body: "Set an amount and how often. Choremaxx tracks it; it doesn't move money.",
      route: '/(tabs)/rewards',
      when: 'showAllowance',
    }),
  ],
};

const ADMIN_POPPINS: TourChapter = {
  id: 'poppins',
  name: 'Poppins',
  steps: [
    step({
      id: 'poppins.tab',
      targetId: 'tabbar.poppins',
      title: 'Poppins',
      body: 'Your co-manager. Say what the house needs and it does it on screen.',
      route: '/(tabs)/poppins',
    }),
    step({
      id: 'poppins.try',
      targetId: 'poppins.speak',
      title: 'Try it',
      body: 'Tap and say "add milk to the list". Or tap the keyboard and type it.',
      route: '/(tabs)/poppins',
      advance: { kind: 'event', event: 'poppins_act_committed' },
      onEnter: 'forceQuietSpeak',
    }),
    step({
      id: 'poppins.silence',
      targetId: 'poppins.stage',
      title: 'Silence means yes',
      body: "Poppins shows what it's about to do. Say nothing and it saves. Say \"no\" to stop.",
      route: '/(tabs)/poppins',
      centered: true,
    }),
    step({
      id: 'poppins.meter',
      targetId: 'poppins.meter',
      title: 'Your actions',
      body: 'Each save uses an action. Quiet Poppins uses 1; Speak back uses more. Change it in Settings.',
      route: '/(tabs)/poppins',
    }),
  ],
};

const ADMIN_PEOPLE: TourChapter = {
  id: 'people',
  name: 'People',
  steps: [
    step({
      id: 'people.members',
      targetId: 'tour.finish',
      title: 'Your people',
      body: 'Add Sidekicks and a second grown-up in Settings → Members.',
      route: '/(tabs)',
      centered: true,
    }),
    step({
      id: 'people.ipad',
      targetId: 'tour.finish',
      title: 'Family iPad',
      body: 'Kids can share one iPad and switch by tapping their face. Set it up from Settings → Members.',
      route: '/(tabs)',
      centered: true,
    }),
    step({
      id: 'people.rules',
      targetId: 'tour.finish',
      title: VOCAB.houseRules,
      body: 'How XP, streaks and deadlines work here. Kids see their own simple version.',
      route: '/(tabs)',
      centered: true,
    }),
    step({
      id: 'people.openSettings',
      targetId: 'tour.finish',
      title: 'Open Settings',
      body: 'Members, House Rules and shared devices live there. Tap below when you are ready.',
      route: '/(tabs)',
      centered: true,
      primaryLabel: 'Open Settings',
      primaryAction: 'open_settings',
    }),
  ],
};

const ADMIN_FINISH: TourChapter = {
  id: 'finish',
  name: 'Finish',
  steps: [
    step({
      id: 'finish.done',
      targetId: 'tour.finish',
      title: "You're set",
      body: 'Your checklist on Home keeps track of the rest. You can replay any part of this tour in Settings → Help.',
      route: '/(tabs)',
    }),
  ],
};

export const ADMIN_TOUR: TourDefinition = {
  tourId: 'admin',
  welcomeTitle: 'Welcome to {householdName}',
  welcomeBody: "A three-minute tour of the house. You'll assign your first task on the way.",
  welcomePrimary: 'Start the tour',
  welcomeSecondary: 'Skip for now',
  chapters: [
    ADMIN_HOME,
    ADMIN_TASKS,
    ADMIN_HOMEWORK,
    ADMIN_PLAN,
    ADMIN_GROCERIES,
    ADMIN_REWARDS,
    ADMIN_POPPINS,
    ADMIN_PEOPLE,
    ADMIN_FINISH,
  ],
};

export const JOINED_ADULT_TOUR: TourDefinition = {
  tourId: 'joined_adult',
  welcomeTitle: "You're in {householdName}",
  welcomeBody: '{ownerName} set this house up. Here is the quick version.',
  welcomePrimary: 'Start the tour',
  welcomeSecondary: 'Skip for now',
  chapters: [
    ADMIN_HOME,
    ADMIN_TASKS,
    ADMIN_HOMEWORK,
    ADMIN_PLAN,
    ADMIN_GROCERIES,
    ADMIN_REWARDS,
    ADMIN_POPPINS,
    {
      ...ADMIN_PEOPLE,
      steps: ADMIN_PEOPLE.steps.filter((s) => s.id !== 'people.ipad'),
    },
    ADMIN_FINISH,
  ],
};

export const SIDEKICK_TOUR: TourDefinition = {
  tourId: 'sidekick',
  welcomeTitle: 'Hi {name}',
  welcomeBody: `Here's how to earn XP and rewards. It takes a minute.`,
  welcomePrimary: 'Show me',
  welcomeSecondary: 'Later',
  chapters: [
    {
      id: 'sidekick_home',
      name: 'Your day',
      steps: [
        step({
          id: 'sk.today',
          targetId: 'home.todayTasks',
          title: 'Your jobs today',
          body: 'These are yours. Finish them to earn XP.',
          route: '/(tabs)',
        }),
        step({
          id: 'sk.complete',
          targetId: 'tasks.firstRow',
          title: 'Mark it done',
          body: `Tap Complete when you finish. ${VOCAB.lateCredit} still counts, just a little less XP.`,
          route: '/(tabs)/tasks',
        }),
        step({
          id: 'sk.proof',
          targetId: 'tasks.proof',
          title: 'Photo proof',
          body: 'Sometimes a grown-up asks for a photo. Snap it right here.',
          route: '/(tabs)/tasks',
          when: 'firstTaskNeedsProof',
        }),
        step({
          id: 'sk.streak',
          targetId: 'home.streak',
          title: 'Your streak',
          body: `Finish every day to grow it. Miss one and you can use ${VOCAB.streakRescue}.`,
          route: '/(tabs)',
        }),
        step({
          id: 'sk.ranks',
          targetId: 'tabbar.rewards',
          title: 'Ranks',
          body: `See how you're doing this week. The winner gets ${VOCAB.weeksCrown}.`,
          route: '/(tabs)/rewards',
          when: 'showRanks',
        }),
        step({
          id: 'sk.hold',
          targetId: 'rewards.holdRequest',
          title: 'Ask for a reward',
          body: "Finish today's jobs, then press and hold to ask.",
          route: '/(tabs)/rewards',
          when: 'showRewards',
        }),
        step({
          id: 'sk.rules',
          targetId: 'home.houseRules',
          title: VOCAB.houseRules,
          body: 'Everything about points and streaks, explained for you.',
          route: '/(tabs)',
        }),
      ],
    },
  ],
};

export const FAMILY_IPAD_TOUR: TourDefinition = {
  tourId: 'family_ipad',
  welcomeTitle: 'Family iPad',
  welcomeBody: 'Tap your face to open your own tasks, XP and rewards.',
  welcomePrimary: 'Got it',
  welcomeSecondary: 'Skip',
  chapters: [
    {
      id: 'ipad_pick',
      name: 'Who is on',
      steps: [
        step({
          id: 'ipad.faces',
          targetId: 'selectProfile.faces',
          title: "Who's using the iPad?",
          body: 'Tap your face to start.',
          route: '/select-profile',
          advance: { kind: 'action' },
        }),
        step({
          id: 'ipad.switch',
          targetId: 'home.switchProfile',
          title: 'Switching',
          body: 'Done? Tap your face here to hand the iPad to someone else.',
          route: '/(tabs)',
        }),
      ],
    },
  ],
};

const TOURS: Record<TourId, TourDefinition> = {
  admin: ADMIN_TOUR,
  joined_adult: JOINED_ADULT_TOUR,
  sidekick: SIDEKICK_TOUR,
  family_ipad: FAMILY_IPAD_TOUR,
};

export function getTourDefinition(tourId: TourId): TourDefinition {
  return TOURS[tourId];
}

export function allTourTargetIds(): string[] {
  const ids = new Set<string>();
  for (const tour of Object.values(TOURS)) {
    for (const chapter of tour.chapters) {
      for (const s of chapter.steps) {
        ids.add(s.targetId);
      }
    }
  }
  return [...ids].sort();
}

export function formatWelcomeCopy(
  template: string,
  vars: { householdName?: string; name?: string; ownerName?: string }
): string {
  return template
    .replace('{householdName}', vars.householdName ?? 'your house')
    .replace('{name}', vars.name ?? 'there')
    .replace('{ownerName}', vars.ownerName ?? 'Someone');
}

export function chaptersForTour(tourId: TourId): TourChapter[] {
  return getTourDefinition(tourId).chapters;
}

/** Flat list of every step across every tour (for tests). */
export function allTourSteps(): { tourId: TourId; chapterId: string; step: TourStep }[] {
  const out: { tourId: TourId; chapterId: string; step: TourStep }[] = [];
  for (const [tourId, def] of Object.entries(TOURS) as [TourId, TourDefinition][]) {
    for (const chapter of def.chapters) {
      for (const s of chapter.steps) {
        out.push({ tourId, chapterId: chapter.id, step: s });
      }
    }
  }
  return out;
}
