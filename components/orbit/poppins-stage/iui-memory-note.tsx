/**
 * Memory note — neutral strip under the stage. Never an IuiCard.
 */
import { StyleSheet, View } from 'react-native';

import { AppText as Text } from '@/components/orbit/app-text';
import { stageBorder, stageMuted } from '@/constants/iui-stage';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';

type Props = {
  text: string;
  subject?: string;
  kind?: string;
};

export function IuiMemoryNote({ text, subject, kind }: Props) {
  const { c, isDark, glass } = useOrbitColors();
  const muted = stageMuted(isDark);
  const label =
    kind === 'like' ? 'Likes' : kind === 'dislike' ? 'Avoids' : kind === 'routine' ? 'Routine' : 'Note';
  return (
    <View
      style={[
        styles.note,
        {
          backgroundColor: glass(0.04),
          borderColor: stageBorder(isDark),
        },
      ]}
      accessibilityRole="text"
      accessibilityLabel={`${label}: ${text}`}>
      <Text style={[styles.kicker, { color: muted }]}>
        {label}
        {subject && subject !== 'house' ? ` · ${subject}` : ''}
      </Text>
      <Text style={[styles.body, { color: c.text }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  note: {
    alignSelf: 'stretch',
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 2,
  },
  kicker: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  body: { fontSize: 13, lineHeight: 18 },
});
