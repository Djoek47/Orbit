import assert from 'node:assert/strict';
import type { HouseholdMember } from '@/types/orbit';
import {
  canShareDevice, cannotAdd, deviceStatusLine, deviceTransition, isDeviceLive, liveDeviceFor,
  onLiveDeviceIds, planAdd, planRemove, withLinks,
} from './shared-device-rules';

const m = (id: string, name: string, role: HouseholdMember['role'], status: HouseholdMember['status'] = 'active', links?: string[]) =>
  ({ id, name, role, status, avatar: '', xp: 0, loadShare: 0, sharedWithMemberIds: links }) as HouseholdMember;

const owner = m('o', 'Ci', 'owner');
const john = m('j', 'John', 'child');
const jenny = m('y', 'Jenny', 'child', 'invited');
const emilie = m('e', 'Emilie', 'child', 'invited');
const ipad = m('d1', 'Test iPad', 'shared-device', 'active', []);
const kitchen = m('d2', 'Kitchen iPad', 'shared-device', 'active', []);
let hh = [owner, john, jenny, emilie, ipad, kitchen];
const apply = (plan: ReturnType<typeof planAdd>) => {
  assert.ok(!('blocked' in plan), 'blocked: ' + JSON.stringify(plan));
  hh = withLinks(hh, (plan as { links: Record<string, string[]> }).links);
  return plan as { notes: { title: string; body: string }[] };
};

// Invited (never signed in) Sidekicks can be added — the old "share to finish" wall is gone.
assert.equal(canShareDevice(jenny), true);
assert.equal(cannotAdd(jenny, ipad, hh), null);
// Admins can't, with a reason.
assert.match(cannotAdd(owner, ipad, hh)!.title, /Admins keep their own phone/);

// One person: waiting, and she stays a Sidekick.
let notes = apply(planAdd('y', 'd1', hh)).notes;
assert.match(notes.at(-1)!.title, /needs one more person/);
assert.equal(isDeviceLive(hh.find((x) => x.id === 'd1'), hh), false);
assert.equal(liveDeviceFor('y', hh), undefined, 'Jenny keeps her own profile while it waits');
assert.equal(onLiveDeviceIds(hh).size, 0);
assert.match(deviceStatusLine(hh.find((x) => x.id === 'd1')!, hh), /Waiting for a second person/);

// Second person: ready; both leave the Sidekicks list.
notes = apply(planAdd('e', 'd1', hh)).notes;
assert.match(notes.at(-1)!.title, /is ready/);
assert.deepEqual([...onLiveDeviceIds(hh)].sort(), ['e', 'y']);

// One device at a time: moving Emilie to the kitchen leaves Test iPad waiting.
notes = apply(planAdd('e', 'd2', hh)).notes;
assert.match(notes[0]!.title, /moved to Kitchen iPad/);
assert.ok(notes.some((n) => /Test iPad needs one more person/.test(n.title)));
assert.deepEqual(hh.find((x) => x.id === 'd1')!.sharedWithMemberIds, ['y']);

// Back to two, then remove one: the other goes back to being a Sidekick.
apply(planAdd('e', 'd1', hh));
apply(planAdd('j', 'd1', hh));
const rm = planRemove('j', 'd1', hh);
assert.match(rm.notes[0]!.title, /John is a Sidekick again/);
hh = withLinks(hh, rm.links);

// ── On the kids' devices ──
// John's own phone: he's on a live device → sign out with a message.
apply(planAdd('j', 'd1', hh));
let t = deviceTransition({ kind: 'personal', memberId: 'j' }, hh);
assert.equal(t.kind, 'moved-to-shared');
// The tablet: people changed → picker refresh.
t = deviceTransition({ kind: 'shared', deviceId: 'd1', localPeople: ['y', 'e'] }, hh);
assert.equal(t.kind, 'roster-changed');
// Unchanged → nothing.
t = deviceTransition({ kind: 'shared', deviceId: 'd1', localPeople: ['y', 'e', 'j'] }, hh);
assert.equal(t.kind, 'none');
// Down to one → the tablet closes, the last person goes back to their own profile.
hh = withLinks(hh, { d1: ['y'] });
t = deviceTransition({ kind: 'shared', deviceId: 'd1', localPeople: ['y', 'e'] }, hh);
assert.equal(t.kind, 'device-closed');
assert.match((t as { message: { body: string } }).message.body, /only Jenny left/);
// Device removed → closes.
t = deviceTransition({ kind: 'shared', deviceId: 'gone', localPeople: [] }, hh);
assert.equal(t.kind, 'device-closed');
// A personal phone whose kid is on a waiting device: nothing (they keep their profile).
t = deviceTransition({ kind: 'personal', memberId: 'y' }, hh);
assert.equal(t.kind, 'none');
console.log('shared-device-rules: ok');
