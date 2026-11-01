import assert from 'node:assert/strict';

import { isEventUtterance, parseEventUtterance } from '@/lib/poppins/event-parse';

const NOW = new Date(2026, 8, 25, 10, 0); // Fri 25 Sep 2026
const MEMBERS = ['Noah', 'Mia', 'Ama'];
const PLACES = ['Parc Jarry', 'School', 'Clinique Papineau'];
const opts = { memberNames: MEMBERS, placeNames: PLACES, now: NOW };
const ev = (s: string) => parseEventUtterance(s, opts);

type Want = Partial<ReturnType<typeof parseEventUtterance>>;
const cases: Array<[string, Want]> = [
  ['dentist for Noah next Thursday at half four', { title: 'Dentist', who: 'Noah', date: '2026-10-01', time: '16:30', endTime: '17:15' }],
  ['put soccer practice on the calendar saturday at 10 at Parc Jarry', { title: 'Soccer practice', date: '2026-09-26', time: '10:00', endTime: '11:30', location: 'Parc Jarry' }],
  ['Mia has piano monday from 4 to 5', { title: 'Piano', who: 'Mia', date: '2026-09-28', time: '16:00', endTime: '17:00' }],
  ["add Noah's doctor appointment tomorrow at 3pm", { title: 'Doctor', who: 'Noah', date: '2026-09-26', time: '15:00' }],
  ['schedule a parent teacher meeting october 2nd at 7pm at School', { title: 'Parent teacher meeting', date: '2026-10-02', time: '19:00', location: 'School' }],
  ['book a haircut for me friday at noon', { title: 'Haircut', date: '2026-09-25', time: '12:00' }],
  ['family dinner sunday at 6 with Ama', { title: 'Family dinner', date: '2026-09-27', time: '18:00', withWho: ['Ama'] }],
  ['birthday party saturday all day', { title: 'Birthday party', date: '2026-09-26', allDay: true }],
  ['vet appointment for the dog next tuesday at 9 and remind me', { title: 'Vet for the dog', date: '2026-09-29', time: '09:00', remind: true }],
  ['dentiste pour Noah jeudi prochain à 16h30', { title: 'Dentiste', who: 'Noah', date: '2026-10-01', time: '16:30' }],
  ['swim class 4-5pm tuesday at the Y', { title: 'Swim class', date: '2026-09-29', time: '16:00', endTime: '17:00', location: 'Y' }],
];
for (const [input, want] of cases) {
  const got = ev(input) as Record<string, unknown>;
  for (const [key, value] of Object.entries(want)) {
    assert.deepEqual(got[key], value, `${input} → ${key}: got ${JSON.stringify(got[key])}, want ${JSON.stringify(value)}`);
  }
}

// What is and isn't a calendar sentence.
const yes = [
  'dentist for Noah next Thursday at half four',
  'put soccer practice on the calendar saturday at 10',
  'Mia has piano monday from 4 to 5',
  'schedule a call with the plumber tomorrow at 9',
  "Noah's thing thursday at 4",
];
const no = [
  'clean the dishes for Mia',
  'take out the trash tomorrow at 6',
  'add milk and eggs',
  'we need bread',
  'practice, then work, shopping on my break, back to work, gym, then pick up the kids',
  'wash the car saturday',
];
for (const s of yes) assert.equal(isEventUtterance(s, opts), true, `should be an event: ${s}`);
for (const s of no) assert.equal(isEventUtterance(s, opts), false, `should not be an event: ${s}`);

console.log(`event-parse: ${cases.length} sentences, ${yes.length + no.length} classifications — ok`);
