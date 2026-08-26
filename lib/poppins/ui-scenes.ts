/**
 * IUI — closed scene graph. Luna / Realtime pick letters; they do not invent widgets.
 */

export const IUI_SCENES = [
  'thinking',
  'task_compose',
  'calendar_zoom',
  'itinerary_stage',
  'grocery_add',
  'reward_mint',
  'list_peek',
  'member_pick',
  'confirm',
  'navigate_coach',
  'task_done',
  'result_mark',
] as const;

export type IuiScene = (typeof IUI_SCENES)[number];

export const IUI_PHASES = [
  'show',
  'narrow',
  'unfold',
  'hold',
  'settle',
  'chain',
] as const;

export type IuiPhase = (typeof IUI_PHASES)[number];

export type IuiCommitKind = 'hold' | 'confirm' | 'none';

export type IuiFace = {
  id: string;
  name: string;
  emoji?: string;
  imageUri?: string;
};

export type IuiChip = {
  id: string;
  label: string;
  emoji?: string;
  /** Catalog outline vs Realtime-created (accent fill). */
  kind?: 'library' | 'created';
};

export type IuiPeekRow = {
  id: string;
  title: string;
  detail?: string;
};

export type IuiStop = {
  id: string;
  label: string;
  emoji?: string;
  category?: string;
};

export type IuiPayload = {
  thinkingLine?: string;
  title?: string;
  subtitle?: string;
  assignee?: string;
  faces?: IuiFace[];
  chips?: IuiChip[];
  selectedChipId?: string;
  due?: string;
  date?: string;
  time?: string;
  location?: string;
  category?: string;
  aisle?: string;
  monthLabel?: string;
  dayNumber?: number;
  stops?: IuiStop[];
  peek?: IuiPeekRow[];
  route?: string;
  coachLine?: string;
  confirmSummary?: string;
  confirmationIds?: string[];
  rewardName?: string;
  groceryName?: string;
  itineraryId?: string;
  itineraryTitle?: string;
  taskId?: string;
  /** Catalog task id when composing from the chore catalog. */
  libraryTaskId?: string;
  /** Repeat for custom / spoken chores (`Daily`). */
  repeat?: string;
  /** Last member name heard in the assistant transcript (Face pulse). */
  spokenName?: string;
  /** Store write kind when HOLD/confirm settles. */
  write?: IuiWriteKind;
  /** False until who/category/task/when are chosen — HOLD must not start. */
  composeReady?: boolean;
  /** Current one-beat compose step. */
  composeStep?: 'who' | 'category' | 'task' | 'when' | 'ready';
  /** Optional: show emoji next to library chips. */
  showEmoji?: boolean;
  /** Narrow kitchen tasks to dish-related, etc. */
  taskQuery?: string;
  /** Green check kind after HOLD settle. */
  markKind?: 'added' | 'done' | 'assigned';
  /** Clothing vs grocery lane on the shared list. */
  shoppingLane?: 'grocery' | 'clothing';
  /** Future drop date (YYYY-MM-DD) for shopping items. */
  releaseDate?: string;
};

export type IuiWriteKind =
  | 'create_task'
  | 'create_event'
  | 'create_itinerary_stop'
  | 'add_grocery'
  | 'complete_task'
  | 'update_task'
  | 'claim_reward'
  | 'advance_itinerary'
  | 'none';

/** Scenes allowed to HOLD-commit a store write. */
export const HOLD_SCENES: readonly IuiScene[] = [
  'task_compose',
  'calendar_zoom',
  'itinerary_stage',
  'grocery_add',
  'task_done',
];

export type IuiBeat = {
  id: string;
  scene: IuiScene;
  phase: IuiPhase;
  commit: IuiCommitKind;
  payload: IuiPayload;
};

/** Silence-as-assent. Short on purpose — genie, not a loading bar. */
export const HOLD_MS_DEFAULT = 850;
export const HOLD_MS_KID = 1300;
/** Lattice / road flash before UNFOLD. Skip entirely when the utterance already named the beat. */
export const SHOW_MS = 160;
/** UNFOLD (card / road / day). Calendar zoom still uses this as a visual, not a wait. */
export const UNFOLD_MS = 220;
/** Quiet gap after speech before HOLD. Words already painted; this is only the commit clock. */
export const SPEECH_QUIET_MS = 70;
/** commit:none linger — result check, then chain or rest. */
export const RESULT_LINGER_MS = 420;
export const NONE_LINGER_MS = 260;
/** Clear the stage after the last settle. */
export const SETTLE_CLEAR_MS = 200;

export function defaultCommitForScene(scene: IuiScene): IuiCommitKind {
  if ((HOLD_SCENES as readonly string[]).includes(scene)) return 'hold';
  if (scene === 'reward_mint' || scene === 'confirm') return 'confirm';
  if (scene === 'task_done') return 'hold';
  return 'none';
}

export function coerceCommit(
  scene: IuiScene,
  commit: IuiCommitKind | undefined,
  route?: string
): IuiCommitKind {
  const next = commit ?? defaultCommitForScene(scene);
  if (scene === 'navigate_coach' || (route && isCoachRoute(route))) return 'none';
  if (next === 'hold' && !(HOLD_SCENES as readonly string[]).includes(scene)) {
    return defaultCommitForScene(scene);
  }
  return next;
}

export function sceneNeedsUnfold(scene: IuiScene): boolean {
  return (
    scene === 'task_compose' ||
    scene === 'calendar_zoom' ||
    scene === 'itinerary_stage' ||
    scene === 'grocery_add'
  );
}

export const COACH_ROUTES = [
  '/settings',
  '/house-rules',
  '/recess',
  '/household-members',
  '/premium',
  '/delete-account',
  '/notifications',
  '/household-balance',
  '/momentum',
  '/weekly-report',
] as const;

export function isCoachRoute(route: string): boolean {
  return (COACH_ROUTES as readonly string[]).includes(route) || route.startsWith('/settings');
}

export function isIuiScene(value: string): value is IuiScene {
  return (IUI_SCENES as readonly string[]).includes(value);
}
