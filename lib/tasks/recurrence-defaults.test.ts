/**
 * lastSundayOfMonth unit checks — `npm run test:recurrence-defaults`.
 */

import { lastSundayOfMonth } from '@/lib/tasks/recurrence-defaults';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

// Month ending on Sunday (Aug 2021 → 31st is Tuesday... use known cases)
// Feb 2020 (leap) ends on Sat → last Sunday is Feb 23
{
  const d = lastSundayOfMonth(2020, 1);
  assert(d.getFullYear() === 2020 && d.getMonth() === 1 && d.getDate() === 23, 'Feb 2020 leap');
}
// Month ending on Sunday: March 2025 ends on Monday 31 → last Sunday March 30
{
  const d = lastSundayOfMonth(2025, 2);
  assert(d.getDay() === 0, 'always Sunday');
  assert(d.getDate() === 30, 'Mar 2025 last Sunday = 30');
}
// Month ending on Sunday: June 2025 ends on Monday 30 → June 29
{
  const d = lastSundayOfMonth(2025, 5);
  assert(d.getDate() === 29, 'Jun 2025 last Sunday = 29');
}
// August 2020 ends on Monday 31 → Aug 30
{
  const d = lastSundayOfMonth(2020, 7);
  assert(d.getDate() === 30 && d.getDay() === 0, 'Aug 2020');
}
// December 2023 ends on Sunday 31 → Dec 31
{
  const d = lastSundayOfMonth(2023, 11);
  assert(d.getDate() === 31 && d.getDay() === 0, 'Dec 2023 ends on Sunday');
}

console.log('test:recurrence-defaults OK');
