import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { Redirect, router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChoremaxxBadge } from '@/components/orbit/choremaxx-logo';
import { getAccentTheme } from '@/constants/accent-themes';
import { orbitColors, space } from '@/constants/orbit-theme';
import {
  loadDeviceSession,
  selectDeviceProfile,
  type DeviceSession,
} from '@/lib/device/device-session';
import { memberDisplayEmoji, isAvatarImageUri } from '@/lib/game-levels';
import { findSharedDeviceForMember, resolveSharedDevicePeople } from '@/lib/household/shared-device';
import { useOrbit } from '@/store/orbit-store';
import type { HouseholdMember } from '@/types/orbit';

function profilesForSession(
  session: DeviceSession | null,
  members: HouseholdMember[]
): HouseholdMember[] {
  if (!session || session.mode !== 'shared') {
    const shell = members.find((m) => m.role === 'shared-device' && m.status === 'active');
    if (shell) return resolveSharedDevicePeople(shell, members);
    return [];
  }
  if (session.profileMemberIds.length > 0) {
    return session.profileMemberIds
      .map((id) => members.find((m) => m.id === id))
      .filter((m): m is HouseholdMember => Boolean(m && m.status === 'active'));
  }
  if (session.sharedDeviceId) {
    const shell = members.find((m) => m.id === session.sharedDeviceId);
    return resolveSharedDevicePeople(shell, members);
  }
  return [];
}

/** Netflix-style “Who’s logging in?” before the main app on shared/kid devices. */
export default function SelectProfileScreen() {
  const insets = useSafeAreaInsets();
  const { household, isLoading, isSignedIn, switchPersona } = useOrbit();
  const [session, setSession] = useState<DeviceSession | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    loadDeviceSession().then((next) => {
      if (mounted) {
        setSession(next);
        setReady(true);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  const profiles = useMemo(
    () => profilesForSession(session, household.members),
    [session, household.members]
  );

  const deviceLabel =
    session?.deviceLabel ||
    findSharedDeviceForMember(profiles[0]?.id, household.members)?.name ||
    'This device';

  if (isLoading || !ready) {
    return null;
  }

  if (!isSignedIn) {
    return <Redirect href="/sign-in" />;
  }

  if (profiles.length === 0) {
    return <Redirect href="/setup-kid-device" />;
  }

  const handleSelect = async (member: HouseholdMember) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await selectDeviceProfile(member.id);
    switchPersona(member.id);
    router.replace('/(tabs)' as never);
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ChoremaxxBadge size="lg" />
        <Text style={styles.eyebrow}>{deviceLabel}</Text>
        <Text style={styles.title}>Who&apos;s logging in?</Text>
        <Text style={styles.subtitle}>
          Pick your profile on this shared device. You can switch anytime from Home.
        </Text>

        <View style={styles.grid}>
          {profiles.map((member) => {
            const theme = getAccentTheme(member.accentThemeId);
            const photo = isAvatarImageUri(member.avatar);
            return (
              <Pressable
                key={member.id}
                onPress={() => void handleSelect(member)}
                style={styles.tile}
                accessibilityRole="button"
                accessibilityLabel={`Log in as ${member.name}`}>
                <LinearGradient
                  colors={[theme.primary, theme.secondary]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.avatarRing}>
                  <View style={styles.avatarInner}>
                    {photo ? (
                      <Image source={{ uri: member.avatar }} style={styles.avatarImage} />
                    ) : (
                      <Text style={styles.avatarEmoji}>{memberDisplayEmoji(member)}</Text>
                    )}
                  </View>
                </LinearGradient>
                <Text style={styles.name} numberOfLines={1}>
                  {member.name}
                </Text>
                <Text style={[styles.xp, { color: theme.primary }]}>{member.xp} XP</Text>
              </Pressable>
            );
          })}
        </View>

        <Pressable
          style={styles.manageRow}
          onPress={() => router.push('/setup-kid-device' as never)}>
          <MaterialIcons name="add-circle-outline" size={20} color={orbitColors.textMuted} />
          <Text style={styles.manageText}>Add another profile with a code or QR</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: orbitColors.background,
    flex: 1,
  },
  content: {
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.xl,
    paddingBottom: 40,
  },
  eyebrow: {
    color: orbitColors.textMuted,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.4,
    marginTop: space.xl,
    textTransform: 'uppercase',
  },
  title: {
    color: orbitColors.text,
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
  },
  subtitle: {
    color: orbitColors.textMuted,
    fontSize: 15,
    lineHeight: 22,
    maxWidth: 340,
    textAlign: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 20,
    justifyContent: 'center',
    marginTop: space.xxl,
    width: '100%',
  },
  tile: {
    alignItems: 'center',
    gap: 8,
    width: 120,
  },
  avatarRing: {
    alignItems: 'center',
    borderRadius: 48,
    height: 96,
    justifyContent: 'center',
    padding: 3,
    width: 96,
  },
  avatarInner: {
    alignItems: 'center',
    backgroundColor: '#0A1525',
    borderRadius: 45,
    height: 90,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 90,
  },
  avatarEmoji: {
    fontSize: 42,
  },
  avatarImage: {
    height: '100%',
    width: '100%',
  },
  name: {
    color: orbitColors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  xp: {
    fontSize: 12,
    fontWeight: '600',
  },
  manageRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: space.xxl,
    paddingVertical: 12,
  },
  manageText: {
    color: orbitColors.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
});
