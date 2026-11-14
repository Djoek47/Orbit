/**
 * Poppins → How it works (the screen). The player itself lives in
 * components/orbit/poppins/how-it-works-player so the tour can play it in place.
 */
import { Redirect, router, Stack } from 'expo-router';
import { View } from 'react-native';

import { HowItWorksPlayer } from '@/components/orbit/poppins/how-it-works-player';
import { isSidekickRole } from '@/lib/sidekick/permissions';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useOrbit } from '@/store/orbit-store';

/** Sidekicks never get Poppins — any way in (a link, a notification, a stale tab) lands on Home. */
export default function PoppinsHowItWorksScreen() {
  const { currentMember } = useOrbit();
  const { c } = useOrbitColors();
  if (isSidekickRole(currentMember?.role)) {
    return <Redirect href={'/(tabs)' as never} />;
  }
  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <Stack.Screen options={{ headerShown: false }} />
      <HowItWorksPlayer
        onClose={() => router.back()}
        onTry={() => router.navigate('/(tabs)/poppins' as never)}
      />
    </View>
  );
}
