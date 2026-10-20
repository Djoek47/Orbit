/**
 * Completed → Full breakdown. The screen is just chrome; the dashboard itself lives in
 * components/orbit/completion/completion-breakdown so Household Health shows the same one.
 */
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText as Text } from '@/components/orbit/app-text';
import { CompletionBreakdown } from '@/components/orbit/completion/completion-breakdown';
import { typography } from '@/constants/orbit-theme';
import { BREAKDOWN_RANGES, type BreakdownRange } from '@/lib/tasks/completion-stats';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';

export default function CompletedBreakdownScreen() {
  const insets = useSafeAreaInsets();
  const { c } = useOrbitColors();
  const params = useLocalSearchParams<{ range?: string }>();
  const initialRange = BREAKDOWN_RANGES.includes(params.range as BreakdownRange)
    ? (params.range as BreakdownRange)
    : undefined;

  return (
    <View style={[styles.root, { backgroundColor: c.background, paddingTop: insets.top + 8 }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Back">
          <MaterialIcons name="chevron-left" size={28} color={c.text} />
        </Pressable>
        <Text style={[typography.headline, { color: c.text }]}>Completed</Text>
        <View style={{ width: 28 }} />
      </View>

      <CompletionBreakdown initialRange={initialRange} bottomInset={insets.bottom} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
});
