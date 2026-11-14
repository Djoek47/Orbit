/**
 * One-beat IUI chrome — kicker, optional back, HOLD wrap. Same glass for every capacity.
 */

import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText as Text } from '@/components/orbit/app-text';
import { IuiHoldRing } from '@/components/orbit/poppins-stage/iui-hold-ring';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';

type Props = {
  kicker: string;
  accent: string;
  holding?: boolean;
  holdProgress?: number;
  frozen?: boolean;
  hold?: boolean;
  onBack?: () => void;
  children: ReactNode;
};

export function IuiStepper({
  kicker,
  accent,
  holding = false,
  holdProgress = 0,
  frozen = false,
  hold = false,
  onBack,
  children,
}: Props) {
  const { c } = useOrbitColors();
  const body = <View style={styles.body}>{children}</View>;

  return (
    <View style={styles.root}>
      <View style={styles.kickerRow}>
        {onBack ? (
          <Pressable onPress={onBack} hitSlop={12} accessibilityRole="button" accessibilityLabel="Back">
            <Text style={[styles.back, { color: c.textSubtle }]}>Back</Text>
          </Pressable>
        ) : (
          <View style={styles.backSpacer} />
        )}
        <Text style={[styles.kicker, { color: c.textSubtle }]}>{kicker}</Text>
        <View style={styles.backSpacer} />
      </View>
      {hold ? (
        <IuiHoldRing progress={holdProgress} accent={accent} frozen={frozen} holding={holding}>
          {body}
        </IuiHoldRing>
      ) : (
        body
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { width: '100%', alignItems: 'center', gap: 14 },
  kickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 4,
  },
  kicker: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    textAlign: 'center',
    flex: 1,
  },
  back: { fontSize: 13, fontWeight: '600' },
  backSpacer: { width: 40 },
  body: { width: '100%', alignItems: 'center', gap: 12 },
});
