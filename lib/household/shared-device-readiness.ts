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
import { isSharedDeviceEligiblePerson } from '@/lib/household/shared-device';
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
 * `isSharedDeviceEligiblePerson` cannot answer this on its own: it requires `active`, and the
 * whole point here is to see the people who are not active yet.
 */
function isSidekickProfile(member: HouseholdMember): boolean {
  if (member.status === 'removed' || member.status === 'inactive') return false;
  if (member.role === 'owner' || member.role === 'admin') return false;
  if (member.role === 'guest' || member.role === 'shared-device') return false;
  return true;
}

export function sharedDeviceReadiness(members: HouseholdMember[]): SharedDeviceReadiness {
  const profiles = members.filter(isSidekickProfile);
  const connected = profiles.filter(
    (member) => member.status === 'active' && isSharedDeviceEligiblePerson(member)
  );
  const waiting = profiles.filter((member) => member.status !== 'active');

  if (connected.length === 0 && waiting.length === 0) {
    return {
      state: 'no-sidekicks',
      connected,
      waiting,
      blocked: true,
      title: 'Nobody to share it with yet',
      body: 'Add a Sidekick first. Once they sign in on their own phone, you can put them on a shared device.',
      action: 'invite',
    };
  }

  if (connected.length === 0) {
    const who = listNames(waiting);
    return {
      state: 'none-connected',
      connected,
      waiting,
      blocked: true,
      title: 'Nobody has signed in yet',
      body:
        waiting.length === 1
          ? `${who} has been invited but hasn't signed in yet. Once they open Choremaxx with their code, they can go on this device.`
          : `${who} have been invited but haven't signed in yet. Once they open Choremaxx with their codes, they can go on this device.`,
      action: 'wait',
    };
  }

  if (connected.length === 1) {
    const who = firstName(connected[0]!);
    const alsoWaiting = waiting.length > 0;
    return {
      state: 'single',
      connected,
      waiting,
      blocked: false,
      title: `Only ${who} so far`,
      body: alsoWaiting
        ? `A shared device is for two or more people taking turns. ${listNames(waiting)} still need to sign in — you can wait, or set it up for ${who} alone and add them later.`
        : `A shared device is for two or more people taking turns. With just ${who}, their own phone works better — but you can set this up anyway and add people later.`,
      action: alsoWaiting ? 'wait' : 'invite',
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
