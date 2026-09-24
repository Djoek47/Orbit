/**
 * Places capability — violet plan card for saving an address.
 */
import { StyleSheet, View } from 'react-native';

import { AppText as Text } from '@/components/orbit/app-text';
import { IuiCard } from '@/components/orbit/poppins-stage/iui-card';
import { stageMuted } from '@/constants/iui-stage';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';

type Props = {
  accent: string;
  fillAccent?: string;
  name: string;
  kind?: string;
  address?: string;
  holding?: boolean;
  holdProgress?: number;
};

export function IuiPlaceCard({
  accent,
  fillAccent,
  name,
  kind,
  address,
  holding,
  holdProgress,
}: Props) {
  const { c, isDark } = useOrbitColors();
  const muted = stageMuted(isDark);
  return (
    <IuiCard
      accent={accent}
      fillAccent={fillAccent ?? accent}
      kicker="Places"
      holding={holding}
      hold={holding}
      holdProgress={holdProgress}
      leftFooter="One hold saves it"
      rightFooter="Reuse on trips"
      accessibilityLabel={`Save place ${name}`}>
      <View style={styles.body}>
        <View style={[styles.tile, { backgroundColor: `${fillAccent ?? accent}22` }]}>
          <Text style={styles.emoji}>📍</Text>
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={[styles.title, { color: c.text }]}>{name || 'Place'}</Text>
          {kind ? (
            <Text style={[styles.kind, { color: accent }]}>{kind.toUpperCase()}</Text>
          ) : null}
          <Text style={[styles.address, { color: muted }]}>
            {address?.trim() || 'Address can come later'}
          </Text>
        </View>
      </View>
    </IuiCard>
  );
}

const styles = StyleSheet.create({
  body: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  tile: {
    width: 54,
    height: 54,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: { fontSize: 24 },
  title: { fontSize: 22, lineHeight: 27, fontWeight: '700', letterSpacing: -0.3 },
  kind: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2 },
  address: { fontSize: 13, lineHeight: 18 },
});
