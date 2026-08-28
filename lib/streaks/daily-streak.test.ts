/**
 * Daily streak local-date + idempotency — `npm run test:daily-streak`.
 */

import { addLocalDays, formatLocalDate } from '@/lib/streaks/local-date';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

/** Pure local-date continuity check (no AsyncStorage in Node). */
function nextStreak(input: {
  lastAwardDate: string | null;
  streak: number;
  today: string;
}): { awarded: boolean; streak: number } {
  const { lastAwardDate, streak, today } = input;
  if (lastAwardDate === today) {
    return { awarded: false, streak };
  }
  const yesterday = addLocalDays(today, -1);
  const continued = lastAwardDate === yesterday;
  return { awarded: true, streak: continued ? streak + 1 : 1 };
}

const today = formatLocalDate(new Date());
assert(/^\d{4}-\d{2}-\d{2}$/.test(today), 'local date shape');

const first = nextStreak({ lastAwardDate: null, streak: 0, today });
assert(first.awarded && first.streak === 1, 'first award → 1');

const sameDay = nextStreak({ lastAwardDate: today, streak: 1, today });
assert(!sameDay.awarded && sameDay.streak === 1, 'idempotent same local day');

const yesterday = addLocalDays(today, -1);
const continued = nextStreak({ lastAwardDate: yesterday, streak: 3, today });
assert(continued.awarded && continued.streak === 4, 'continues from yesterday');

const gap = nextStreak({ lastAwardDate: addLocalDays(today, -3), streak: 9, today });
assert(gap.awarded && gap.streak === 1, 'gap resets to 1');

console.log('test:daily-streak OK');
