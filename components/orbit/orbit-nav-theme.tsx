import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import type { ReactNode } from 'react';

import { useOrbit } from '@/store/orbit-store';

/** Drives React Navigation theme from the household palette, not raw OS black. */
export function OrbitNavTheme({ children }: { children: ReactNode }) {
  const { orbitPalette } = useOrbit();
  const base = orbitPalette.isDark ? DarkTheme : DefaultTheme;
  return (
    <ThemeProvider
      value={{
        ...base,
        colors: {
          ...base.colors,
          primary: orbitPalette.primary,
          background: orbitPalette.background,
          card: orbitPalette.backgroundSoft,
          text: orbitPalette.text,
          border: orbitPalette.border,
          notification: orbitPalette.accent,
        },
      }}>
      {children}
    </ThemeProvider>
  );
}
