/**
 * Predictable Support error categories — shown as chips and attached to Resend.
 */
export const ERROR_CATEGORIES = [
  'tasks',
  'rewards',
  'calendar',
  'grocery',
  'poppins',
  'billing',
  'settings',
  'network',
  'unknown',
] as const;

export type ErrorCategory = (typeof ERROR_CATEGORIES)[number];

export const ERROR_CATEGORY_LABEL: Record<ErrorCategory, string> = {
  tasks: 'Tasks',
  rewards: 'Rewards',
  calendar: 'Calendar',
  grocery: 'Grocery',
  poppins: 'Poppins',
  billing: 'Billing',
  settings: 'Settings',
  network: 'Network',
  unknown: 'Other',
};

export function isErrorCategory(value: unknown): value is ErrorCategory {
  return typeof value === 'string' && (ERROR_CATEGORIES as readonly string[]).includes(value);
}

/** Infer a category from freeform title/message/source — never throws. */
export function inferErrorCategory(input: {
  title?: string | null;
  message?: string | null;
  source?: string | null;
}): ErrorCategory {
  const blob = `${input.title ?? ''} ${input.message ?? ''} ${input.source ?? ''}`.toLowerCase();

  if (
    blob.includes('network') ||
    blob.includes('offline') ||
    blob.includes('failed to fetch') ||
    blob.includes('non-2xx') ||
    blob.includes('edge function') ||
    blob.includes('connection')
  ) {
    return 'network';
  }
  if (
    blob.includes('token') ||
    blob.includes('credit') ||
    blob.includes('purchase') ||
    blob.includes('premium') ||
    blob.includes('billing') ||
    blob.includes('receipt') ||
    blob.includes('iap') ||
    blob.includes('storekit')
  ) {
    return 'billing';
  }
  if (
    blob.includes('poppins') ||
    blob.includes('voice') ||
    blob.includes('realtime') ||
    blob.includes('speak') ||
    blob.includes('whisper') ||
    blob.includes('luna')
  ) {
    return 'poppins';
  }
  if (
    blob.includes('grocery') ||
    blob.includes('shopping') ||
    blob.includes('shop ') ||
    blob.includes('missing item')
  ) {
    return 'grocery';
  }
  if (
    blob.includes('calendar') ||
    blob.includes('itinerary') ||
    blob.includes('trip') ||
    blob.includes('event')
  ) {
    return 'calendar';
  }
  if (
    blob.includes('reward') ||
    blob.includes('allowance') ||
    blob.includes('xp') ||
    blob.includes('trophy') ||
    blob.includes('redemption')
  ) {
    return 'rewards';
  }
  if (
    blob.includes('task') ||
    blob.includes('chore') ||
    blob.includes('proof') ||
    blob.includes('homework') ||
    blob.includes('assign') ||
    blob.includes('complete')
  ) {
    return 'tasks';
  }
  if (
    blob.includes('setting') ||
    blob.includes('household') ||
    blob.includes('invite') ||
    blob.includes('member') ||
    blob.includes('support')
  ) {
    return 'settings';
  }
  if (input.source === 'crash') return 'unknown';
  return 'unknown';
}
