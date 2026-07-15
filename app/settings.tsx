import { router } from 'expo-router';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';

import { GlassCard } from '@/components/orbit/glass-card';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { StatusPill } from '@/components/orbit/status-pill';
import { orbitScreen, orbitSpacing, orbitTypography } from '@/constants/orbit-theme';
import { useOrbit } from '@/store/orbit-store';

export default function SettingsScreen() {
  const {
    currentUser,
    deleteAccount,
    exportUserData,
    household,
    permissions,
    signOut,
  } = useOrbit();

  const handleExport = async () => {
    const payload = await exportUserData();
    await Clipboard.setStringAsync(payload);
    Alert.alert('Export ready', 'Your data JSON was copied to the clipboard.');
  };

  const handleDelete = () => {
    Alert.alert('Delete account', 'This permanently removes your Orbit account.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteAccount();
          router.replace('/welcome' as never);
        },
      },
    ]);
  };

  return (
    <ScrollView
      style={orbitScreen.container}
      contentContainerStyle={orbitScreen.content}
      contentInsetAdjustmentBehavior="automatic">
      <View style={orbitScreen.header}>
        <Text style={orbitTypography.caption}>Admin</Text>
        <Text style={orbitTypography.display}>Settings</Text>
        <Text style={orbitTypography.body}>Household controls, integrations, and account actions.</Text>
      </View>

      <GlassCard style={styles.card}>
        <StatusPill label={household.householdType ?? 'household'} tone="cyan" />
        <Text style={orbitTypography.cardTitle}>{household.householdName}</Text>
        <Text style={orbitTypography.caption}>Signed in as {currentUser?.email ?? household.greetingName}</Text>
        <Text style={orbitTypography.caption}>{household.members.length} members · invite {household.inviteCode || '—'}</Text>
      </GlassCard>

      <GlassCard style={styles.card}>
        <Text style={orbitTypography.cardTitle}>Household</Text>
        <OrbitButton tone="secondary" onPress={() => router.push('/household-members' as never)}>
          Members
        </OrbitButton>
        <OrbitButton
          disabled={!permissions.canInviteMembers}
          tone="secondary"
          onPress={() => router.push('/invite-household' as never)}>
          Invite
        </OrbitButton>
        <OrbitButton tone="secondary" onPress={() => router.push('/smart-home' as never)}>
          Smart Home
        </OrbitButton>
        <OrbitButton
          disabled={!permissions.canViewAnalytics}
          tone="secondary"
          onPress={() => router.push('/analytics' as never)}>
          Analytics
        </OrbitButton>
        <OrbitButton tone="secondary" onPress={() => router.push('/notifications' as never)}>
          Notifications
        </OrbitButton>
        <OrbitButton tone="secondary" onPress={() => router.push('/(tabs)/calendar' as never)}>
          Calendar
        </OrbitButton>
        <OrbitButton tone="secondary" onPress={() => router.push('/create-event' as never)}>
          Create Event
        </OrbitButton>
      </GlassCard>

      <GlassCard style={styles.card}>
        <Text style={orbitTypography.cardTitle}>Account</Text>
        <OrbitButton
          tone="secondary"
          onPress={async () => {
            await signOut();
            router.replace('/welcome' as never);
          }}>
          Sign out
        </OrbitButton>
        <OrbitButton tone="secondary" onPress={handleExport}>
          Export data
        </OrbitButton>
        <OrbitButton tone="danger" onPress={handleDelete}>
          Delete account
        </OrbitButton>
      </GlassCard>

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
});
