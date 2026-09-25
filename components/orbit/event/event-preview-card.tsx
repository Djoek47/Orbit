/**
 * The new event as it will look — date tile, title, who · time, place, leave-by,
 * quick chips, and the day strip. Pure presentation; the form owns every value.
 */
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText as Text } from '@/components/orbit/app-text';
import { DayStrip } from '@/components/orbit/event/day-strip';
import { MemberGlyph } from '@/components/orbit/member-glyph';
import { STAGE, stageBorder, stageFaint, stageMuted, stageSurfaces } from '@/constants/iui-stage';
import { space, typography } from '@/constants/orbit-theme';
import type { DayStripLayout } from '@/lib/calendar/day-strip';
import { dateTileParts } from '@/lib/poppins/when-parse';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';

/** Card corner from the approved design. */
const CARD_RADIUS = 24;

export type PreviewChip = {
  id: string;
  label: string;
  selected?: boolean;
};

type Props = {
  title: string;
  placeholderTitle?: string;
  /** YYYY-MM-DD */
  dateKey: string;
  /** "Noah · 4:30 – 5:15 PM" */
  detail: string;
  member?: { name: string; avatar?: string | null } | null;
  place?: string;
  placeAddress?: string;
  leaveBy?: string | null;
  chips: PreviewChip[];
  onChipPress: (id: string) => void;
  layout: DayStripLayout;
};

export function EventPreviewCard({
  title,
  placeholderTitle = 'New event',
  dateKey,
  detail,
  member,
  place,
  placeAddress,
  leaveBy,
  chips,
  onChipPress,
  layout,
}: Props) {
  const { c, isDark } = useOrbitColors();
  const fill = STAGE.domain.plan;
  const accentText = isDark ? STAGE.domain.plan : STAGE.domainLight.plan;
  const muted = stageMuted(isDark);
  const tile = dateTileParts(dateKey);
  const border = stageBorder(isDark);
  const hasTitle = title.trim().length > 0;

  return (
    <View
      style={[
        styles.ring,
        { borderColor: `${fill}${isDark ? '55' : '40'}` },
      ]}>
      <View
        style={[
          styles.card,
          {
            backgroundColor: isDark ? '#141A33' : stageSurfaces(false).card,
            borderColor: stageBorder(isDark, true),
          },
        ]}
        accessibilityLabel="Event preview">
        <View style={styles.header}>
          <View style={[styles.tile, { backgroundColor: `${fill}24`, borderColor: `${fill}55` }]}>
            <Text style={[styles.tileWeekday, { color: accentText }]}>{tile?.weekday ?? ''}</Text>
            <Text style={[styles.tileDay, { color: c.text }]}>{tile?.day ?? '–'}</Text>
            <Text style={[styles.tileMonth, { color: muted }]}>{tile?.month ?? ''}</Text>
          </View>
          <View style={styles.headerBody}>
            <Text
              style={[typography.title2, { color: hasTitle ? c.text : stageFaint(isDark) }]}
              numberOfLines={2}>
              {hasTitle ? title.trim() : placeholderTitle}
            </Text>
            <View style={styles.detailRow}>
              {member ? <MemberGlyph member={member} size={13} /> : null}
              <Text style={[typography.footnote, { color: muted, flexShrink: 1 }]} numberOfLines={1}>
                {detail}
              </Text>
            </View>
          </View>
        </View>

        {place || leaveBy || chips.length ? (
          <View style={[styles.section, { borderTopColor: border }]}>
            {place ? (
              <View style={styles.infoRow}>
                <MaterialIcons name="place" size={17} color={muted} />
                <View style={styles.infoBody}>
                  <Text style={[typography.subheadline, { color: c.text }]} numberOfLines={1}>
                    {place}
                  </Text>
                  {placeAddress ? (
                    <Text style={[typography.caption1, { color: muted }]} numberOfLines={1}>
                      {placeAddress}
                    </Text>
                  ) : null}
                </View>
              </View>
            ) : null}
            {leaveBy ? (
              <View style={styles.infoRow}>
                <MaterialIcons name="schedule" size={17} color={muted} />
                <Text style={[typography.subheadline, { color: c.text }]}>{leaveBy}</Text>
              </View>
            ) : null}
            {chips.length ? (
              <View style={styles.chips}>
                {chips.map((chip) => (
                  <Pressable
                    key={chip.id}
                    accessibilityRole="button"
                    accessibilityState={{ selected: !!chip.selected }}
                    onPress={() => onChipPress(chip.id)}
                    hitSlop={4}
                    style={({ pressed }) => [
                      styles.chip,
                      chip.selected
                        ? { backgroundColor: fill, borderColor: fill }
                        : { borderColor: stageBorder(isDark, true) },
                      pressed && styles.pressed,
                    ]}>
                    <Text
                      style={[
                        typography.caption1,
                        styles.chipLabel,
                        { color: chip.selected ? STAGE.ink.onAccent : c.text },
                      ]}>
                      {chip.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}

        <DayStrip layout={layout} fill={fill} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  ring: {
    borderRadius: CARD_RADIUS + 6,
    borderCurve: 'continuous',
    borderWidth: 1.5,
    padding: 5,
  },
  card: {
    borderRadius: CARD_RADIUS,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: space.sm,
    padding: space.md,
  },
  tile: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    height: 62,
    justifyContent: 'center',
    width: 58,
  },
  tileWeekday: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8 },
  tileDay: { fontSize: 24, fontWeight: '700', lineHeight: 28 },
  tileMonth: { fontSize: 10, fontWeight: '600', letterSpacing: 0.6 },
  headerBody: { flex: 1, gap: space.xxs },
  detailRow: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  section: {
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: space.sm,
    padding: space.md,
  },
  infoRow: { alignItems: 'center', flexDirection: 'row', gap: space.sm },
  infoBody: { flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  chip: {
    borderCurve: 'continuous',
    borderRadius: STAGE.radius.pill,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipLabel: { fontWeight: '600' },
  pressed: { opacity: 0.7 },
});
