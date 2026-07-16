import { Redirect, Tabs } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { GlobalHeaderChips } from '@/components/orbit/global-header-chips';
import { MakeTabBar } from '@/components/orbit/make-tab-bar';
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
        <Tabs.Screen name="plan" options={{ title: 'Plan' }} />
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
        <Tabs.Screen name="rewards" options={{ title: 'Ranks' }} />
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
