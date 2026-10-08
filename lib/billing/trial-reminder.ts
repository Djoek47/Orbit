/**
 * The two notifications a free trial owes the person who started it.
 *
 *   a day before   "Your free trial ends tomorrow" — Apple charges automatically when it ends,
 *                  so this is the last moment to cancel without paying. Sent whether or not
 *                  renewal is on: a charge nobody expected is the commonest complaint there is.
 *   when it ends   only if renewal was turned off — "Your free trial has ended", pointing back
 *                  to the paywall. If renewal is on, the trial simply becomes Premium and
 *                  there is nothing to say.
 *
 * Both are local notifications with fixed identifiers, so rescheduling replaces rather than
 * stacks them. Pure planning (`trialReminderPlan`) is separate from scheduling so it can be
 * tested without a phone.
 */
export const TRIAL_ENDING_ID = 'choremaxx.trial.ending';
export const TRIAL_ENDED_ID = 'choremaxx.trial.ended';

const DAY_MS = 86_400_000;

export type TrialReminder = { id: string; at: Date; title: string; body: string };

export function trialReminderPlan(input: {
  inTrial: boolean;
  endsAt: string | null;
  willRenew: boolean | null;
  priceLine: string;
  now?: Date;
}): TrialReminder[] {
  const now = input.now ?? new Date();
  if (!input.inTrial || !input.endsAt) return [];
  const end = new Date(input.endsAt);
  if (Number.isNaN(end.getTime()) || end.getTime() <= now.getTime()) return [];

  const plan: TrialReminder[] = [];
  const dayBefore = new Date(end.getTime() - DAY_MS);
  if (dayBefore.getTime() > now.getTime()) {
    plan.push({
      id: TRIAL_ENDING_ID,
      at: dayBefore,
      title: 'Your free trial ends tomorrow',
      body:
        input.willRenew === false
          ? 'After tomorrow, ChoreMaxx needs a subscription to open. Subscribe any time from Settings.'
          : `Your subscription starts automatically at ${input.priceLine}. To stop it, cancel from Subscription in ChoreMaxx settings before then.`,
    });
  }
  if (input.willRenew === false) {
    plan.push({
      id: TRIAL_ENDED_ID,
      at: end,
      title: 'Your free trial has ended',
      body: 'Your chores, XP and rewards are all still here. Open ChoreMaxx to subscribe and keep going.',
    });
  }
  return plan;
}

/** Replace any scheduled trial reminders with this plan. Best effort; never throws. */
export async function scheduleTrialReminders(plan: TrialReminder[]): Promise<void> {
  try {
    const Notifications = await import('expo-notifications');
    await Notifications.cancelScheduledNotificationAsync(TRIAL_ENDING_ID).catch(() => undefined);
    await Notifications.cancelScheduledNotificationAsync(TRIAL_ENDED_ID).catch(() => undefined);
    const permission = await Notifications.getPermissionsAsync();
    if (!permission.granted) return;
    for (const r of plan) {
      await Notifications.scheduleNotificationAsync({
        identifier: r.id,
        content: { title: r.title, body: r.body, sound: true, data: { route: '/premium?source=settings' } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: r.at },
      });
    }
  } catch (error) {
    console.warn('scheduleTrialReminders', error);
  }
}
