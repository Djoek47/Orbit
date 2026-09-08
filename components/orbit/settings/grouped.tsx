/**
 * iOS Settings grouped list — one rounded group, hairline rows, drill-in chevrons.
 * Use this instead of a stack of independent cards.
 */

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Pressable, StyleSheet, Switch, View } from 'react-native';

import { AppText as Text } from '@/components/orbit/app-text';
import { glassFill, useOrbitColors } from '@/lib/theme/use-orbit-colors';

export function SettingsGroup({
  header,
  footer,
  children,
}: {
  header?: string;
  footer?: string;
  children: React.ReactNode;
}) {
  const { c, isDark, glassBorder } = useOrbitColors();
  return (
    <View style={styles.block}>
      {header ? (
        <Text style={[styles.header, { color: c.textMuted }]}>{header}</Text>
      ) : null}
      <View
        style={[
          styles.group,
          { backgroundColor: glassFill(isDark), borderColor: glassBorder(0.08) },
        ]}>
        {children}
      </View>
      {footer ? (
        <Text style={[styles.footer, { color: c.textSubtle }]}>{footer}</Text>
      ) : null}
    </View>
  );
}

export function SettingsNavRow({
  icon,
  iconColor,
  label,
  value,
  subtitle,
  last,
  onPress,
  accessibilityHint,
}: {
  icon?: keyof typeof MaterialIcons.glyphMap;
  iconColor?: string;
  label: string;
  value?: string;
  subtitle?: string;
  last?: boolean;
  onPress: () => void;
  accessibilityHint?: string;
}) {
  const { c, glassBorder } = useOrbitColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={value ? `${label}, ${value}` : label}
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        !last && { borderBottomColor: glassBorder(0.08), borderBottomWidth: StyleSheet.hairlineWidth },
        pressed && { opacity: 0.72 },
      ]}>
      {icon ? (
        <View style={[styles.iconWell, { backgroundColor: `${iconColor ?? c.primary}22` }]}>
          <MaterialIcons name={icon} size={16} color={iconColor ?? c.primary} />
        </View>
      ) : null}
      <View style={styles.rowBody}>
        <Text style={[styles.label, { color: c.text }]}>{label}</Text>
        {subtitle ? (
          <Text style={[styles.subtitle, { color: c.textSubtle }]} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {value ? (
        <Text style={[styles.value, { color: c.textMuted }]} numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      <MaterialIcons name="chevron-right" size={18} color={c.textSubtle} />
    </Pressable>
  );
}

export function SettingsToggleRow({
  label,
  subtitle,
  value,
  last,
  onValueChange,
}: {
  label: string;
  subtitle?: string;
  value: boolean;
  last?: boolean;
  onValueChange: (next: boolean) => void;
}) {
  const { c, glassBorder } = useOrbitColors();
  return (
    <View
      style={[
        styles.row,
        !last && { borderBottomColor: glassBorder(0.08), borderBottomWidth: StyleSheet.hairlineWidth },
      ]}>
      <View style={styles.rowBody}>
        <Text style={[styles.label, { color: c.text }]}>{label}</Text>
        {subtitle ? (
          <Text style={[styles.subtitle, { color: c.textSubtle }]}>{subtitle}</Text>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: glassBorder(0.14), true: c.primary }}
        thumbColor="#fff"
        accessibilityLabel={label}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: 6 },
  header: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.4,
    paddingHorizontal: 4,
    textTransform: 'uppercase',
  },
  group: {
    borderCurve: 'continuous',
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  footer: {
    fontSize: 12,
    lineHeight: 16,
    paddingHorizontal: 4,
    paddingTop: 2,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    minHeight: 52,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  iconWell: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 8,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  rowBody: { flex: 1, gap: 2, minWidth: 0 },
  label: { fontSize: 16, fontWeight: '500' },
  subtitle: { fontSize: 12, lineHeight: 16 },
  value: { fontSize: 15, fontWeight: '400', maxWidth: 140, textAlign: 'right' },
});
