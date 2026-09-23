/**
 * Get Started — full Poppins household setup (voice, persona, control, alerts).
 * Mirrors Settings → Poppins with onboarding-first hierarchy and cost clarity.
 */
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { AppText as Text } from '@/components/orbit/app-text';
import { PoppinsAdvancedSheet } from '@/components/orbit/poppins-advanced-sheet';
import { PoppinsModeCards } from '@/components/orbit/poppins-mode-cards';
import { radius, space } from '@/constants/orbit-theme';
import {
  MAJORDOMO_PROFILES,
  getMajordomoProfile,
  type MajordomoProfileId,
} from '@/lib/ai/majordomo-profiles';
import {
  prefsForTier,
  type PoppinsInteractionPrefs,
} from '@/lib/poppins/poppins-prefs';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';

export type PoppinsSetupValue = {
  prefs: PoppinsInteractionPrefs;
  majordomoProfileId: MajordomoProfileId;
};

type PoppinsSetupPanelProps = {
  value: PoppinsSetupValue;
  onChange: (next: PoppinsSetupValue) => void;
  accent?: string;
};

const FEATURED_PERSONAS: MajordomoProfileId[] = [
  'poppins',
  'steward',
  'intelligence',
  'wit',
  'companion',
  'operator',
];

function PersonaChip({
  profileId,
  active,
  onPress,
  index,
}: {
  profileId: MajordomoProfileId;
  active: boolean;
  onPress: () => void;
  index: number;
}) {
  const { c, glass, glassBorder } = useOrbitColors();
  const profile = getMajordomoProfile(profileId);

  return (
    <Animated.View entering={FadeInDown.delay(120 + index * 35).springify()}>
      <Pressable
        accessibilityRole="radio"
        accessibilityState={{ selected: active }}
        accessibilityLabel={`${profile.displayName}, ${profile.role}`}
        onPress={onPress}
        style={[
          styles.personaChip,
          {
            backgroundColor: active ? `${profile.accent}18` : glass(0.05),
            borderColor: active ? `${profile.accent}66` : glassBorder(0.1),
          },
        ]}>
        <View style={[styles.personaDot, { backgroundColor: profile.accent }]} />
        <View style={styles.personaCopy}>
          <Text style={[styles.personaName, { color: c.text }]}>{profile.displayName}</Text>
          <Text style={[styles.personaRole, { color: c.textMuted }]} numberOfLines={1}>
            {profile.role}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

/** Full Poppins onboarding settings — voice, persona, control, notifications. */
export function PoppinsSetupPanel({ value, onChange, accent }: PoppinsSetupPanelProps) {
  const { c, glass, glassBorder } = useOrbitColors();
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const resolvedAccent = accent ?? c.primary;
  const { prefs, majordomoProfileId } = value;
  const activePersona = getMajordomoProfile(majordomoProfileId);

  const patchPrefs = (patch: Partial<PoppinsInteractionPrefs>) => {
    onChange({ ...value, prefs: { ...prefs, ...patch } });
  };

  const selectPersona = (id: MajordomoProfileId) => {
    void Haptics.selectionAsync();
    onChange({ ...value, majordomoProfileId: id });
  };

  return (
    <View style={styles.root}>
      <Animated.View entering={FadeInDown.delay(20).springify()} style={styles.heroBlock}>
        <View style={[styles.heroBadge, { backgroundColor: `${activePersona.accent}22` }]}>
          <View style={[styles.heroDot, { backgroundColor: activePersona.accent }]} />
          <Text style={[styles.heroBadgeText, { color: activePersona.accent }]}>
            {activePersona.displayName}
          </Text>
        </View>
        <Text style={[styles.lead, { color: c.textMuted }]}>
          Choose Poppins Base or Poppins Max. You can fine-tune later in Advanced.
        </Text>
      </Animated.View>

      <PoppinsModeCards
        prefs={prefs}
        accent={resolvedAccent}
        onSelectTier={(tier) => {
          onChange({ ...value, prefs: prefsForTier(tier) });
        }}
      />

      <Pressable
        onPress={() => setAdvancedOpen(true)}
        style={[styles.advancedRow, { borderColor: glassBorder(0.1), backgroundColor: glass(0.04) }]}>
        <Text style={[styles.advancedLabel, { color: c.text }]}>Advanced</Text>
        <Text style={[styles.advancedHint, { color: c.textMuted }]}>
          Confirm, undo, thinking, replies, notifications
        </Text>
      </Pressable>

      <Text style={[styles.sectionLabel, { color: c.textSubtle }]}>Who speaks</Text>
      <Text style={[styles.sectionHint, { color: c.textMuted }]}>
        Personality and voice for the household. Same tools — different presence.
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.personaRow}
        style={styles.personaScroll}>
        {FEATURED_PERSONAS.map((id, index) => (
          <PersonaChip
            key={id}
            profileId={id}
            index={index}
            active={majordomoProfileId === id}
            onPress={() => selectPersona(id)}
          />
        ))}
        {MAJORDOMO_PROFILES.filter((p) => !FEATURED_PERSONAS.includes(p.id)).map((profile, index) => (
          <PersonaChip
            key={profile.id}
            profileId={profile.id}
            index={FEATURED_PERSONAS.length + index}
            active={majordomoProfileId === profile.id}
            onPress={() => selectPersona(profile.id)}
          />
        ))}
      </ScrollView>
      <Text style={[styles.personaPersonality, { color: c.textSubtle }]}>
        {activePersona.personality}
      </Text>
      <PoppinsAdvancedSheet
        visible={advancedOpen}
        prefs={prefs}
        onDismiss={() => setAdvancedOpen(false)}
        onChange={(next) => patchPrefs(next)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: space.md,
    marginBottom: space.lg,
    width: '100%',
  },
  heroBlock: {
    gap: 8,
    marginBottom: 4,
  },
  heroBadge: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderCurve: 'continuous',
    borderRadius: radius.full,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  heroDot: {
    borderRadius: 5,
    height: 10,
    width: 10,
  },
  heroBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  lead: {
    fontSize: 14,
    lineHeight: 20,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginTop: 4,
    textTransform: 'uppercase',
  },
  sectionHint: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: -6,
  },
  voiceRow: {
    flexDirection: 'row',
    gap: 10,
  },
  voiceCardWrap: {
    flex: 1,
  },
  voiceCard: {
    borderCurve: 'continuous',
    borderRadius: radius.card,
    borderWidth: 1,
    gap: 8,
    minHeight: 210,
    overflow: 'hidden',
    padding: 14,
    paddingBottom: 16,
  },
  voiceIconWell: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 12,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  voiceTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  voiceSubtitle: {
    fontSize: 12,
    lineHeight: 16,
    minHeight: 48,
  },
  costPill: {
    alignSelf: 'flex-start',
    borderCurve: 'continuous',
    borderRadius: radius.full,
    borderWidth: 1,
    marginTop: 2,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  costPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  costDetail: {
    fontSize: 11,
    lineHeight: 14,
  },
  radio: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 11,
    borderWidth: 1.5,
    height: 22,
    justifyContent: 'center',
    marginTop: 'auto',
    width: 22,
  },
  costBanner: {
    alignItems: 'flex-start',
    borderCurve: 'continuous',
    borderRadius: radius.card,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    padding: 12,
  },
  costBannerTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  costBannerBody: {
    fontSize: 12,
    lineHeight: 17,
  },
  personaScroll: {
    marginHorizontal: -4,
  },
  personaRow: {
    gap: 8,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  personaChip: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    maxWidth: 168,
    minWidth: 148,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  personaDot: {
    borderRadius: 7,
    height: 14,
    width: 14,
  },
  personaCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  personaName: {
    fontSize: 14,
    fontWeight: '700',
  },
  personaRole: {
    fontSize: 11,
    lineHeight: 14,
  },
  personaPersonality: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: -4,
  },
  advancedRow: {
    borderCurve: 'continuous',
    borderRadius: radius.card,
    borderWidth: 1,
    gap: 2,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  advancedLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  advancedHint: {
    fontSize: 12,
    lineHeight: 16,
  },
});
