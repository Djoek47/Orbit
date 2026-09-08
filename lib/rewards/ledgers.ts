/**
 * Reward + allowance ledgers — Revision E §3.
 * One write path, one read path. History screens read only from here.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { WEEK_STARTS_ON } from '@/constants/scoring';
import { addLocalDays, formatLocalDate } from '@/lib/streaks/local-date';

export type RewardLedgerOrigin = 'earned' | 'requested';
export type RewardLedgerStatus = 'pending' | 'approved' | 'declined';

export type RewardLedgerEntry = {
  id: string;
  householdId: string;
  memberId: string;
  rewardId: string;
  /** Snapshot — survives rename/delete. */
  rewardName: string;
  origin: RewardLedgerOrigin;
  status: RewardLedgerStatus;
  createdAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
  note?: string;
};

export type AllowanceLedgerStatus = 'owed' | 'paid';

export type AllowanceLedgerEntry = {
  id: string;
  householdId: string;
  memberId: string;
  /** Snapshot amount in major units (dollars). */
  amount: number;
  currency: string;
  status: AllowanceLedgerStatus;
  /** YYYY-MM-DD household-local. */
  periodStart: string;
  periodEnd: string;
  createdAt: string;
  markedPaidAt?: string;
  markedPaidBy?: string;
  note?: string;
  /** Optional display label snapshot e.g. "$5". */
  amountLabel?: string;
};

const REWARD_KEY = '@orbit/reward_ledger.v1';
const ALLOWANCE_KEY = '@orbit/allowance_ledger.v1';

let rewardLedger: RewardLedgerEntry[] = [];
let allowanceLedger: AllowanceLedgerEntry[] = [];
let rewardHydratedFor: string | null = null;
let allowanceHydratedFor: string | null = null;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function localPartsInZone(isoUtc: string, timeZone: string): {
  y: number;
  m: number;
  d: number;
  weekday: number;
} {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  });
  const parts = dtf.formatToParts(new Date(isoUtc));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return {
    y: Number(get('year')),
    m: Number(get('month')),
    d: Number(get('day')),
    weekday: weekdayMap[get('weekday')] ?? 0,
  };
}

/** Monday 00:00 → Sunday end, household-local. Returns local YYYY-MM-DD bounds. */
export function householdWeekBounds(
  asOfIsoUtc: string,
  timeZone = 'UTC',
  weekStartsOn = WEEK_STARTS_ON
): { periodStart: string; periodEnd: string } {
  const { y, m, d, weekday } = localPartsInZone(asOfIsoUtc, timeZone);
  const localDate = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const diff = (weekday - weekStartsOn + 7) % 7;
  const periodStart = addLocalDays(localDate, -diff);
  const periodEnd = addLocalDays(periodStart, 6);
  return { periodStart, periodEnd };
}

export function isIsoInHouseholdWeek(
  isoUtc: string,
  timeZone: string,
  week: { periodStart: string; periodEnd: string }
): boolean {
  const local = formatLocalDate(new Date(isoUtc), timeZone);
  return local >= week.periodStart && local <= week.periodEnd;
}

export function parseAmountLabel(label: string): { amount: number; currency: string } {
  const match = label.trim().match(/^([^0-9.-]*)([0-9]+(?:\.[0-9]+)?)/);
  if (!match) return { amount: 0, currency: 'USD' };
  const currency = match[1].includes('€') ? 'EUR' : match[1].includes('£') ? 'GBP' : 'USD';
  return { amount: Number(match[2]), currency };
}

export function formatMoney(amount: number, currency = 'USD'): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
    }).format(amount);
  } catch {
    return `$${amount}`;
  }
}

