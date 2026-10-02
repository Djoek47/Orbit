import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { Redirect, router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/orbit/avatar';
import { TourTarget } from '@/components/orbit/tour/tour-target';
import { ChoremaxxBadge } from '@/components/orbit/choremaxx-logo';
import { SidekickUnlockSplash } from '@/components/orbit/sidekick-unlock-splash';
import { getAccentTheme } from '@/constants/accent-themes';
import { space } from '@/constants/orbit-theme';
import { isPersonalSidekickDevice } from '@/lib/device/device-host';
import { orbitAlert } from '@/components/orbit/orbit-alert';
import {
  clearDeviceSession,
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

/** Shared iPad — pick a face, then Choremaxx. */
function profilePickerLayout(count: number): { columns: number; tileWidth: number; ring: number } {
  const n = Math.min(6, Math.max(2, count || 2));
  if (n <= 2) return { columns: 2, tileWidth: 148, ring: 108 };
  if (n === 3) return { columns: 3, tileWidth: 118, ring: 96 };
  if (n === 4) return { columns: 2, tileWidth: 132, ring: 92 };
  if (n === 5) return { columns: 3, tileWidth: 108, ring: 84 };
  return { columns: 3, tileWidth: 102, ring: 78 };
}

export default function SelectProfileScreen() {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
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

  const sidekickUnlock = useMemo(
    () => isPersonalSidekickDevice(session, profiles),
    [session, profiles]
  );

  const deviceLabel =
    session?.deviceLabel?.replace(/\biPad\b/i, 'device') ||
    findSharedDeviceForMember(profiles[0]?.id, household.members)?.name?.replace(/\biPad\b/i, 'device') ||
    DEFAULT_SHARED_IPAD_NAME;

  const layout = useMemo(
    () => profilePickerLayout(profiles.length),
    [profiles.length]
  );
  const gridMaxWidth = Math.min(windowWidth - 48, layout.columns * layout.tileWidth + (layout.columns - 1) * 16);

  const enterAsMember = async (member: HouseholdMember) => {
    await selectDeviceProfile(member.id);
    switchPersona(member.id);
    router.replace('/(tabs)' as never);
  };

  if (isLoading || !ready) {
    return null;
  }

  if (!isSignedIn) {
    return <Redirect href="/sign-in" />;
  }

  if (profiles.length === 0) {
    router.replace('/welcome' as never);
    return null;
  }

  if (sidekickUnlock && profiles.length === 1) {
    return (
      <SidekickUnlockSplash
        member={profiles[0]!}
        onComplete={() => {
          void enterAsMember(profiles[0]!);
        }}
      />
    );
  }

  const handleSelect = async (member: HouseholdMember) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await enterAsMember(member);
  };

  const handleRemove = (member: HouseholdMember) => {
    orbitAlert(`Remove ${member.name}?`, 'They can be added again with their profile QR.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          void removeHostedProfile(member.id).then((next) => {
            setSession(next);
            if (next.profileMemberIds.length === 0) {
              router.replace('/welcome' as never);
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
        <Text style={[styles.title, { color: orbitPalette.text }]}>Who&apos;s on this device?</Text>
        <Text style={[styles.subtitle, { color: orbitPalette.textMuted }]}>
          Tap your face. Switch anytime from the Switch tab at the bottom.
        </Text>

        <TourTarget id="selectProfile.faces">
        <View style={[styles.grid, { maxWidth: gridMaxWidth, width: '100%' }]}>
          {profiles.map((member) => {
            const theme = getAccentTheme(member.accentThemeId);
            const photo = isAvatarImageUri(member.avatar);
            const inner = layout.ring - 6;
            return (
              <Pressable
                key={member.id}
                onPress={() => void handleSelect(member)}
                onLongPress={() => handleRemove(member)}
                delayLongPress={450}
                style={[styles.tile, { width: layout.tileWidth }]}
                accessibilityRole="button"
                accessibilityLabel={`Continue as ${member.name}. Long press to remove from this device.`}>
                <LinearGradient
                  colors={[theme.primary, theme.secondary]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[styles.avatarRing, { width: layout.ring, height: layout.ring, borderRadius: layout.ring / 2 }]}>
                  <View
                    style={[
                      styles.avatarInner,
                      {
                        backgroundColor: orbitPalette.backgroundSoft,
                        width: inner,
                        height: inner,
                        borderRadius: inner / 2,
                      },
                    ]}>
                    <Avatar
                      name={member.name}
                      emoji={memberDisplayEmoji(member)}
                      imageUri={photo ? member.avatar : undefined}
                      size={layout.ring >= 100 ? 'xl' : layout.ring >= 88 ? 'l' : 'm'}
                    />
                  </View>
                </LinearGradient>
                <Text style={[styles.name, { color: orbitPalette.text }]} numberOfLines={1}>
                  {member.name}
                </Text>
              </Pressable>
            );
          })}
        </View>
        </TourTarget>

        {__DEV__ ? (
          <Pressable
            onPress={() => {
              orbitAlert(
                'DEV · leave shared tablet?',
                'Clears this device binding so you can sign back in as admin.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Leave tablet',
                    style: 'destructive',
                    onPress: () => {
                      void clearDeviceSession().then(() =>
                        router.replace('/welcome' as never)
                      );
                    },
                  },
                ]
              );
            }}
            style={styles.devBtn}
            accessibilityRole="button"
            accessibilityLabel="DEV leave shared tablet">
            <Text style={styles.devLabel}>DEV</Text>
          </Pressable>
        ) : null}
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
    flexGrow: 1,
    gap: space.md,
    justifyContent: 'center',
    minHeight: '100%',
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
    alignSelf: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    justifyContent: 'center',
    marginTop: space.lg,
  },
  tile: {
    alignItems: 'center',
    gap: 10,
  },
  avatarRing: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 3,
  },
  avatarInner: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
  },
  devBtn: {
    alignSelf: 'center',
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
    borderWidth: 1,
    marginTop: space.xl,
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  devLabel: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    textAlign: 'center',
  },
});
