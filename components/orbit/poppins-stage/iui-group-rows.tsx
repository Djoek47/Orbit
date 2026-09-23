/**
 * WO11 — grouped acts on one card: rows with × to drop before commit.
 * No mount entrance animations — stage is live under WebRTC.
 */
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText as Text } from '@/components/orbit/app-text';
import { STAGE } from '@/constants/iui-stage';
import type { IuiGroupItem } from '@/lib/poppins/ui-scenes';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';

type Props = {
  items: IuiGroupItem[];
  /** Queued acts waiting behind the current beat (dimmed). */
  queued?: IuiGroupItem[];
  accent: string;
  kind: 'grocery' | 'task';
  onDrop?: (id: string) => void;
  /** Hide × while rows are saving / done. */
  allowDrop?: boolean;
};

function rowDetail(item: IuiGroupItem, kind: 'grocery' | 'task'): string | undefined {
  if (kind === 'grocery') return item.aisle;
  const bits = [item.assignee, item.due].filter(Boolean);
  return bits.length ? bits.join(' · ') : undefined;
}

function statusHint(item: IuiGroupItem): string | undefined {
  if (item.status === 'saving') return 'Saving…';
  if (item.status === 'done') return 'Added';
  if (item.status === 'failed') return "Couldn't save — retry";
  return undefined;
}

export function IuiGroupRows({
  items,
  queued = [],
  accent,
  kind,
  onDrop,
  allowDrop = true,
}: Props) {
  const { c } = useOrbitColors();
  const active = items.filter((item) => !item.dropped);

  return (
    <View style={styles.stack}>
      {active.map((item) => {
        const detail = rowDetail(item, kind);
        const hint = statusHint(item);
        const failed = item.status === 'failed';
        const danger = STAGE.semantic.danger;
        return (
          <View
            key={item.id}
            style={[
              styles.row,
              {
                borderColor: failed ? `${danger}88` : `${accent}55`,
                backgroundColor: failed ? `${danger}14` : `${accent}14`,
              },
            ]}>
            <View style={styles.body}>
              <Text style={[styles.title, { color: c.text }]} numberOfLines={1}>
                {kind === 'task' && item.assignee
                  ? `${item.label} → ${item.assignee}`
                  : item.label}
              </Text>
              {detail && kind === 'grocery' ? (
                <Text style={[styles.detail, { color: c.textMuted }]}>{detail}</Text>
              ) : null}
              {kind === 'task' && item.due ? (
                <Text style={[styles.detail, { color: c.textMuted }]}>{item.due}</Text>
              ) : null}
              {hint ? (
                <Text
                  style={[
                    styles.detail,
                    { color: failed ? danger : c.textMuted },
                  ]}>
                  {hint}
                </Text>
              ) : null}
            </View>
            {allowDrop && item.status !== 'done' && item.status !== 'saving' && onDrop ? (
              <Pressable
                onPress={() => onDrop(item.id)}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={`Drop ${item.label}`}
                style={styles.drop}>
                <Text style={[styles.dropMark, { color: c.textSubtle }]}>×</Text>
              </Pressable>
            ) : null}
          </View>
        );
      })}
      {queued.map((item) => (
        <View
          key={`q-${item.id}`}
          style={[
            styles.row,
            styles.queued,
            { borderColor: `${accent}22`, backgroundColor: `${accent}08` },
          ]}>
          <View style={styles.body}>
            <Text style={[styles.title, styles.queuedTitle, { color: c.textMuted }]} numberOfLines={1}>
              {item.label}
            </Text>
            {rowDetail(item, kind) ? (
              <Text style={[styles.detail, { color: c.textSubtle }]}>{rowDetail(item, kind)}</Text>
            ) : null}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { width: '100%', gap: 8, alignItems: 'stretch' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    minWidth: 240,
    gap: 8,
  },
  queued: { opacity: 0.55 },
  body: { flex: 1 },
  title: { fontSize: 16, fontWeight: '600', letterSpacing: -0.2 },
  queuedTitle: { fontWeight: '500' },
  detail: { fontSize: 12, marginTop: 2 },
  drop: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropMark: { fontSize: 22, fontWeight: '400', lineHeight: 24 },
});
