import React, { memo } from 'react';
import Svg, { Circle, Path } from 'react-native-svg';
import { ICONS, IconName, IconShape } from './icons';

export type IconVariant = 'duotone' | 'halo';

/** Defaults. Prefer passing colors from the theme rather than editing these. */
export const ICON_BODY = '#F1E6D6';   // cream — same family as the "chore" wordmark
export const ICON_ACCENT = '#E4552B'; // rust — same family as the "maxx" wordmark

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
  /** duotone only */
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
  tone = ICON_BODY,
  bodyColor = ICON_BODY,
  accentColor = ICON_ACCENT,
  glow = 1,
  muted = false,
}: IconProps) {
  const shapes = ICONS[name];
  if (!shapes) return null;

  const w = STROKE[variant];
  const nodes: React.ReactNode[] = [];

  if (variant === 'halo' && glow > 0 && !muted) {
    // Fake the bloom with two wide, low-opacity passes. react-native-svg has no
    // reliable filter support, so do not reach for feGaussianBlur here.
    shapes.forEach((s, i) => {
      const base = s.accent ? w.accent : w.body;
      nodes.push(draw(s, 1000 + i, tone, base * 3.4, undefined, 0.08 * glow));
      nodes.push(draw(s, 2000 + i, tone, base * 2.0, undefined, 0.16 * glow));
    });
  }

  shapes.forEach((s, i) => {
    if (variant === 'halo') {
      nodes.push(draw(s, i, tone, s.accent ? w.accent : w.body, undefined, s.accent ? 0.55 : 1));
    } else {
      const stroke = s.accent ? accentColor : bodyColor;
      const fill = s.accent && s.fill ? accentColor : undefined;
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
