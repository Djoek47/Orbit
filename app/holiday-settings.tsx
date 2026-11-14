/**
 * Holidays — which regions and which days show on the Plan calendar, each with its own Moji.
 * Reached from Plan (the holiday chip) and Settings → Calendar → Holidays.
 */
import { format } from 'date-fns';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText as Text } from '@/components/orbit/app-text';
import { Moji } from '@/components/orbit/moji/moji';
import { SettingsModalChrome } from '@/components/orbit/settings/modal-chrome';
import { saveHolidayPrefs, useHolidayPrefs } from '@/lib/calendar/holiday-prefs';
import {
  HOLIDAY_REGIONS,
  HOLIDAYS,
  isHolidayOn,
  type HolidayDef,
  type HolidayKind,
  type HolidayRegion,
} from '@/lib/calendar/holidays';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';

const SECTIONS: { kind: HolidayKind; title: string; hint: string }[] = [
  { kind: 'public', title: 'Public holidays', hint: 'Days off where you live.' },
  { kind: 'fun', title: 'Fun days', hint: 'Halloween, Valentine’s, Mother’s and Father’s Day.' },
  { kind: 'cultural', title: 'Cultures and faiths', hint: 'Off until you turn them on.' },
];

function nextDate(def: HolidayDef, today: Date): Date | null {
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  for (const y of [today.getFullYear(), today.getFullYear() + 1]) {
    const d = def.date(y);
    if (d && d.getTime() >= start) return d;
  }
  return null;
}

export default function HolidaySettingsScreen() {
  const insets = useSafeAreaInsets();
  const { c, glass, glassBorder } = useOrbitColors();
  const prefs = useHolidayPrefs();
  const today = useMemo(() => new Date(), []);

  const toggleRegion = (id: HolidayRegion) => {
    if (id === 'global') return;
    const has = prefs.regions.includes(id);
    void saveHolidayPrefs({
      ...prefs,
      regions: has ? prefs.regions.filter((r) => r !== id) : [...prefs.regions, id],
    });
  };
  const toggleDay = (def: HolidayDef, on: boolean) =>
    void saveHolidayPrefs({ ...prefs, overrides: { ...prefs.overrides, [def.id]: on } });

  const listed = HOLIDAYS.filter((h) => h.regions.some((r) => prefs.regions.includes(r)))
    .map((h) => ({ def: h, next: nextDate(h, today) }))
    .filter((row) => row.next)
    .sort((a, b) => a.next!.getTime() - b.next!.getTime());

  return (
    <SettingsModalChrome
      backLabel="Back"
      title="Holidays"
      purpose="Pick where you celebrate. The days show on your calendar with their own little icon.">
      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 32 }]}>
        <View style={[styles.card, { backgroundColor: glass(0.05), borderColor: glassBorder(0.12) }]}>
          <View style={styles.row}>
            <Moji name="calendar" size={30} />
            <View style={styles.grow}>
              <Text style={[styles.headline, { color: c.text }]}>Show holidays</Text>
              <Text style={[styles.foot, { color: c.textMuted }]}>On the Plan calendar and in Next 7 days</Text>
            </View>
            <Switch
              value={prefs.enabled}
              onValueChange={(v) => void saveHolidayPrefs({ ...prefs, enabled: v })}
              accessibilityLabel="Show holidays"
            />
          </View>
        </View>

        {prefs.enabled ? (
          <>
            <Text style={[styles.eyebrow, { color: c.textMuted }]}>WHERE YOU CELEBRATE</Text>
            <View style={styles.chips}>
              {HOLIDAY_REGIONS.map((r, i) => {
                const on = prefs.regions.includes(r.id);
                return (
                  <Animated.View key={r.id} entering={FadeInDown.delay(i * 40).springify()} layout={LinearTransition}>
                    <Pressable
                      onPress={() => toggleRegion(r.id)}
                      disabled={r.id === 'global'}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: on }}
                      accessibilityHint={r.hint}
                      style={({ pressed }) => [
                        styles.chip,
                        {
                          backgroundColor: on ? c.primary : glass(0.06),
                          borderColor: on ? c.primary : glassBorder(0.14),
                          transform: [{ scale: pressed ? 0.95 : 1 }],
                        },
                      ]}>
                      <Text style={[styles.chipText, { color: on ? '#fff' : c.text }]}>{r.label}</Text>
                    </Pressable>
                  </Animated.View>
                );
              })}
            </View>

            {SECTIONS.map((section) => {
              const rows = listed.filter((row) => row.def.kind === section.kind);
              if (rows.length === 0) return null;
              return (
                <View key={section.kind} style={styles.section}>
                  <Text style={[styles.title3, { color: c.text }]}>{section.title}</Text>
                  <Text style={[styles.foot, { color: c.textMuted, marginTop: -6 }]}>{section.hint}</Text>
                  <View style={[styles.card, { backgroundColor: glass(0.05), borderColor: glassBorder(0.12) }]}>
                    {rows.map(({ def, next }, i) => {
                      const on = isHolidayOn(def, prefs);
                      return (
                        <View
                          key={def.id}
                          style={[
                            styles.row,
                            i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: glassBorder(0.1) },
                            !on && { opacity: 0.55 },
                          ]}>
                          <Moji name={def.moji} size={32} />
                          <View style={styles.grow}>
                            <Text style={[styles.headline, { color: c.text }]}>{def.name}</Text>
                            <Text style={[styles.foot, { color: c.textMuted }]} numberOfLines={2}>
                              {format(next!, 'EEE, MMM d')}
                              {def.approximate ? ' (may shift a day)' : ''} · {def.blurb}
                            </Text>
                          </View>
                          <Switch value={on} onValueChange={(v) => toggleDay(def, v)} accessibilityLabel={def.name} />
                        </View>
                      );
                    })}
                  </View>
                </View>
              );
            })}
          </>
        ) : null}
      </ScrollView>
    </SettingsModalChrome>
  );
}

const styles = StyleSheet.create({
  body: { gap: 14, paddingHorizontal: 20, paddingTop: 8 },
  card: { borderCurve: 'continuous', borderRadius: 20, borderWidth: 1, paddingHorizontal: 14 },
  row: { alignItems: 'center', flexDirection: 'row', gap: 12, minHeight: 60, paddingVertical: 10 },
  grow: { flex: 1, gap: 2 },
  headline: { fontSize: 17, fontWeight: '600' },
  title3: { fontSize: 20, fontWeight: '600' },
  foot: { fontSize: 13, lineHeight: 18 },
  eyebrow: { fontSize: 12, fontWeight: '600', letterSpacing: 0.4, marginTop: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderRadius: 999, borderWidth: 1, minHeight: 40, justifyContent: 'center', paddingHorizontal: 16 },
  chipText: { fontSize: 15, fontWeight: '600' },
  section: { gap: 10, marginTop: 8 },
});
