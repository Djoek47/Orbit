import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { orbitColors } from '@/constants/orbit-theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { OrbitProvider } from '@/store/orbit-store';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <OrbitProvider>
        <Stack>
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
          <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
          <Stack.Screen name="create-task" options={{ presentation: 'modal', title: 'Create Task' }} />
          <Stack.Screen name="add-grocery" options={{ presentation: 'modal', title: 'Missing Item' }} />
          <Stack.Screen name="create-event" options={{ presentation: 'modal', title: 'Create Event' }} />
        </Stack>
      </OrbitProvider>
      <StatusBar backgroundColor={orbitColors.background} style="light" />
    </ThemeProvider>
  );
}
