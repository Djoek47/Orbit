/**
 * Revision G §7.1 / §4.g — Sidekick API denials. Hiding UI is not the control.
 */

export const SIDEKICK_STORAGE_ROLE = 'child';

export type SidekickDeniedAction =
  | 'complete_others_task'
  | 'create_task'
  | 'assign_task'
  | 'edit_task'
  | 'poppins'
  | 'grocery_remove'
  | 'grocery_edit'
  | 'grocery_checkoff'
  | 'grocery_add_when_disabled'
  | 'grant_reward'
  | 'mark_reward_given'
  | 'mark_allowance_paid'
  | 'settings'
  | 'members'
  | 'invites'
  | 'subscription';

export const POPPINS_EDGE_FUNCTIONS = [
  'poppins-briefing',
  'poppins-chat',
  'poppins-voice',
  'poppins-monitor',
  'poppins-notify',
  'poppins-realtime-session',
  'poppins-realtime-sdp',
  'poppins-voice-tool',
] as const;

export function isSidekickRole(role: string | null | undefined): boolean {
  return role === 'child' || role === 'sidekick';
}

export function sidekickForbiddenStatus(role: string | null | undefined, action: SidekickDeniedAction): 403 | null {
  if (!isSidekickRole(role)) return null;
  return 403;
}

export function groceryAddAllowedForSidekick(opts: {
  role: string | null | undefined;
  householdAllows: boolean;
}): boolean {
  if (!isSidekickRole(opts.role)) return true;
  return opts.householdAllows;
}

/**
 * Sidekicks never get Poppins — no tab, no Speak, no Base, no typing. This is deliberately not a
 * household setting: the admin decision is that AI is for the grown-ups only. The old
 * `householdAllows` / `sidekickPoppinsAi` inputs are still accepted so existing callers compile,
 * but they no longer change the answer.
 */
export function poppinsAiAllowedForSidekick(opts: {
  role: string | null | undefined;
  householdAllows?: boolean;
}): boolean {
  return !isSidekickRole(opts.role);
}

/** True when this member should see the Poppins tab / Speak entry. */
export function canShowPoppinsTab(opts: {
  role: string | null | undefined;
  sidekickPoppinsAi?: boolean;
}): boolean {
  return !isSidekickRole(opts.role);
}
