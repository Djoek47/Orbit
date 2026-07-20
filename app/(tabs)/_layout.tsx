import { Redirect, Tabs } from 'expo-router';
import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { GlobalHeaderChips } from '@/components/orbit/global-header-chips';
import { MakeTabBar } from '@/components/orbit/make-tab-bar';
import { loadOnboardingPrefs, type OnboardingRole } from '@/lib/onboarding-prefs';
import { useOrbit } from '@/store/orbit-store';

/** Map household role → Make onboarding role for tab visibility. */
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
    <View style={styles.shell}>
      <Tabs
        tabBar={(props) => <MakeTabBar {...props} />}
        screenOptions={{
          headerShown: false,
          // One native tab bar — do not absolute-position (avoids double bottom chrome)
          tabBarStyle: styles.tabBarPlaceholder,
        }}>
        <Tabs.Screen name="index" options={{ title: 'Home' }} />
        <Tabs.Screen name="tasks" options={{ title: 'Tasks' }} />
        <Tabs.Screen
          name="plan"
          options={{
            href: showPlan ? undefined : null,
            title: 'Plan',
          }}
        />
        <Tabs.Screen
          name="groceries"
          options={{
            href: null,
            title: 'Groceries',
          }}
        />
        <Tabs.Screen
          name="calendar"
          options={{
            href: null,
            title: 'Calendar',
          }}
        />
        <Tabs.Screen
          name="rewards"
          options={{
            href: showRewards ? undefined : null,
            title: 'Rewards',
          }}
        />
        <Tabs.Screen name="nova" options={{ title: 'Nova' }} />
      </Tabs>

      <GlobalHeaderChips />
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    backgroundColor: '#070D1C',
    flex: 1,
  },
  tabBarPlaceholder: {
    backgroundColor: 'transparent',
    borderTopWidth: 0,
    elevation: 0,
  },
});
