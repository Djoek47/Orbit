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
  /** Store write kind when HOLD/confirm settles. */
  write?: IuiWriteKind;
};

export type IuiWriteKind =
  | 'create_task'
  | 'create_event'
  | 'create_itinerary_stop'
  | 'add_grocery'
  | 'complete_task'
  | 'advance_itinerary'
  | 'none';

export type IuiBeat = {
  id: string;
  scene: IuiScene;
  phase: IuiPhase;
  commit: IuiCommitKind;
  payload: IuiPayload;
};

export const HOLD_MS_DEFAULT = 1500;
export const HOLD_MS_KID = 2200;
/** SHOW beat before HOLD so GhostField / Lattice can land. */
export const SHOW_MS = 480;

export function defaultCommitForScene(scene: IuiScene): IuiCommitKind {
  if (
    scene === 'task_compose' ||
    scene === 'calendar_zoom' ||
    scene === 'itinerary_stage' ||
    scene === 'grocery_add'
  ) {
    return 'hold';
  }
  if (scene === 'reward_mint' || scene === 'confirm') return 'confirm';
  return 'none';
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
