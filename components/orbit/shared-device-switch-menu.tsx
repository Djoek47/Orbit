/**
 * Home Switch · {Name} — shared-device face menu (Emma / Jack).
 * Switches the signed-in face without a full sign-out.
 */
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useState } from 'react';
import { LayoutAnimation, Platform, Pressable, StyleSheet, UIManager, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, Layout, ZoomIn } from 'react-native-reanimated';

import { AppText as Text } from '@/components/orbit/app-text';
import { orbitAlert } from '@/components/orbit/orbit-alert';
import { TourTarget } from '@/components/orbit/tour/tour-target';
import { Moji } from '@/components/orbit/moji/moji';
import { radius, space, typography } from '@/constants/orbit-theme';
import {
  isSharedTabletDeviceSession,
  reconcileHostedDeviceSession,
  type DeviceSession,
} from '@/lib/device/device-session';
import {
  profilesForSharedDeviceSwitch,
  resolveSwitchDeviceShell,
} from '@/lib/device/profiles-for-switch';
import { isAvatarImageUri, memberDisplayEmoji } from '@/lib/game-levels';
import { memberPresenceParts } from '@/lib/household/member-presence';
import { normalizeSharedDeviceLabel } from '@/lib/device/profile-picker-layout';
import { resolveMemberAccentColor } from '@/lib/theme/member-accent';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useOrbit } from '@/store/orbit-store';
import type { HouseholdMember } from '@/types/orbit';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Props = {
  members: HouseholdMember[];
  currentMember: HouseholdMember | null | undefined;
  accentColor: string;
  onSwitchPersona: (memberId: string) => void | Promise<void>;
};

