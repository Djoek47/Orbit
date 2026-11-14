import type { HouseholdEvent, MemberCapabilities } from '@/types/orbit';
import { isSidekickRole } from '@/lib/sidekick/permissions';

export function isEventApproved(event: HouseholdEvent): boolean {
  return event.approvalStatus !== 'pending';
}

export function isEventPending(event: HouseholdEvent): boolean {
  return event.approvalStatus === 'pending';
}

/** Sidekick calendar rows (school, practice, etc.) may require admin approval. Homework uses tasks. */
export function sidekickEventNeedsApproval(
  caps: Pick<MemberCapabilities, 'requireSidekickEventApproval'>,
  category?: HouseholdEvent['category']
): boolean {
  if (caps.requireSidekickEventApproval === false) return false;
  const value = category ?? 'Family';
  return value === 'School' || value === 'Activity' || value === 'Appointment' || value === 'Family';
}

export function resolveEventApprovalStatus(opts: {
  actorRole: string | null | undefined;
  caps: MemberCapabilities;
  category?: HouseholdEvent['category'];
  explicit?: HouseholdEvent['approvalStatus'];
}): HouseholdEvent['approvalStatus'] {
  if (opts.explicit) return opts.explicit;
  if (!isSidekickRole(opts.actorRole)) return 'approved';
  return sidekickEventNeedsApproval(opts.caps, opts.category) ? 'pending' : 'approved';
}

export function pendingEventsForAdmin(events: HouseholdEvent[]): HouseholdEvent[] {
  return events.filter(isEventPending);
}
