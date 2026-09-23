import { Share } from 'react-native';

import type { InviteLinks } from '@/types/orbit';

export function buildInviteShareMessage(links: InviteLinks, householdName?: string) {
  const home = householdName?.trim() || 'our Orbit household';
  return `Join ${home} on Orbit\n\nInvite code: ${links.code}\n\nOpen: ${links.deepLink}\nor ${links.webLink}`;
}

/** System share sheet — Messages, AirDrop, Mail, etc. */
export async function shareInviteLinks(links: InviteLinks, householdName?: string) {
  const message = buildInviteShareMessage(links, householdName);
  return Share.share({
    message,
    title: 'Join our Orbit household',
    url: links.deepLink,
  });
}
