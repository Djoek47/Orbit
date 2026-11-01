import { BlurView } from 'expo-blur';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { AppText as Text } from '@/components/orbit/app-text';
import { Moji } from '@/components/orbit/moji/moji';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { space, typography } from '@/constants/orbit-theme';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';

type Props = {
  visible: boolean;
  title: string;
  body: string;
  primaryLabel: string;
  secondaryLabel: string;
  onStart: () => void;
  onSkip: () => void;
};

/**
 * The first-run invitation. One layer only: the screen behind is blurred and dimmed, and the
 * card is opaque — nothing from underneath reads through it.
 */
export function TourWelcome({
  visible,
  title,
  body,
  primaryLabel,
  secondaryLabel,
  onStart,
  onSkip,
}: Props) {
  const { c, isDark } = useOrbitColors();
  const cardBg = isDark ? '#111827' : '#FFFFFF';
  const cardBorder = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(15,28,42,0.08)';

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <BlurView intensity={isDark ? 40 : 30} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
      <View
        style={[
          styles.backdrop,
          { backgroundColor: isDark ? 'rgba(3,6,14,0.78)' : 'rgba(15,28,42,0.45)' },
        ]}>
        <View
          accessibilityViewIsModal
          style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
          <View style={[styles.badge, { backgroundColor: isDark ? 'rgba(45,212,191,0.14)' : 'rgba(15,111,85,0.10)' }]}>
            <Moji name="sparkles" size={30} />
          </View>
          <Text style={[typography.eyebrow, { color: c.textSubtle, textAlign: 'center' }]}>
            Welcome
          </Text>
          <Text style={[typography.title2, { color: c.text, textAlign: 'center' }]}>{title}</Text>
          <Text style={[typography.body, { color: c.textMuted, textAlign: 'center', lineHeight: 22 }]}>
            {body}
          </Text>
          <View style={styles.actions}>
            <OrbitButton onPress={onStart}>{primaryLabel}</OrbitButton>
            <Pressable onPress={onSkip} hitSlop={10} accessibilityRole="button" style={styles.secondary}>
              <Text style={[typography.footnote, { color: c.textSubtle, fontWeight: '600' }]}>
                {secondaryLabel}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    alignItems: 'stretch',
    borderRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    gap: space.sm,
    maxWidth: 380,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 16,
    width: '100%',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 16 },
    elevation: 12,
  },
  badge: {
    alignItems: 'center',
    alignSelf: 'center',
    borderRadius: 22,
    height: 56,
    justifyContent: 'center',
    marginBottom: 4,
    width: 56,
  },
  actions: {
    gap: 4,
    marginTop: space.sm,
  },
  secondary: {
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
});
