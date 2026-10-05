/**
 * Tasks “Who's on” — animated face filter for viewing another person's tasks
 * without switching the signed-in account (that is the tab-bar Switch).
 */
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useState } from 'react';
import { LayoutAnimation, Platform, Pressable, StyleSheet, UIManager, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, Layout, ZoomIn } from 'react-native-reanimated';

import { AppText as Text } from '@/components/orbit/app-text';
import { radius, typography } from '@/constants/orbit-theme';
import { loadDeviceSession } from '@/lib/device/device-session';
import { isAvatarImageUri, memberDisplayEmoji } from '@/lib/game-levels';
import { whosOnPeople } from '@/lib/household/whos-on-people';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import type { HouseholdMember } from '@/types/orbit';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Props = {
  members: HouseholdMember[];
  currentMemberId: string;
  /** Name currently used to filter the task list (view-as). */
  viewingName: string | null;
  accentColor: string;
  onViewMember: (member: HouseholdMember | null) => void;
};

export function WhosOnSwitcher({
  members,
  currentMemberId,
  viewingName,
  accentColor,
  onViewMember,
}: Props) {
  const { c, glass, glassBorder } = useOrbitColors();
  const [open, setOpen] = useState(false);
  const [hostedIds, setHostedIds] = useState<string[] | undefined>();

  useEffect(() => {
    void loadDeviceSession().then((session) => {
      if (session.mode === 'shared' && session.profileMemberIds.length > 0) {
        setHostedIds(session.profileMemberIds);
      }
    });
  }, [currentMemberId]);

  const people = useMemo(
    () =>
      whosOnPeople({
        members,
        currentMemberId,
        hostedMemberIds: hostedIds,
      }),
    [members, currentMemberId, hostedIds]
  );

  const current = members.find((member) => member.id === currentMemberId);
  const viewing =
    people.find((member) => member.name === viewingName) ??
    people.find((member) => member.id === currentMemberId) ??
    current ??
    people[0];

  if (people.length < 2 || !viewing) return null;

  const label = viewing.name.split(' ')[0] || viewing.name;

  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={() => {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          setOpen((value) => !value);
          void Haptics.selectionAsync();
        }}
        accessibilityRole="button"
        accessibilityLabel={`Who's on, viewing ${label}. Tap to pick someone else.`}
        accessibilityHint="Filters the task list. Does not switch the signed-in account."
        style={[
          styles.chip,
          {
            backgroundColor: `${accentColor}22`,
            borderColor: `${accentColor}66`,
          },
        ]}>
        <FaceBubble member={viewing} accentColor={accentColor} size={22} />
        <Text style={[styles.chipText, { color: accentColor }]}>Who&apos;s on · {label}</Text>
        <MaterialIcons
          name={open ? 'expand-less' : 'expand-more'}
          size={18}
          color={accentColor}
        />
      </Pressable>

      {open ? (
        <Animated.View
          entering={FadeInDown.duration(220)}
          layout={Layout.springify()}
          style={[
            styles.tray,
            { backgroundColor: glass(0.08), borderColor: glassBorder(0.12) },
          ]}>
          <Text style={[typography.caption1, { color: c.textMuted }]}>
            View tasks · stays signed in as {current?.name.split(' ')[0] ?? 'you'}
          </Text>
          <View style={styles.faces}>
            {people.map((member, index) => {
              const selected = member.name === viewing.name;
              const isSignedIn = member.id === currentMemberId;
              return (
                <Animated.View
                  key={member.id}
                  entering={ZoomIn.delay(40 * index).duration(220)}
                  layout={Layout.springify()}>
                  <Pressable
                    onPress={() => {
                      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      onViewMember(member.id === currentMemberId ? null : member);
                      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                      setOpen(false);
                    }}
                    style={[
                      styles.face,
                      {
                        backgroundColor: selected ? `${accentColor}22` : glass(0.04),
                        borderColor: selected ? `${accentColor}77` : glassBorder(0.1),
                      },
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`View ${member.name}'s tasks${isSignedIn ? ', signed in' : ''}`}>
                    <FaceBubble member={member} accentColor={accentColor} size={36} selected={selected} />
                    <Text
                      style={[styles.faceName, { color: selected ? accentColor : c.text }]}
                      numberOfLines={1}>
                      {member.name.split(' ')[0]}
                    </Text>
                    {isSignedIn ? (
                      <Animated.Text entering={FadeIn} style={[styles.signedIn, { color: c.textSubtle }]}>
                        you
                      </Animated.Text>
                    ) : (
                      <Text style={[styles.signedIn, { color: 'transparent' }]}>you</Text>
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
  wrap: { gap: 8, marginTop: 10 },
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
  chipText: { fontSize: 12, fontWeight: '700' },
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
    minWidth: 72,
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
  faceName: { fontSize: 12, fontWeight: '700', maxWidth: 64 },
  signedIn: { fontSize: 10, fontWeight: '700' },
  bubble: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
