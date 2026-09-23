/**
 * Registry of all 15 ChoreMaxx transactional email templates. Import a
 * specific module (e.g. `./verification`) to send; this file exists so the
 * smoke test and future wiring code can iterate every template by name.
 */
import * as emailChanged from './email-changed';
import * as householdInvite from './household-invite';
import * as magicLink from './magic-link';
import * as paymentFailed from './payment-failed';
import * as paymentReceipt from './payment-receipt';
import * as passwordReset from './password-reset';
import * as securityAlert from './security-alert';
import * as subscriptionCancelled from './subscription-cancelled';
import * as subscriptionStarted from './subscription-started';
import * as taskAssigned from './task-assigned';
import * as taskCompleted from './task-completed';
import * as trialEnding from './trial-ending';
import * as verification from './verification';
import * as weeklySummary from './weekly-summary';
import * as welcome from './welcome';

export type WiredStatus = 'wired' | 'todo';

/** Whether each template already has a live sending path (`docs/email-templates.md`). */
export const EMAIL_REGISTRY: {
  id: string;
  name: string;
  status: WiredStatus;
  module: { _module: unknown };
}[] = [
  { id: 'verification', name: 'Email Verification', status: 'wired', module: verification },
  { id: 'welcome', name: 'Welcome', status: 'todo', module: welcome },
  { id: 'password-reset', name: 'Password Reset', status: 'wired', module: passwordReset },
  { id: 'magic-link', name: 'Magic Login Link', status: 'wired', module: magicLink },
  { id: 'household-invite', name: 'Household Invitation', status: 'todo', module: householdInvite },
  { id: 'task-assigned', name: 'Task Assigned', status: 'todo', module: taskAssigned },
  { id: 'task-completed', name: 'Task Completed', status: 'todo', module: taskCompleted },
  { id: 'weekly-summary', name: 'Weekly Household Summary', status: 'todo', module: weeklySummary },
  { id: 'subscription-started', name: 'Subscription Started', status: 'todo', module: subscriptionStarted },
  { id: 'payment-receipt', name: 'Payment Receipt', status: 'todo', module: paymentReceipt },
  { id: 'payment-failed', name: 'Payment Failed', status: 'todo', module: paymentFailed },
  {
    id: 'subscription-cancelled',
    name: 'Subscription Cancelled',
    status: 'todo',
    module: subscriptionCancelled,
  },
  { id: 'trial-ending', name: 'Trial Ending', status: 'todo', module: trialEnding },
  { id: 'security-alert', name: 'Security Alert', status: 'todo', module: securityAlert },
  { id: 'email-changed', name: 'Email Changed', status: 'wired', module: emailChanged },
];
