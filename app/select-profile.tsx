import * as Haptics from 'expo-haptics';
import { Redirect, router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TourTarget } from '@/components/orbit/tour/tour-target';
import { ChoremaxxBadge } from '@/components/orbit/choremaxx-logo';
import { SharedDeviceProfilePicker } from '@/components/orbit/shared-device-profile-picker';
import { SidekickUnlockSplash } from '@/components/orbit/sidekick-unlock-splash';
import { space } from '@/constants/orbit-theme';
import { isPersonalSidekickDevice } from '@/lib/device/device-host';
import {
  profilesForSharedDeviceSwitch,
  resolveSwitchDeviceShell,
} from '@/lib/device/profiles-for-switch';
import { normalizeSharedDeviceLabel } from '@/lib/device/profile-picker-layout';
import { orbitAlert } from '@/components/orbit/orbit-alert';
import {
  clearDeviceSession,
  reconcileHostedDeviceSession,
  removeHostedProfile,
  saveDeviceSession,
  selectDeviceProfile,
  setupSharedDeviceSession,
  type DeviceSession,
} from '@/lib/device/device-session';
import { useOrbit } from '@/store/orbit-store';
import type { HouseholdMember } from '@/types/orbit';
import { AppText as Text } from '@/components/orbit/app-text';

async function alignSessionWithRoster(
  session: DeviceSession,
  members: HouseholdMember[]
): Promise<DeviceSession> {
  const profiles = profilesForSharedDeviceSwitch(session, members);
  if (profiles.length < 2) return session;

  const ids = profiles.map((p) => p.id);
  const missing = ids.some((id) => !session.profileMemberIds.includes(id));
  const wrongKind = session.hostKind === 'sidekick' || session.hostKind === undefined;
  if (!missing && !wrongKind && session.mode === 'shared') return session;

  const shell = resolveSwitchDeviceShell(session, members);
  const next = await setupSharedDeviceSession({
    profileMemberIds: ids,
    deviceLabel:
      session.deviceLabel?.trim() ||
      normalizeSharedDeviceLabel(shell?.name) ||
      'Family device',
    hostKind: 'shared-tablet',
    sharedDeviceId: session.sharedDeviceId ?? shell?.id ?? null,
  });

  if (session.needsProfilePick || next.needsProfilePick) {
    const withPick: DeviceSession = {
      ...next,
      activeMemberId: null,
      needsProfilePick: true,
    };
    await saveDeviceSession(withPick);
    return withPick;
  }

  if (session.activeMemberId && ids.includes(session.activeMemberId)) {
    return selectDeviceProfile(session.activeMemberId);
  }

  return next;
}

/** Shared device — pick a face (Switch tab or cold start), then Choremaxx. */
export default function SelectProfileScreen() {
  const insets = useSafeAreaInsets();
  const { household, isLoading, isSignedIn, orbitPalette, switchPersona } = useOrbit();
  const [session, setSession] = useState<DeviceSession | null>(null);
  const [ready, setReady] = useState(false);
  /** Who was tapped. Holds the picker's chosen-face animation while the profile opens. */
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      const reconciled = await reconcileHostedDeviceSession(household.members);
      const aligned = await alignSessionWithRoster(reconciled, household.members);
      if (!mounted) return;
      setSession(aligned);
      setReady(true);
    })();
    return () => {
      mounted = false;
    };
  }, [household.members]);

  const profiles = useMemo(
    () => profilesForSharedDeviceSwitch(session, household.members),
    [session, household.members]
  );

  const shell = useMemo(
    () => resolveSwitchDeviceShell(session, household.members),
    [session, household.members]
  );

  // Personal unlock splash only for a true one-person Sidekick phone.
  const showPersonalSplash =
    profiles.length === 1 &&
    !session?.needsProfilePick &&
    isPersonalSidekickDevice(session, profiles) &&
    !shell;

  const deviceLabel = normalizeSharedDeviceLabel(session?.deviceLabel || shell?.name);

  const enterAsMember = async (member: HouseholdMember) => {
    try {
      await switchPersona(member.id);
      router.replace('/(tabs)' as never);
    } catch (error) {
      setSelectedId(null);
      orbitAlert(
        'Could not open profile',
        error instanceof Error
          ? error.message
          : 'Scan the shared-device QR code again so this profile is on the tablet.',
        undefined,
        { record: true, source: 'select-profile' }
      );
    }
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

  if (showPersonalSplash) {
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
    if (selectedId) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedId(member.id);
    // Let the chosen face finish growing before the screen changes under it.
    await new Promise((resolve) => setTimeout(resolve, 260));
    await enterAsMember(member);
  };

  const handleRemove = (member: HouseholdMember) => {
    orbitAlert(`Remove ${member.name}?`, 'They can be added again with their profile QR code.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          void removeHostedProfile(member.id).then(async (next) => {
            const aligned = await alignSessionWithRoster(next, household.members);
            setSession(aligned);
            if (profilesForSharedDeviceSwitch(aligned, household.members).length === 0) {
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
      <View style={styles.body}>
        <View style={styles.hero}>
          <ChoremaxxBadge size="lg" />
          <Text style={[styles.eyebrow, { color: orbitPalette.textMuted }]}>{deviceLabel}</Text>
          <Text style={[styles.title, { color: orbitPalette.text }]}>Who&apos;s using this device?</Text>
          <Text style={[styles.subtitle, { color: orbitPalette.textMuted }]}>
            Tap your profile. You can switch any time.
          </Text>
        </View>

        <ScrollView
          contentContainerStyle={styles.facesScroll}
          showsVerticalScrollIndicator={false}
          bounces={profiles.length > 4}>
          <TourTarget id="selectProfile.faces">
            <SharedDeviceProfilePicker
              profiles={profiles}
              backgroundSoft={orbitPalette.backgroundSoft}
              textColor={orbitPalette.text}
              onSelect={(member) => void handleSelect(member)}
              onRemove={handleRemove}
              selectedId={selectedId}
            />
          </TourTarget>
        </ScrollView>

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
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  body: {
    flex: 1,
    paddingBottom: 24,
  },
  hero: {
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.xl,
    paddingTop: space.md,
  },
  facesScroll: {
    flexGrow: 1,
    justifyContent: 'center',
    minHeight: 260,
    paddingHorizontal: space.lg,
    paddingVertical: space.lg,
  },
  eyebrow: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.4,
    marginTop: space.lg,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    lineHeight: 34,
    maxWidth: 320,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 22,
    maxWidth: 320,
    textAlign: 'center',
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
