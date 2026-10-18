/**
 * What a household can reach, given what it has paid for.
 *
 * Three states, decided in one place so no screen has to work it out again:
 *
 *   paid     everything
 *   trial    the whole app, except Poppins — the trial proves the chores are worth paying
 *            for, and the AI is the thing being sold, so it stays behind the till. A trial
 *            household has no monthly allowance at all; it can buy a credit pack to try
 *            Poppins, or subscribe and get the 300 that come with it.
 *   locked   nothing but the paywall and the few settings a person must always be able to
 *            reach: delete the account, transfer the household, read the terms, get support.
 *            Locking someone out of deleting their own account would be indefensible.
 *
 * "Locked" covers never having paid and a trial that ran out. Apple charges automatically at
 * the end of a trial, so a household that reaches this state has either cancelled or had a
 * payment fail — in both cases the answer is the same screen.
 *
 * Pure: no React Native, no storage, no clock of its own.
 */
import { isPremiumActive, type EntitlementState } from '@/constants/billing';

export type AccessLevel = 'paid' | 'trial' | 'locked';

/** The only destinations that stay open while locked. */
export const UNPAID_SETTINGS_KEYS = [
  'subscription',
  'household',
  'transferOwnership',
  'deleteAccount',
  'terms',
  'privacy',
  'support',
  'signOut',
] as const;

export type UnpaidSettingsKey = (typeof UNPAID_SETTINGS_KEYS)[number];

export type AccessView = {
  level: AccessLevel;
  /** True when the app itself is behind the paywall. */
  appLocked: boolean;
  /** True when Poppins is reachable but refuses to run. */
  poppinsLocked: boolean;
  /** Monthly Poppins allowance this household actually gets. Zero on trial. */
  monthlyAllowance: number;
  /** Whole days left, rounded down. Null when not in a trial. */
  trialDaysLeft: number | null;
  /** Hours left, for the last day. Null when not in a trial. */
  trialHoursLeft: number | null;
  trialEndsAt: string | null;
  /** "4 days left" · "Ends tomorrow" · "Ends in 5 hours" · "" when not on trial. */
  trialLabel: string;
  /** True in the last 48 hours, when the countdown should start being loud. */
  trialEndingSoon: boolean;
};

const MS_HOUR = 3_600_000;
const MS_DAY = 86_400_000;

export function accessLevel(
  entitlement: EntitlementState | null | undefined,
  now = new Date()
): AccessLevel {
  if (!entitlement) return 'locked';
  if (!isPremiumActive(entitlement, now)) return 'locked';
  return entitlement.inTrial ? 'trial' : 'paid';
}

/** "4 days left", "Ends tomorrow", "Ends in 5 hours", "Ends in under an hour". */
export function formatTrialRemaining(msLeft: number): string {
  if (msLeft <= 0) return 'Trial over';
  if (msLeft < MS_HOUR) return 'Ends in under an hour';
  if (msLeft < MS_DAY) {
    const hours = Math.round(msLeft / MS_HOUR);
    return `Ends in ${hours} hour${hours === 1 ? '' : 's'}`;
  }
  const days = Math.floor(msLeft / MS_DAY);
  if (days === 1) return 'Ends tomorrow';
  return `${days} days left`;
}

export function accessView(
  entitlement: EntitlementState | null | undefined,
  monthlyAllowanceWhenPaid: number,
  now = new Date()
): AccessView {
  const level = accessLevel(entitlement, now);
  // The countdown is to the real end of the trial, never to the end of a grace period.
  const endsAt = entitlement?.periodEndsAt ?? entitlement?.expiresAt ?? null;

  if (level !== 'trial') {
    return {
      level,
      appLocked: level === 'locked',
      // Nothing to lock on the paid path; a locked app never reaches Poppins anyway.
      poppinsLocked: level === 'locked',
      monthlyAllowance: level === 'paid' ? monthlyAllowanceWhenPaid : 0,
      trialDaysLeft: null,
      trialHoursLeft: null,
      trialEndsAt: null,
      trialLabel: '',
      trialEndingSoon: false,
    };
  }

  const msLeft = endsAt ? new Date(endsAt).getTime() - now.getTime() : 0;
  const safeMs = Number.isNaN(msLeft) ? 0 : Math.max(0, msLeft);

  return {
    level,
    appLocked: false,
    poppinsLocked: true,
    monthlyAllowance: 0,
    trialDaysLeft: Math.floor(safeMs / MS_DAY),
    trialHoursLeft: Math.floor(safeMs / MS_HOUR),
    trialEndsAt: endsAt,
    trialLabel: formatTrialRemaining(safeMs),
    trialEndingSoon: safeMs <= 2 * MS_DAY,
  };
}

/** True when this settings row should still be reachable while the app is locked. */
export function settingsAllowedWhenLocked(key: string): boolean {
  return (UNPAID_SETTINGS_KEYS as readonly string[]).includes(key);
}

/**
 * What the Poppins lock screen says. A trial household is being sold something, not told off,
 * so it offers both ways in: the packs, or the subscription that includes the allowance.
 */
export function poppinsLockCopy(view: AccessView, monthlyAllowanceWhenPaid: number) {
  if (view.level === 'locked') {
    return {
      title: 'Poppins comes with your subscription',
      body: 'Subscribe to talk to your house instead of typing at it.',
      primary: 'See plans',
      secondary: null as string | null,
    };
  }
  return {
    title: 'Poppins comes with your subscription',
    body: `Your trial covers chores, XP and rewards. Poppins runs on actions — subscribe for ${monthlyAllowanceWhenPaid} every month, or buy a pack to try it now.`,
    primary: 'Subscribe',
    secondary: 'Buy actions',
  };
}
