/**
 * Seasonal themes in Settings → Your look. Lists every season that's on right now (Halloween in
 * October; Thanksgiving or Christmas once they exist). Out of season it shows nothing.
 */
import { StyleSheet, Switch, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { AppText as Text } from '@/components/orbit/app-text';
import { Moji } from '@/components/orbit/moji/moji';
import { SeasonMonster } from '@/components/orbit/seasonal/halloween-decor';
import { SEASONAL_THEMES, setHalloween, useSeasonal } from '@/lib/theme/seasonal';
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
        const on = t.id === 'halloween' ? season.halloween : false;
        return (
          <View key={t.id} style={[styles.row, { backgroundColor: on ? '#3A2470' : glass(0.05), borderColor: on ? '#7B3FE4' : glassBorder(0.1) }]}>
            {on ? <SeasonMonster size={34} /> : <Moji name={t.moji} size={34} />}
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[styles.name, { color: on ? '#F5EEFF' : c.text }]}>{t.name}</Text>
              <Text style={[styles.blurb, { color: on ? '#D6CBEF' : c.textMuted }]}>
                {t.blurb} · {t.ends}
              </Text>
            </View>
            <Switch
              value={on}
              onValueChange={(v) => {
                if (t.id === 'halloween') void setHalloween(v);
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
