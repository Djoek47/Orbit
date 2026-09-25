/**
 * Allowance capability — gold confirm card (never silent HOLD).
 */
import { StyleSheet, View } from 'react-native';

import { AppText as Text } from '@/components/orbit/app-text';
import { IuiCard } from '@/components/orbit/poppins-stage/iui-card';
import { stageMuted } from '@/constants/iui-stage';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';

type Props = {
  accent: string;
  fillAccent?: string;
  memberName: string;
  amountLabel: string;
  note?: string;
  kind?: 'grant' | 'hold' | 'payout';
};

const KIND_LABEL: Record<NonNullable<Props['kind']>, string> = {
  grant: 'Grant',
  // Hold / Pay out are label-only until iui-commit wires them (WO16 §3.7).
  hold: 'Grant',
  payout: 'Grant',
};

export function IuiAllowanceCard({
  accent,
  fillAccent,
  memberName,
  amountLabel,
  note,
  kind = 'grant',
}: Props) {
  const { c, isDark } = useOrbitColors();
  const muted = stageMuted(isDark);
  return (
    <IuiCard
      accent={accent}
      fillAccent={fillAccent ?? accent}
      kicker="Allowance"
      countLabel={KIND_LABEL[kind]}
      accessibilityLabel={`${KIND_LABEL[kind]} ${amountLabel} to ${memberName}`}>
      <View style={styles.body}>
        <Text style={[styles.amount, { color: c.text }]}>{amountLabel}</Text>
        <Text style={[styles.to, { color: muted }]}>to {memberName}</Text>
        {note ? <Text style={[styles.note, { color: muted }]}>{note}</Text> : null}
      </View>
    </IuiCard>
  );
}

const styles = StyleSheet.create({
  body: { gap: 6 },
  amount: { fontSize: 30, lineHeight: 34, fontWeight: '700', letterSpacing: -0.4 },
  to: { fontSize: 15, lineHeight: 20, fontWeight: '600' },
  note: { fontSize: 13, lineHeight: 18, marginTop: 4 },
  hint: { fontSize: 12, lineHeight: 17, marginTop: 8 },
});
