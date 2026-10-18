/**
 * One house rule, picture first:
 *
 *   ┌─────────────────────────────────────────────┐
 *   │ (🔔)  The household deadline      [Change] ⌄ │  headline only
 *   │  ────●──────────●──────────●                 │  the rule's visual, when it has one
 *   │  (tap) full sentence fades in                │
 *   └─────────────────────────────────────────────┘
 *
 * The long sentence is one tap away instead of on screen. Cards spring in one after another.
 */
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { AppText as Text } from '@/components/orbit/app-text';
import { RuleVisual } from '@/components/orbit/house-rules/visuals';
import type { VisualWidgetProps } from '@/components/orbit/house-rules/visuals/types';
import { Moji } from '@/components/orbit/moji/moji';
import type { MojiName } from '@/components/orbit/moji/art';
import type { VisualKey } from '@/lib/rules/types';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';

type Props = {
  index: number;
  color: string;
  moji: MojiName;
  headline: string;
  body: string;
  visual: VisualKey;
  visualProps: VisualWidgetProps;
  fixed: boolean;
  /** Admin can change it: a pill, or a switch for on/off rules. */
  action?: { kind: 'button'; label: string; onPress: () => void } | { kind: 'switch'; value: boolean; onChange: (v: boolean) => void };
};

export function RuleCard({ index, color, moji, headline, body, visual, visualProps, fixed, action }: Props) {
  const { c, glass, glassBorder } = useOrbitColors();
  const [open, setOpen] = useState(false);
  const press = useSharedValue(1);
  const turn = useSharedValue(0);

  useEffect(() => {
    turn.set(withTiming(open ? 1 : 0, { duration: 220 }));
  }, [open, turn]);

  const cardStyle = useAnimatedStyle(() => ({ transform: [{ scale: press.value }] }));
  const chevronStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value * 180}deg` }] }));

  return (
    <Animated.View
      entering={FadeInDown.delay(90 + index * 45).duration(280)}
      layout={LinearTransition.springify().damping(20)}>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        onPressIn={() => press.set(withSpring(0.985, { damping: 26, stiffness: 320 }))}
        onPressOut={() => press.set(withSpring(1, { damping: 22, stiffness: 260 }))}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${headline}. ${open ? body : 'Tap for details.'}`}>
        <Animated.View
          style={[
            styles.card,
            cardStyle,
            { backgroundColor: glass(0.05), borderColor: open ? `${color}66` : glassBorder(0.1) },
          ]}>
          <View style={[styles.stripe, { backgroundColor: color, opacity: fixed ? 0.35 : 1 }]} />
          <View style={styles.head}>
            <View style={[styles.badge, { backgroundColor: `${color}22` }]}>
              <Moji name={moji} size={22} />
            </View>
            <Text style={[styles.headline, { color: c.text }]} numberOfLines={2}>
              {headline}
            </Text>
            {action?.kind === 'switch' ? (
              <Switch
                value={action.value}
                onValueChange={action.onChange}
                trackColor={{ false: glassBorder(0.14), true: color }}
                accessibilityLabel={headline}
              />
            ) : action?.kind === 'button' ? (
              <Pressable
                onPress={action.onPress}
                hitSlop={8}
                style={[styles.change, { backgroundColor: `${color}22` }]}
                accessibilityRole="button"
                accessibilityLabel={action.label}>
                <MaterialIcons name="tune" size={14} color={color} />
                <Text style={[styles.changeLabel, { color }]}>{action.label}</Text>
              </Pressable>
            ) : fixed ? (
              <MaterialIcons name="lock-outline" size={15} color={c.textSubtle} />
            ) : null}
            <Animated.View style={chevronStyle}>
              <MaterialIcons name="expand-more" size={20} color={c.textSubtle} />
            </Animated.View>
          </View>

          {visual !== 'none' ? <RuleVisual visual={visual} {...visualProps} /> : null}

          {open ? (
            <Animated.View entering={FadeIn.duration(220)}>
              <Text style={[styles.body, { color: c.textMuted }]}>
                <Emphasis text={body} color={c.text} />
              </Text>
            </Animated.View>
          ) : null}
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

/** Numbers and times in bold, so the sentence can be skimmed. */
function Emphasis({ text, color }: { text: string; color: string }) {
  const parts = text.split(/(\d{1,2}:\d{2}\s*(?:AM|PM)?|\d+\s*(?:XP|%|days?|minutes?|points?)|\b\d+\b)/gi);
  return (
    <>
      {parts.map((part, i) =>
        /\d/.test(part) ? (
          <Text key={i} style={{ fontWeight: '800', color }}>
            {part}
          </Text>
        ) : (
          <Text key={i}>{part}</Text>
        )
      )}
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
    paddingHorizontal: 14,
    paddingVertical: 14,
    paddingLeft: 18,
    gap: 4,
  },
  stripe: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  badge: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  headline: { flex: 1, fontSize: 17, fontWeight: '800', letterSpacing: -0.3, lineHeight: 22 },
  change: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  changeLabel: { fontSize: 13, fontWeight: '700' },
  body: { fontSize: 15, lineHeight: 22, marginTop: 10 },
});
