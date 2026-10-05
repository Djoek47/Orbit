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
      ensureVisible: true,
    }),
    step({
      id: 'home.grocery',
      targetId: 'home.groceryCard',
      title: 'Your grocery list',
      body: 'One shared list for the house. Tap to open it.',
      route: '/(tabs)',
      ensureVisible: true,
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

// Every step is either a look (the whole screen is held still, Next moves on) or a do (the
// highlighted thing works; Next still moves on). Demonstrations play in the tour's own panel and
// never navigate. Each chapter pins the section it shows (onEnter) so it never inherits the last
// one — the Tasks chapter used to open on Homework.

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
      onEnter: 'tasks.chores',
    }),
    step({
      id: 'tasks.assign',
      targetId: 'tasks.assignButton',
      title: 'Assign a chore',
      body: 'A chore needs what, who, and when. This is the button.',
      route: '/(tabs)/tasks',
      onEnter: 'tasks.chores',
    }),
    step({
      id: 'tasks.assignDemo',
      targetId: 'tasks.assignButton',
      title: 'Watch one go out',
      body: 'What, who, when, then Assign — and where it lands.',
      route: '/(tabs)/tasks',
      onEnter: 'tasks.chores',
      centered: true,
      primaryLabel: 'Show me',
      primaryAction: 'open_mock_assign',
    }),
    step({
      id: 'tasks.hold',
      targetId: 'tasks.firstRow',
      title: 'Press and hold',
      body: 'Hold a task to complete it, skip today, or delete it.',
      route: '/(tabs)/tasks',
      onEnter: 'tasks.chores',
    }),
    // Nothing to hand out to yet: show how a Sidekick joins. Settings comes at the end.
    step({
      id: 'tasks.needSidekick',
      targetId: 'tabbar.tasks',
      title: 'Add a Sidekick',
      body: 'Chores and homework need someone to give them to. It takes a code.',
      route: '/(tabs)/tasks',
      when: 'noSidekick',
      centered: true,
      primaryLabel: 'Show me how',
      primaryAction: 'open_mock_sidekick',
    }),
    step({
      id: 'tasks.proofLoop',
      targetId: 'tasks.firstRow',
      title: 'Asking for a photo',
      body: 'See it once. They finish, you ask for a photo, and you can ask again.',
      route: '/(tabs)/tasks',
      when: 'hasSidekick',
      centered: true,
      primaryLabel: 'Show me',
      primaryAction: 'open_proof_walkthrough',
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
      id: 'homework.assignDemo',
      targetId: 'tasks.assignButton',
      title: 'Watch one go out',
      body: 'Subject, what to do, who and when. A photo is asked for on the way.',
      route: '/(tabs)/tasks',
      when: 'homeworkEnabled',
      onEnter: 'tasks.homework',
      centered: true,
      primaryLabel: 'Show me',
      primaryAction: 'open_mock_homework',
    }),
    step({
      id: 'homework.proofLoop',
      targetId: 'tasks.domainSegment',
      title: 'Homework proof',
      body: 'Same loop as chores. Half a page is not done, so ask again.',
      route: '/(tabs)/tasks',
      when: 'homeworkEnabled',
      onEnter: 'tasks.homework',
      centered: true,
      primaryLabel: 'Show me',
      primaryAction: 'open_homework_walkthrough',
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
      onEnter: 'plan.calendar',
    }),
    step({
      id: 'plan.add',
      targetId: 'plan.addButton',
      title: 'Add to the calendar',
      body: 'Appointments, practices and single events. Add one now if you like.',
      route: '/(tabs)/plan',
      onEnter: 'plan.calendar',
      advance: { kind: 'next_or_event', event: 'event_created' },
    }),
    step({
      id: 'plan.itineraries',
      targetId: 'plan.itinerariesTab',
      title: 'Trips',
      body: 'A trip chains stops in one run: school, then pharmacy, then the store.',
      route: '/(tabs)/plan',
      onEnter: 'plan.itineraries',
    }),
    step({
      id: 'plan.newTrip',
      targetId: 'plan.newTrip',
      title: 'Build a trip',
      body: 'Add stops in order, or ask Poppins to plan the route for you.',
      route: '/(tabs)/plan',
      onEnter: 'plan.itineraries',
      advance: { kind: 'next_or_event', event: 'itinerary_created' },
    }),
    step({
      id: 'plan.places',
      targetId: 'plan.placesSegment',
      title: 'My Places',
      body: 'Save home, school and stores once. Trips pick them instead of retyping addresses.',
      route: '/(tabs)/plan',
      onEnter: 'plan.places',
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
      advance: { kind: 'next_or_event', event: 'grocery_added' },
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
      body: 'XP, rewards, allowance and who is ahead this week.',
      route: '/(tabs)/rewards',
      onEnter: 'rewards.vault',
    }),
    step({
      id: 'rewards.segment',
      targetId: 'rewards.segment',
      title: 'Three surfaces',
      body: 'Rewards is the catalogue. Allowance tracks cash promises. Rankings show who is leading.',
      route: '/(tabs)/rewards',
      when: 'rewardSegmentsGte2',
      onEnter: 'rewards.vault',
    }),
    step({
      id: 'rewards.vault',
      targetId: 'rewards.vault',
      title: 'The catalogue',
      body: 'Kids earn XP for chores and spend it here. You set each cost.',
      route: '/(tabs)/rewards',
      when: 'showRewards',
      onEnter: 'rewards.vault',
    }),
    step({
      id: 'rewards.create',
      targetId: 'rewards.createReward',
      title: 'Create a reward',
      body: 'Pick a title, an XP cost, and how often it can be claimed.',
      route: '/(tabs)/rewards',
      when: 'showRewards',
      onEnter: 'rewards.vault',
    }),
    step({
      id: 'rewards.allowance',
      targetId: 'rewards.createAllowance',
      title: 'Set an allowance',
      body: 'Separate from XP. Choose who, how much and how often, then mark it paid.',
      route: '/(tabs)/rewards',
      when: 'showAllowance',
      onEnter: 'rewards.allowance',
    }),
    step({
      id: 'rewards.ranks',
      targetId: 'rewards.ranksTab',
      title: 'Rankings',
      body: 'Who earned the most XP, finished the most, or kept the longest streak.',
      route: '/(tabs)/rewards',
      when: 'showRanks',
      onEnter: 'rewards.ranks',
    }),
  ],
};

