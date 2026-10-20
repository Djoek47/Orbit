import assert from 'node:assert/strict';

import { MOJI_ART } from '@/components/orbit/moji/art';
import {
  DEFAULT_HOLIDAY_PREFS,
  HOLIDAYS,
  dateKeyOf,
  easterSunday,
  holidaysBetween,
  suggestedRegions,
  type HolidayPrefs,
} from './holidays';

const on = (id: string, y: number) => dateKeyOf(HOLIDAYS.find((h) => h.id === id)!.date(y)!);

// Known dates
assert.equal(dateKeyOf(easterSunday(2026)), '2026-04-05');
assert.equal(dateKeyOf(easterSunday(2027)), '2027-03-28');
assert.equal(on('ca-thanksgiving', 2026), '2026-10-12');
assert.equal(on('us-thanksgiving', 2026), '2026-11-26');
assert.equal(on('ca-victoria-day', 2026), '2026-05-18');
assert.equal(on('ca-victoria-day', 2027), '2027-05-24');
assert.equal(on('us-memorial', 2026), '2026-05-25');
assert.equal(on('uk-mothering-sunday', 2026), '2026-03-15');
assert.equal(on('mothers-day', 2026), '2026-05-10');
assert.equal(on('fr-fete-meres', 2026), '2026-05-31');
assert.equal(on('halloween', 2026), '2026-10-31');
assert.equal(new Date(2026, 9, 31).getDay(), 6); // a Saturday

// Every holiday has a real Moji and a unique id
const ids = new Set<string>();
for (const h of HOLIDAYS) {
  assert.ok(MOJI_ART[h.moji], `${h.id} moji`);
  assert.ok(!ids.has(h.id), `duplicate ${h.id}`);
  ids.add(h.id);
}

// Defaults: global only; cultural off; fun on
const year = holidaysBetween(new Date(2026, 0, 1), new Date(2026, 11, 31), DEFAULT_HOLIDAY_PREFS);
const all = Object.values(year).flat().map((h) => h.id);
assert.ok(all.includes('halloween'));
assert.ok(!all.includes('diwali'));
assert.ok(!all.includes('ca-canada-day'));

// Regions + overrides
const ca: HolidayPrefs = { enabled: true, regions: ['global', 'canada', 'quebec'], overrides: { diwali: true, valentines: false } };
const caYear = Object.values(holidaysBetween(new Date(2026, 0, 1), new Date(2026, 11, 31), ca)).flat().map((h) => h.id);
for (const id of ['ca-canada-day', 'qc-fete-nationale', 'diwali', 'ca-thanksgiving']) assert.ok(caYear.includes(id), id);
assert.ok(!caYear.includes('valentines'));
// Boxing Day listed once even though two regions bring it
const uk: HolidayPrefs = { enabled: true, regions: ['global', 'canada', 'uk'], overrides: {} };
assert.equal(holidaysBetween(new Date(2026, 11, 26), new Date(2026, 11, 26), uk)['2026-12-26']!.length, 1);
// Off means nothing
assert.deepEqual(holidaysBetween(new Date(2026, 0, 1), new Date(2026, 11, 31), { ...ca, enabled: false }), {});

assert.deepEqual(suggestedRegions('CA', 'fr'), ['global', 'canada', 'quebec']);
assert.deepEqual(suggestedRegions('US', 'en'), ['global', 'us']);
console.log(`holidays: ${HOLIDAYS.length} defined — ok`);
