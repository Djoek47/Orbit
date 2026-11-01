# 08 — Liquid Glass Guidelines

> Choremaxx has exactly one component today that correctly implements a Liquid-Glass-style material: `components/orbit/global-header-chips.tsx` (real `BlurView` + accent gradient wash). Everything else calling itself "glass" (`GlassCard`) is actually a flat translucent fill. This document defines the rule that fixes that gap without over-applying blur everywhere, which would be an equally bad outcome.

## The one rule

**Glass is navigation and chrome. Glass is never content.**

If you're unsure whether something should be glass, ask: *does this element float above scrollable content, or is it part of the content itself?* Floating → glass. Content → flat `surface` color (see `02-design-language.md` §1.2).

## Where glass belongs

- **Navigation** — the tab bar (`make-tab-bar.tsx`), the top chrome (`global-header-chips.tsx`, already correct).
- **Chrome** — toolbars, the collapsed-search affordance, a screen's floating back/close button when it sits over imagery/content rather than a solid header.
- **Floating controls** — the FAB, a floating "..." menu trigger, a floating "scroll to top" affordance.
- **Overlays** — context menus (`05-component-library.md`), tooltips/callouts.
- **Sheets** — the partial-height bottom sheet's background (`ultraThin`), a full-screen modal's *header* only (the modal's body content is flat, not glass — see next section).
- **Search** — the search field itself and its immediate surrounding bar.

## Where glass does NOT belong

- **Cards.** A Task card, a Reward card, a Nova briefing card is `surface.card`/`surface.cardStrong` — flat translucent fill, never blurred. `GlassCard`'s naming is legacy; conceptually it is a *surface* component, not a material component (see `05-component-library.md`'s Cards entry — this is the terminology fix that ships with the Phase B token work).
- **List rows.** Never blurred.
- **Full-screen modal bodies.** The *header* of a modal sheet can use `ultraThin` if it needs to show a hint of what's behind it while scrolling (rare), but the scrollable body content area is `background.elevated` flat, per `02-design-language.md` §1.1 — a fully blurred modal body makes text hard to read and signals "temporary/floating" for something that's actually the user's full attention surface.
- **Backgrounds.** The screen's root background is never a blur — it's a flat/gradient color from the background hierarchy.

## Never stack glass on glass

If a blurred tab bar is visible and a blurred context menu opens *directly above* it with no flat content between them, the two materials visually merge into mush — this is the single most common Liquid-Glass implementation mistake. Rule: **at most one material layer is visible in any given screen region at a time.** When a glass element (context menu, sheet) opens over another glass element (tab bar, header), the lower one should be:

- Dimmed/backdrop-darkened rather than left as visible blur, or
- Positioned so the new glass element doesn't visually overlap the old one (e.g. a context menu anchored mid-screen doesn't overlap the tab bar).

## Never blur everything

A screen where the header, the tab bar, *and* several cards are all blurred has no depth left to communicate — everything reads as "hazy" rather than "layered." Depth comes from **contrast between exactly one or two glass layers and everything else being resolutely flat.** This is why `05-component-library.md` assigns glass to only: tab bar, header/search, FAB, context menu, bottom sheet — five components, not fifty.

## Material tier reference

(Full spec in `02-design-language.md` §6; repeated here for the "translate this rule" context.)

| Tier | Where |
|---|---|
| `material.liquidGlass` | Tab bar, expanded search field, FAB — the hero floating moments, used in ≤3 places on screen at once. |
| `material.ultraThin` | Sticky section headers while scrolling, bottom-sheet backgrounds. |
| `material.thin` | Context menus, secondary inline toolbars, segmented-control-adjacent floating chips. |
| `material.opaque` | Full-screen modal bodies — deliberately *not* glass. |

## Concrete before/after in this codebase

- **Tab bar** (`make-tab-bar.tsx`): today a full-width `LinearGradient` bar with no blur. Becomes a floating, inset (`space.sm` margin) rounded-rect using the exact `BlurView` + gradient-wash recipe already proven in `global-header-chips.tsx` — this is the single highest-impact Liquid Glass change in the whole rebuild, because the tab bar is visible on every primary screen.
- **`GlassCard`**: keep its current translucent-fill visual (it already looks reasonable), but drop the "glass" framing in documentation/naming going forward — it's a `surface.card`, not a material.
- **Context menus / bottom sheets**: currently don't exist as shared components (per `05`) — when built, they use `material.thin`/`material.ultraThin` from day one rather than a flat card, which is the one net-new "real glass" surface area beyond the tab bar.
- **Search fields**: currently plain `Input` styling wherever search exists — upgrade to `material.thin` per `05`'s Search Bar entry.

## Cross-reference

- Material tier definitions: `02-design-language.md` §6.
- Component assignments: `05-component-library.md`.
- Instagram's floating-glass-navigation pattern (the specific inspiration for the tab bar rebuild) is documented with its "translate into Choremaxx" note in `11-reverse-engineering-apple-apps.md`.
