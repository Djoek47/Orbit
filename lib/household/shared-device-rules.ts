/**
 * The rules for shared devices, in one place.
 *
 *   Who can go on one   Any Sidekick in the household, signed in yet or not (invited, pending
 *                       or active). Admins stay on their own phones.
 *   When it works       With two or more people. One person has nothing to share, so a device
 *                       with fewer than two is "waiting": it can't be used, and the person on
 *                       it stays an ordinary Sidekick with their own profile.
 *   How many devices    One per person. Adding someone to a second device moves them there.
 *   What moves          Nothing about the person: same member record, same XP, streaks and
 *                       tasks. Only where they open ChoreMaxx changes.
 *
 * And the words for every case, so each screen explains the same thing the same way.
 *
 * Pure: no React Native, no storage, no network.
 */
import type { HouseholdMember } from '@/types/orbit';

/** People needed before a shared device can be used. */
export const SHARED_DEVICE_MIN_PEOPLE = 2;
/** Most faces on one tablet. */
export const SHARED_DEVICE_MAX = 6;

export type Message = { title: string; body: string };

const first = (m: HouseholdMember | undefined | null) =>
  (m?.name ?? '').trim().split(/\s+/)[0] || 'They';
const deviceLabel = (d: HouseholdMember | undefined | null) => d?.name?.trim() || 'the shared device';

export function isDevice(m: HouseholdMember | undefined | null): boolean {
  return Boolean(m && m.role === 'shared-device' && m.status === 'active');
}

/** A Sidekick who could share a device: not an admin, not removed, signed in or not. */
export function canShareDevice(m: HouseholdMember | undefined | null): boolean {
  if (!m) return false;
  if (m.status !== 'active' && m.status !== 'invited' && m.status !== 'pending') return false;
  // Sidekicks, and grown-ups without admin rights (an older teen, a grandparent).
  const role = m.role as string;
  return role !== 'owner' && role !== 'admin' && role !== 'guest' && role !== 'shared-device';
}

export function devicesOf(members: HouseholdMember[]): HouseholdMember[] {
  return members.filter(isDevice);
}

/** Everyone linked to the device who can share it (whether or not it is in use yet). */
export function peopleOn(device: HouseholdMember | undefined | null, members: HouseholdMember[]): HouseholdMember[] {
  if (!isDevice(device)) return [];
  const ids = new Set(device?.sharedWithMemberIds ?? []);
  return members.filter((m) => ids.has(m.id) && canShareDevice(m));
}

/** In use: two or more people. */
export function isDeviceLive(device: HouseholdMember | undefined | null, members: HouseholdMember[]): boolean {
  return peopleOn(device, members).length >= SHARED_DEVICE_MIN_PEOPLE;
}

/** The device this person opens ChoreMaxx on — only a device that is in use. */
export function liveDeviceFor(memberId: string | null | undefined, members: HouseholdMember[]): HouseholdMember | undefined {
  if (!memberId) return undefined;
  return devicesOf(members).find(
    (d) => (d.sharedWithMemberIds ?? []).includes(memberId) && isDeviceLive(d, members)
  );
}

/** The device this person is linked to, in use or waiting. */
export function linkedDeviceFor(memberId: string | null | undefined, members: HouseholdMember[]): HouseholdMember | undefined {
  if (!memberId) return undefined;
  return devicesOf(members).find((d) => (d.sharedWithMemberIds ?? []).includes(memberId));
}

/** People who live on a device in use — they leave the Sidekicks list. */
export function onLiveDeviceIds(members: HouseholdMember[]): Set<string> {
  const ids = new Set<string>();
  for (const d of devicesOf(members)) {
    if (!isDeviceLive(d, members)) continue;
    for (const p of peopleOn(d, members)) ids.add(p.id);
  }
  return ids;
}

// ── Adding and removing ──────────────────────────────────────────────────────────────────────

export type LinkPlan = {
  /** Every device whose list changes, with its new list. */
  links: Record<string, string[]>;
  /** What to tell the admin, in order. Empty when there is nothing worth saying. */
  notes: Message[];
};

