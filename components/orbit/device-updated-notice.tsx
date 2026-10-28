/**
 * "Your admin updated this device" — slides down on a shared device when the admin changes who
 * uses it, then leaves by itself. The faces have already been updated underneath it.
 */
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useEffect } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, { FadeOutUp, SlideInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText as Text } from '@/components/orbit/app-text';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useOrbitOptional } from '@/store/orbit-store';

const SHOW_MS = 5000;

export function DeviceUpdatedNotice() {
  const orbit = useOrbitOptional();
  const { c, isDark } = useOrbitColors();
  const insets = useSafeAreaInsets();
  const notice = orbit?.deviceNotice ?? null;
  const dismiss = orbit?.dismissDeviceNotice;

  useEffect(() => {
    if (!notice || !dismiss) return;
    const id = setTimeout(dismiss, SHOW_MS);
    return () => clearTimeout(id);
  }, [notice, dismiss]);

  if (!notice || !orbit) return null;
  const accent = orbit.accentTheme.primary;
  return (
    <Animated.View
      key={notice.at}
      entering={SlideInUp.springify().damping(18)}
      exiting={FadeOutUp.duration(220)}
      pointerEvents="box-none"
      style={[styles.wrap, { top: insets.top + 8 }]}>
      <Pressable
        onPress={dismiss}
        accessibilityRole="alert"
        accessibilityLabel={`${notice.title}. ${notice.body}`}
        style={[
          styles.card,
          { backgroundColor: isDark ? 'rgba(24,20,30,0.97)' : 'rgba(255,255,255,0.98)', borderColor: `${accent}66` },
        ]}>
        <MaterialIcons name="sync" size={22} color={accent} />
        <Text style={[styles.title, { color: c.text }]}>{notice.title}</Text>
        <Text style={[styles.body, { color: c.textMuted }]}>{notice.body}</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', left: 16, position: 'absolute', right: 16, zIndex: 999 },
  card: {
    borderCurve: 'continuous',
    borderRadius: 20,
    borderWidth: 1,
    gap: 4,
    maxWidth: 520,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    width: '100%',
  },
  title: { fontSize: 16, fontWeight: '800' },
  body: { fontSize: 14, lineHeight: 20 },
});
