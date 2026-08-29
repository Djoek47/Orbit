import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText as Text } from '@/components/orbit/app-text';
import { PersistentScrollView } from '@/components/orbit/persistent-scroll-view';
import { formatHouseRulesTime } from '@/lib/rules/interpolate';
import { deadlinePickerValues } from '@/lib/rules/deadline';
import type { HouseRulesDoc } from '@/lib/rules/types';

type Props = {
  visible: boolean;
  doc: HouseRulesDoc;
  current: string;
  pending?: string | null;
  appliesOn?: string | null;
  use24h?: boolean;
  onSelect: (hhmm: string) => void;
  onClose: () => void;
};

export function DeadlinePickerSheet({
  visible,
  doc,
  current,
  pending,
  appliesOn,
  use24h,
  onSelect,
  onClose,
}: Props) {
  const insets = useSafeAreaInsets();
  const values = deadlinePickerValues(doc);
  const cfg = doc.settings.dailyDeadline;
  const selected = pending?.trim() || current;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.head}>
            <Text style={styles.title}>{cfg.label}</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Text style={styles.done}>Done</Text>
            </Pressable>
          </View>
          <Text style={styles.help}>{cfg.help}</Text>
          {pending && appliesOn ? (
            <Text style={styles.pending}>Takes effect {appliesOn}. Tasks already underway keep their value.</Text>
          ) : (
            <Text style={styles.pending}>Takes effect the following day.</Text>
          )}
          <PersistentScrollView style={styles.list} indicatorColor="#E9B44C">
            {values.map((hhmm) => {
              const on = hhmm === selected;
              return (
                <Pressable
                  key={hhmm}
                  onPress={() => onSelect(hhmm)}
                  style={[styles.row, on && styles.rowOn]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}>
                  <Text style={[styles.rowText, on && styles.rowTextOn]}>
                    {formatHouseRulesTime(hhmm, use24h)}
                  </Text>
                </Pressable>
              );
            })}
          </PersistentScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#16233A',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '72%',
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  head: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  title: { color: '#E7EDF6', fontSize: 18, fontWeight: '700' },
  done: { color: '#E9B44C', fontSize: 16, fontWeight: '600' },
  help: { color: '#8DA0BC', fontSize: 13, lineHeight: 18, marginTop: 8 },
  pending: { color: '#AEBDD2', fontSize: 12.5, lineHeight: 18, marginBottom: 8, marginTop: 6 },
  list: { maxHeight: 360 },
  row: {
    borderBottomColor: '#2A3A57',
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 14,
  },
  rowOn: { backgroundColor: 'rgba(233,180,76,0.12)' },
  rowText: { color: '#C9D6E8', fontSize: 16, fontVariant: ['tabular-nums'] },
  rowTextOn: { color: '#E9B44C', fontWeight: '700' },
});
