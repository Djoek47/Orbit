/**
 * Seasonal themes in Settings → Your look. Lists the season in the air right now (Halloween in
 * October, Thanksgiving in November, Christmas through early January). Out of season: nothing.
 */
import { StyleSheet, Switch, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { AppText as Text } from '@/components/orbit/app-text';
import { Moji } from '@/components/orbit/moji/moji';
import { SeasonMascot } from '@/components/orbit/seasonal/season-decor';
import { SEASON_SURFACE, SEASONAL_THEMES, setSeason, useSeasonal } from '@/lib/theme/seasonal';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';

export function SeasonalThemes() {
  const season = useSeasonal();
  const { c, glass, glassBorder } = useOrbitColors();
  const live = SEASONAL_THEMES.filter((t) => t.available());
  if (!live.length) return null;
  return (
    <Animated.View entering={FadeInDown.springify()} style={styles.wrap}>
      <Text style={[styles.eyebrow, { color: c.textSubtle }]}>SEASONAL THEME</Text>
      {live.map((t) => {
        const on = season.active === t.id;
        const sx = SEASON_SURFACE[t.id];
        return (
          <View key={t.id} style={[styles.row, { backgroundColor: on ? sx.card : glass(0.05), borderColor: on ? sx.cardEdge : glassBorder(0.1) }]}>
            {on ? <SeasonMascot size={34} season={t.id} /> : <Moji name={t.moji} size={34} />}
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[styles.name, { color: on ? sx.text : c.text }]}>{t.name}</Text>
              <Text style={[styles.blurb, { color: on ? sx.cardSub : c.textMuted }]}>
                {t.blurb} · {t.ends}
              </Text>
            </View>
            <Switch
              value={on}
              onValueChange={(v) => {
                void setSeason(t.id, v);
              }}
              accessibilityLabel={`${t.name} theme`}
            />
          </View>
        );
      })}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8, marginTop: 16 },
  eyebrow: { fontSize: 12, fontWeight: '600', letterSpacing: 0.4 },
  row: { alignItems: 'center', borderCurve: 'continuous', borderRadius: 18, borderWidth: 1, flexDirection: 'row', gap: 12, padding: 12 },
  name: { fontSize: 17, fontWeight: '600' },
  blurb: { fontSize: 13, lineHeight: 17 },
});