export function SharedDeviceSwitchMenu({
  members,
  currentMember,
  accentColor,
  onSwitchPersona,
}: Props) {
  const { c, glass, glassBorder } = useOrbitColors();
  const { switchingPersona } = useOrbit();
  const [open, setOpen] = useState(false);
  const [session, setSession] = useState<DeviceSession | null>(null);
  const role = currentMember?.role;
  // Hard rule: household admin personal phone never shows Switch · faces.
  const isPersonalAdmin = role === 'owner' || role === 'admin';

  useEffect(() => {
    let mounted = true;
    void (async () => {
      if (isPersonalAdmin) {
        const { demoteSharedSessionForPersonalAdmin } = await import(
          '@/lib/device/device-session'
        );
        const next = await demoteSharedSessionForPersonalAdmin(role);
        if (mounted) setSession(next);
        return;
      }
      const next = await reconcileHostedDeviceSession(members);
      if (mounted) setSession(next);
    })();
    return () => {
      mounted = false;
    };
  }, [currentMember?.id, isPersonalAdmin, members, role]);

  const people = useMemo(
    () => profilesForSharedDeviceSwitch(session, members),
    [session, members]
  );
  const shell = useMemo(
    () => resolveSwitchDeviceShell(session, members),
    [session, members]
  );

  // Personal admin / Sidekick phones never show Switch — only a real shared-tablet
  // session where the signed-in face is one of the hosted people (or the shell).
  const onSharedRoster =
    Boolean(currentMember) &&
    (currentMember!.role === 'shared-device' ||
      people.some((person) => person.id === currentMember!.id));
  if (
    isPersonalAdmin ||
    !isSharedTabletDeviceSession(session) ||
    people.length < 2 ||
    !currentMember ||
    !onSharedRoster
  ) {
    return null;
  }

  const firstName = currentMember.name.trim().split(/\s+/)[0] || currentMember.name;
  const deviceName = normalizeSharedDeviceLabel(session?.deviceLabel || shell?.name);
  // Shared-tablet status is the *device* link — same blue "Connected" for Jack
  // and Emma. Do not key off each face's Sidekick lastSeen (that made one face
  // show "Connected" and the other fall back to "Emma's device").
  const connected =
    isSharedTabletDeviceSession(session) ||
    (session?.mode === 'shared' && people.length >= 2);

  const pick = async (member: HouseholdMember) => {
    if (switchingPersona) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      // switchPersona binds DeviceSession + profile code, then syncs — do not
      // flip the menu closed until that succeeds (else Mark complete fails).
      await onSwitchPersona(member.id);
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setOpen(false);
    } catch (error) {
      orbitAlert(
        'Could not switch',
        error instanceof Error
          ? error.message
          : 'Scan the shared-device QR again so this profile is on the tablet.',
        undefined,
        { record: true, source: 'shared-switch' }
      );
    }
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <TourTarget id="home.switchProfile">
          <Pressable
            onPress={() => {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              setOpen((value) => !value);
              void Haptics.selectionAsync();
            }}
            accessibilityRole="button"
            accessibilityLabel={`Switch who's on. Currently ${firstName}.`}
            accessibilityHint="Opens Emma, Jack, and anyone else on this shared device."
            style={[
              styles.chip,
              {
                backgroundColor: `${accentColor}22`,
                borderColor: `${accentColor}66`,
              },
            ]}>
            {shell?.avatar ? (
              <Text style={styles.deviceEmoji}>{shell.avatar}</Text>
            ) : (
              <Moji name="phone" size={16} />
            )}
            <Text style={[typography.caption1, { color: accentColor, fontWeight: '700' }]}>
              Switch · {firstName}
            </Text>
            <MaterialIcons
              name={open ? 'expand-less' : 'expand-more'}
              size={16}
              color={accentColor}
            />
          </Pressable>
        </TourTarget>

        <View
          style={[
            styles.connectedChip,
            {
              backgroundColor: connected ? 'rgba(56,189,248,0.18)' : glass(0.06),
              borderColor: connected ? 'rgba(56,189,248,0.55)' : glassBorder(0.12),
            },
          ]}
          accessibilityLabel={
            connected ? `Connected on ${deviceName}` : `Shared device ${deviceName}`
          }>
          <View
            style={[
              styles.connectedDot,
              { backgroundColor: connected ? '#38BDF8' : c.textMuted },
            ]}
          />
          <Text
            style={[
              styles.connectedText,
              { color: connected ? '#38BDF8' : c.textMuted },
            ]}
            numberOfLines={1}>
            {connected ? 'Connected' : 'Not connected'}
          </Text>
        </View>
      </View>

      {open ? (
        <Animated.View
          entering={FadeInDown.duration(220)}
          layout={Layout.springify()}
          style={[
            styles.tray,
            { backgroundColor: glass(0.1), borderColor: glassBorder(0.14) },
          ]}>
          <Text style={[typography.caption1, { color: c.textMuted }]}>
            {deviceName} · tap a profile to carry on (no sign-out)
          </Text>
          <View style={styles.faces}>
            {people.map((member, index) => {
              const selected = member.id === currentMember.id;
              const live = memberPresenceParts(member).isLive;
              const faceAccent = resolveMemberAccentColor(member, accentColor);
              return (
                <Animated.View
                  key={member.id}
                  entering={ZoomIn.delay(40 * index).duration(220)}
                  layout={Layout.springify()}>
                  <Pressable
                    onPress={() => void pick(member)}
                    style={[
                      styles.face,
                      {
                        backgroundColor: selected ? `${faceAccent}22` : glass(0.04),
                        borderColor: selected ? `${faceAccent}77` : glassBorder(0.1),
                      },
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`Continue as ${member.name}`}>
                    <FaceBubble
                      member={member}
                      accentColor={faceAccent}
                      size={40}
                      selected={selected}
                    />
                    <Text
                      style={[styles.faceName, { color: selected ? faceAccent : c.text }]}
                      numberOfLines={1}>
                      {member.name.split(' ')[0]}
                    </Text>
                    {selected ? (
                      <Animated.Text
                        entering={FadeIn}
                        style={[styles.meta, { color: c.textSubtle }]}>
                        you
                      </Animated.Text>
                    ) : live ? (
                      <Text style={[styles.meta, { color: '#38BDF8' }]}>live</Text>
                    ) : (
                      <Text style={[styles.meta, { color: 'transparent' }]}>you</Text>
                    )}
                  </Pressable>
                </Animated.View>
              );
            })}
          </View>
        </Animated.View>
      ) : null}
    </View>
  );
}

function FaceBubble({
  member,
  accentColor,
  size,
  selected,
}: {
  member: HouseholdMember;
  accentColor: string;
  size: number;
  selected?: boolean;
}) {
  const uri = isAvatarImageUri(member.avatar) ? member.avatar : undefined;
  const emoji = memberDisplayEmoji(member);
  return (
    <View
      style={[
        styles.bubble,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: `${accentColor}28`,
          borderWidth: selected ? 2 : 0,
          borderColor: accentColor,
        },
      ]}>
      {uri ? (
        <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} />
      ) : (
        <Text style={{ fontSize: size * 0.45 }}>{emoji}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8, marginTop: space.xs },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderCurve: 'continuous',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  deviceEmoji: { fontSize: 16 },
  connectedChip: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  connectedDot: {
    borderRadius: 4,
    height: 8,
    width: 8,
  },
  connectedText: {
    fontSize: 12,
    fontWeight: '700',
    maxWidth: 140,
  },
  tray: {
    borderCurve: 'continuous',
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 10,
    padding: 12,
  },
  faces: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  face: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 4,
    minWidth: 76,
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
  faceName: { fontSize: 12, fontWeight: '700', maxWidth: 68 },
  meta: { fontSize: 10, fontWeight: '700' },
  bubble: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
