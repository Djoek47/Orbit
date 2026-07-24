import { Platform, Share } from 'react-native';

import { buildInviteLinks } from '@/lib/invites/parse-invite';

type ShareInviteInput = {
  householdName?: string;
  inviteCode: string;
  deepLink?: string;
  webLink?: string;
  /** Kid profile invites skip account creation — parent already owns the household. */
  kind?: 'household' | 'kid';
  childName?: string;
};

/**
 * Opens the system share sheet. On iOS this surfaces AirDrop for nearby people.
 */
export async function shareInvite({
  householdName,
  inviteCode,
  deepLink,
  webLink,
  kind = 'household',
  childName,
}: ShareInviteInput): Promise<'shared' | 'dismissed'> {
  const links = buildInviteLinks(inviteCode);
  const code = links.code;
  const url = webLink || links.webLink;
  const appLink = deepLink || links.deepLink;
  const home = householdName?.trim() || 'our household';

  const message =
    kind === 'kid'
      ? [
          childName
            ? `${childName}, you're invited to ${home} on Choremaxx.`
            : `You're invited to ${home} on Choremaxx.`,
          ``,
          `No sign-in needed — open this invite on your phone.`,
          `In the app: Get Started → Child → paste this code.`,
          ``,
          `Kid invite code: ${code}`,
          `Open: ${url}`,
          Platform.OS === 'ios' ? `Or AirDrop / open: ${appLink}` : `Or open in Choremaxx: ${appLink}`,
        ].join('\n')
      : [
          `You're invited to join ${home} on Choremaxx.`,
          ``,
          `Invite code: ${code}`,
          `Open: ${url}`,
          Platform.OS === 'ios' ? `Or AirDrop / open: ${appLink}` : `Or open in Choremaxx: ${appLink}`,
        ].join('\n');

  const result = await Share.share(
    Platform.OS === 'ios'
      ? { message, url }
      : {
          message,
          title: kind === 'kid' ? 'Choremaxx kid invite' : 'Join us on Choremaxx',
        },
  );

  if (result.action === Share.sharedAction) {
    return 'shared';
  }
  return 'dismissed';
}
