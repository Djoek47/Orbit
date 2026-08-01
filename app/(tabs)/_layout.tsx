import { Redirect, Tabs } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { GlobalHeaderChips } from '@/components/orbit/global-header-chips';
import { MakeTabBar } from '@/components/orbit/make-tab-bar';
import { loadDeviceSession } from '@/lib/device/device-session';
import { isSharedDeviceAccount } from '@/lib/household/shared-device';
import { loadOnboardingPrefs, type OnboardingRole } from '@/lib/onboarding-prefs';
import { useOrbit } from '@/store/orbit-store';

/** Map household role → Make onboarding role for tab visibility. */
function resolveUiRole(
  householdRole: string | undefined,
  onboardingRole: OnboardingRole | null,
  sharedKid: boolean,
): OnboardingRole {
  if (sharedKid || householdRole === 'child') return 'child';
  if (onboardingRole) return onboardingRole;
  if (householdRole === 'guest') return 'roommate';
  return 'parent';
}

export default function TabLayout() {
  const { currentUser, currentMember, hasHousehold, household, isLoading, isSignedIn, orbitPalette } =
    useOrbit();
  const [onboardingRole, setOnboardingRole] = useState<OnboardingRole | null>(null);
  const [needsPick, setNeedsPick] = useState(false);

  useEffect(() => {
    loadOnboardingPrefs().then((prefs) => setOnboardingRole(prefs?.role ?? null));
  }, []);

  useEffect(() => {
    let mounted = true;
    loadDeviceSession().then((session) => {
      if (!mounted) return;
      setNeedsPick(
        session.mode === 'shared' &&
          session.needsProfilePick &&
          session.profileMemberIds.length > 0
      );
    });
    return () => {
      mounted = false;
    };
  }, [currentMember?.id, isSignedIn]);

  const sharedKid = isSharedDeviceAccount(currentMember, household.members);
  const uiRole = useMemo(
    () => resolveUiRole(currentMember?.role, onboardingRole, sharedKid),
    [currentMember?.role, onboardingRole, sharedKid],
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

  if (needsPick) {
    return <Redirect href={'/select-profile' as never} />;
  }

  const showPlan = uiRole !== 'child';
  const showRewards = uiRole !== 'roommate';

  return (
    <View style={[styles.shell, { backgroundColor: orbitPalette.background }]}>
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
            title: 'Ranks',
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
    flex: 1,
  },
  tabBarPlaceholder: {
    backgroundColor: 'transparent',
    borderTopWidth: 0,
    elevation: 0,
  },
});