async function loadRewardLedger(householdId: string): Promise<void> {
  if (rewardHydratedFor === householdId) return;
  try {
    const raw = await AsyncStorage.getItem(`${REWARD_KEY}:${householdId}`);
    const parsed = raw ? (JSON.parse(raw) as RewardLedgerEntry[]) : [];
    rewardLedger = [
      ...(Array.isArray(parsed) ? parsed : []),
      ...rewardLedger.filter((e) => e.householdId !== householdId),
    ];
  } catch {
    /* keep memory */
  }
  rewardHydratedFor = householdId;
}

async function persistRewardLedger(householdId: string): Promise<void> {
  try {
    const rows = rewardLedger.filter((e) => e.householdId === householdId);
    await AsyncStorage.setItem(`${REWARD_KEY}:${householdId}`, JSON.stringify(rows));
  } catch (error) {
    console.warn('persistRewardLedger failed', error);
  }
}

async function loadAllowanceLedger(householdId: string): Promise<void> {
  if (allowanceHydratedFor === householdId) return;
  try {
    const raw = await AsyncStorage.getItem(`${ALLOWANCE_KEY}:${householdId}`);
    const parsed = raw ? (JSON.parse(raw) as AllowanceLedgerEntry[]) : [];
    allowanceLedger = [
      ...(Array.isArray(parsed) ? parsed : []),
      ...allowanceLedger.filter((e) => e.householdId !== householdId),
    ];
  } catch {
    /* keep memory */
  }
  allowanceHydratedFor = householdId;
}

async function persistAllowanceLedger(householdId: string): Promise<void> {
  try {
    const rows = allowanceLedger.filter((e) => e.householdId === householdId);
    await AsyncStorage.setItem(`${ALLOWANCE_KEY}:${householdId}`, JSON.stringify(rows));
  } catch (error) {
    console.warn('persistAllowanceLedger failed', error);
  }
}

function createId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Single write path for reward history. */
export async function applyRewardChange(input: {
  householdId: string;
  memberId: string;
  rewardId: string;
  rewardName: string;
  origin: RewardLedgerOrigin;
  status: RewardLedgerStatus;
  note?: string;
  resolvedBy?: string;
  /** Stable id — use redemption id so approve can update the same row. */
  id?: string;
}): Promise<RewardLedgerEntry> {
  await loadRewardLedger(input.householdId);
  const now = new Date().toISOString();
  const id = input.id ?? createId('rled');

  const idx = rewardLedger.findIndex((e) => e.id === id);
  if (idx >= 0) {
    const updated: RewardLedgerEntry = {
      ...rewardLedger[idx],
      status: input.status,
      resolvedAt: input.status === 'pending' ? undefined : now,
      resolvedBy: input.resolvedBy,
      note: input.note ?? rewardLedger[idx].note,
    };
    rewardLedger[idx] = updated;
    await persistRewardLedger(input.householdId);
    return clone(updated);
  }

  const entry: RewardLedgerEntry = {
    id,
    householdId: input.householdId,
    memberId: input.memberId,
    rewardId: input.rewardId,
    rewardName: input.rewardName,
    origin: input.origin,
    status: input.status,
    createdAt: now,
    resolvedAt: input.status === 'pending' ? undefined : now,
    resolvedBy: input.resolvedBy,
    note: input.note,
  };
  rewardLedger = [entry, ...rewardLedger];
  await persistRewardLedger(input.householdId);
  return clone(entry);
}

