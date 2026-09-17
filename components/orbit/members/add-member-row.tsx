import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Pressable, StyleSheet, View } from 'react-native';

import { radius, space } from '@/constants/orbit-theme';
import { glassFill, useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { AppText as Text } from '@/components/orbit/app-text';

type Props = {
  accent: string;
  onPress: () => void;
};

/** Premium add-member affordance — opens sheet, never navigates away. */
export function AddMemberRow({ accent, onPress }: Props) {
  const { c, isDark, glassBorder } = useOrbitColors();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Add household member"
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: glassFill(isDark),
          borderColor: pressed ? `${accent}44` : glassBorder(0.1),
          opacity: pressed ? 0.92 : 1,
        },
      ]}>
      <View style={[styles.icon, { backgroundColor: `${accent}14`, borderColor: `${accent}33` }]}>
        <MaterialIcons name="add" size={22} color={accent} />
      </View>
      <View style={styles.copy}>
        <Text style={[styles.label, { color: c.text }]}>Add member</Text>
        <Text style={[styles.hint, { color: c.textMuted }]}>
          Create a profile — share their invite when ready
        </Text>
      </View>
      <MaterialIcons name="chevron-right" size={20} color={c.textSubtle} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: radius.cardLarge,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: space.md,
    marginBottom: space.lg,
    paddingHorizontal: space.md,
    paddingVertical: 16,
  },
  icon: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  copy: {
    flex: 1,
    gap: 3,
  },
  label: {
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  hint: {
    fontSize: 13,
    lineHeight: 18,
  },
});
