/**
 * First screen after Get Started — plain context before reward-model choices.
 * One composition: what ChoreMaxx is, then Continue into reward strategy.
 */
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { AppText as Text } from '@/components/orbit/app-text';
import { ChoremaxxLogo } from '@/components/orbit/choremaxx-logo';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { space, typography } from '@/constants/orbit-theme';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';

const POINTS = [
  {
    title: 'One household, shared work',
    body: 'Tasks, groceries, and ranks live in one place so everyone sees the same picture.',
  },
  {
    title: 'Poppins helps you run it',
    body: 'Speak or type — chores, lists, and plans fill in without hunting through menus.',
  },
  {
    title: 'You pick how effort pays off',
    body: 'Next you’ll choose XP, rewards, allowance, or a mix — and whether harder chores earn more points or everyone earns the same. Change any of it later in Settings.',
  },
] as const;

export function OrbitBrief({
  accent,
  onContinue,
  onBack,
}: {
  accent: string;
  onContinue: () => void;
  onBack: () => void;
}) {
  const { c } = useOrbitColors();

  return (
    <View style={styles.root}>
      <Pressable
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel="Back"
        hitSlop={10}
        style={styles.backRow}>
        <MaterialIcons name="chevron-left" size={22} color={accent} />
        <Text style={[styles.back, { color: accent }]}>Back</Text>
      </Pressable>

      <Animated.View entering={FadeIn.duration(280)} style={styles.brand}>
        <ChoremaxxLogo size="md" />
        <Text style={[typography.title1, styles.title, { color: c.text }]}>
          Turn Chores into XP. Run Your Household Like Never Before.
        </Text>
        <Text style={[styles.lede, { color: c.textMuted }]}>
          ChoreMaxx is the operating system for your household — shared work, Poppins, then you
          choose how effort pays off.
        </Text>
      </Animated.View>

      <View style={styles.points}>
        {POINTS.map((point, index) => (
          <Animated.View
            key={point.title}
            entering={FadeInDown.delay(80 + index * 70).duration(320)}
            style={styles.point}>
            <View style={[styles.mark, { backgroundColor: `${accent}28` }]}>
              <Text style={[styles.markText, { color: accent }]}>{index + 1}</Text>
            </View>
            <View style={styles.pointCopy}>
              <Text style={[styles.pointTitle, { color: c.text }]}>{point.title}</Text>
              <Text style={[styles.pointBody, { color: c.textMuted }]}>{point.body}</Text>
            </View>
          </Animated.View>
        ))}
      </View>

      <OrbitButton onPress={onContinue}>Continue</OrbitButton>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexGrow: 1,
    gap: space.lg,
    paddingBottom: space.xl,
  },
  backRow: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: 2,
    marginBottom: 4,
    marginLeft: -6,
  },
  back: {
    fontSize: 17,
    fontWeight: '600',
  },
  brand: {
    gap: 12,
  },
  title: {
    letterSpacing: -0.6,
  },
  lede: {
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 23,
  },
  points: {
    gap: 18,
  },
  point: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'flex-start',
  },
  mark: {
    width: 32,
    height: 32,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  markText: {
    fontSize: 15,
    fontWeight: '800',
  },
  pointCopy: {
    flex: 1,
    gap: 4,
  },
  pointTitle: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  pointBody: {
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 21,
  },
});
