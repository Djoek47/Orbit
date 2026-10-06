import { Redirect, router, Tabs } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { GlobalHeaderChips } from '@/components/orbit/global-header-chips';
import { HouseholdSwitchBar } from '@/components/orbit/household-switch-bar';
import { MakeTabBar } from '@/components/orbit/make-tab-bar';
import { loadDeviceSession } from '@/lib/device/device-session';
import { isSharedDeviceAccount } from '@/lib/household/shared-device';
import { loadOnboardingPrefs, type OnboardingRole } from '@/lib/onboarding-prefs';
import { useMajordomoName } from '@/lib/ai/use-majordomo-name';
import { canShowPoppinsTab } from '@/lib/sidekick/permissions';
import { useTabFifthSlot } from '@/lib/navigation/use-tab-fifth-slot';
import { useOrbit } from '@/store/orbit-store';

/** Map household role → onboarding role for tab visibility. */
function resolveUiRole(
  householdRole: string | undefined,
  onboardingRole: OnboardingRole | null,
  sharedKid: boolean,
): OnboardingRole {
  if (sharedKid || householdRole === 'child') return 'child';
  if (onboardingRole) return onboardingRole;
  return 'parent';
}

export default function TabLayout() {
  const { currentUser, currentMember, hasHousehold, household, isLoading, isSignedIn, orbitPalette } =
    useOrbit();
  const majordomoName = useMajordomoName();
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

  // Safety net: tabs used to return null when signed out and wait for root
  // replace('/'). If that handoff missed, users stayed on a blank dark screen.
  useEffect(() => {
    if (isLoading || isSignedIn) return;
    const t = setTimeout(() => {
      try {
        router.replace('/welcome' as never);
      } catch (error) {
        console.warn('tabs.signedOut.replaceWelcome', error);
      }
    }, 50);
    return () => clearTimeout(t);
  }, [isLoading, isSignedIn]);

  const sharedKid = isSharedDeviceAccount(currentMember, household.members);
  const uiRole = useMemo(
    () => resolveUiRole(currentMember?.role, onboardingRole, sharedKid),
    [currentMember?.role, onboardingRole, sharedKid],
  );
  const fifthSlot = useTabFifthSlot({
    role: currentMember?.role,
    members: household.members,
    memberId: currentMember?.id,
  });

  if (isLoading) {
    return null;
  }

  if (!isSignedIn) {
    // Brief blank while replace('/welcome') runs (sign-out leave + safety net).
    return null;
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

  const showPlan = true;
  const showRewards = true;
  // The fifth slot is Poppins only for an adult on their own device; a shared tablet shows
  // "Switch who's on" there, and a Sidekick gets four tabs.
  const showPoppins =
    canShowPoppinsTab({ role: currentMember?.role }) && fifthSlot === 'poppins';

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
            title: uiRole === 'child' ? 'Ranks' : 'Rewards',
          }}
        />
        <Tabs.Screen name="poppins" options={{ href: showPoppins ? undefined : null, title: majordomoName }} />
      </Tabs>

      <GlobalHeaderChips />
      <HouseholdSwitchBar />
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
