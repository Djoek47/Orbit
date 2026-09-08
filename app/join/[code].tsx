import { Redirect, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { stashInviteCode } from '@/lib/invite/invite-code-store';
import {
  classifyInviteCode,
  inviteHref,
  nextInviteDestination,
} from '@/lib/invites/invite-intent';
import { useOrbit } from '@/store/orbit-store';

/** Deep link entry: choremaxx://join/CODE → the right join / sign-in / kid path. */
export default function JoinCodeRedirectScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const { isLoading, isSignedIn, isPendingMember, hasHousehold } = useOrbit();
  const raw = String(code ?? '');

  useEffect(() => {
    if (raw) {
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

  const kind = classifyInviteCode(raw) ?? 'household';
  const dest = nextInviteDestination(kind, { isSignedIn, isPendingMember, hasHousehold });
  return <Redirect href={inviteHref(dest, raw || 'invite') as never} />;
}
