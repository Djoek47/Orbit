/**
 * Admin household calendar keeps homework off by default.
 * Sidekick / focused calendars always include homework.
 * Admins can opt in via Plan → Homework toggle (persisted).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { PlanItem } from '@/lib/calendar/plan-items';

const KEY = '@orbit/admin_plan_show_homework_v1';

/** Default: admins do not see homework dots/rows on the main household calendar. */
export function defaultAdminPlanShowHomework(): boolean {
  return false;
}

export async function loadAdminPlanShowHomework(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw === '1') return true;
    if (raw === '0') return false;
    return defaultAdminPlanShowHomework();
  } catch {
    return defaultAdminPlanShowHomework();
  }
}

export async function saveAdminPlanShowHomework(show: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, show ? '1' : '0');
  } catch (error) {
    console.warn('saveAdminPlanShowHomework', error);
  }
}

/**
 * Strip homework from the admin household calendar unless they opted in.
 * Non-admin (Sidekick / focused) calendars always keep homework.
 */
export function filterPlanItemsForAdminCalendar(
  items: readonly PlanItem[],
  opts: { isAdmin: boolean; showHomework: boolean }
): PlanItem[] {
  if (!opts.isAdmin || opts.showHomework) return [...items];
  return items.filter((item) => item.kind !== 'homework');
}
