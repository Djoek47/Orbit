import assert from 'node:assert/strict';

import { formatTime12, friendlyDay, parseWhen, stripWhen } from '@/lib/poppins/when-parse';

// Friday 25 September 2026, 10:00.
const NOW = new Date(2026, 8, 25, 10, 0);
const w = (s: string) => parseWhen(s, NOW);

const cases: Array<[string, Partial<ReturnType<typeof parseWhen>>]> = [
  ['dentist for Noah next Thursday at half four', { date: '2026-10-01', time: '16:30' }],
  ['put soccer practice on the calendar saturday at 10', { date: '2026-09-26', time: '10:00' }],
  ['add dentist appointment tomorrow at 3pm', { date: '2026-09-26', time: '15:00' }],
  ['piano lesson monday from 4 to 5:30', { date: '2026-09-28', time: '16:00', endTime: '17:30' }],
  ['doctor on the 14th at noon', { date: '2026-10-14', time: '12:00' }],
  ['parent teacher night october 2nd at 7pm', { date: '2026-10-02', time: '19:00' }],
  ['school trip 2 october', { date: '2026-10-02' }],
  ['swim tonight at 7', { date: '2026-09-25', time: '19:00' }],
  ['haircut today at quarter past two', { date: '2026-09-25', time: '14:15' }],
  ['vet friday at quarter to five', { date: '2026-09-25', time: '16:45' }],
  ['réunion demain à 16h30', { date: '2026-09-26', time: '16:30' }],
  ['dentiste jeudi prochain à 9h', { date: '2026-10-01', time: '09:00' }],
  ['movie in 3 days at 8 pm', { date: '2026-09-28', time: '20:00' }],
  ['yoga the day after tomorrow at 9 in the morning', { date: '2026-09-27', time: '09:00' }],
  ['meeting tomorrow at 2 for an hour', { date: '2026-09-26', time: '14:00', endTime: '15:00' }],
  ['family dinner sunday', { date: '2026-09-27' }],
  ['fair all day saturday', { date: '2026-09-26', allDay: true }],
  ['soccer saturday 10am for 1 hour', { date: '2026-09-26', time: '10:00', endTime: '11:00', durationMin: 60 }],
  ['mia piano 6-7', { time: '18:00', endTime: '19:00' }],
  ['swim class 4-5pm tuesday', { date: '2026-09-29', time: '16:00', endTime: '17:00' }],
  ['study group for 2 hours tomorrow at 3', { date: '2026-09-26', time: '15:00', endTime: '17:00' }],
];

for (const [input, expected] of cases) {
  const got = w(input);
  for (const [key, value] of Object.entries(expected)) {
    assert.equal(
      (got as Record<string, unknown>)[key],
      value,
      `${input} → ${key}: got ${JSON.stringify((got as Record<string, unknown>)[key])}, want ${JSON.stringify(value)}`
    );
  }
}

// Guessing is flagged so the card can offer AM/PM.
assert.equal(w('practice saturday at 10').timeGuessed, true);
assert.equal(w('practice saturday at 10am').timeGuessed, undefined);
// Counts are not times.
assert.equal(w('buy 3 apples').time, undefined);
assert.equal(w('pick up 2 kids at 4').time, '16:00');
// Titles come out clean.
assert.equal(stripWhen('dentist for Noah next Thursday at half four', w('dentist for Noah next Thursday at half four')), 'dentist for noah');
assert.equal(stripWhen('soccer practice saturday at 10', w('soccer practice saturday at 10')), 'soccer practice');
assert.equal(stripWhen('piano lesson monday from 4 to 5:30', w('piano lesson monday from 4 to 5:30')), 'piano lesson');

assert.equal(stripWhen('soccer saturday 10am for 1 hour', w('soccer saturday 10am for 1 hour')), 'soccer');
assert.equal(formatTime12('16:30'), '4:30 PM');
assert.equal(formatTime12('09:00', { compact: true }), '9 AM');
assert.equal(friendlyDay('2026-09-26', NOW), 'Tomorrow');
assert.equal(friendlyDay('2026-10-01', NOW), 'Thursday');

console.log(`when-parse: ${cases.length} phrases — ok`);
