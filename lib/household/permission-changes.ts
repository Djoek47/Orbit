/**
 * What changed when an admin moves a Sidekick permission — so the kid's phone can say so
 * instead of silently behaving differently.
 *
 *   granted  →  green   "You can now add to the grocery list"
 *   removed  →  amber   "Adding to the calendar is off again"
 *
 * The toggles live in two places (the household row for grocery and Poppins, the
 * capabilities map for the rest). This puts them side by side so one diff covers both.
 */
import { DEFAULT_MEMBER_CAPABILITIES, type MemberCapabilities } from '@/lib/member-capabilities';

/** Everything a Sidekick's permissions are made of, flattened. */
export type SidekickPermissionState = MemberCapabilities & {
  sidekickGroceryAdd: boolean;
};

export type PermissionKey = keyof SidekickPermissionState;

export type PermissionChange = {
  key: PermissionKey;
  granted: boolean;
  /** Said to the Sidekick, in their words. */
  message: string;
};

/** Sidekick-facing wording. `on` is what they can now do; `off` is what stopped. */
const COPY: Record<PermissionKey, { on: string; off: string }> = {
  allowRewardRedeem: {
    on: 'You can spend points on rewards',
    off: 'Spending points on rewards is off for now',
  },
  allowSpecialRewardRequest: {
    on: 'You can suggest a reward',
    off: 'Suggesting rewards is off for now',
  },
  allowAllowance: {
    on: 'You can see your allowance',
    off: 'Your allowance is hidden for now',
  },
  allowGroceryAdd: {
    on: 'You can add to the grocery list',
    off: 'Adding to the grocery list is off for now',
  },
  allowCalendarCreate: {
    on: 'You can add to the calendar',
    off: 'Adding to the calendar is off for now',
  },
  requireSidekickEventApproval: {
    on: 'A parent now approves the events you add',
    off: 'Your events go on the calendar without approval',
  },
  sidekickGroceryAdd: {
    on: 'You can add to the grocery list',
    off: 'Adding to the grocery list is off for now',
  },
};

/** The two grocery switches say the same thing — only report it once. */
const SAME_AS: Partial<Record<PermissionKey, PermissionKey>> = {
  allowGroceryAdd: 'sidekickGroceryAdd',
};

export function permissionState(input: {
  memberCapabilities?: Partial<MemberCapabilities> | null;
  sidekickGroceryAdd?: boolean | null;
}): SidekickPermissionState {
  return {
    ...DEFAULT_MEMBER_CAPABILITIES,
    ...(input.memberCapabilities ?? {}),
    sidekickGroceryAdd: input.sidekickGroceryAdd === true,
  };
}

/** Every switch that moved, with the line to show the Sidekick. */
export function permissionChanges(
  before: SidekickPermissionState,
  after: SidekickPermissionState
): PermissionChange[] {
  const changes: PermissionChange[] = [];
  const said = new Set<PermissionKey>();

  for (const key of Object.keys(COPY) as PermissionKey[]) {
    if (before[key] === after[key]) continue;
    const canonical = SAME_AS[key] ?? key;
    if (said.has(canonical)) continue;
    said.add(canonical);
    const granted = after[key] === true;
    changes.push({ key, granted, message: granted ? COPY[key].on : COPY[key].off });
  }
  return changes;
}

/** One line for the notification, however many switches moved. */
export function permissionChangeSummary(changes: PermissionChange[]): string {
  if (changes.length === 0) return '';
  if (changes.length === 1) return changes[0]!.message;
  const granted = changes.filter((change) => change.granted).length;
  const removed = changes.length - granted;
  if (granted && removed) return `${granted} thing you can do changed, ${removed} turned off`;
  if (granted) return `${granted} new things you can do`;
  return `${removed} things are off for now`;
}

/** Green when anything was granted, amber when it was only taken away. */
export function permissionChangeTone(changes: PermissionChange[]): 'granted' | 'removed' | 'none' {
  if (changes.length === 0) return 'none';
  return changes.some((change) => change.granted) ? 'granted' : 'removed';
}
