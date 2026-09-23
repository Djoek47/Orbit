/** First-run tour types — Work Order 9 Part D. */

export type TourId = 'admin' | 'sidekick' | 'family_ipad' | 'joined_adult';

export type TourStatus = 'not_started' | 'offered' | 'in_progress' | 'completed' | 'skipped';

export type TourAdvance =
  | { kind: 'next' }
  | { kind: 'action' }
  | { kind: 'event'; event: TourEventName }
  | { kind: 'next_or_event'; event: TourEventName };

export type TourEventName =
  | 'task_created'
  | 'homework_created'
  | 'grocery_added'
  | 'event_created'
  | 'itinerary_created'
  | 'reward_created'
  | 'allowance_created'
  | 'poppins_act_committed'
  | 'poppins_spoke'
  | 'member_created'
  | 'shared_device_set_up'
  | 'task_completed'
  | 'reward_requested';

/** Stable target ids used by <TourTarget id="…">. */
export type TourTargetId =
  | 'home.todayTasks'
  | 'home.groceryCard'
  | 'home.houseRules'
  | 'home.streak'
  | 'home.switchProfile'
  | 'header.settings'
  | 'settings.houseRules'
  | 'tabbar.tasks'
  | 'tabbar.plan'
  | 'tabbar.rewards'
  | 'tabbar.poppins'
  | 'tasks.assignButton'
  | 'tasks.domainSegment'
  | 'tasks.firstRow'
  | 'tasks.proof'
  | 'assign.form'
  | 'plan.addButton'
  | 'plan.viewSegment'
  | 'plan.smartTrips'
  | 'plan.myPlaces'
  | 'plan.addPlace'
  | 'plan.newTrip'
  | 'groceries.search'
  | 'groceries.aisles'
  | 'groceries.storeRun'
  | 'rewards.segment'
  | 'rewards.vault'
  | 'rewards.createReward'
  | 'rewards.createAllowance'
  | 'rewards.holdRequest'
  | 'poppins.speak'
  | 'poppins.stage'
  | 'poppins.meter'
  | 'poppins.mode'
  | 'settings.members'
  | 'members.addMember'
  | 'members.sharedIpad'
  | 'selectProfile.faces'
  | 'tour.finish'
  | 'tour.welcome';

export type TourStep = {
  id: string;
  targetId: TourTargetId;
  title: string;
  body: string;
  /** Expo Router path for this step (navigated when the step starts). */
  route: string;
  advance: TourAdvance;
  /** Scroll the screen so the target is visible before measuring. */
  ensureVisible?: boolean;
  /** Condition key evaluated by tour-conditions. */
  when?: string;
  /** Centred card with no spotlight target (step can show while the stage is live). */
  centered?: boolean;
  /** Side effect when the step becomes active (e.g. switch domain tab). */
  onEnter?:
    | 'tasks.homework'
    | 'forceQuietSpeak'
    | 'plan.itineraries'
    | 'plan.places'
    | 'rewards.vault';
  /** Override primary button label (default Next / Done). */
  primaryLabel?: string;
  /** Special primary action instead of advancing. */
  primaryAction?: 'open_settings';
};

export type TourChapter = {
  id: string;
  name: string;
  steps: TourStep[];
};

export type TourDefinition = {
  tourId: TourId;
  welcomeTitle: string;
  welcomeBody: string;
  welcomePrimary: string;
  welcomeSecondary: string;
  chapters: TourChapter[];
};

export type TourState = {
  tourId: TourId;
  status: TourStatus;
  chapterId?: string;
  stepIndex?: number;
  completedChapters: string[];
  skippedChapters: string[];
  updatedAt: string;
  /** Checklist dismissed by user. */
  checklistHidden?: boolean;
  /** Checklist has shown its completed celebration once. */
  checklistCompletedSeen?: boolean;
  /** Wall-clock when the tour started (for duration analytics). */
  startedAt?: string;
};

export type TourRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ChecklistItemId =
  | 'assign_chore'
  | 'assign_homework'
  | 'add_grocery'
  | 'calendar_event'
  | 'create_reward'
  | 'ask_poppins'
  | 'add_sidekick'
  | 'setup_device';

export function tourStorageKey(householdId: string, memberId: string, tourId: TourId): string {
  return `orbit.tour.v1.${householdId}.${memberId}.${tourId}`;
}

export function emptyTourState(tourId: TourId): TourState {
  return {
    tourId,
    status: 'not_started',
    completedChapters: [],
    skippedChapters: [],
    updatedAt: new Date().toISOString(),
  };
}
