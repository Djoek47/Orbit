import { Redirect, Tabs } from 'expo-router';
import React, { useMemo } from 'react';
import { StyleSheet } from 'react-native';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { orbitColors } from '@/constants/orbit-theme';
import { loadOnboardingPrefs, type OnboardingRole } from '@/lib/onboarding-prefs';
import { useOrbit } from '@/store/orbit-store';

/** Map household role → Make v7 onboarding role for tab visibility. */
function resolveUiRole(
  householdRole: string | undefined,
  onboardingRole: OnboardingRole | null,
): OnboardingRole {
  if (householdRole === 'child') return 'child';
  if (onboardingRole) return onboardingRole;
  if (householdRole === 'guest') return 'roommate';
  return 'parent';
}

export default function TabLayout() {
  const { currentUser, currentMember, hasHousehold, isLoading, isSignedIn } = useOrbit();
  const [onboardingRole, setOnboardingRole] = React.useState<OnboardingRole | null>(null);

  React.useEffect(() => {
    loadOnboardingPrefs().then((prefs) => setOnboardingRole(prefs?.role ?? null));
  }, []);

  const uiRole = useMemo(
    () => resolveUiRole(currentMember?.role, onboardingRole),
    [currentMember?.role, onboardingRole],
  );

  if (isLoading) {
    return null;
  }

  if (!isSignedIn) {
    return <Redirect href={'/welcome' as never} />;
  }

  if (!currentUser?.profileComplete) {
    return <Redirect href={'/welcome' as never} />;
  }

  if (!hasHousehold) {
    return <Redirect href={'/welcome' as never} />;
  }

  const showPlan = uiRole !== 'child';
  const showRewards = uiRole !== 'roommate';

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: orbitColors.primary,
        tabBarInactiveTintColor: orbitColors.textSubtle,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: styles.tabBar,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <IconSymbol size={25} name="house.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="tasks"
        options={{
          title: 'Tasks',
          tabBarIcon: ({ color }) => <IconSymbol size={25} name="checklist" color={color} />,
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          // Make v7: Plan tab (Calendar + Itineraries). Route stays `calendar`.
          href: showPlan ? undefined : null,
          title: 'Plan',
          tabBarIcon: ({ color }) => <IconSymbol size={25} name="calendar" color={color} />,
        }}
      />
      <Tabs.Screen
        name="groceries"
        options={{
          // Groceries remain reachable from Home / deep links; not a primary Make v7 tab.
          href: null,
          title: 'Groceries',
        }}
      />
      <Tabs.Screen
        name="rewards"
        options={{
          href: showRewards ? undefined : null,
          title: 'Rewards',
          tabBarIcon: ({ color }) => <IconSymbol size={25} name="gift.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="nova"
        options={{
          title: 'Nova',
          tabBarIcon: ({ color }) => <IconSymbol size={25} name="sparkles" color={color} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: 'rgba(7, 13, 28, 0.94)',
    borderTopColor: orbitColors.border,
    height: 88,
    paddingBottom: 24,
    paddingTop: 10,
  },
});
