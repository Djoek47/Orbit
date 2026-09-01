import type { HouseholdMember } from '@/types/orbit';

/** Active owner/admin member ids for push + inbox audience. */
export function adminMemberIds(members: HouseholdMember[]): string[] {
  return members
    .filter(
      (member) =>
        member.status === 'active' && (member.role === 'owner' || member.role === 'admin')
    )
    .map((member) => member.id);
}

/** Resolve audienceRoles to member ids (owner/admin/adult → admins + adults with userId). */
export function resolveAudienceMemberIds(
  members: HouseholdMember[],
  data?: Record<string, unknown>
): string[] {
  const explicit = data?.audienceMemberIds;
  if (Array.isArray(explicit) && explicit.length > 0) {
    return explicit.filter((id): id is string => typeof id === 'string' && id.length > 0);
  }

  const roles = data?.audienceRoles;
  if (!Array.isArray(roles) || roles.length === 0) {
    return [];
  }

  const roleSet = new Set(roles.map((role) => String(role).toLowerCase()));
  return members
    .filter((member) => {
      if (member.status !== 'active') return false;
      if (roleSet.has('owner') && member.role === 'owner') return true;
      if (roleSet.has('admin') && member.role === 'admin') return true;
      if (roleSet.has('adult') && member.role === 'adult') return true;
      if (roleSet.has('child') && member.role === 'child') return true;
      return false;
    })
    .map((member) => member.id);
}
