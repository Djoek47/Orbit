/**
 * Inbox + push copy when an admin changes someone else's name or picture.
 * Only ever sent for an admin acting on another person; people editing their own profile
 * are not notified.
 */
export const MEMBER_PROFILE_CHANGED_KIND = 'member_profile_changed';

export type MemberProfileChangeNotice = {
  title: string;
  body: string;
  category: 'members';
  priority: 'medium';
  data: {
    kind: typeof MEMBER_PROFILE_CHANGED_KIND;
    audienceMemberIds: string[];
    change: 'name' | 'avatar';
    changedByName: string;
    previousName?: string;
    newName?: string;
  };
};

export function memberNameChangedNotice(input: {
  memberId: string;
  adminName?: string | null;
  previousName: string;
  newName: string;
}): MemberProfileChangeNotice {
  const admin = input.adminName?.trim() || 'A household admin';
  return {
    title: 'Your name was changed',
    body: `${admin} changed your name from ${input.previousName} to ${input.newName}.`,
    category: 'members',
    priority: 'medium',
    data: {
      kind: MEMBER_PROFILE_CHANGED_KIND,
      audienceMemberIds: [input.memberId],
      change: 'name',
      changedByName: admin,
      previousName: input.previousName,
      newName: input.newName,
    },
  };
}

export function memberAvatarChangedNotice(input: {
  memberId: string;
  adminName?: string | null;
}): MemberProfileChangeNotice {
  const admin = input.adminName?.trim() || 'A household admin';
  return {
    title: 'Your picture was changed',
    body: `${admin} updated your profile picture. You can choose a new one from your profile any time.`,
    category: 'members',
    priority: 'medium',
    data: {
      kind: MEMBER_PROFILE_CHANGED_KIND,
      audienceMemberIds: [input.memberId],
      change: 'avatar',
      changedByName: admin,
    },
  };
}
