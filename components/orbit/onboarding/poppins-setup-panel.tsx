/**
 * Get Started — full Poppins household setup (voice, persona, control, alerts).
 * Mirrors Settings → Poppins with onboarding-first hierarchy and cost clarity.
 */
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { AppText as Text } from '@/components/orbit/app-text';
import { SegmentedControl } from '@/components/orbit/segmented-control';
import { SettingsGroup, SettingsToggleRow } from '@/components/orbit/settings/grouped';
import { motion } from '@/constants/motion-tokens';
import { radius, space, typography } from '@/constants/orbit-theme';
import {
  TOKEN_WEIGHT_QUIET,
  TOKEN_WEIGHT_SPEAK_BACK,
  TOKENS_PER_MONTH,
} from '@/constants/poppins-ai-rates';
import {
  MAJORDOMO_PROFILES,
  getMajordomoProfile,
  type MajordomoProfileId,
} from '@/lib/ai/majordomo-profiles';
import {
  derivedModeLine,
  type PoppinsConfirmTime,
  type PoppinsInteractionPrefs,
  type PoppinsUndoWindowSec,
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

function VoiceModeCard({
  active,
  accent,
  title,
  subtitle,
  costLabel,
  costDetail,
  icon,
  onPress,
  index,
}: {
  active: boolean;
  accent: string;
  title: string;
  subtitle: string;
  costLabel: string;
  costDetail: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  onPress: () => void;
  index: number;
}) {
  const { c, glass, glassBorder, isDark } = useOrbitColors();
  const scale = useSharedValue(active ? 1 : 0.985);

  useEffect(() => {
    scale.value = withSpring(active ? 1 : 0.985, motion.snappy);
  }, [active, scale]);

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View
      entering={FadeInDown.delay(40 + index * 45).springify()}
      style={styles.voiceCardWrap}>
      <Pressable
        accessibilityRole="radio"
        accessibilityState={{ selected: active }}
        accessibilityLabel={`${title}. ${costDetail}`}
        onPress={onPress}>
        <Animated.View
          style={[
            styles.voiceCard,
            cardStyle,
            {
              backgroundColor: active
                ? isDark
                  ? `${accent}1A`
                  : `${accent}14`
                : glass(0.05),
              borderColor: active ? `${accent}77` : glassBorder(0.1),
            },
          ]}>
          {active ? (
            <LinearGradient
              colors={[`${accent}33`, 'transparent']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />
          ) : null}
          <View style={[styles.voiceIconWell, { backgroundColor: active ? `${accent}28` : glass(0.08) }]}>
            <MaterialIcons name={icon} size={22} color={active ? accent : c.textMuted} />
          </View>
          <Text style={[styles.voiceTitle, { color: c.text }]}>{title}</Text>
          <Text style={[styles.voiceSubtitle, { color: c.textMuted }]} numberOfLines={3}>
            {subtitle}
          </Text>
          <View
            style={[
              styles.costPill,
              {
                backgroundColor: active ? `${accent}22` : glass(0.06),
                borderColor: active ? `${accent}44` : glassBorder(0.08),
              },
            ]}>
            <Text style={[styles.costPillText, { color: active ? accent : c.textSoft }]}>
              {costLabel}
            </Text>
          </View>
          <Text style={[styles.costDetail, { color: c.textSubtle }]}>{costDetail}</Text>
          <View
            style={[
              styles.radio,
              {
                borderColor: active ? accent : glassBorder(0.22),
                backgroundColor: active ? accent : 'transparent',
              },
            ]}>
            {active ? (
              <MaterialIcons name="check" size={14} color={c.ink} />
            ) : null}
          </View>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

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
  const resolvedAccent = accent ?? c.primary;
  const { prefs, majordomoProfileId } = value;
  const activePersona = getMajordomoProfile(majordomoProfileId);
  const speakBack = prefs.speakBack;
  const quietActs = Math.floor(TOKENS_PER_MONTH / TOKEN_WEIGHT_QUIET);
  const spokenActs = Math.floor(TOKENS_PER_MONTH / TOKEN_WEIGHT_SPEAK_BACK);

  const patchPrefs = (patch: Partial<PoppinsInteractionPrefs>) => {
    onChange({ ...value, prefs: { ...prefs, ...patch } });
  };

  const selectVoice = (nextSpeakBack: boolean) => {
    void Haptics.selectionAsync();
    patchPrefs({ speakBack: nextSpeakBack });
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
          Choose how {activePersona.displayName} talks, acts, and notifies your household. You can
          change every setting later.
        </Text>
      </Animated.View>

      <Text style={[styles.sectionLabel, { color: c.textSubtle }]}>Reply style</Text>
      <View style={styles.voiceRow}>
        <VoiceModeCard
          index={0}
          active={!speakBack}
          accent={resolvedAccent}
          icon="visibility"
          title="Just show me"
          subtitle="Poppins listens quietly and fills the screen. Best for shared rooms and kids."
          costLabel={`${TOKEN_WEIGHT_QUIET} action each`}
          costDetail={`~${quietActs}/mo on your plan`}
          onPress={() => selectVoice(false)}
        />
        <VoiceModeCard
          index={1}
          active={speakBack}
          accent={resolvedAccent}
          icon="record-voice-over"
          title="Talk to me"
          subtitle="Poppins answers out loud with a live voice. Richer — and costs more per action."
          costLabel={`~${TOKEN_WEIGHT_SPEAK_BACK} actions each`}
          costDetail={`~${spokenActs}/mo on your plan`}
          onPress={() => selectVoice(true)}
        />
      </View>

      <View
        style={[
          styles.costBanner,
          {
            backgroundColor: glass(0.05),
            borderColor: glassBorder(0.1),
          },
        ]}>
        <MaterialIcons
          name={speakBack ? 'graphic-eq' : 'graphic-eq'}
          size={18}
          color={speakBack ? c.warning : c.success}
        />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[styles.costBannerTitle, { color: c.text }]}>
            {speakBack ? 'Speak back uses more of your monthly actions' : 'Quiet is the lighter option'}
          </Text>
          <Text style={[styles.costBannerBody, { color: c.textMuted }]}>
            {speakBack
              ? `Each spoken turn uses about ${TOKEN_WEIGHT_SPEAK_BACK} actions (vs ${TOKEN_WEIGHT_QUIET} for Just show me). Your plan includes ${TOKENS_PER_MONTH} actions per month.`
              : `Each quiet turn uses ${TOKEN_WEIGHT_QUIET} action. Talk to me is available anytime when you want a spoken reply.`}
          </Text>
        </View>
      </View>

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

      <Text style={[styles.sectionLabel, { color: c.textSubtle }]}>How Poppins acts</Text>
      <SettingsGroup footer="Act immediately skips the pause before saving. You can still undo for a few seconds.">
        <SettingsToggleRow
          label="Act immediately"
          subtitle="Skip the hold — Direct control when slots are filled."
          value={prefs.actImmediately}
          onValueChange={(actImmediately) => {
            void Haptics.selectionAsync();
            patchPrefs({ actImmediately });
          }}
        />
        <SettingsToggleRow
          label="Show thinking"
          subtitle='A short "thinking" moment while Poppins works it out.'
          value={prefs.showThinking}
          onValueChange={(showThinking) => {
            void Haptics.selectionAsync();
            patchPrefs({ showThinking });
          }}
        />
        <SettingsToggleRow
          label="Written replies"
          subtitle="Show answers on screen. Questions always appear."
          value={prefs.writtenReplies}
          last
          onValueChange={(writtenReplies) => {
            void Haptics.selectionAsync();
            patchPrefs({ writtenReplies });
          }}
        />
      </SettingsGroup>

      {!prefs.actImmediately ? (
        <SettingsGroup footer="Fine-tune Guided confirm and undo timing.">
          <View style={styles.segmentPad}>
            <SegmentedControl
              label="Confirm time — silence before saving"
              options={[
                { value: 'quick', label: 'Quick' },
                { value: 'normal', label: 'Normal' },
                { value: 'relaxed', label: 'Relaxed' },
              ]}
              value={prefs.confirmTime}
              onChange={(confirmTime: PoppinsConfirmTime) => {
                void Haptics.selectionAsync();
                patchPrefs({ confirmTime });
              }}
            />
          </View>
          <View style={[styles.segmentPad, { paddingBottom: 12 }]}>
            <SegmentedControl
              label="Undo window — after saving"
              options={[
                { value: '5', label: '5 s' },
                { value: '10', label: '10 s' },
                { value: '15', label: '15 s' },
              ]}
              value={String(prefs.undoWindowSec) as '5' | '10' | '15'}
              onChange={(sec) => {
                void Haptics.selectionAsync();
                patchPrefs({ undoWindowSec: Number(sec) as PoppinsUndoWindowSec });
              }}
            />
          </View>
        </SettingsGroup>
      ) : null}

      <Text style={[styles.sectionLabel, { color: c.textSubtle }]}>Notifications</Text>
      <SettingsGroup footer="Approve or change suggestions without opening the app.">
        <SettingsToggleRow
          label="Notification actions"
          subtitle="Approve or change Poppins' suggestions from a notification."
          value={prefs.notificationActions}
          last
          onValueChange={(notificationActions) => {
            void Haptics.selectionAsync();
            patchPrefs({ notificationActions });
          }}
        />
      </SettingsGroup>

      <View
        style={[
          styles.summaryBar,
          { backgroundColor: `${resolvedAccent}14`, borderColor: `${resolvedAccent}33` },
        ]}>
        <MaterialIcons name="auto-awesome" size={16} color={resolvedAccent} />
        <Text style={[styles.summaryText, { color: c.textSoft }]}>{derivedModeLine(prefs)}</Text>
      </View>
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
  segmentPad: {
    paddingHorizontal: 14,
    paddingTop: 12,
  },
  summaryBar: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  summaryText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
});