/** Why this person can't go on this device right now, or null when they can. */
export function cannotAdd(person: HouseholdMember | undefined | null, device: HouseholdMember, members: HouseholdMember[]): Message | null {
  const name = first(person);
  const where = deviceLabel(device);
  if (!person) return { title: 'Not found', body: 'That person is no longer in this household.' };
  if (person.status === 'removed' || person.status === 'inactive') {
    return { title: `${name} isn’t in the household`, body: `${name} was removed. Add them again from People first.` };
  }
  if (person.role === 'owner' || person.role === 'admin') {
    return {
      title: 'Admins keep their own phone',
      body: `${name} runs the household, so they stay on their own phone. Shared devices are for the Sidekicks who take turns on one tablet.`,
    };
  }
  if (!canShareDevice(person)) {
    return { title: `${name} can’t share a device`, body: 'Only Sidekicks can be added to a shared device.' };
  }
  if ((device.sharedWithMemberIds ?? []).includes(person.id)) {
    return { title: `${name} is already on ${where}`, body: `${name} already appears on ${where}.` };
  }
  if (peopleOn(device, members).length >= SHARED_DEVICE_MAX) {
    return {
      title: `${where} is full`,
      body: `${where} can share with up to ${SHARED_DEVICE_MAX} people. Take someone off first, or set up another shared device.`,
    };
  }
  return null;
}

/** Put a person on a device: off any other device (one at a time), then onto this one. */
export function planAdd(personId: string, deviceId: string, members: HouseholdMember[]): LinkPlan | { blocked: Message } {
  const device = members.find((m) => m.id === deviceId);
  const person = members.find((m) => m.id === personId);
  if (!device || !isDevice(device)) return { blocked: { title: 'Device not found', body: 'Close this and open People again.' } };
  const blocked = cannotAdd(person, device, members);
  if (blocked) return { blocked };

  const links: Record<string, string[]> = {};
  const notes: Message[] = [];
  const name = first(person);

  // One device at a time: moving off the old one.
  const previous = linkedDeviceFor(personId, members);
  if (previous && previous.id !== deviceId) {
    const left = (previous.sharedWithMemberIds ?? []).filter((id) => id !== personId);
    links[previous.id] = left;
    notes.push({
      title: `${name} moved to ${deviceLabel(device)}`,
      body: `Each person uses one shared device, so ${name} is off ${deviceLabel(previous)}.`,
    });
    const after = withLinks(members, links);
    const prevAfter = after.find((m) => m.id === previous.id);
    if (prevAfter && !isDeviceLive(prevAfter, after) && peopleOn(prevAfter, after).length === 1) {
      const alone = peopleOn(prevAfter, after)[0];
      notes.push(waitingNote(prevAfter, alone));
    }
  }

  links[deviceId] = [...(device.sharedWithMemberIds ?? []), personId];
  const after = withLinks(members, links);
  const deviceAfter = after.find((m) => m.id === deviceId)!;
  const count = peopleOn(deviceAfter, after).length;

  if (count === 1) {
    notes.push(waitingNote(deviceAfter, person));
  } else if (count === SHARED_DEVICE_MIN_PEOPLE && !isDeviceLive(device, members)) {
    const names = peopleOn(deviceAfter, after).map(first).join(' and ');
    notes.push({
      title: `${deviceLabel(device)} is ready`,
      body: `${names} now share ${deviceLabel(device)}. Each one taps their own face on it. If they were signed in on their own phone, that phone signs out and tells them why.`,
    });
  } else {
    notes.push({
      title: `${name} is on ${deviceLabel(device)}`,
      body: person?.status === 'active'
        ? `${name} now uses ${deviceLabel(device)}. If ${name} was signed in on their own phone, it signs out and tells them why.`
        : `${name} now uses ${deviceLabel(device)}. ${name} hasn’t signed in anywhere yet — that’s fine, they can start on the tablet.`,
    });
  }
  return { links, notes };
}

/** Take a person off a device. */
export function planRemove(personId: string, deviceId: string, members: HouseholdMember[]): LinkPlan {
  const device = members.find((m) => m.id === deviceId);
  const person = members.find((m) => m.id === personId);
  if (!device) return { links: {}, notes: [] };
  const links = { [deviceId]: (device.sharedWithMemberIds ?? []).filter((id) => id !== personId) };
  const after = withLinks(members, links);
  const deviceAfter = after.find((m) => m.id === deviceId)!;
  const left = peopleOn(deviceAfter, after);
  const name = first(person);
  const notes: Message[] = [
    {
      title: `${name} is a Sidekick again`,
      body: `${name} has their own profile back, with all their XP and streaks. They sign in on their own phone with their code.`,
    },
  ];
  if (left.length === 1) notes.push(waitingNote(deviceAfter, left[0]));
  if (left.length === 0 && isDeviceLive(device, members)) {
    notes.push({ title: `${deviceLabel(device)} is empty`, body: 'Add two people to use it again, or remove the device.' });
  }
  return { links, notes };
}

