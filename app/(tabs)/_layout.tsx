import { Redirect, Tabs } from 'expo-router';
import React from 'react';
import { StyleSheet } from 'react-native';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { orbitColors } from '@/constants/orbit-theme';
import { useOrbit } from '@/store/orbit-store';

export default function TabLayout() {
  const { currentUser, hasHousehold, isLoading, isSignedIn } = useOrbit();

  if (isLoading) {
    return null;
  }

  if (!isSignedIn) {
    return <Redirect href={'/welcome' as never} />;
  }

  if (!currentUser?.profileComplete) {
    return <Redirect href={'/create-profile' as never} />;
  }

  if (!hasHousehold) {
    return <Redirect href={'/household-setup' as never} />;
  }

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: orbitColors.orbitBlue,
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
        name="plan"
        options={{
          title: 'Plan',
          tabBarIcon: ({ color }) => <IconSymbol size={25} name="calendar" color={color} />,
        }}
      />
      <Tabs.Screen
        name="groceries"
        options={{
          // Make v5: grocery intelligence lives under Plan trips + Home; keep route for deep links.
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
          title: 'Ranks',
          tabBarIcon: ({ color }) => <IconSymbol size={25} name="trophy.fill" color={color} />,
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
