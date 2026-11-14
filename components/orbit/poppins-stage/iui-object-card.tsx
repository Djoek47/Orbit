import { StyleSheet, View } from 'react-native';

import { Moji } from '@/components/orbit/moji/moji';
import { AppText as Text } from '@/components/orbit/app-text';
import { IuiGhostField } from '@/components/orbit/poppins-stage/iui-ghost-field';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';

type Props = {
  title?: string;
  detail?: string;
  emoji?: string;
  accent: string;
};

export function IuiObjectCard({ title, detail, emoji, accent }: Props) {
  const { c } = useOrbitColors();
  const label = title?.trim() ?? '';
  return (
    <View style={[styles.card, { borderColor: `${accent}55`, backgroundColor: `${accent}14` }]}>
      {emoji ? <Moji emoji={emoji} size={30} /> : null}
      <View style={{ flex: 1 }}>
        {label ? (
          <Text style={[styles.title, { color: c.text }]}>{label}</Text>
        ) : (
          <IuiGhostField text="What is it called?" accent={accent} />
        )}
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
  title: { fontSize: 18, fontWeight: '600', letterSpacing: -0.3 },
  detail: { fontSize: 13, marginTop: 4 },
});
