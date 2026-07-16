import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { orbitColors } from '@/constants/orbit-theme';
import { DeepLinkBridge } from '@/components/orbit/deep-link-bridge';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { OrbitProvider } from '@/store/orbit-store';

export const unstable_settings = {
  anchor: 'index',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <OrbitProvider>
        <DeepLinkBridge />
        <Stack>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="join/[code]" options={{ headerShown: false }} />
          <Stack.Screen name="pending-approval" options={{ title: 'Pending Approval' }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="welcome" options={{ headerShown: false }} />
          <Stack.Screen name="sign-in" options={{ title: 'Sign In' }} />
          <Stack.Screen name="sign-up" options={{ title: 'Create Account' }} />
          <Stack.Screen name="forgot-password" options={{ title: 'Reset Password' }} />
          <Stack.Screen name="create-profile" options={{ title: 'Create Profile' }} />
          <Stack.Screen name="household-setup" options={{ title: 'Household' }} />
          <Stack.Screen name="create-household" options={{ presentation: 'modal', title: 'Create Household' }} />
          <Stack.Screen name="join-household" options={{ presentation: 'modal', title: 'Join Household' }} />
          <Stack.Screen name="invite-household" options={{ presentation: 'modal', title: 'Invite Members' }} />
          <Stack.Screen name="household-members" options={{ presentation: 'modal', title: 'Members' }} />
          <Stack.Screen name="settings" options={{ presentation: 'modal', title: 'Settings' }} />
          <Stack.Screen name="notifications" options={{ title: 'Notifications' }} />
          <Stack.Screen name="momentum" options={{ title: 'Momentum' }} />
          <Stack.Screen name="household-balance" options={{ title: 'Household Balance' }} />
          <Stack.Screen name="weekly-report" options={{ title: 'Weekly Report' }} />
          <Stack.Screen name="badge-gallery" options={{ title: 'Badge Gallery' }} />
          <Stack.Screen name="shopping-recommendations" options={{ title: 'Store Recommendations' }} />
          <Stack.Screen name="smart-home" options={{ title: 'Smart Home' }} />
          <Stack.Screen name="analytics" options={{ title: 'Analytics' }} />
          <Stack.Screen name="task/[id]" options={{ title: 'Task' }} />
          <Stack.Screen name="event/[id]" options={{ title: 'Event' }} />
          <Stack.Screen name="itinerary/[id]" options={{ title: 'Itinerary' }} />
          <Stack.Screen name="create-task" options={{ presentation: 'modal', headerShown: false }} />
          <Stack.Screen name="add-grocery" options={{ presentation: 'modal', title: 'Missing Item' }} />
          <Stack.Screen name="scan-grocery" options={{ presentation: 'modal', title: 'Scan Product' }} />
          <Stack.Screen name="create-event" options={{ presentation: 'modal', title: 'Create Event' }} />
          <Stack.Screen name="create-itinerary" options={{ presentation: 'modal', title: 'Create Itinerary' }} />
          <Stack.Screen name="create-reward" options={{ presentation: 'modal', title: 'Mint Reward' }} />
          <Stack.Screen
            name="special-reward-request"
            options={{ presentation: 'modal', title: 'Special Request' }}
          />
        </Stack>
      </OrbitProvider>
      <StatusBar backgroundColor={orbitColors.background} style="light" />
    </ThemeProvider>
  );
}
