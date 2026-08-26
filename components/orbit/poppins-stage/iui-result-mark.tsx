import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { StyleSheet, View } from 'react-native';

import { AppText as Text } from '@/components/orbit/app-text';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';

const MARK_GREEN = '#22C55E';

type Props = {
  kind?: 'added' | 'done' | 'assigned';
  title?: string;
};

const LABEL: Record<NonNullable<Props['kind']>, string> = {
  added: 'Added',
  done: 'Done',
  assigned: 'Assigned',
};

/** Green check after Poppins writes — milk added, task done, task assigned. */
export function IuiResultMark({ kind = 'added', title }: Props) {
  const { c } = useOrbitColors();
  return (
    <View style={styles.wrap}>
      <View style={styles.badge}>
        <MaterialIcons name="check" size={36} color="#ECFDF5" />
      </View>
      <View>
        <Text style={[styles.label, { color: MARK_GREEN }]}>{LABEL[kind]}</Text>
        {title ? (
          <Text style={[styles.title, { color: c.text }]} numberOfLines={2}>
            {title}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 12, paddingVertical: 8 },
  badge: {
    alignItems: 'center',
    backgroundColor: MARK_GREEN,
    borderRadius: 32,
    height: 64,
    justifyContent: 'center',
    width: 64,
  },
  label: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  title: { fontSize: 15, marginTop: 4, textAlign: 'center' },
});
