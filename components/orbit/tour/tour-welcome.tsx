import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { AppText as Text } from '@/components/orbit/app-text';
import { GlassCard } from '@/components/orbit/glass-card';
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

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={[styles.backdrop, { backgroundColor: isDark ? 'rgba(0,0,0,0.72)' : 'rgba(0,0,0,0.55)' }]}>
        <GlassCard style={styles.card}>
          <Text style={[typography.title2, { color: c.text, textAlign: 'center' }]}>{title}</Text>
          <Text style={[typography.body, { color: c.textMuted, textAlign: 'center' }]}>{body}</Text>
          <OrbitButton onPress={onStart}>{primaryLabel}</OrbitButton>
          <Pressable onPress={onSkip} hitSlop={10} accessibilityRole="button" style={styles.secondary}>
            <Text style={[typography.footnote, { color: c.textSubtle }]}>{secondaryLabel}</Text>
          </Pressable>
        </GlassCard>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  card: {
    gap: space.md,
    maxWidth: 360,
  },
  secondary: {
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
});
