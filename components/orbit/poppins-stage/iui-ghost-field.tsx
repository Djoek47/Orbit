import { StyleSheet } from 'react-native';

import { AppText as Text } from '@/components/orbit/app-text';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';

type Props = {
  text: string;
  accent: string;
  /** Kept for callers; spoken text is always instant. */
  catchUp?: boolean;
};

/** Spoken words land at once — no typewriter lag. */
export function IuiGhostField({ text, accent }: Props) {
  const { c } = useOrbitColors();

  return (
    <Text style={[styles.field, { color: c.text, borderBottomColor: `${accent}66` }]}>
      {text || ' '}
    </Text>
  );
}

const styles = StyleSheet.create({
  field: {
    fontSize: 28,
    fontWeight: '300',
    letterSpacing: -0.6,
    textAlign: 'center',
    borderBottomWidth: 1,
    paddingBottom: 8,
    minWidth: 180,
  },
});
