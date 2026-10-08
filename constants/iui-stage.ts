/**
 * WO12 §A1 — stage design tokens. Every stage component reads from here;
 * domain colours are fixed and never repainted by a member's accent pack.
 *
 * Dark hexes (`domain` / `semantic`) are for fills, rings, and dots.
 * Light hexes (`domainLight` / `semanticLight`) are for TEXT on the light card —
 * every value is ≥4.5:1 against the composite card surface (see stage-contrast.test.ts).
 */
import type { IuiScene, IuiWriteKind } from '@/lib/poppins/ui-scenes';

export const STAGE = {
  domain: {
    /** Tasks, homework, groceries — the doing. */
    chores: '#76C4AE',
    /** Events, trips, places. */
    plan: '#A78BFA',
    /** Rewards, allowance, ranks. */
    rewards: '#FAC775',
    /** Home, people, teaching. */
    household: '#378ADD',
  },
  /** Text on light card — WO12 audit P1. */
  domainLight: {
    chores: '#0F6F55',
    plan: '#6B3FD4',
    rewards: '#8A6A1F',
    household: '#1F6FBF',
  },
  semantic: {
    success: '#34D399',
    warning: '#FB923C',
    danger: '#F87171',
  },
  /** Text on light card — success darkened past audit’s #059669 (3.74) to clear 4.5. */
  semanticLight: {
    success: '#047857',
    warning: '#B45309',
    danger: '#DC2626',
  },
  surface: {
    card: 'rgba(255,255,255,0.05)',
    row: 'rgba(255,255,255,0.03)',
    rowActive: 'rgba(255,255,255,0.06)',
  },
  /** Light-mode surfaces — paired via useOrbitColors / isDark. */
  surfaceLight: {
    card: 'rgba(255,255,255,0.92)',
    row: 'rgba(15,28,42,0.04)',
    rowActive: 'rgba(15,28,42,0.07)',
  },
  /** Ground under the light card — used for contrast compositing. */
  ground: {
    dark: '#070D1C',
    light: '#F0F4F8',
  },
  radius: {
    row: 17,
    card: 25,
    ring: 30,
    pill: 999,
  },
  ringWidth: 2,
  /** Readable muted greys — never use textSubtle for meaning (WO12 §G). */
  text: {
    mutedDark: '#9DB4D2',
    mutedLight: '#46617F',
    faintDark: '#6E88AA',
    /** Was #6E88AA (3.61 on light card); darkened for AA. */
    faintLight: '#4E6884',
  },
  border: {
    dark: 'rgba(255,255,255,0.08)',
    light: 'rgba(15,28,42,0.10)',
    darkStrong: 'rgba(255,255,255,0.14)',
    lightStrong: 'rgba(15,28,42,0.14)',
  },
  ink: {
    /** On-accent label (mint / teach fill buttons). */
    onAccent: '#061424',
    /** Retry button fill / label (trouble row failed). */
    retryFill: '#F0A0A0',
    retryInk: '#2B0B0B',
    /** Soft body line on dark cards. */
    softDark: '#C8D8F0',
  },
  /** Shell / dock — Main / Batch / Coach boards. */
  shell: {
    groundDark: '#070D1C',
    groundLight: '#F0F4F8',
    /** Teaching accent on coach cards (fill / ring). */
    teach: '#6FA8E8',
    /** Teaching TEXT on light card. */
    teachLight: '#1F6FBF',
    teachNum: '#9BC6F5',
    mic: '#2F9E74',
  },
  dock: {
    side: 54,
    mic: 82,
    sideRadius: 18,
    gap: 20,
  },
} as const;

export type StageDomain = keyof typeof STAGE.domain;

type DomainKey = StageDomain | 'success' | 'teach';

