/**
 * Persistent vertical scroll indicator for Revision D §5.2.
 * Always shows a visible track/thumb — not the fading iOS default.
 */

import { ScrollView, StyleSheet, View, type ScrollViewProps } from 'react-native';
import { useState } from 'react';

import { useOrbitColors } from '@/lib/theme/use-orbit-colors';

type Props = ScrollViewProps & {
  indicatorColor?: string;
};

export function PersistentScrollView({
  children,
  style,
  contentContainerStyle,
  indicatorColor,
  ...rest
}: Props) {
  const { c } = useOrbitColors();
  const [viewport, setViewport] = useState(1);
  const [content, setContent] = useState(1);
  const [offset, setOffset] = useState(0);

  const show = content > viewport + 4;
  const thumbH = show ? Math.max(24, (viewport / content) * viewport) : 0;
  const maxTravel = Math.max(1, viewport - thumbH);
  const travel = show ? Math.min(maxTravel, (offset / Math.max(1, content - viewport)) * maxTravel) : 0;
  const color = indicatorColor ?? c.accent;
  const thumbColor = `${color}66`; // theme accent at ~40% opacity (Rev F §2.1)

  return (
    <View style={[styles.wrap, style]} onLayout={(e) => setViewport(e.nativeEvent.layout.height)}>
      <ScrollView
        {...rest}
        style={StyleSheet.absoluteFill}
        contentContainerStyle={contentContainerStyle}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={(_w, h) => setContent(h)}
        onScroll={(e) => {
          setOffset(e.nativeEvent.contentOffset.y);
          rest.onScroll?.(e);
        }}
        scrollEventThrottle={16}
      >
        {children}
      </ScrollView>
      {show ? (
        <View style={[styles.track, { backgroundColor: `${color}22` }]} pointerEvents="none">
          <View
            style={[
              styles.thumb,
              {
                height: thumbH,
                transform: [{ translateY: travel }],
                backgroundColor: thumbColor,
              },
            ]}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, position: 'relative' },
  track: {
    borderRadius: 3,
    bottom: 8,
    position: 'absolute',
    right: 2,
    top: 8,
    width: 3,
  },
  thumb: {
    borderRadius: 3,
    opacity: 0.85,
    width: 3,
  },
});
