import React, { memo } from 'react';
import Svg, { Circle, Path } from 'react-native-svg';
import { useOrbitOptional } from '@/store/orbit-store';
import { resolveIconDuotone } from './iconDuotone';
import { ICONS, IconName, IconShape } from './icons';

export type IconVariant = 'duotone' | 'halo';

/** Coral-pack fallbacks when Icon renders outside OrbitProvider. */
export const ICON_BODY = '#FAC775';
export const ICON_ACCENT = '#D85A30';

const STROKE = {
  duotone: { body: 1.75, accent: 1.9 },
  halo: { body: 1.4, accent: 1.4 },
};

export type IconProps = {
  name: IconName;
  size?: number;
  variant?: IconVariant;
  /** halo only — one tone taken from the surrounding palette. */
  tone?: string;
  /** duotone only — omit to follow active Sky/Citrus/Coral/Berry pack. */
  bodyColor?: string;
  accentColor?: string;
  /** halo only — bloom strength, 0 turns it off. */
  glow?: number;
  /** locked / unearned state */
  muted?: boolean;
};

function draw(
  s: IconShape,
  i: number,
  stroke: string,
  width: number,
  fill: string | undefined,
  opacity: number,
) {
  const common = {
    stroke,
    strokeWidth: width,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: fill ?? 'none',
    opacity,
  };
  return s.t === 'c' ? (
    <Circle key={i} cx={s.cx} cy={s.cy} r={s.r} {...common} />
  ) : (
    <Path key={i} d={s.d} {...common} />
  );
}

function Icon({
  name,
  size = 24,
  variant = 'duotone',
  tone,
  bodyColor,
  accentColor,
  glow = 1,
  muted = false,
}: IconProps) {
  const orbit = useOrbitOptional();
  const themed = resolveIconDuotone(orbit?.accentTheme?.id, orbit?.orbitPalette?.isDark);
  const resolvedBody = bodyColor ?? themed.body;
  const resolvedAccent = accentColor ?? themed.accent;
  const resolvedTone = tone ?? resolvedBody;

  const shapes = ICONS[name];
  if (!shapes) return null;

  const w = STROKE[variant];
  const nodes: React.ReactNode[] = [];

  if (variant === 'halo' && glow > 0 && !muted) {
    // Fake the bloom with two wide, low-opacity passes. react-native-svg has no
    // reliable filter support, so do not reach for feGaussianBlur here.
    shapes.forEach((s, i) => {
      const base = s.accent ? w.accent : w.body;
      nodes.push(draw(s, 1000 + i, resolvedTone, base * 3.4, undefined, 0.08 * glow));
      nodes.push(draw(s, 2000 + i, resolvedTone, base * 2.0, undefined, 0.16 * glow));
    });
  }

  shapes.forEach((s, i) => {
    if (variant === 'halo') {
      nodes.push(
        draw(s, i, resolvedTone, s.accent ? w.accent : w.body, undefined, s.accent ? 0.55 : 1),
      );
    } else {
      const stroke = s.accent ? resolvedAccent : resolvedBody;
      const fill = s.accent && s.fill ? resolvedAccent : undefined;
      nodes.push(draw(s, i, stroke, s.accent ? w.accent : w.body, fill, 1));
    }
  });

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" opacity={muted ? 0.28 : 1}>
      {nodes}
    </Svg>
  );
}

export default memo(Icon);
