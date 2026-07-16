import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Redirect, Tabs, router } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MakeTabBar } from '@/components/orbit/make-tab-bar';
import { useOrbit } from '@/store/orbit-store';

export default function TabLayout() {
  const { currentUser, hasHousehold, isLoading, isSignedIn } = useOrbit();
  const insets = useSafeAreaInsets();

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
          tabBarStyle: styles.hiddenTabBar,
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

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Settings"
        onPress={() => router.push('/settings' as never)}
        style={[styles.settingsChip, { top: insets.top + 8 }]}>
        <MaterialIcons name="settings" size={13} color="#7C9CC0" />
        <Text style={styles.settingsLabel}>Settings</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
  },
  hiddenTabBar: {
    backgroundColor: 'transparent',
    borderTopWidth: 0,
    elevation: 0,
    position: 'absolute',
  },
  settingsChip: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    position: 'absolute',
    right: 16,
    zIndex: 30,
  },
  settingsLabel: {
    color: '#7C9CC0',
    fontSize: 11,
    fontWeight: '600',
  },
});
