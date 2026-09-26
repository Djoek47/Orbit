/**
 * Homework sentences → the card. Titles are what was said; never a library chore's title.
 * Run: npx --yes tsx lib/poppins/homework-parse.test.ts
 */
import assert from 'node:assert/strict';

import {
  isHomeworkDoneUtterance,
  isHomeworkUtterance,
  parseHomeworkUtterance,
} from '@/lib/poppins/homework-parse';

const NOW = new Date(2026, 8, 25, 10, 0); // Fri 25 Sep 2026
const MEMBERS = ['Mia', 'Noah', 'Yuhi'];
const hw = (s: string) => parseHomeworkUtterance(s, MEMBERS, NOW);

type Want = Partial<ReturnType<typeof parseHomeworkUtterance>>;
const cases: Array<[string, Want]> = [
  ['Mia has math homework due tomorrow', { title: 'Math homework', subject: 'Math', assignee: 'Mia', due: 'Tomorrow', repeat: 'None' }],
  ['give Mia her science worksheet due thursday', { title: 'Science worksheet', subject: 'Science', assignee: 'Mia', due: 'Thursday' }],
  ['Noah needs to read chapter 5 by Monday', { title: 'Read chapter 5', subject: 'Reading', assignee: 'Noah', due: 'Monday' }],
  ['assign reading homework to Noah for Friday', { title: 'Reading homework', subject: 'Reading', assignee: 'Noah', due: 'Today' }],
  ['assign reading homework to Noah for Wednesday', { title: 'Reading homework', due: 'Wednesday' }],
  ['Yuhi has a history project due October 12', { title: 'History project', subject: 'History', assignee: 'Yuhi', due: '2026-10-12' }],
  ['Noah should study for the spelling test tomorrow', { title: 'Study for the spelling test', subject: 'English', assignee: 'Noah', due: 'Tomorrow' }],
  ['math homework for Mia every weekday', { title: 'Math homework', repeat: 'Weekdays', assignee: 'Mia' }],
  ['homework for Mia tonight, one-off, with a photo when it is done', { title: 'Homework', due: 'Today', repeat: 'None', proof: true }],
  ['Yuhi has her spelling words this week', { title: 'Spelling words', subject: 'English', due: 'This week' }],
  ['devoirs de maths pour Mia demain', { subject: 'Math', assignee: 'Mia' }],
];
for (const [input, want] of cases) {
  const got = hw(input) as Record<string, unknown>;
  for (const [key, value] of Object.entries(want)) {
    assert.deepEqual(got[key], value, `${input} → ${key}: got ${JSON.stringify(got[key])}, want ${JSON.stringify(value)}`);
  }
}

for (const s of [
  'Mia has math homework due tomorrow',
  'give Mia her science worksheet due thursday',
  'Noah needs to read chapter 5 by Monday',
  'Yuhi has a history project due October 12',
  'study for the spelling test',
]) assert.equal(isHomeworkUtterance(s), true, `homework: ${s}`);
for (const s of [
  'clean the dishes for Mia',
  'add milk to the list',
  'dentist for Noah next Thursday at half four',
  'I finished my math homework',
]) assert.equal(isHomeworkUtterance(s), false, `not a new assignment: ${s}`);

assert.equal(isHomeworkDoneUtterance('I finished my math homework'), true);
assert.equal(isHomeworkDoneUtterance("I'm done with my reading"), true);
assert.equal(isHomeworkDoneUtterance('I finished the dishes'), false);

console.log(`homework-parse: ${cases.length} sentences — ok`);
