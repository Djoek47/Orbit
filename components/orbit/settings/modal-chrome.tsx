/**
 * Modal chrome — WO14 §0: back (labelled) + close X on every settings modal.
 */
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText as Text } from '@/components/orbit/app-text';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';

type Props = {
  /** Where back goes — shown as the label. */
  backLabel: string;
  onBack?: () => void;
  /** Close leaves settings stack (defaults to dismiss). */
  onClose?: () => void;
  title?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  /** Optional one-line purpose under the title. */
  purpose?: string;
};

export function SettingsModalChrome({
  backLabel,
  onBack,
  onClose,
  title,
  right,
  children,
  purpose,
}: Props) {
  const insets = useSafeAreaInsets();
  const { c, glassBorder, isDark } = useOrbitColors();
  const accent = c.primary;
  const back = onBack ?? (() => router.back());
  const close =
    onClose ??
    (() => {
      if (router.canDismiss()) router.dismiss();
      else router.replace('/settings' as never);
    });

  return (
    <View style={[styles.shell, { backgroundColor: c.background, paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <Pressable
          onPress={back}
          accessibilityRole="button"
          accessibilityLabel={backLabel}
          hitSlop={8}
          style={styles.backHit}>
          <MaterialIcons name="chevron-left" size={28} color={accent} />
          <Text style={[styles.backLabel, { color: accent }]} numberOfLines={1}>
            {backLabel}
          </Text>
        </Pressable>
        <View style={styles.topRight}>
          {right}
          <Pressable
            onPress={close}
            accessibilityRole="button"
            accessibilityLabel="Close"
            hitSlop={8}
            style={[
              styles.closeHit,
              {
                backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,28,42,0.06)',
                borderColor: glassBorder(0.1),
              },
            ]}>
            <MaterialIcons name="close" size={18} color={c.textMuted} />
          </Pressable>
        </View>
      </View>
      {title ? (
        <View style={styles.titleBlock}>
          <Text style={[styles.title, { color: c.text }]}>{title}</Text>
          {purpose ? (
            <Text style={[styles.purpose, { color: c.textMuted }]}>{purpose}</Text>
          ) : null}
        </View>
      ) : null}
      <View style={styles.body}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1 },
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 44,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  backHit: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 0,
    minHeight: 44,
    maxWidth: '70%',
    paddingRight: 8,
  },
  backLabel: { fontSize: 17, fontWeight: '500' },
  topRight: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  closeHit: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  titleBlock: { gap: 4, paddingHorizontal: 20, paddingBottom: 8, paddingTop: 4 },
  title: { fontSize: 28, fontWeight: '600', letterSpacing: -0.5 },
  purpose: { fontSize: 14, lineHeight: 20 },
  body: { flex: 1 },
});
