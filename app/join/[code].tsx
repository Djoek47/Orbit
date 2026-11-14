import { Redirect, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { stashInviteCode } from '@/lib/invite/invite-code-store';
import { routeInvitePayload } from '@/lib/invites/route-invite-payload';
import { useOrbit } from '@/store/orbit-store';

/** Deep link entry: choremaxx://join/CODE → the right join / sign-in / kid path. */
export default function JoinCodeRedirectScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const { isLoading, isSignedIn, isPendingMember, hasHousehold } = useOrbit();
  const raw = String(code ?? '');

  useEffect(() => {
    if (!raw) return;
    // Shared-device URLs are multi-param; only stash simple CMX codes.
    if (!raw.includes('shared-device') && !raw.includes('://')) {
      void stashInviteCode(raw);
    }
  }, [raw]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  const routed = routeInvitePayload(raw || 'invite', {
    isSignedIn,
    isPendingMember,
    hasHousehold,
  });
  return <Redirect href={(routed?.href ?? '/welcome') as never} />;
}
