/**
 * Poppins Base and Poppins Max, told as a picture.
 *
 * The difference between them is one thing — whether Poppins talks back — and that one thing
 * is what makes Max cost more. So each card carries the same two signals:
 *
 *   what it does   Base draws written lines coming out of the orb; Max draws sound rings
 *                  leaving it, breathing while it's the chosen tier.
 *   what it costs   a row of pips: one lit for Base, a dense run for Max, plus how far a
 *                  month goes at that rate (300 written things, or about eight conversations).
 *
 * No prices in dollars here: the household's month is measured in actions, and that is what
 * people actually spend.
 */
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { AppText as Text } from '@/components/orbit/app-text';
import { Moji } from '@/components/orbit/moji/moji';
import {
  TOKENS_PER_MONTH,
  TOKEN_WEIGHT_QUIET,
  TOKEN_WEIGHT_SPEAK_BACK,
} from '@/constants/poppins-ai-rates';
import { poppinsTier, type PoppinsInteractionPrefs } from '@/lib/poppins/poppins-prefs';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';

export const BASE_TONE = '#4FA3FF';
export const MAX_TONE = '#8E7CFF';

type Tier = 'base' | 'max';

const COPY: Record<
  Tier,
  { name: string; tagline: string; does: string; cost: string; pips: number; tone: string }
> = {
  base: {
    name: 'Poppins Base',
    tagline: 'Listens, writes it down',
    does: 'Nothing is spoken back.',
    cost: `${TOKEN_WEIGHT_QUIET} action each`,
    pips: 1,
    tone: BASE_TONE,
  },
  max: {
    name: 'Poppins Max',
    tagline: 'Talks back out loud',
    does: 'A real conversation. Costs more.',
    cost: `~${TOKEN_WEIGHT_SPEAK_BACK} actions each`,
    pips: 10,
    tone: MAX_TONE,
  },
};

/** How far a month goes at each rate — the honest comparison. */
function monthLine(tier: Tier): string {
  if (tier === 'base') return `${TOKENS_PER_MONTH} a month`;
  const conversations = Math.floor(TOKENS_PER_MONTH / TOKEN_WEIGHT_SPEAK_BACK);
  return `~${conversations} chats a month`;
}

type Props = {
  prefs: PoppinsInteractionPrefs;
  disabled?: boolean;
  onSelectTier: (tier: Tier) => void;
};

export function PoppinsTierCards({ prefs, disabled, onSelectTier }: Props) {
  const tier = poppinsTier(prefs);
  const chosen: Tier = prefs.speakBack ? 'max' : 'base';
  const { c } = useOrbitColors();

  return (
    <View style={styles.stack}>
      {(['base', 'max'] as const).map((key) => (
        <TierCard
          key={key}
          tier={key}
          selected={chosen === key}
          disabled={disabled}
          onPress={() => onSelectTier(key)}
        />
      ))}
      {tier === 'custom' ? (
        <Text style={[styles.custom, { color: c.textMuted }]}>
          Advanced is tuned, so this household is Custom. Tapping a card above resets it.
        </Text>
      ) : null}
    </View>
  );
}

function TierCard({
  tier,
  selected,
  disabled,
  onPress,
}: {
  tier: Tier;
  selected: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const { c, glass, glassBorder, isDark } = useOrbitColors();
  const copy = COPY[tier];
  const breath = useSharedValue(0);

  useEffect(() => {
    if (!selected) {
      breath.set(withTiming(0, { duration: 260 }));
      return;
    }
    breath.set(
      withRepeat(
        withSequence(
          withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: 1500, easing: Easing.inOut(Easing.sin) })
        ),
        -1
      )
    );
  }, [breath, selected]);

  return (
    <Pressable
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      accessibilityLabel={`${copy.name}. ${copy.tagline}. ${copy.cost}, ${monthLine(tier)}.`}
      onPress={() => {
        if (disabled) return;
        void Haptics.selectionAsync();
        onPress();
      }}
      style={[
        styles.card,
        {
          backgroundColor: selected ? (isDark ? `${copy.tone}1A` : `${copy.tone}12`) : glass(0.05),
          borderColor: selected ? `${copy.tone}88` : glassBorder(0.1),
          opacity: disabled ? 0.55 : 1,
        },
      ]}>
      {selected ? (
        <LinearGradient
          colors={[`${copy.tone}33`, 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.fill}
          pointerEvents="none"
        />
      ) : null}

      <View style={styles.head}>
        <TierMark tier={tier} tone={copy.tone} selected={selected} breath={breath} />
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Text style={[styles.name, { color: c.text }]}>{copy.name}</Text>
          <Text style={[styles.tagline, { color: copy.tone }]}>{copy.tagline}</Text>
        </View>
        <View
          style={[
            styles.radio,
            {
              borderColor: selected ? copy.tone : glassBorder(0.22),
              backgroundColor: selected ? copy.tone : 'transparent',
            },
          ]}>
          {selected ? <Moji name="check" size={12} /> : null}
        </View>
      </View>

      <Text style={[styles.does, { color: c.textSoft }]}>{copy.does}</Text>

      {/*
        What it costs. The words sit on their own line above the pips: side by side, a long
        cost ran straight into them.
      */}
      <View style={[styles.costRow, { borderTopColor: glassBorder(0.08) }]}>
        <View style={styles.costLine}>
          <Text style={[styles.cost, { color: c.text }]} numberOfLines={1}>
            {copy.cost}
          </Text>
          <Text style={[styles.month, { color: c.textMuted }]} numberOfLines={1}>
            {monthLine(tier)}
          </Text>
        </View>
        <View style={styles.pips}>
          {Array.from({ length: 10 }, (_, index) => (
            <View
              key={index}
              style={[
                styles.pip,
                {
                  backgroundColor: index < copy.pips ? copy.tone : glassBorder(0.14),
                  flex: index < copy.pips ? 1.4 : 1,
                },
              ]}
            />
          ))}
        </View>
      </View>
    </Pressable>
  );
}

