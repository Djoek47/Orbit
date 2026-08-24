import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { Redirect, router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/orbit/avatar';
import { ChoremaxxBadge } from '@/components/orbit/choremaxx-logo';
import { getAccentTheme } from '@/constants/accent-themes';
import { space } from '@/constants/orbit-theme';
import {
  loadDeviceSession,
  removeHostedProfile,
  selectDeviceProfile,
  type DeviceSession,
} from '@/lib/device/device-session';
import { memberDisplayEmoji, isAvatarImageUri } from '@/lib/game-levels';
import { DEFAULT_SHARED_IPAD_NAME, findSharedDeviceForMember, resolveSharedDevicePeople } from '@/lib/household/shared-device';
import { useOrbit } from '@/store/orbit-store';
import type { HouseholdMember } from '@/types/orbit';
import { AppText as Text } from '@/components/orbit/app-text';

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

/** Who’s using this iPad — pick a face, then Choremaxx. */
export default function SelectProfileScreen() {
  const insets = useSafeAreaInsets();
  const { household, isLoading, isSignedIn, orbitPalette, switchPersona } = useOrbit();
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
    DEFAULT_SHARED_IPAD_NAME;

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

  const handleRemove = (member: HouseholdMember) => {
    Alert.alert(`Remove ${member.name}?`, 'They can be added again with their profile QR.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          void removeHostedProfile(member.id).then((next) => {
            setSession(next);
            if (next.profileMemberIds.length === 0) {
              router.replace('/setup-kid-device' as never);
            }
          });
        },
      },
    ]);
  };

  return (
    <View
      style={[
        styles.root,
        {
          paddingTop: insets.top + 24,
          paddingBottom: insets.bottom + 24,
          backgroundColor: orbitPalette.background,
        },
      ]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ChoremaxxBadge size="lg" />
        <Text style={[styles.eyebrow, { color: orbitPalette.textMuted }]}>{deviceLabel}</Text>
        <Text style={[styles.title, { color: orbitPalette.text }]}>Who&apos;s using this iPad?</Text>
        <Text style={[styles.subtitle, { color: orbitPalette.textMuted }]}>
          Tap your face. Switch anytime from Home.
        </Text>

        <View style={styles.grid}>
          {profiles.map((member) => {
            const theme = getAccentTheme(member.accentThemeId);
            const photo = isAvatarImageUri(member.avatar);
            return (
              <Pressable
                key={member.id}
                onPress={() => void handleSelect(member)}
                onLongPress={() => handleRemove(member)}
                delayLongPress={450}
                style={styles.tile}
                accessibilityRole="button"
                accessibilityLabel={`Continue as ${member.name}. Long press to remove from this iPad.`}>
                <LinearGradient
                  colors={[theme.primary, theme.secondary]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.avatarRing}>
                  <View
                    style={[
                      styles.avatarInner,
                      { backgroundColor: orbitPalette.backgroundSoft },
                    ]}>
                    <Avatar
                      name={member.name}
                      emoji={memberDisplayEmoji(member)}
                      imageUri={photo ? member.avatar : undefined}
                      size="xl"
                    />
                  </View>
                </LinearGradient>
                <Text style={[styles.name, { color: orbitPalette.text }]} numberOfLines={1}>
                  {member.name}
                </Text>
              </Pressable>
            );
          })}
          <Pressable
            style={styles.tile}
            onPress={() => router.push('/setup-kid-device' as never)}
            accessibilityRole="button"
            accessibilityLabel="Add someone to this iPad">
            <View style={[styles.addRing, { borderColor: orbitPalette.border }]}>
              <MaterialIcons name="add" size={36} color={orbitPalette.textMuted} />
            </View>
            <Text style={[styles.name, { color: orbitPalette.textMuted }]}>Add</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.xl,
    paddingBottom: 40,
  },
  eyebrow: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.3,
    marginTop: space.xl,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
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
    borderRadius: 45,
    height: 90,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 90,
  },
  addRing: {
    alignItems: 'center',
    borderRadius: 48,
    borderStyle: 'dashed',
    borderWidth: 2,
    height: 96,
    justifyContent: 'center',
    width: 96,
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
  },
});
