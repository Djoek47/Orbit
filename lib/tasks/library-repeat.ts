import type { Frequency } from '@/lib/tasks/task-library';

/**
 * Map library frequency onto the four store repeat values.
 * Monthly / quarterly / seasonal / as-needed must not become Weekly
 * (that made catch-up invent fake Sundays).
 */
export function mapLibraryRepeat(freq: Frequency | string): 'None' | 'Daily' | 'Weekly' | 'Weekdays' {
  if (freq === 'daily') return 'Daily';
  if (freq === 'weekdays') return 'Weekdays';
  if (freq === 'weekly' || freq === '2x_weekly' || freq === 'biweekly') return 'Weekly';
  return 'None';
}