/**
 * The orb, and which mic it wears. Base: a listening mic. Max: a speaking mic with sound
 * arcs, plus breathing rings when it's the chosen tier.
 */
function TierMark({
  tier,
  tone,
  selected,
  breath,
}: {
  tier: Tier;
  tone: string;
  selected: boolean;
  breath: SharedValue<number>;
}) {
  const ring1 = useAnimatedStyle(() => ({
    opacity: selected ? 0.5 - breath.value * 0.2 : 0.3,
    transform: [{ scale: 1 + breath.value * 0.18 }],
  }));
  const ring2 = useAnimatedStyle(() => ({
    opacity: selected ? 0.32 - breath.value * 0.18 : 0.18,
    transform: [{ scale: 1.2 + breath.value * 0.26 }],
  }));

  return (
    <View style={styles.mark}>
      {tier === 'max' ? (
        <>
          <Animated.View style={[styles.ring, { borderColor: tone }, ring1]} pointerEvents="none" />
          <Animated.View style={[styles.ring, { borderColor: tone }, ring2]} pointerEvents="none" />
        </>
      ) : null}
      <View style={[styles.orb, { backgroundColor: `${tone}2E`, borderColor: `${tone}66` }]}>
        <Moji name="poppins" size={24} />
      </View>
      <View
        style={[styles.badge, { backgroundColor: `${tone}E6` }]}
        pointerEvents="none"
        accessible={false}>
        <Moji name={tier === 'base' ? 'mic' : 'micSpeak'} size={13} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 12 },
  card: {
    borderCurve: 'continuous',
    borderRadius: 22,
    borderWidth: 1,
    gap: 10,
    overflow: 'hidden',
    padding: 16,
  },
  fill: { bottom: 0, left: 0, position: 'absolute', right: 0, top: 0 },
  head: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  mark: { alignItems: 'center', height: 56, justifyContent: 'center', width: 56 },
  badge: {
    alignItems: 'center',
    borderRadius: 10,
    bottom: 2,
    height: 20,
    justifyContent: 'center',
    position: 'absolute',
    right: 2,
    width: 20,
  },
  orb: {
    alignItems: 'center',
    borderRadius: 17,
    borderWidth: 1,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  ring: { borderRadius: 29, borderWidth: 1.5, height: 52, position: 'absolute', width: 52 },
  name: { fontSize: 17, fontWeight: '800', letterSpacing: -0.3 },
  tagline: { fontSize: 12.5, fontWeight: '800', letterSpacing: 0.1 },
  radio: {
    alignItems: 'center',
    borderRadius: 11,
    borderWidth: 1.5,
    height: 22,
    justifyContent: 'center',
    width: 22,
  },
  does: { fontSize: 13, lineHeight: 18 },
  costRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 8,
    paddingTop: 10,
  },
  costLine: {
    alignItems: 'baseline',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  pips: { alignItems: 'center', flexDirection: 'row', gap: 3 },
  pip: { borderRadius: 2, height: 5 },
  cost: { flexShrink: 1, fontSize: 14, fontWeight: '800' },
  month: { flexShrink: 0, fontSize: 12 },
  custom: { fontSize: 12.5, lineHeight: 18, paddingHorizontal: 4 },
});
