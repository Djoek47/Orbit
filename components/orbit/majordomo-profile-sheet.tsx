import { useMemo } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { BottomSheet } from '@/components/orbit/bottom-sheet';
import { AppText as Text } from '@/components/orbit/app-text';
import { androidBlurMethod, resolveBlurTint } from '@/constants/material-tokens';
import { radius, space } from '@/constants/orbit-theme';
import {
  MAJORDOMO_PROFILES,
  getMajordomoProfile,
  resolveMajordomoProfileId,
  type MajordomoProfileId,
} from '@/lib/ai/majordomo-profiles';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';

type MajordomoProfileSheetProps = {
  visible: boolean;
  onDismiss: () => void;
  householdProfileId?: string | null;
  memberProfileId?: string | null;
  memberName?: string;
  canManageHousehold: boolean;
  onSelectHousehold: (id: MajordomoProfileId) => void;
  onSelectPersonal: (id: MajordomoProfileId | null) => void;
};

/**
 * Apple-caliber majordomo picker — Character → Personality → Voice.
 * One clear decision: who speaks for the household.
 */
export function MajordomoProfileSheet({
  visible,
  onDismiss,
  householdProfileId,
  memberProfileId,
  memberName,
  canManageHousehold,
  onSelectHousehold,
  onSelectPersonal,
}: MajordomoProfileSheetProps) {
  const { c, glass, glassBorder, isDark } = useOrbitColors();
  const activeId = resolveMajordomoProfileId({
    householdProfileId,
    memberProfileId,
  });
  const active = getMajordomoProfile(activeId);
  const usingPersonal = Boolean(memberProfileId);

  const rows = useMemo(() => MAJORDOMO_PROFILES, []);

  return (
    <BottomSheet visible={visible} onDismiss={onDismiss} heightRatio={0.82} accentColor={active.accent}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeIn.duration(280)}>
          <Text style={[styles.eyebrow, { color: c.textSubtle }]}>HOUSEHOLD STAFF</Text>
          <Text style={[styles.title, { color: c.text }]}>Majordomo</Text>
          <Text style={[styles.lead, { color: c.textMuted }]}>
            One character. One voice. Same household tools.
          </Text>
        </Animated.View>

        <Animated.View
          entering={FadeInDown.delay(60).duration(320)}
          style={[styles.hero, { borderColor: `${active.accent}55` }]}>
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <BlurView
              intensity={Platform.OS === 'ios' ? 56 : 80}
              tint={resolveBlurTint(isDark)}
              experimentalBlurMethod={androidBlurMethod}
              style={StyleSheet.absoluteFill}
            />
            <LinearGradient
              colors={[`${active.accent}${isDark ? '99' : '77'}`, `${active.accent}22`, 'transparent']}
              locations={[0, 0.55, 1]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
          </View>
          <View style={[styles.heroDot, { backgroundColor: active.accent }]} />
          <View style={{ flex: 1, zIndex: 1 }}>
            <Text style={[styles.heroName, { color: c.text }]}>{active.displayName}</Text>
            <Text style={[styles.heroRole, { color: c.textMuted }]}>{active.role}</Text>
            <Text style={[styles.heroVoice, { color: c.textSubtle }]}>
              Voice · {active.voice}
            </Text>
          </View>
        </Animated.View>

        <Text style={[styles.sectionLabel, { color: c.textSubtle }]}>
          {canManageHousehold ? 'Household default' : 'Available profiles'}
        </Text>

        <View style={styles.list}>
          {rows.map((profile, index) => {
            const isActiveRow = activeId === profile.id;
            return (
              <Animated.View
                key={profile.id}
                entering={FadeInDown.delay(80 + index * 28).duration(280)}>
                <Pressable
                  onPress={() => {
                    if (canManageHousehold) {
                      onSelectHousehold(profile.id);
                      if (usingPersonal) onSelectPersonal(null);
                    } else {
                      onSelectPersonal(profile.id);
                    }
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isActiveRow }}
                  accessibilityLabel={`${profile.displayName}, ${profile.role}`}
                  style={[
                    styles.row,
                    {
                      backgroundColor: isActiveRow
                        ? `${profile.accent}14`
                        : isDark
                          ? 'rgba(255,255,255,0.03)'
                          : glass(0.35),
                      borderColor: isActiveRow ? `${profile.accent}55` : glassBorder(0.06),
                    },
                  ]}>
                  <View style={[styles.swatch, { backgroundColor: profile.accent }]} />
                  <View style={styles.rowCopy}>
                    <Text style={[styles.rowName, { color: c.text }]}>{profile.displayName}</Text>
                    <Text style={[styles.rowRole, { color: c.textMuted }]}>{profile.role}</Text>
                    <Text style={[styles.rowPersonality, { color: c.textSubtle }]} numberOfLines={2}>
                      {profile.personality}
                    </Text>
                  </View>
                  <View style={styles.rowMeta}>
                    <Text style={[styles.voiceChip, { color: c.textSubtle }]}>
                      {profile.voice}
                    </Text>
                    {isActiveRow ? (
                      <View style={[styles.check, { backgroundColor: profile.accent }]} />
                    ) : (
                      <View style={[styles.checkIdle, { borderColor: glassBorder(0.12) }]} />
                    )}
                  </View>
                </Pressable>
              </Animated.View>
            );
          })}
        </View>

        {canManageHousehold ? (
          <View style={styles.personalBlock}>
            <Text style={[styles.sectionLabel, { color: c.textSubtle }]}>
              For {memberName ?? 'you'} only
            </Text>
            <Text style={[styles.personalHint, { color: c.textMuted }]}>
              Optional override. Leave off to use the household default.
            </Text>
            <Pressable
              onPress={() => onSelectPersonal(null)}
              style={[
                styles.resetRow,
                {
                  borderColor: glassBorder(0.08),
                  backgroundColor: !usingPersonal ? `${active.accent}12` : glass(0.2),
                },
              ]}>
              <Text style={[styles.resetText, { color: c.text }]}>
                {!usingPersonal ? 'Using household default' : 'Clear personal override'}
              </Text>
            </Pressable>
            {usingPersonal ? null : (
              <View style={styles.personalPicks}>
                {rows.slice(0, 4).map((profile) => (
                  <Pressable
                    key={`p-${profile.id}`}
                    onPress={() => onSelectPersonal(profile.id)}
                    style={[styles.miniChip, { borderColor: glassBorder(0.1) }]}>
                    <View style={[styles.miniDot, { backgroundColor: profile.accent }]} />
                    <Text style={[styles.miniLabel, { color: c.textMuted }]}>
                      {profile.displayName}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
            {usingPersonal ? (
              <View style={styles.personalPicks}>
                {rows.map((profile) => (
                  <Pressable
                    key={`po-${profile.id}`}
                    onPress={() => onSelectPersonal(profile.id)}
                    style={[
                      styles.miniChip,
                      {
                        borderColor:
                          memberProfileId === profile.id
                            ? `${profile.accent}66`
                            : glassBorder(0.1),
                        backgroundColor:
                          memberProfileId === profile.id ? `${profile.accent}14` : 'transparent',
                      },
                    ]}>
                    <View style={[styles.miniDot, { backgroundColor: profile.accent }]} />
                    <Text style={[styles.miniLabel, { color: c.textMuted }]}>
                      {profile.displayName}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}

        <Text style={[styles.footnote, { color: c.textSubtle }]}>
          Capabilities stay the same. Character changes how they speak.
        </Text>
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: space.lg,
    paddingBottom: space.xxl,
    gap: 10,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.4,
    marginBottom: 6,
  },
  title: {
    fontSize: 34,
    fontWeight: '300',
    letterSpacing: -0.8,
    marginBottom: 8,
  },
  lead: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '400',
    marginBottom: 18,
  },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: radius.cardLarge ?? 24,
    borderWidth: 1,
    padding: 18,
    marginBottom: 18,
    overflow: 'hidden',
  },
  heroDot: {
    width: 14,
    height: 14,
    borderRadius: 999,
  },
  heroName: {
    fontSize: 22,
    fontWeight: '500',
    letterSpacing: -0.3,
  },
  heroRole: {
    fontSize: 14,
    marginTop: 2,
  },
  heroVoice: {
    fontSize: 12,
    marginTop: 6,
    letterSpacing: 0.3,
    textTransform: 'capitalize',
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.2,
    marginBottom: 8,
    marginTop: 4,
  },
  list: { gap: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 18,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  swatch: {
    width: 10,
    height: 44,
    borderRadius: 999,
  },
  rowCopy: { flex: 1, gap: 2 },
  rowName: {
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  rowRole: {
    fontSize: 13,
    fontWeight: '500',
  },
  rowPersonality: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  rowMeta: {
    alignItems: 'flex-end',
    gap: 10,
  },
  voiceChip: {
    fontSize: 11,
    letterSpacing: 0.4,
    textTransform: 'capitalize',
  },
  check: {
    width: 18,
    height: 18,
    borderRadius: 999,
  },
  checkIdle: {
    width: 18,
    height: 18,
    borderRadius: 999,
    borderWidth: 1.5,
  },
  personalBlock: {
    marginTop: 18,
    gap: 8,
  },
  personalHint: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 4,
  },
  resetRow: {
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  resetText: {
    fontSize: 15,
    fontWeight: '500',
  },
  personalPicks: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  miniChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  miniDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  miniLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  footnote: {
    marginTop: 22,
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
  },
});
