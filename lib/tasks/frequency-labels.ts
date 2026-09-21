import type { Frequency } from '@/lib/tasks/task-library';

/** Display labels for library frequencies (Rev F §10.2). */
export const FREQUENCY_LABELS: Record<string, string> = {
  daily: 'Daily',
  weekdays: 'Weekdays',
  weekly: 'Weekly',
  monthly: 'Monthly',
  '2x_weekly': 'Twice a week',
  biweekly: 'Every two weeks',
  quarterly: 'Quarterly',
  seasonal: 'Seasonal',
  as_needed: 'As needed',
  none: 'None',
};

export const PRIMARY_FREQUENCIES = ['daily', 'weekly', 'monthly'] as const;

export const MORE_FREQUENCIES = [
  'weekdays',
  '2x_weekly',
  'biweekly',
  'quarterly',
  'seasonal',
  'as_needed',
] as const;

export function frequencyLabel(freq: Frequency | string | undefined): string {
  if (!freq) return 'Daily';
  return FREQUENCY_LABELS[freq] ?? 'Daily';
}

export function isMoreFrequency(freq: string): boolean {
  return (MORE_FREQUENCIES as readonly string[]).includes(freq);
}