// Look, don't touch: Base and Max are held still (tapping one used to start the live stage and
// end the tour). The live "try it" step is gone — the recording shows it without spending a thing.
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
      id: 'poppins.mode',
      targetId: 'poppins.mode',
      title: 'Base or Max',
      body: 'Base listens and writes it down. Max talks back and uses more actions.',
      route: '/(tabs)/poppins',
    }),
    step({
      id: 'poppins.demo',
      targetId: 'poppins.stage',
      title: 'Watch it work',
      body: 'One voice asks, the other does it: a chore, a shop, a week, a trip.',
      route: '/(tabs)/poppins',
      centered: true,
      primaryLabel: 'Play it',
      primaryAction: 'open_poppins_demo',
    }),
    step({
      id: 'poppins.silence',
      targetId: 'poppins.stage',
      title: 'Silence means yes',
      body: 'Poppins shows what it is about to do. Say nothing and it saves. Say no to stop.',
      route: '/(tabs)/poppins',
      centered: true,
    }),
    step({
      id: 'poppins.meter',
      targetId: 'poppins.meter',
      title: 'Your actions',
      body: 'Each save uses an action. Base uses 1, Max uses more. Top up in Settings.',
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
      body: 'Add Sidekicks and a second grown-up in Settings. Kids can share one iPad too.',
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
      body: 'Replay any part of this tour from Settings, under Help.',
      route: '/(tabs)',
      centered: true,
      primaryLabel: 'Done',
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
      steps: ADMIN_PEOPLE.steps,
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
          ensureVisible: true,
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
          // The photo button lives on the task's own page, not on this list — a card that
          // pointed at it waited on something that is never here, then skipped itself.
          targetId: 'tasks.firstRow',
          title: 'Photo proof',
          body: 'Sometimes a grown-up asks for a photo. Open the task and snap it there.',
          route: '/(tabs)/tasks',
          centered: true,
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
  welcomeTitle: 'Shared devices',
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
          title: "Who's using this device?",
          body: 'Tap your face to start.',
          route: '/select-profile',
          advance: { kind: 'action' },
        }),
        step({
          id: 'ipad.switch',
          targetId: 'tabbar.switch',
          title: 'Switching',
          body: 'Done? Tap Switch in the tab bar to hand the device to someone else.',
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
