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
  /** Last member name heard in the assistant transcript (Face pulse). */
  spokenName?: string;
  /** Store write kind when HOLD/confirm settles. */
  write?: IuiWriteKind;
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
];

export type IuiBeat = {
  id: string;
  scene: IuiScene;
  phase: IuiPhase;
  commit: IuiCommitKind;
  payload: IuiPayload;
};

export const HOLD_MS_DEFAULT = 1500;
export const HOLD_MS_KID = 2200;
/** SHOW beat before UNFOLD so GhostField / Lattice can land. */
export const SHOW_MS = 480;
/** UNFOLD (card / road / day) before HOLD. Matches motion.settle. */
export const UNFOLD_MS = 600;
/** Quiet gap after speech before HOLD may start. */
export const SPEECH_QUIET_MS = 400;

export function defaultCommitForScene(scene: IuiScene): IuiCommitKind {
  if ((HOLD_SCENES as readonly string[]).includes(scene)) return 'hold';
  if (scene === 'reward_mint' || scene === 'confirm') return 'confirm';
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
  return scene === 'task_compose' || scene === 'calendar_zoom' || scene === 'itinerary_stage';
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
