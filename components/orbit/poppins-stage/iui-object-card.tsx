import { StyleSheet, View } from 'react-native';

import { AppText as Text } from '@/components/orbit/app-text';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';

type Props = {
  title: string;
  detail?: string;
  emoji?: string;
  accent: string;
};

export function IuiObjectCard({ title, detail, emoji, accent }: Props) {
  const { c } = useOrbitColors();
  return (
    <View style={[styles.card, { borderColor: `${accent}55`, backgroundColor: `${accent}14` }]}>
      {emoji ? <Text style={styles.emoji}>{emoji}</Text> : null}
      <View style={{ flex: 1 }}>
        <Text style={[styles.title, { color: c.text }]}>{title}</Text>
        {detail ? <Text style={[styles.detail, { color: c.textMuted }]}>{detail}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 16,
    minWidth: 240,
  },
  emoji: { fontSize: 28 },
  title: { fontSize: 18, fontWeight: '600', letterSpacing: -0.3 },
  detail: { fontSize: 13, marginTop: 4 },
});