function waitingNote(device: HouseholdMember, alone: HouseholdMember | undefined): Message {
  const name = first(alone);
  return {
    title: `${deviceLabel(device)} needs one more person`,
    body: `A shared device is for two or more people taking turns, so it can’t be used with just ${name}. Until someone else joins, ${name} stays a Sidekick on their own profile.`,
  };
}

/** The members with these device lists applied — for planning, never saved. */
export function withLinks(members: HouseholdMember[], links: Record<string, string[]>): HouseholdMember[] {
  return members.map((m) => (links[m.id] ? { ...m, sharedWithMemberIds: links[m.id] } : m));
}

/** One line for the device card. */
export function deviceStatusLine(device: HouseholdMember, members: HouseholdMember[]): string {
  const people = peopleOn(device, members);
  if (people.length === 0) return 'Add two Sidekicks to start using it';
  if (people.length === 1) return `Waiting for a second person · ${first(people[0])} stays a Sidekick for now`;
  return `${people.length} people share it`;
}

// ── On the kid's own device ──────────────────────────────────────────────────────────────────

export type DeviceTransition =
  | { kind: 'none' }
  /** A Sidekick's own phone: they were put on a shared device. Sign this phone out. */
  | { kind: 'moved-to-shared'; message: Message }
  /** A shared device that was removed, or dropped below two people. Sign it out. */
  | { kind: 'device-closed'; message: Message }
  /** A shared device whose people changed. Show the picker with the new list. */
  | { kind: 'roster-changed'; people: string[]; message: Message };

/**
 * What should happen on this device after the household changed.
 *   personal phone:  memberId is the Sidekick signed in here
 *   shared device:   deviceId is the device this tablet is, localPeople who it shows now
 */
export function deviceTransition(
  here:
    | { kind: 'personal'; memberId: string }
    | { kind: 'shared'; deviceId: string; localPeople: string[] },
  members: HouseholdMember[]
): DeviceTransition {
  if (here.kind === 'personal') {
    const device = liveDeviceFor(here.memberId, members);
    if (!device) return { kind: 'none' };
    const me = members.find((m) => m.id === here.memberId);
    return {
      kind: 'moved-to-shared',
      message: {
        title: `You’re on ${deviceLabel(device)} now`,
        body: `Your admin moved ${first(me) === 'They' ? 'you' : first(me)} to ${deviceLabel(device)}. Everything you’ve earned comes with you — open ChoreMaxx there and tap your face. This phone signs out.`,
      },
    };
  }

  const device = members.find((m) => m.id === here.deviceId);
  if (!device || !isDevice(device)) {
    return {
      kind: 'device-closed',
      message: {
        title: 'This device was removed',
        body: 'Your admin removed this shared device. Everyone keeps their XP and streaks — sign in on your own phone with your code.',
      },
    };
  }
  const people = peopleOn(device, members);
  if (people.length < SHARED_DEVICE_MIN_PEOPLE) {
    const alone = people[0];
    return {
      kind: 'device-closed',
      message: {
        title: `${deviceLabel(device)} needs two people`,
        body: alone
          ? `Your admin changed who uses ${deviceLabel(device)}. With only ${first(alone)} left, it can’t be shared, so ${first(alone)} goes back to their own profile — sign in on your own phone with your code. Nothing you’ve earned is lost.`
          : `Your admin took everyone off ${deviceLabel(device)}. Sign in on your own phone with your code. Nothing you’ve earned is lost.`,
      },
    };
  }
  const ids = people.map((p) => p.id);
  const same = ids.length === here.localPeople.length && ids.every((id) => here.localPeople.includes(id));
  if (same) return { kind: 'none' };
  return {
    kind: 'roster-changed',
    people: ids,
    message: {
      title: 'Your admin updated this device',
      body: `${people.map(first).join(', ')} use ${deviceLabel(device)} now. Tap your face to carry on.`,
    },
  };
}
