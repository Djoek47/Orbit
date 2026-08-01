import { PropsWithChildren, ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { orbitColors, space, typography } from '@/constants/orbit-theme';

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
  return (
    <View style={styles.row}>
      <View style={styles.copy}>
        <Text style={[typography.headline, completed && styles.completed]}>{title}</Text>
        {meta ? <Text style={typography.footnote}>{meta}</Text> : null}
        {children}
      </View>
      {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  completed: {
    color: orbitColors.textMuted,
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
