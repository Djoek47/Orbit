import { PropsWithChildren, ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { orbitColors, orbitSpacing, orbitTypography } from '@/constants/orbit-theme';

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
        <Text style={[orbitTypography.cardTitle, completed && styles.completed]}>{title}</Text>
        {meta ? <Text style={orbitTypography.caption}>{meta}</Text> : null}
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
    gap: orbitSpacing.xs,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: orbitSpacing.md,
  },
  trailing: {
    alignItems: 'flex-end',
  },
});
