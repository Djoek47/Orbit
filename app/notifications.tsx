import { useEffect } from 'react';
import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { GlassCard } from '@/components/orbit/glass-card';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { OrbitListItem } from '@/components/orbit/orbit-list-item';
import { StatusPill } from '@/components/orbit/status-pill';
import { orbitColors, orbitScreen, orbitSpacing, orbitTypography } from '@/constants/orbit-theme';
import { useOrbit } from '@/store/orbit-store';

export default function NotificationsScreen() {
  const {
    markAllNotificationsRead,
    markNotificationRead,
    notifications,
    refreshNotifications,
  } = useOrbit();

  useEffect(() => {
    void refreshNotifications();
  }, [refreshNotifications]);

  const unread = notifications.filter((item) => !item.isRead).length;

  return (
    <ScrollView
      style={orbitScreen.container}
      contentContainerStyle={orbitScreen.content}
      contentInsetAdjustmentBehavior="automatic">
      <View style={orbitScreen.header}>
        <Text style={orbitTypography.caption}>Inbox</Text>
        <Text style={orbitTypography.display}>Notifications</Text>
        <Text style={orbitTypography.body}>
          {unread > 0 ? `${unread} unread` : 'You are caught up.'}
        </Text>
      </View>

      <OrbitButton disabled={unread === 0} onPress={() => markAllNotificationsRead()}>
        Mark all read
      </OrbitButton>

      {notifications.length === 0 ? (
        <GlassCard>
          <Text style={orbitTypography.caption}>No notifications yet.</Text>
        </GlassCard>
      ) : (
        notifications.map((item) => (
          <GlassCard key={item.id} style={styles.card}>
            <View style={orbitScreen.row}>
              <StatusPill label={item.category} tone={item.isRead ? 'blue' : 'cyan'} />
              <StatusPill label={item.priority} tone={item.priority === 'high' || item.priority === 'critical' ? 'red' : 'amber'} />
            </View>
            <OrbitListItem
              meta={new Date(item.createdAt).toLocaleString()}
              title={item.title}>
              <Text style={orbitTypography.caption}>{item.body}</Text>
            </OrbitListItem>
            {!item.isRead ? (
              <OrbitButton tone="secondary" onPress={() => markNotificationRead(item.id)}>
                Mark read
              </OrbitButton>
            ) : (
              <Text style={styles.readLabel}>Read</Text>
            )}
          </GlassCard>
        ))
      )}

      <OrbitButton tone="secondary" onPress={() => router.back()}>
        Back
      </OrbitButton>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: orbitSpacing.md,
  },
  readLabel: {
    color: orbitColors.textSubtle,
    fontSize: 12,
    fontWeight: '600',
  },
});
