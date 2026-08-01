import type { ReactNode } from 'react';
import { StyleSheet, Text, type StyleProp, type TextStyle } from 'react-native';

import { typography } from '@/constants/orbit-theme';
import { useOrbit } from '@/store/orbit-store';

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
  const typeStyle = accentTheme.typeStyle;

  return (
    <Text
      style={[
        typography.eyebrow,
        {
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
