import { memo } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg';

import { MOJI_ART, type MojiName } from '@/components/orbit/moji/art';
import { mojiForEmoji } from '@/components/orbit/moji/resolve';
import type { MojiShape } from '@/components/orbit/moji/types';

export type MojiProps = {
  /** A Moji by name… */
  name?: MojiName;
  /**
   * …or a stored emoji string (grocery icon, room, place, subject). Emojis are kept in data
   * for back-compat; they are never drawn as text — this maps them to a Moji.
   */
  emoji?: string | null;
  /** Rendered size in points (square). Default 24. */
  size?: number;
  /** Used when neither `name` nor `emoji` resolves. Default 'sparkles'. */
  fallback?: MojiName;
  style?: StyleProp<ViewStyle>;
};

function renderShape(s: MojiShape, i: number) {
  const common = { fill: s.f, opacity: s.o, transform: s.tr } as const;
  switch (s.t) {
    case 'p':
      return <Path key={i} d={s.d} {...common} />;
    case 'c':
      return <Circle key={i} cx={s.cx} cy={s.cy} r={s.r} {...common} />;
    case 'e':
      return <Ellipse key={i} cx={s.cx} cy={s.cy} rx={s.rx} ry={s.ry} {...common} />;
    case 'r':
      return <Rect key={i} x={s.x} y={s.y} width={s.w} height={s.h} rx={s.rx} {...common} />;
  }
}

/**
 * ChoreMaxx Moji — our own flat-shaded emoji set (groceries, homework, places, rooms,
 * rewards). Replaces every system emoji outside avatars. Keeps its own colours on every
 * theme, like an emoji. Not to be confused with the approved task `Icon` set.
 */
export const Moji = memo(function Moji({
  name,
  emoji,
  size = 24,
  fallback = 'sparkles',
  style,
}: MojiProps) {
  const resolved: MojiName = name ?? mojiForEmoji(emoji) ?? fallback;
  const art = MOJI_ART[resolved];
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" style={style} accessibilityElementsHidden>
      {art.map(renderShape)}
    </Svg>
  );
});
