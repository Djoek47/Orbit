import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { DeepLinkBridge } from '@/components/orbit/deep-link-bridge';
import { OrbitChromeBridge } from '@/components/orbit/orbit-chrome-bridge';
import { OrbitNavTheme } from '@/components/orbit/orbit-nav-theme';
import { BRICOLAGE_FONT_MAP } from '@/constants/bricolage-font-assets';
import { OrbitProvider } from '@/store/orbit-store';

export const unstable_settings = {
  anchor: 'index',
};

SplashScreen.preventAutoHideAsync().catch(() => {
  /* already prevented / native splash absent in some hosts */
});

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(BRICOLAGE_FONT_MAP);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync().catch(() => undefined);
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <OrbitProvider>
      <OrbitNavTheme>
        <DeepLinkBridge />
        <OrbitChromeBridge />
        <Stack>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="join/[code]" options={{ headerShown: false }} />
          <Stack.Screen name="pending-approval" options={{ headerShown: false, title: 'Pending Approval' }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="welcome" options={{ headerShown: false }} />
          <Stack.Screen name="onboarding" options={{ headerShown: false }} />
          <Stack.Screen name="sign-in" options={{ headerShown: false, title: 'Sign In' }} />
          <Stack.Screen name="sign-up" options={{ headerShown: false, title: 'Create Account' }} />
          <Stack.Screen
            name="confirm-email"
            options={{ headerShown: false, title: 'Confirm Email' }}
          />
          <Stack.Screen
            name="delete-account"
            options={{ presentation: 'modal', headerShown: false, title: 'Delete Account' }}
          />
          <Stack.Screen
            name="premium"
            options={{ headerShown: false, title: 'Premium' }}
          />
          <Stack.Screen
            name="auth/callback"
            options={{ headerShown: false, title: 'Confirming' }}
          />
          <Stack.Screen name="forgot-password" options={{ headerShown: false, title: 'Reset Password' }} />
          <Stack.Screen name="create-profile" options={{ headerShown: false, title: 'Create Profile' }} />
          <Stack.Screen name="household-setup" options={{ headerShown: false, title: 'Household' }} />
          <Stack.Screen
            name="create-household"
            options={{ presentation: 'modal', headerShown: false, title: 'Create Household' }}
          />
          <Stack.Screen
            name="join-household"
            options={{ presentation: 'modal', headerShown: false, title: 'Join Household' }}
          />
          <Stack.Screen
            name="invite-household"
            options={{ presentation: 'modal', headerShown: false, title: 'Add New Member' }}
          />
          <Stack.Screen name="household-members" options={{ presentation: 'modal', title: 'Members' }} />
          <Stack.Screen
            name="select-profile"
            options={{ headerShown: false, title: 'Who is logging in' }}
          />
          <Stack.Screen
            name="setup-kid-device"
            options={{ presentation: 'modal', headerShown: false, title: 'Shared device setup' }}
          />
          <Stack.Screen name="settings" options={{ presentation: 'modal', headerShown: false }} />
          <Stack.Screen
            name="house-rules"
            options={{ presentation: 'modal', headerShown: false, title: 'House Rules' }}
          />
          <Stack.Screen
            name="recess"
            options={{ presentation: 'modal', headerShown: false, title: 'Recess' }}
          />
          <Stack.Screen
            name="places"
            options={{ presentation: 'modal', headerShown: false, title: 'My Places' }}
          />
          <Stack.Screen name="notifications" options={{ presentation: 'modal', headerShown: false }} />
          <Stack.Screen name="momentum" options={{ title: 'Momentum' }} />
          <Stack.Screen
            name="household-balance"
            options={{ presentation: 'modal', headerShown: false, title: 'Household Health' }}
          />
          <Stack.Screen name="weekly-report" options={{ title: 'Weekly Report' }} />
          <Stack.Screen name="badge-gallery" options={{ title: 'Badge Gallery' }} />
          <Stack.Screen
            name="shopping-recommendations"
            options={{ presentation: 'modal', headerShown: false, title: 'Store Recommendations' }}
          />
          <Stack.Screen name="smart-home" options={{ title: 'Smart Home' }} />
          <Stack.Screen name="analytics" options={{ title: 'Analytics' }} />
          <Stack.Screen name="task/[id]" options={{ title: 'Task' }} />
          <Stack.Screen name="event/[id]" options={{ title: 'Event' }} />
          <Stack.Screen name="itinerary/[id]" options={{ headerShown: false, title: 'Trip' }} />
          <Stack.Screen name="create-task" options={{ presentation: 'modal', headerShown: false }} />
          <Stack.Screen name="add-grocery" options={{ presentation: 'modal', headerShown: false, title: 'Missing Item' }} />
          <Stack.Screen name="scan-grocery" options={{ presentation: 'modal', headerShown: false, title: 'Scan Product' }} />
          <Stack.Screen name="create-event" options={{ presentation: 'modal', headerShown: false, title: 'Create Event' }} />
          <Stack.Screen name="create-itinerary" options={{ presentation: 'modal', headerShown: false, title: 'Create Itinerary' }} />
          <Stack.Screen name="create-reward" options={{ presentation: 'modal', headerShown: false, title: 'Mint a reward' }} />
          <Stack.Screen
            name="grant-allowance"
            options={{ presentation: 'modal', headerShown: false, title: 'Grant Allowance' }}
          />
          <Stack.Screen
            name="special-reward-request"
            options={{ presentation: 'modal', headerShown: false, title: 'Ask for a reward' }}
          />
          <Stack.Screen
            name="shopping-mode"
            options={{ presentation: 'modal', headerShown: false, title: 'Shopping Mode' }}
          />
          <Stack.Screen
            name="grocery-browse"
            options={{ presentation: 'modal', headerShown: false, title: 'Browse groceries' }}
          />
          <Stack.Screen
            name="reward-tally"
            options={{ presentation: 'modal', headerShown: false, title: 'Reward history' }}
          />
          <Stack.Screen
            name="allowance-history"
            options={{ presentation: 'modal', headerShown: false, title: 'Allowance history' }}
          />
        </Stack>
      </OrbitNavTheme>
    </OrbitProvider>
  );
}
