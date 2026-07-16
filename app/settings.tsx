import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';

import { GlassCard } from '@/components/orbit/glass-card';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { StatusPill } from '@/components/orbit/status-pill';
import { orbitColors, orbitRadius, orbitScreen, orbitSpacing, orbitTypography } from '@/constants/orbit-theme';
import { formatHouseholdRole } from '@/lib/permissions';
import { useOrbit } from '@/store/orbit-store';

export default function SettingsScreen() {
  const {
    activeMemberId,
    currentMember,
    currentUser,
    deleteAccount,
    exportUserData,
    household,
    permissions,
    signOut,
    switchPersona,
    updateNotificationPrefs,
  } = useOrbit();
  const [showAdvanced, setShowAdvanced] = useState(false);
  const prefs = household.notificationPrefs ?? {
    tasks: true,
    itinerary: true,
    groceries: true,
    rewards: true,
  };

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
        <Text style={orbitTypography.caption}>Household</Text>
        <Text style={orbitTypography.display}>Settings</Text>
        <Text style={orbitTypography.body}>Roles, invites, calendar, and account controls.</Text>
      </View>

      <GlassCard style={styles.card}>
        <StatusPill label={household.householdType ?? 'household'} tone="cyan" />
        <Text style={orbitTypography.cardTitle}>{household.householdName}</Text>
        <Text style={orbitTypography.caption}>
          Viewing as {currentMember?.name ?? currentUser?.email ?? household.greetingName}
          {currentMember ? ` · ${formatHouseholdRole(currentMember.role)}` : ''}
        </Text>
        <Text style={orbitTypography.caption}>
          {household.members.length} members · invite {household.inviteCode || '—'}
        </Text>
      </GlassCard>

      <GlassCard style={styles.card}>
        <Text style={orbitTypography.cardTitle}>Switch member (demo)</Text>
        <Text style={orbitTypography.caption}>
          Try Orbit as owner, admin, child, guest, or pending adult without signing out.
        </Text>
        <View style={styles.personaGrid}>
          {household.members.map((member) => {
            const active = (activeMemberId ?? currentMember?.id) === member.id;
            return (
              <Pressable
                key={member.id}
                onPress={() => switchPersona(member.id)}
                style={[styles.personaChip, active && styles.personaChipActive]}>
                <Text style={styles.personaAvatar}>{member.avatar}</Text>
                <Text style={[styles.personaName, active && styles.personaNameActive]}>{member.name}</Text>
                <Text style={styles.personaRole}>{formatHouseholdRole(member.role)}</Text>
              </Pressable>
            );
          })}
        </View>
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
        <OrbitButton tone="secondary" onPress={() => router.push('/notifications' as never)}>
          Notifications inbox
        </OrbitButton>
        <OrbitButton tone="secondary" onPress={() => router.push('/(tabs)/plan' as never)}>
          Plan (Calendar + Itineraries)
        </OrbitButton>
        <OrbitButton tone="secondary" onPress={() => router.push('/(tabs)/groceries' as never)}>
          Groceries
        </OrbitButton>
        <OrbitButton tone="secondary" onPress={() => router.push('/create-event' as never)}>
          Create Event
        </OrbitButton>
      </GlassCard>

      <GlassCard style={styles.card}>
        <Text style={orbitTypography.cardTitle}>Nova notification prefs</Text>
        <Text style={orbitTypography.caption}>Mock-persisted toggles for Nova-authored household nudges.</Text>
        {(
          [
            ['tasks', 'Tasks & streaks'],
            ['itinerary', 'Itinerary legs'],
            ['groceries', 'Grocery & sales'],
            ['rewards', 'Rewards'],
          ] as const
        ).map(([key, label]) => (
          <OrbitButton
            key={key}
            tone="secondary"
            onPress={() => updateNotificationPrefs({ [key]: !prefs[key] })}>
            {label}: {prefs[key] ? 'On' : 'Off'}
          </OrbitButton>
        ))}
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

      <GlassCard style={styles.card}>
        <OrbitButton tone="secondary" onPress={() => setShowAdvanced((value) => !value)}>
          {showAdvanced ? 'Hide advanced' : 'Advanced'}
        </OrbitButton>
        {showAdvanced ? (
          <>
            <Text style={orbitTypography.caption}>Optional platform previews outside the core household loops.</Text>
            <OrbitButton tone="secondary" onPress={() => router.push('/smart-home' as never)}>
              Smart Home
            </OrbitButton>
            <OrbitButton
              disabled={!permissions.canViewAnalytics}
              tone="secondary"
              onPress={() => router.push('/analytics' as never)}>
              Analytics
            </OrbitButton>
          </>
        ) : null}
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
  personaAvatar: {
    color: orbitColors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  personaChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderColor: orbitColors.border,
    borderRadius: orbitRadius.md,
    borderWidth: 1,
    flexBasis: '47%',
    flexGrow: 1,
    gap: 4,
    padding: orbitSpacing.md,
  },
  personaChipActive: {
    backgroundColor: 'rgba(0, 194, 255, 0.14)',
    borderColor: 'rgba(0, 194, 255, 0.4)',
  },
  personaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: orbitSpacing.sm,
  },
  personaName: {
    color: orbitColors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  personaNameActive: {
    color: orbitColors.novaCyan,
  },
  personaRole: {
    color: orbitColors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
});
