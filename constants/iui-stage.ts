/**
 * WO12 §A1 — stage design tokens. Every stage component reads from here;
 * domain colours are fixed and never repainted by a member's accent pack.
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
  semantic: {
    success: '#34D399',
    warning: '#FB923C',
    danger: '#F87171',
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
  radius: {
    row: 17,
    card: 25,
    ring: 30,
    pill: 999,
  },
  ringWidth: 2,
  timing: {
    show: 150,
    hold: 850,
    holdKid: 1300,
    settle: 600,
    undo: 5000,
  },
  /** Readable muted greys — never use textSubtle for meaning (WO12 §G). */
  text: {
    mutedDark: '#9DB4D2',
    mutedLight: '#46617F',
    faintDark: '#6E88AA',
    faintLight: '#6E88AA',
  },
  /** Shell / dock — Main / Batch / Coach boards. */
  shell: {
    groundDark: '#070D1C',
    groundLight: '#F0F4F8',
    /** Teaching accent on coach cards (lighter than household domain). */
    teach: '#6FA8E8',
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

/** Domain colour for a beat — fixed, not the member accent. */
export function stageAccent(scene: IuiScene | string, write?: IuiWriteKind | string): string {
  if (scene === 'coach_steps' || scene === 'navigate_coach' || scene === 'member_pick') {
    return STAGE.shell.teach;
  }
  if (scene === 'reward_mint') return STAGE.domain.rewards;
  if (
    scene === 'calendar_zoom' ||
    scene === 'itinerary_stage' ||
    write === 'create_event' ||
    write === 'create_itinerary_stop' ||
    write === 'advance_itinerary'
  ) {
    return STAGE.domain.plan;
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
    return STAGE.domain.chores;
  }
  if (scene === 'result_mark') return STAGE.semantic.success;
  return STAGE.domain.chores;
}

export function stageDomainLabel(scene: IuiScene | string, write?: IuiWriteKind | string): string {
  const accent = stageAccent(scene, write);
  if (accent === STAGE.domain.plan) return 'Plan';
  if (accent === STAGE.domain.rewards) return 'Rewards';
  if (accent === STAGE.domain.household) return 'Home';
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
