/**
 * The column the whole app lives in.
 *
 * On a phone, and on the iPhone Duo's inner screen, it is simply the window. On an iPad it is
 * centred and capped, with the household's own background painted either side, so a layout
 * made for a phone reads as a deliberate column rather than a phone screen stretched across
 * thirteen inches of glass.
 *
 * It follows the window as it changes — rotation, Split View, Stage Manager, folding a Duo —
 * because useWindowDimensions does. Anything that used to measure the screen once, at module
 * load, should read useContentWidth() instead, or it will lay out for a window that no longer
 * exists.
 *
 * Native modals (presentation: 'modal' / 'formSheet') are presented by the system outside this
 * view and are already centred sheets on iPad, so they are left alone.
 */
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { columnWidth, layoutClass, type LayoutClass } from '@/lib/ui/layout-metrics';

type ContentWidth = {
  /** The width content actually has to work with. */
  width: number;
  /** The whole window, for the rare thing that should still span it. */
  windowWidth: number;
  layout: LayoutClass;
};

const ContentWidthContext = createContext<ContentWidth | null>(null);

export function AppColumn({ background, children }: { background: string; children: ReactNode }) {
  const { width: windowWidth } = useWindowDimensions();
  const width = columnWidth(windowWidth);
  const value = useMemo(
    () => ({ width, windowWidth, layout: layoutClass(windowWidth) }),
    [width, windowWidth]
  );

  return (
    <ContentWidthContext.Provider value={value}>
      <View style={[styles.outer, { backgroundColor: background }]}>
        <View style={[styles.column, { width }]}>{children}</View>
      </View>
    </ContentWidthContext.Provider>
  );
}

/**
 * The column's width. Outside an AppColumn (tests, a native modal) it falls back to the window,
 * which is what everything measured before the column existed.
 */
export function useContentWidth(): ContentWidth {
  const fromColumn = useContext(ContentWidthContext);
  const { width: windowWidth } = useWindowDimensions();
  return (
    fromColumn ?? {
      width: windowWidth,
      windowWidth,
      layout: layoutClass(windowWidth),
    }
  );
}

/**
 * For anything drawn in a native Modal, which renders outside the column: a style that puts a
 * full-width sheet back inside it. Null on a phone and on the Duo, where there is no margin.
 *
 *   'flow'      the sheet is a flex child (e.g. of a backdrop with justifyContent: flex-end):
 *               centred by alignSelf, with the column's width
 *   'absolute'  the sheet is position: absolute with left: 0 / right: 0: inset both edges
 *
 * They differ because left/right on a non-absolute view are offsets, not edges — mixing them
 * with centring shifts the sheet twice.
 */
export function useModalColumnStyle(
  mode: 'flow' | 'absolute' = 'flow'
): { width: number; alignSelf: 'center' } | { left: number; right: number; width: number } | null {
  const { width, windowWidth } = useContentWidth();
  const inset = Math.max(0, (windowWidth - width) / 2);
  if (inset <= 0) return null;
  return mode === 'absolute' ? { left: inset, right: inset, width } : { width, alignSelf: 'center' };
}

const styles = StyleSheet.create({
  outer: { alignItems: 'center', flex: 1 },
  column: { flex: 1, overflow: 'hidden' },
});
