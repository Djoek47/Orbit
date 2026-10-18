import { useEffect } from 'react';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';

import {
  parseInviteCodeFromUrl,
  parseMemberInviteTokenFromUrl,
  parseSharedDeviceInviteFromUrl,
} from '@/lib/invite/deep-links';
import { parseHouseholdTransferTokenFromUrl } from '@/lib/household/household-transfer';
import { stashInviteCode } from '@/lib/invite/invite-code-store';
import { stashMemberInviteToken } from '@/lib/invite/member-invite-token-store';
import {
  classifyInviteCode,
  inviteHref,
  nextInviteDestination,
} from '@/lib/invites/invite-intent';
import { useOrbit } from '@/store/orbit-store';

async function handleInviteUrl(
  url: string,
  session: { isSignedIn: boolean; isPendingMember: boolean; hasHousehold: boolean }
) {
  const sharedDevicePayload = parseSharedDeviceInviteFromUrl(url);
  if (sharedDevicePayload) {
    router.replace(
      `/join-shared-device?payload=${encodeURIComponent(sharedDevicePayload)}` as never
    );
    return;
  }

  const transferToken = parseHouseholdTransferTokenFromUrl(url);
  if (transferToken) {
    router.replace(
      `/accept-household-transfer?token=${encodeURIComponent(transferToken)}` as never
    );
    return;
  }

  const memberToken = parseMemberInviteTokenFromUrl(url);
  if (memberToken) {
    await stashMemberInviteToken(memberToken);
    router.replace(`/redeem-member-invite?token=${encodeURIComponent(memberToken)}` as never);
    return;
  }

  const code = parseInviteCodeFromUrl(url);
  if (!code) {
    return;
  }

  await stashInviteCode(code);
  const kind = classifyInviteCode(code) ?? 'household';
  const dest = nextInviteDestination(kind, session);
  router.replace(inviteHref(dest, code) as never);
}

/** Listens for choremaxx://join/CODE and https://www.choremaxx.app/join/CODE. */
export function useDeepLinkInvite() {
  const { isSignedIn, isPendingMember, hasHousehold } = useOrbit();

  useEffect(() => {
    let mounted = true;
    const session = { isSignedIn, isPendingMember, hasHousehold };

    Linking.getInitialURL()
      .then((url) => {
        if (mounted && url) {
          void handleInviteUrl(url, session);
        }
      })
      .catch(() => undefined);

    const subscription = Linking.addEventListener('url', ({ url }) => {
      void handleInviteUrl(url, session);
    });

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, [hasHousehold, isPendingMember, isSignedIn]);
}
