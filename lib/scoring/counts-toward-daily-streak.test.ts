import assert from 'node:assert/strict';

import { countsTowardDailyStreak, isHygieneForStreak } from '@/lib/scoring/counts-toward-daily-streak';

assert.equal(countsTowardDailyStreak({ repeat: 'Daily' }), true);
assert.equal(countsTowardDailyStreak({ repeat: 'Weekdays' }), true);
assert.equal(countsTowardDailyStreak({ repeat: 'Weekly' }), false);

// Decision B — hygiene does not feed chore daily streak
assert.equal(isHygieneForStreak({ tracking: 'streak' }), true);
assert.equal(countsTowardDailyStreak({ repeat: 'Daily', tracking: 'streak' }), false);
assert.equal(countsTowardDailyStreak({ repeat: 'Daily', category: 'Hygiene' }), false);

console.log('test:counts-toward-daily-streak OK');
