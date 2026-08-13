import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';

import { AppText as Text } from '@/components/orbit/app-text';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';

type Props = {
  text: string;
  accent: string;
};

/** Title types itself — speak a correction mid-type. */
export function IuiGhostField({ text, accent }: Props) {
  const { c } = useOrbitColors();
  const [shown, setShown] = useState('');

  useEffect(() => {
    setShown('');
    if (!text) return;
    let i = 0;
    const timer = setInterval(() => {
      i += 1;
      setShown(text.slice(0, i));
      if (i >= text.length) clearInterval(timer);
    }, 28);
    return () => clearInterval(timer);
  }, [text]);

  return (
    <Text style={[styles.field, { color: c.text, borderBottomColor: `${accent}66` }]}>
      {shown || ' '}
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
