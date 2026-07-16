import { Redirect, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { stashInviteCode } from '@/lib/invite/invite-code-store';
import { useOrbit } from '@/store/orbit-store';

/** Deep link entry: orbit://join/CODE → stash code and route into join flow. */
export default function JoinCodeRedirectScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const { isLoading, isSignedIn } = useOrbit();

  useEffect(() => {
    if (code) {
      void stashInviteCode(String(code));
    }
  }, [code]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!isSignedIn) {
    return <Redirect href="/welcome" />;
  }

  return <Redirect href={`/join-household?code=${encodeURIComponent(String(code ?? ''))}` as never} />;
}