function domainKeyFor(scene: IuiScene | string, write?: IuiWriteKind | string): DomainKey {
  if (scene === 'coach_steps' || scene === 'navigate_coach' || scene === 'member_pick') {
    return 'teach';
  }
  if (
    scene === 'reward_mint' ||
    scene === 'allowance_act' ||
    scene === 'ranks_peek' ||
    write === 'claim_reward' ||
    write === 'grant_allowance'
  ) {
    return 'rewards';
  }
  if (
    scene === 'calendar_zoom' ||
    scene === 'itinerary_stage' ||
    scene === 'place_save' ||
    write === 'create_event' ||
    write === 'create_itinerary_stop' ||
    write === 'advance_itinerary' ||
    write === 'upsert_place'
  ) {
    return 'plan';
  }
  if (
    scene === 'grocery_add' ||
    scene === 'task_compose' ||
    scene === 'homework_compose' ||
    scene === 'task_done' ||
    write === 'add_grocery' ||
    write === 'clear_grocery' ||
    write === 'create_task' ||
    write === 'create_homework' ||
    write === 'complete_task' ||
    write === 'update_task'
  ) {
    return 'chores';
  }
  if (scene === 'result_mark') return 'success';
  if (scene === 'memory_note') return 'household';
  return 'chores';
}

/**
 * TEXT colour for kickers / titles — theme-aware.
 * Fills, rings, and dots must use `stageFill` (always the bright dark hexes).
 */
export function stageAccent(
  scene: IuiScene | string,
  write?: IuiWriteKind | string,
  isDark = true
): string {
  const key = domainKeyFor(scene, write);
  if (key === 'teach') return isDark ? STAGE.shell.teach : STAGE.shell.teachLight;
  if (key === 'success') return isDark ? STAGE.semantic.success : STAGE.semanticLight.success;
  if (isDark) return STAGE.domain[key];
  return STAGE.domainLight[key];
}

/** Fill / ring / dot colour — never the light text palette. */
export function stageFill(scene: IuiScene | string, write?: IuiWriteKind | string): string {
  const key = domainKeyFor(scene, write);
  if (key === 'teach') return STAGE.shell.teach;
  if (key === 'success') return STAGE.semantic.success;
  return STAGE.domain[key];
}

export function stageSuccessText(isDark: boolean): string {
  return isDark ? STAGE.semantic.success : STAGE.semanticLight.success;
}

export function stageDangerText(isDark: boolean): string {
  return isDark ? STAGE.semantic.danger : STAGE.semanticLight.danger;
}

export function stageDomainLabel(scene: IuiScene | string, write?: IuiWriteKind | string): string {
  const key = domainKeyFor(scene, write);
  if (scene === 'place_save' || write === 'upsert_place') return 'Places';
  if (scene === 'allowance_act' || write === 'grant_allowance') return 'Allowance';
  if (scene === 'ranks_peek') return 'Ranks';
  if (scene === 'memory_note') return 'Memory';
  if (key === 'plan') return 'Plan';
  if (key === 'rewards') return 'Rewards';
  if (key === 'household' || key === 'teach') return 'Home';
  if (scene === 'grocery_add' || write === 'add_grocery' || write === 'clear_grocery') {
    return 'Groceries';
  }
  if (scene === 'homework_compose' || write === 'create_homework') return 'Homework';
  return 'Chores';
}

export function stageSurfaces(isDark: boolean) {
  return isDark ? STAGE.surface : STAGE.surfaceLight;
}

export function stageMuted(isDark: boolean) {
  return isDark ? STAGE.text.mutedDark : STAGE.text.mutedLight;
}

export function stageFaint(isDark: boolean) {
  return isDark ? STAGE.text.faintDark : STAGE.text.faintLight;
}

export function stageBorder(isDark: boolean, strong = false) {
  if (strong) return isDark ? STAGE.border.darkStrong : STAGE.border.lightStrong;
  return isDark ? STAGE.border.dark : STAGE.border.light;
}

/** Composite of light card over light ground — contrast baseline for AA checks. */
export function stageLightCardComposite(): string {
  const a = 0.92;
  const dst = [0xf0, 0xf4, 0xf8];
  const ch = dst.map((d) => Math.round(255 * a + d * (1 - a)));
  return `#${ch.map((x) => x.toString(16).padStart(2, '0')).join('')}`;
}
