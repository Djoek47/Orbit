import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { isTourCardOnScreen, placeTourCard } from '@/lib/tour/tour-layout';

const SCREENS = [
  { w: 375, h: 667, insets: { top: 20, bottom: 0 } },
  { w: 402, h: 874, insets: { top: 59, bottom: 34 } },
  { w: 820, h: 1180, insets: { top: 24, bottom: 20 } },
] as const;

const CARD_HEIGHTS = [160, 260, 420] as const;

function assertInsideSafeArea(
  top: number,
  cardHeight: number,
  screen: { h: number },
  insets: { top: number; bottom: number }
) {
  const minTop = insets.top + 8;
  const maxBottom = screen.h - insets.bottom - 8;
  assert.ok(top >= minTop - 0.5, `top ${top} above safe min ${minTop}`);
  assert.ok(top + cardHeight <= maxBottom + 0.5, `bottom ${top + cardHeight} past ${maxBottom}`);
}

describe('placeTourCard', () => {
  for (const screen of SCREENS) {
    for (const cardHeight of CARD_HEIGHTS) {
      it(`tab-bar target on ${screen.w}x${screen.h} card ${cardHeight}`, () => {
        const tabBarTop = screen.h - screen.insets.bottom - 64;
        const result = placeTourCard({
          target: { x: 80, y: tabBarTop, width: 64, height: 56 },
          cardHeight,
          screen: { w: screen.w, h: screen.h },
          insets: screen.insets,
        });
        assertInsideSafeArea(result.top, cardHeight, screen, screen.insets);
        assert.notEqual(result.placement, 'below');
      });

      it(`top target on ${screen.w}x${screen.h} card ${cardHeight}`, () => {
        const result = placeTourCard({
          target: { x: 20, y: screen.insets.top + 40, width: 200, height: 48 },
          cardHeight,
          screen: { w: screen.w, h: screen.h },
          insets: screen.insets,
        });
        assertInsideSafeArea(result.top, cardHeight, screen, screen.insets);
      });

      it(`middle target on ${screen.w}x${screen.h} card ${cardHeight}`, () => {
        const result = placeTourCard({
          target: { x: 24, y: screen.h / 2 - 40, width: 300, height: 80 },
          cardHeight,
          screen: { w: screen.w, h: screen.h },
          insets: screen.insets,
        });
        assertInsideSafeArea(result.top, cardHeight, screen, screen.insets);
      });
    }
  }

  it('prefers below when both sides fit', () => {
    const result = placeTourCard({
      target: { x: 40, y: 200, width: 200, height: 40 },
      cardHeight: 160,
      screen: { w: 402, h: 874 },
      insets: { top: 59, bottom: 34 },
    });
    assert.equal(result.placement, 'below');
  });

  it('centers when forced or no target', () => {
    const a = placeTourCard({
      target: null,
      cardHeight: 200,
      screen: { w: 402, h: 874 },
      insets: { top: 59, bottom: 34 },
    });
    assert.equal(a.placement, 'center');
    const b = placeTourCard({
      target: { x: 0, y: 0, width: 402, height: 500 },
      cardHeight: 200,
      screen: { w: 402, h: 874 },
      insets: { top: 59, bottom: 34 },
      forceCenter: true,
    });
    assert.equal(b.placement, 'center');
  });

  it('reproduces the WO9.3 stuck-card case and clamps on-screen', () => {
    // Tester iPhone 402×874 — Tasks tab near the bottom.
    const result = placeTourCard({
      target: { x: 80, y: 792, width: 64, height: 58 },
      cardHeight: 200,
      screen: { w: 402, h: 874 },
      insets: { top: 59, bottom: 34 },
    });
    assertInsideSafeArea(result.top, 200, { h: 874 }, { top: 59, bottom: 34 });
    assert.ok(result.top + 200 <= 874 - 34 - 8);
  });

  it('counts clamped center as visible for the watchdog', () => {
    const tall = 900;
    const screen = { w: 402, h: 874 };
    const insets = { top: 59, bottom: 34 };
    const result = placeTourCard({
      target: null,
      cardHeight: tall,
      screen,
      insets,
    });
    assert.equal(result.placement, 'center');
    assert.equal(
      isTourCardOnScreen({
        placement: result.placement,
        top: result.top,
        cardHeight: tall,
        screen: { h: screen.h },
        insets,
      }),
      true
    );
  });
});
