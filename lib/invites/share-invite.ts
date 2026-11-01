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
          childName ? `${childName} — join ${home} on Choremaxx.` : `Join ${home} on Choremaxx.`,
          `Code: ${code}`,
          appLink,
        ].join('\n')
      : [`Join ${home} on Choremaxx.`, `Code: ${code}`, appLink, url].join('\n');

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
