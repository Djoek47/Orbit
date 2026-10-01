import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { isTourCardOnScreen, placeExitPill, placeTourCard } from '@/lib/tour/tour-layout';

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

// ── Exit pill never covers what the tour is pointing at ───────────────────────
{
  const screen = { w: 390, h: 844 };
  const insets = { top: 47 };
  const home = placeExitPill({ target: null, screen, insets });
  assert.equal(home.side, 'right', 'with nothing highlighted it sits where it always did');
  assert.equal(home.top, 55);

  // A target well down the page leaves the corner alone.
  const lowTarget = placeExitPill({
    target: { x: 16, y: 400, width: 358, height: 80 },
    screen,
    insets,
  });
  assert.deepEqual(lowTarget, { side: 'right', top: 55 });

  // The Settings button: top-right, small. The pill flips to the left.
  const settings = placeExitPill({
    target: { x: 250, y: 44, width: 96, height: 34 },
    screen,
    insets,
  });
  assert.equal(settings.side, 'left', 'the way out never hides behind the button it points at');
  assert.equal(settings.top, 55);

  // The real header: bell then Settings, hard against the right edge (from the device).
  for (const chip of [
    { x: 343, y: 82, width: 112, height: 44 }, // Settings, 471pt screenshot scaled
    { x: 268, y: 60, width: 104, height: 36 }, // Settings on a 390pt phone
    { x: 214, y: 60, width: 44, height: 36 }, // the bell
  ]) {
    const placed = placeExitPill({ target: chip, screen, insets });
    assert.equal(placed.side, 'left', `header chip at x=${chip.x} moves the pill left`);
  }

  // Something top-LEFT (a greeting, a back chevron) leaves the right corner free.
  const topLeft = placeExitPill({
    target: { x: 12, y: 44, width: 70, height: 34 },
    screen,
    insets,
  });
  assert.equal(topLeft.side, 'right');

  // A full-width header: no corner is free, so the pill drops below it.
  const banner = placeExitPill({
    target: { x: 0, y: 40, width: 390, height: 70 },
    screen,
    insets,
  });
  assert.equal(banner.side, 'right');
  assert.ok(banner.top >= 110 + 10 - 1, `dropped below the banner, got ${banner.top}`);
  assert.ok(banner.top + 40 <= screen.h, 'and still on screen');

  // A target that fills the screen can't push the pill off the bottom.
  const huge = placeExitPill({
    target: { x: 0, y: 0, width: 390, height: 844 },
    screen,
    insets,
  });
  assert.ok(huge.top + 40 <= screen.h, 'clamped inside the screen');
  assert.ok(huge.top >= 55, 'never above the safe area');
}

console.log('tour-layout: exit pill ok');
