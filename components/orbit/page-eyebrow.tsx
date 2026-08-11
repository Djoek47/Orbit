import type { ReactNode } from 'react';
import { StyleSheet, type StyleProp, type TextStyle } from 'react-native';

import { typography } from '@/constants/orbit-theme';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useOrbit } from '@/store/orbit-store';
import { AppText as Text } from '@/components/orbit/app-text';

type PageEyebrowProps = {
  children: ReactNode;
  style?: StyleProp<TextStyle>;
};

/**
 * Little title under the sticky chrome — same type as the Home date line
 * (uppercase, muted, accent-aware weight/tracking).
 */
export function PageEyebrow({ children, style }: PageEyebrowProps) {
  const { accentTheme } = useOrbit();
  const { c } = useOrbitColors();
  const typeStyle = accentTheme.typeStyle;

  return (
    <Text
      style={[
        typography.eyebrow,
        {
          color: c.textSubtle,
          fontWeight: typeStyle.captionWeight,
          letterSpacing: typeStyle.letterSpacing + 0.35,
        },
        style,
      ]}>
      {children}
    </Text>
  );
}

/** Static style alias when a component cannot use the hook. Prefer `PageEyebrow`. */
export const pageEyebrowStyle = StyleSheet.flatten(typography.eyebrow);
