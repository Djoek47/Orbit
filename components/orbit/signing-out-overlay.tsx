/**
 * Full-screen "Signing out…" cover — Settings is a modal; without this the
 * sheet can sit frozen while GoTrue / voice teardown runs (up to a few seconds).
 */
import { ActivityIndicator, Modal, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { AppText as Text } from '@/components/orbit/app-text';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useOrbitOptional } from '@/store/orbit-store';

type Props = {
  visible: boolean;
};

export function SigningOutOverlay({ visible }: Props) {
  const { c, isDark } = useOrbitColors();
  const orbit = useOrbitOptional();
  const primary = orbit?.accentTheme.primary ?? c.primary;
  const secondary = orbit?.accentTheme.secondary ?? primary;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      presentationStyle="overFullScreen"
      onRequestClose={() => {
        /* block back while signing out */
      }}>
      <Animated.View
        entering={FadeIn.duration(280)}
        style={[styles.backdrop, { backgroundColor: isDark ? 'rgba(0,0,0,0.72)' : 'rgba(8,16,28,0.55)' }]}>
        <Animated.View entering={FadeInDown.duration(320).springify().damping(16)}>
          <LinearGradient
            colors={[`${primary}33`, `${secondary}14`]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.card, { borderColor: `${primary}66` }]}>
            <ActivityIndicator size="large" color={primary} />
            <Text style={[styles.title, { color: isDark ? '#F7F2EC' : c.text }]}>Signing out…</Text>
            <Text style={[styles.sub, { color: isDark ? '#C9B8AA' : c.textMuted }]}>
              This can take a few seconds while we close Poppins and clear this device.
            </Text>
          </LinearGradient>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  card: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 24,
    borderWidth: 1,
    gap: 12,
    maxWidth: 320,
    paddingHorizontal: 28,
    paddingVertical: 28,
    width: '100%',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  sub: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
    textAlign: 'center',
  },
});
