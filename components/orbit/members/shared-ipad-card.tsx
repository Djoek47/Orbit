import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { radius, space } from '@/constants/orbit-theme';
import { glassFill, useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { AppText as Text } from '@/components/orbit/app-text';

type Props = {
  accent: string;
};

export function SharedIpadCard({ accent }: Props) {
  const { c, isDark, glassBorder } = useOrbitColors();

  return (
    <View style={styles.block}>
      <Text style={[styles.sectionLabel, { color: c.textSubtle }]}>SHARED IPAD</Text>
      <View
        style={[
          styles.card,
          {
            backgroundColor: glassFill(isDark),
            borderColor: glassBorder(0.1),
          },
        ]}>
        <View style={styles.cardHead}>
          <MaterialIcons name="tablet-mac" size={20} color={accent} />
          <Text style={[styles.cardTitle, { color: c.text }]}>This iPad</Text>
        </View>
        <Text style={[styles.cardBody, { color: c.textMuted }]}>
          Scan each Sidekick&apos;s profile QR. They pick their face when they open the app.
        </Text>
        <Pressable
          onPress={() => router.push('/setup-kid-device' as never)}
          style={({ pressed }) => [
            styles.action,
            {
              borderColor: `${accent}55`,
              backgroundColor: pressed ? `${accent}28` : `${accent}12`,
            },
          ]}>
          <Text style={[styles.actionText, { color: accent }]}>Set up this iPad</Text>
          <MaterialIcons name="arrow-forward" size={16} color={accent} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: space.sm,
    marginBottom: space.lg,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.1,
    marginLeft: 4,
  },
  card: {
    borderCurve: 'continuous',
    borderRadius: radius.cardLarge,
    borderWidth: StyleSheet.hairlineWidth,
    gap: space.sm,
    padding: space.md,
  },
  cardHead: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  cardBody: {
    fontSize: 14,
    lineHeight: 20,
  },
  action: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderCurve: 'continuous',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
