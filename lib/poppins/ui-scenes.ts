/**
 * IUI — closed scene graph. Luna / Realtime pick letters; they do not invent widgets.
 */

export const IUI_SCENES = [
  'thinking',
  'task_compose',
  'homework_compose',
  'calendar_zoom',
  'itinerary_stage',
  'grocery_add',
  'reward_mint',
  'place_save',
  'allowance_act',
  'ranks_peek',
  'memory_note',
  'list_peek',
  'member_pick',
  'confirm',
  'navigate_coach',
  'coach_steps',
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
  address?: string;
  placeQuery?: string;
  time?: string;
  kind?: string;
  /** Unresolved place — show add-address chip. */
  needsAddress?: boolean;
};

export type IuiGroupItem = {
  id: string;
  /** Grocery name or task title. */
  label: string;
  assignee?: string;
  due?: string;
  aisle?: string;
  libraryTaskId?: string;
  category?: string;
  /** Row dropped before commit. */
  dropped?: boolean;
  /** Per-row commit status for batch writes. */
  status?: 'pending' | 'saving' | 'done' | 'failed';
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
  /** WO12 §D — how-to id for coach_steps. */
  howToId?: string;
  /** Numbered teaching steps on the coach card. */
  coachSteps?: Array<{ id: string; text: string; route?: string; targetId?: string }>;
  /** Show "Just do it" when the how-to can run as a normal act. */
  canDoItForYou?: boolean;
  confirmSummary?: string;
  confirmationIds?: string[];
  rewardName?: string;
  groceryName?: string;
  /** place_save — display name for the saved place. */
  placeName?: string;
  /** place_save — SavedPlaceKind string. */
  placeKind?: string;
  /** place_save — street / query address. */
  placeAddress?: string;
  /** allowance_act — member to pay. */
  allowanceMemberId?: string;
  allowanceMemberName?: string;
  /** allowance_act — human label e.g. "$5" or "10 XP". */
  allowanceAmountLabel?: string;
  allowanceAmountXp?: number;
  allowanceNote?: string;
  /** allowance_act mode. */
  allowanceKind?: 'grant' | 'hold' | 'payout';
  /** memory_note — house fact text. */
  memoryText?: string;
  memorySubject?: string;
  memoryKind?: 'like' | 'dislike' | 'routine' | 'note';
  itineraryId?: string;
  itineraryTitle?: string;
  taskId?: string;
  /** Catalog task id when composing from the chore catalog. */
  libraryTaskId?: string;
  /** Repeat for custom / spoken chores (`Daily`). */
  repeat?: string;
  /** Last member name heard in the assistant transcript (Face pulse). */
  spokenName?: string;
  /**
   * Provenance for filled slots — speech/touch wins over model merge.
   * Keys are payload field names (`assignee`, `title`, `due`, …).
   */
  slotSource?: Partial<
    Record<
      'assignee' | 'title' | 'due' | 'date' | 'time' | 'category' | 'libraryTaskId' | 'groceryName',
      'speech' | 'touch' | 'model'
    >
  >;
  /** Store write kind when HOLD/confirm settles. */
  write?: IuiWriteKind;
  /** False until who/category/task/when are chosen — HOLD must not start. */
  composeReady?: boolean;
  /** Marginal fuzzy fill — do not arm HOLD until confirmed. */
  provisional?: boolean;
  /** Original user utterance — used by validateAct echo detection. */
  sourceUtterance?: string;
  /** Current one-beat compose step. */
  composeStep?: 'who' | 'category' | 'task' | 'subject' | 'when' | 'ready';
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
  /** homework_compose vs generic task_compose. */
  composeKind?: 'homework';
  /**
   * Transport that produced this beat — meter charges from the beat, not prefs race.
   * `silent` = Quiet / typed; `spoken` = Speak back Realtime.
   */
  actMode?: 'silent' | 'spoken';
  /** WO11 — grouped same-kind acts on one card (one HOLD). */
  items?: IuiGroupItem[];
  /** WO12 §F4 — talking part offline; act still succeeded. */
  modelOffline?: boolean;
  /** Progress label e.g. "2 of 3". */
  progressLabel?: string;
  /** WO12 §C — slots filled by speech, ordered by character offset. */
  slotOrder?: Array<'title' | 'assignee' | 'due' | 'category' | 'date' | 'time'>;
  /** First empty slot — the one in focus. */
  focusSlot?: 'title' | 'assignee' | 'due' | 'category' | 'date' | 'time' | null;
};

export type IuiWriteKind =
  | 'create_task'
  | 'create_homework'
  | 'create_event'
  | 'create_itinerary_stop'
  | 'add_grocery'
  | 'clear_grocery'
  | 'complete_task'
  | 'update_task'
  | 'claim_reward'
  | 'upsert_place'
  | 'grant_allowance'
  | 'advance_itinerary'
  | 'none';

/** Scenes allowed to HOLD-commit a store write. */
export const HOLD_SCENES: readonly IuiScene[] = [
  'task_compose',
  'homework_compose',
  'calendar_zoom',
  'itinerary_stage',
  'grocery_add',
  'place_save',
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
/** commit:none linger — result check, then chain or rest. Arrival, not a blink. */
export const RESULT_LINGER_MS = 980;
export const NONE_LINGER_MS = 320;
/** Clear the stage after the last settle — give the mark time to land. */
export const SETTLE_CLEAR_MS = 420;

export function defaultCommitForScene(scene: IuiScene): IuiCommitKind {
  if ((HOLD_SCENES as readonly string[]).includes(scene)) return 'hold';
  if (scene === 'reward_mint' || scene === 'confirm' || scene === 'allowance_act') return 'confirm';
  if (scene === 'task_done') return 'hold';
  if (scene === 'coach_steps' || scene === 'memory_note' || scene === 'ranks_peek') return 'none';
  return 'none';
}

export function coerceCommit(
  scene: IuiScene,
  commit: IuiCommitKind | undefined,
  route?: string
): IuiCommitKind {
  const next = commit ?? defaultCommitForScene(scene);
  if (scene === 'navigate_coach' || scene === 'coach_steps' || (route && isCoachRoute(route))) {
    return 'none';
  }
  if (next === 'hold' && !(HOLD_SCENES as readonly string[]).includes(scene)) {
    return defaultCommitForScene(scene);
  }
  return next;
}

export function sceneNeedsUnfold(scene: IuiScene): boolean {
  return (
    scene === 'task_compose' ||
    scene === 'homework_compose' ||
    scene === 'calendar_zoom' ||
    scene === 'itinerary_stage' ||
    scene === 'grocery_add' ||
    scene === 'place_save' ||
    scene === 'allowance_act'
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
