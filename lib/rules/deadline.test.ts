import assert from 'node:assert/strict';

import { getHouseRulesDoc } from '@/lib/rules/house-rules-data';
import {
  deadlinePickerValues,
  isValidDailyDeadline,
  queueDailyDeadlineChange,
} from '@/lib/rules/deadline';

const doc = getHouseRulesDoc();
const values = deadlinePickerValues(doc);

assert.equal(values[0], '15:00');
assert.equal(values[values.length - 1], '23:59');
assert.ok(isValidDailyDeadline('23:59', doc));
assert.ok(isValidDailyDeadline('19:00', doc));
assert.ok(!isValidDailyDeadline('00:00', doc));
assert.ok(!isValidDailyDeadline('24:00', doc));

try {
  queueDailyDeadlineChange('14:30', new Date(2026, 7, 13), doc);
  assert.fail('expected invalid deadline to throw');
} catch (error) {
  assert.match(String(error), /between 15:00 and 23:59/);
}

console.log('deadline.test.ts ok');
