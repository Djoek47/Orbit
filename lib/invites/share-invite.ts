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
 * Opens the system share sheet. On iOS, `url` is the custom scheme so AirDrop
 * opens Choremaxx immediately when the app is installed. The https link stays
 * in the message for Messages / Mail / web fallback.
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
          `No account needed — open the invite on this phone.`,
          `In the app: Get Started → Child → paste the code.`,
          ``,
          `Kid invite code: ${code}`,
          `Open in app: ${appLink}`,
          `Web: ${url}`,
        ].join('\n')
      : [
          `You're invited to join ${home} on Choremaxx.`,
          ``,
          `Invite code: ${code}`,
          ``,
          `Open in Choremaxx: ${appLink}`,
          `Or tap: ${url}`,
        ].join('\n');

  const result = await Share.share(
    Platform.OS === 'ios'
      ? {
          // AirDrop / Contacts: custom scheme opens the app when installed.
          url: appLink,
          message,
        }
      : {
          message: `${message}\n${appLink}`,
          title: kind === 'kid' ? 'Choremaxx kid invite' : 'Join us on Choremaxx',
        }
  );

  if (result.action === Share.sharedAction) {
    return 'shared';
  }
  return 'dismissed';
}
