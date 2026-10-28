/**
 * Whether a household can set up a shared device yet, and what to say when it cannot.
 *
 * A Sidekick only becomes pickable once they have signed in at least once — until then the
 * profile is `invited` and there is nothing to put on a tablet. The wizard filtered those out
 * silently, so "Who uses it" could show an empty grid under the words "Tap each Sidekick who
 * shares it", with no hint that the people you just invited are the reason. Worse, Next stayed
 * live and failed later with "Pick at least one person", which blames the user for something
 * they cannot do yet.
 *
 * This decides the state once so the step can block honestly and say why.
 *
 * Pure: no React Native, no storage.
 */
import type { HouseholdMember } from '@/types/orbit';

export type SharedDeviceReadinessState =
  /** Nobody has been invited yet — the household needs people before it needs a shared device. */
  | 'no-sidekicks'
  /** Sidekicks exist but none has signed in, so none can be put on a device. Blocking. */
  | 'none-connected'
  /** Exactly one person can be picked. Allowed, but a shared device is the wrong tool for one. */
  | 'single'
  /** Two or more. This is what the feature is for. */
  | 'ready';

export type SharedDeviceReadiness = {
  state: SharedDeviceReadinessState;
  /** Sidekicks who have signed in and can be put on the device. */
  connected: HouseholdMember[];
  /** Invited, never signed in. They are the reason the grid is empty. */
  waiting: HouseholdMember[];
  /** True while the step must not advance. */
  blocked: boolean;
  title: string;
  body: string;
  /** What the person should do next, when there is something to do. */
  action: 'invite' | 'wait' | null;
};

function firstName(member: HouseholdMember): string {
  const name = member.name.trim();
  return name.split(/\s+/)[0] || name;
}

/** "Emma", "Emma and Jack", "Emma, Jack and 2 others". */
export function listNames(members: HouseholdMember[]): string {
  const names = members.map(firstName).filter(Boolean);
  if (names.length === 0) return '';
  if (names.length === 1) return names[0]!;
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  const rest = names.length - 2;
  return `${names[0]}, ${names[1]} and ${rest} other${rest === 1 ? '' : 's'}`;
}

/**
 * A Sidekick-shaped member, whatever their status.
 *
 * `isSharedDeviceEligiblePerson` cannot answer this: it requires `active`, and the whole point
 * here is to see the people who are not active yet. It is also wider than the wizard's own
 * grid, which renders `role === 'child'` only — counting an active adult as "connected" while
 * giving them no tile reproduces the silent empty grid this module exists to prevent.
 */
function isSidekickProfile(member: HouseholdMember): boolean {
  if (member.status === 'removed' || member.status === 'inactive') return false;
  return member.role === 'child';
}

export function sharedDeviceReadiness(members: HouseholdMember[]): SharedDeviceReadiness {
  const profiles = members.filter(isSidekickProfile);
  // Exactly who the wizard's grid will render — see isSidekickProfile.
  // Signed in or not, every Sidekick can go on a shared device now (the old rule made each kid
  // sign in on a phone first). `waiting` is kept for callers that still show who hasn't
  // signed in, but it no longer blocks anything.
  const connected = profiles;
  const waiting = profiles.filter((member) => member.status !== 'active');

  if (connected.length === 0) {
    return {
      state: 'no-sidekicks',
      connected,
      waiting,
      blocked: true,
      title: 'Add your Sidekicks first',
      body: 'A shared device is a tablet two or more Sidekicks take turns on. Add them in People — they don’t need to sign in anywhere first — then come back here.',
      action: 'invite',
    };
  }

  if (connected.length === 1) {
    const who = firstName(connected[0]!);
    return {
      state: 'single',
      connected,
      waiting,
      blocked: true,
      title: `Only ${who} so far`,
      body: `A shared device is for two or more people taking turns on one tablet — with just ${who} there’s nobody to share it with, so ${who} keeps their own profile. Add another Sidekick in People, then set this up for both.`,
      action: 'invite',
    };
  }

  return {
    state: 'ready',
    connected,
    waiting,
    blocked: false,
    title: '',
    body: '',
    action: null,
  };
}