/** Single write path for allowance history. */
export async function applyAllowanceChange(input: {
  householdId: string;
  memberId: string;
  amount: number;
  currency?: string;
  status: AllowanceLedgerStatus;
  timeZone?: string;
  asOfIso?: string;
  note?: string;
  amountLabel?: string;
  markedPaidBy?: string;
  id?: string;
}): Promise<AllowanceLedgerEntry> {
  await loadAllowanceLedger(input.householdId);
  const now = input.asOfIso ?? new Date().toISOString();
  const tz = input.timeZone ?? 'UTC';
  const week = householdWeekBounds(now, tz);
  const id = input.id ?? createId('aled');

  const idx = allowanceLedger.findIndex((e) => e.id === id);
  if (idx >= 0) {
    const updated: AllowanceLedgerEntry = {
      ...allowanceLedger[idx],
      status: input.status,
      markedPaidAt: input.status === 'paid' ? now : allowanceLedger[idx].markedPaidAt,
      markedPaidBy: input.markedPaidBy,
      note: input.note ?? allowanceLedger[idx].note,
    };
    allowanceLedger[idx] = updated;
    await persistAllowanceLedger(input.householdId);
    return clone(updated);
  }

  const entry: AllowanceLedgerEntry = {
    id,
    householdId: input.householdId,
    memberId: input.memberId,
    amount: input.amount,
    currency: input.currency ?? 'USD',
    status: input.status,
    periodStart: week.periodStart,
    periodEnd: week.periodEnd,
    createdAt: now,
    markedPaidAt: input.status === 'paid' ? now : undefined,
    markedPaidBy: input.markedPaidBy,
    note: input.note,
    amountLabel: input.amountLabel,
  };
  allowanceLedger = [entry, ...allowanceLedger];
  await persistAllowanceLedger(input.householdId);
  return clone(entry);
}

export async function listRewardLedger(
  householdId: string,
  opts?: { timeZone?: string; thisWeekOnly?: boolean }
): Promise<RewardLedgerEntry[]> {
  await loadRewardLedger(householdId);
  let rows = rewardLedger.filter((e) => e.householdId === householdId);
  if (opts?.thisWeekOnly) {
    const week = householdWeekBounds(new Date().toISOString(), opts.timeZone ?? 'UTC');
    rows = rows.filter((e) => isIsoInHouseholdWeek(e.createdAt, opts.timeZone ?? 'UTC', week));
  }
  return clone(rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
}

export async function listAllowanceLedger(
  householdId: string,
  opts?: { timeZone?: string; thisWeekOnly?: boolean }
): Promise<AllowanceLedgerEntry[]> {
  await loadAllowanceLedger(householdId);
  let rows = allowanceLedger.filter((e) => e.householdId === householdId);
  if (opts?.thisWeekOnly) {
    const week = householdWeekBounds(new Date().toISOString(), opts.timeZone ?? 'UTC');
    rows = rows.filter((e) => {
      // Prefer period fields; also accept createdAt in week.
      return (
        (e.periodStart <= week.periodEnd && e.periodEnd >= week.periodStart) ||
        isIsoInHouseholdWeek(e.createdAt, opts.timeZone ?? 'UTC', week)
      );
    });
  }
  return clone(rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
}

export function summarizeRewardLedger(entries: RewardLedgerEntry[]) {
  return {
    waiting: entries.filter((e) => e.status === 'pending').length,
    approved: entries.filter((e) => e.status === 'approved').length,
    declined: entries.filter((e) => e.status === 'declined').length,
  };
}

export function summarizeAllowanceLedger(entries: AllowanceLedgerEntry[]) {
  const owed = entries
    .filter((e) => e.status === 'owed')
    .reduce((sum, e) => sum + e.amount, 0);
  const paid = entries
    .filter((e) => e.status === 'paid')
    .reduce((sum, e) => sum + e.amount, 0);
  const currency = entries[0]?.currency ?? 'USD';
  return { owed, paid, currency };
}

/** Test helpers */
export function __resetLedgersForTests() {
  rewardLedger = [];
  allowanceLedger = [];
  rewardHydratedFor = null;
  allowanceHydratedFor = null;
}

export function __setRewardLedgerForTests(entries: RewardLedgerEntry[]) {
  rewardLedger = clone(entries);
  rewardHydratedFor = entries[0]?.householdId ?? null;
}

export function __setAllowanceLedgerForTests(entries: AllowanceLedgerEntry[]) {
  allowanceLedger = clone(entries);
  allowanceHydratedFor = entries[0]?.householdId ?? null;
}
