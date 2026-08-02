import { PropsWithChildren, ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { space, typography } from '@/constants/orbit-theme';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';

type OrbitListItemProps = PropsWithChildren<{
  completed?: boolean;
  meta?: string;
  title: string;
  trailing?: ReactNode;
}>;

export function OrbitListItem({
  children,
  completed = false,
  meta,
  title,
  trailing,
}: OrbitListItemProps) {
  const { c } = useOrbitColors();

  return (
    <View style={styles.row}>
      <View style={styles.copy}>
        <Text
          style={[
            typography.headline,
            { color: c.text },
            completed && [styles.completed, { color: c.textMuted }],
          ]}>
          {title}
        </Text>
        {meta ? <Text style={[typography.footnote, { color: c.textMuted }]}>{meta}</Text> : null}
        {children}
      </View>
      {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  completed: {
    textDecorationLine: 'line-through',
  },
  copy: {
    flex: 1,
    gap: space.xs,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: space.md,
  },
  trailing: {
    alignItems: 'flex-end',
  },
});
