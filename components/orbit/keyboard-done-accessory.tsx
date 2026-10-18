/**
 * The Done bar above the keyboard.
 *
 * A one-line field gets iOS's blue return key, which reads as "finished" and closes the
 * keyboard. A multi-line one can't: its return key makes a new line, so there is no way to put
 * the keyboard away except guessing where to tap. This is that way out — one shared bar, hung
 * on every multi-line field by id.
 *
 * iOS only; Android's own back gesture already dismisses the keyboard.
 */
import { InputAccessoryView, Keyboard, Platform, Pressable, StyleSheet, View } from 'react-native';

import { AppText as Text } from '@/components/orbit/app-text';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useOrbitOptional } from '@/store/orbit-store';

/** One id for the whole app — the bar says the same thing everywhere. */
export const KEYBOARD_DONE_ID = 'choremaxx.keyboard.done';

export function KeyboardDoneAccessory() {
  const { c, isDark, glassBorder } = useOrbitColors();
  const orbit = useOrbitOptional();
  const accent = orbit?.accentTheme.primary ?? c.primary;

  if (Platform.OS !== 'ios') return null;

  return (
    <InputAccessoryView nativeID={KEYBOARD_DONE_ID}>
      <View
        style={[
          styles.bar,
          {
            backgroundColor: isDark ? 'rgba(22,17,14,0.96)' : 'rgba(248,246,244,0.96)',
            borderTopColor: glassBorder(0.12),
          },
        ]}>
        <Pressable
          onPress={() => Keyboard.dismiss()}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Done, close the keyboard"
          style={({ pressed }) => [styles.btn, { opacity: pressed ? 0.7 : 1 }]}>
          <Text style={[styles.label, { color: accent }]}>Done</Text>
        </Pressable>
      </View>
    </InputAccessoryView>
  );
}

const styles = StyleSheet.create({
  bar: {
    alignItems: 'flex-end',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  btn: { paddingHorizontal: 8, paddingVertical: 5 },
  label: { fontSize: 16, fontWeight: '700' },
});
