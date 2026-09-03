import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { motion } from '@/constants/motion-tokens';
import { radius, space, typography } from '@/constants/orbit-theme';
import {
  DEFAULT_REWARD_PACKAGE_ID,
  REWARD_PACKAGES,
  type RewardPackage,
  type RewardPackageId,
} from '@/lib/rewards/reward-packages';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { AppText as Text } from '@/components/orbit/app-text';

type RewardPackagePickerProps = {
  selectedId: RewardPackageId | null;
  onSelect: (id: RewardPackageId) => void;
  accent?: string;
};

function PackageCard({
  pack,
  active,
  accent,
  onPress,
  index,
}: {
  pack: RewardPackage;
  active: boolean;
  accent: string;
  onPress: () => void;
  index: number;
}) {
  const { c, glass, glassBorder } = useOrbitColors();
  const scale = useSharedValue(active ? 1 : 0.98);

  useEffect(() => {
    scale.value = withSpring(active ? 1 : 0.98, motion.snappy);
  }, [active, scale]);

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View entering={FadeInDown.delay(60 + index * 50).springify()}>
      <Pressable
        accessibilityRole="radio"
        accessibilityState={{ selected: active }}
        onPress={onPress}>
        <Animated.View
          style={[
            styles.card,
            cardStyle,
            {
              backgroundColor: active ? `${accent}18` : glass(0.05),
              borderColor: active ? `${accent}66` : glassBorder(0.12),
            },
          ]}>
          <View style={styles.cardTop}>
            <View style={[styles.emojiWrap, { backgroundColor: `${accent}22` }]}>
              <Text style={styles.emoji}>{pack.emoji}</Text>
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <View style={styles.titleRow}>
                <Text style={[styles.title, { color: c.text }]}>{pack.title}</Text>
                {pack.recommended ? (
                  <View style={[styles.pill, { backgroundColor: `${accent}33` }]}>
                    <Text style={[styles.pillText, { color: accent }]}>Recommended</Text>
                  </View>
                ) : null}
              </View>
              <Text style={[styles.tagline, { color: c.textMuted }]}>{pack.tagline}</Text>
            </View>
            <View
              style={[
                styles.radio,
                {
                  borderColor: active ? accent : glassBorder(0.2),
                  backgroundColor: active ? accent : 'transparent',
                },
              ]}>
              {active ? <Text style={[styles.check, { color: c.ink }]}>✓</Text> : null}
            </View>
          </View>
          <View style={styles.chips}>
            {pack.highlights.map((chip) => (
              <View
                key={chip}
                style={[
                  styles.chip,
                  {
                    backgroundColor: active ? `${accent}14` : glass(0.04),
                    borderColor: active ? `${accent}33` : glassBorder(0.08),
                  },
                ]}>
                <Text style={[styles.chipText, { color: active ? c.text : c.textMuted }]}>
                  {chip}
                </Text>
              </View>
            ))}
          </View>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

/** Get Started reward bundles — playful cards, calm hierarchy. */
export function RewardPackagePicker({ selectedId, onSelect, accent }: RewardPackagePickerProps) {
  const { c } = useOrbitColors();
  const resolvedAccent = accent ?? c.primary;
  const resolvedId = selectedId ?? DEFAULT_REWARD_PACKAGE_ID;

  const pick = (id: RewardPackageId) => {
    void Haptics.selectionAsync();
    onSelect(id);
  };

  return (
    <View style={styles.list}>
      {REWARD_PACKAGES.map((pack, index) => (
        <PackageCard
          key={pack.id}
          pack={pack}
          index={index}
          active={resolvedId === pack.id}
          accent={resolvedAccent}
          onPress={() => pick(pack.id)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: space.md,
    paddingVertical: space.sm,
  },
  card: {
    borderCurve: 'continuous',
    borderRadius: radius.cardLarge,
    borderWidth: 1.5,
    gap: space.md,
    padding: space.lg,
  },
  cardTop: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: space.md,
  },
  emojiWrap: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 18,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  emoji: {
    fontSize: 26,
  },
  titleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  title: {
    ...typography.headline,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  pill: {
    borderCurve: 'continuous',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  pillText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  tagline: {
    ...typography.footnote,
    lineHeight: 20,
  },
  radio: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 2,
    height: 24,
    justifyContent: 'center',
    marginTop: 4,
    width: 24,
  },
  check: {
    fontSize: 13,
    fontWeight: '800',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderCurve: 'continuous',
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
