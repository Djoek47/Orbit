import { useEffect } from 'react';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';

import { parseInviteCodeFromUrl } from '@/lib/invite/deep-links';
import { stashInviteCode } from '@/lib/invite/invite-code-store';
import { useOrbit } from '@/store/orbit-store';

async function handleInviteUrl(url: string, isSignedIn: boolean) {
  const code = parseInviteCodeFromUrl(url);
  if (!code) {
    return;
  }

  await stashInviteCode(code);

  if (isSignedIn) {
    router.push(`/join-household?code=${encodeURIComponent(code)}` as never);
    return;
  }

  router.push('/welcome' as never);
}

/** Listens for orbit://join/CODE and https://orbit.app/join/CODE deep links. */
export function useDeepLinkInvite() {
  const { isSignedIn } = useOrbit();

  useEffect(() => {
    let mounted = true;

    Linking.getInitialURL()
      .then((url) => {
        if (mounted && url) {
          void handleInviteUrl(url, isSignedIn);
        }
      })
      .catch(() => undefined);

    const subscription = Linking.addEventListener('url', ({ url }) => {
      void handleInviteUrl(url, isSignedIn);
    });

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, [isSignedIn]);
}
