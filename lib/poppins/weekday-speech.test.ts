/**
 * "Friday" vs "next Friday" — the two must agree with the calendar parser, and the answer
 * must not depend on which day the test runs (this used to break every Saturday).
 */
import assert from 'node:assert/strict';

import { nextDateForWeekday } from '@/lib/poppins/ui-speech';

const TUESDAY = new Date(2026, 8, 29, 10); // Tue 29 Sep 2026
const THURSDAY = new Date(2026, 9, 1, 10); // Thu 1 Oct 2026

// The coming one.
assert.equal(nextDateForWeekday('thursday', { now: TUESDAY }), '2026-10-01');
// "next" means the week after.
assert.equal(nextDateForWeekday('thursday', { next: true, now: TUESDAY }), '2026-10-08');
// Said on the day itself, it means today.
assert.equal(nextDateForWeekday('thursday', { now: THURSDAY }), '2026-10-01');
// …and "next Thursday" on a Thursday is a week out.
assert.equal(nextDateForWeekday('thursday', { next: true, now: THURSDAY }), '2026-10-08');
// Wrapping backwards over the weekend.
assert.equal(nextDateForWeekday('monday', { now: TUESDAY }), '2026-10-05');

console.log('weekday-speech: ok');
