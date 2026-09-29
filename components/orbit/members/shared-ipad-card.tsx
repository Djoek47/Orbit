import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { AppText as Text } from '@/components/orbit/app-text';
import { TourTarget } from '@/components/orbit/tour/tour-target';
import { radius, space } from '@/constants/orbit-theme';
import { glassFill, useOrbitColors } from '@/lib/theme/use-orbit-colors';

type Props = {
  accent: string;
};

function isIpadDevice(): boolean {
  return Platform.OS === 'ios' && Platform.isPad === true;
}

/** Shared devices entry — WO14 §0 rename (was Family iPad). */
export function SharedIpadCard({ accent }: Props) {
  const { c, isDark, glassBorder } = useOrbitColors();
  const onDevice = isIpadDevice();

  return (
    <TourTarget id="members.sharedIpad">
      <View style={styles.block}>
        <Text style={[styles.sectionLabel, { color: c.textSubtle }]}>SHARED DEVICES</Text>
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
            <Text style={[styles.cardTitle, { color: c.text }]}>
              {onDevice ? 'This device' : 'Shared devices'}
            </Text>
          </View>
          <Text style={[styles.cardBody, { color: c.textMuted }]}>
            {onDevice
              ? 'Turn this tablet into a shared device your kids use. Each one taps their face to start.'
              : 'Kids can share one phone or tablet and switch by tapping their face. Open Choremaxx on that device and set it up there.'}
          </Text>
          <Pressable
            onPress={() =>
              router.push(
                (onDevice ? '/setup-kid-device' : '/setup-kid-device?readonly=1') as never
              )
            }
            style={({ pressed }) => [
              styles.action,
              {
                borderColor: `${accent}55`,
                backgroundColor: pressed ? `${accent}28` : `${accent}12`,
              },
            ]}>
            <Text style={[styles.actionText, { color: accent }]}>
              {onDevice ? 'Set up this device' : 'How it works'}
            </Text>
            <MaterialIcons name="arrow-forward" size={16} color={accent} />
          </Pressable>
        </View>
      </View>
    </TourTarget>
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
    minHeight: 44,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
