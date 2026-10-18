# 03 — Motion & Interaction

> Choremaxx already ships `react-native-reanimated`, `expo-haptics`, and `react-native-gesture-handler` as dependencies but uses them only in a handful of showpiece components (`nova-orb`, `brand-opening`, `sign-in-success`, `fire-edge-progress`, `reward-claim-press`). This document turns that into a shared motion system so every rebuilt screen moves the same way iOS itself moves.

## 1. Spring timing tokens

Three named springs, matching `docs/ux-design-system.md`'s existing 150/300/600ms intent but expressed as Reanimated spring configs (springs, not durations, because iOS motion is physically based, not linear-eased):

| Token | Config | Usage |
|---|---|---|
| `motion.snappy` | `{ damping: 20, stiffness: 300, mass: 0.8 }` (~150ms feel) | Button press feedback, toggle switches, chip selection. |
| `motion.smooth` | `{ damping: 18, stiffness: 180, mass: 1 }` (~300ms feel) | Card state changes, sheet content transitions, list-row insert/remove. |
| `motion.settle` | `{ damping: 22, stiffness: 90, mass: 1.2 }` (~600ms feel) | Momentum ring fill, XP/badge reveal, Nova orb state changes, onboarding hero transitions. |

For simple opacity/color fades that don't need spring physics, use `withTiming` at matching durations (150/300/600ms) with `Easing.out(Easing.cubic)` — reserve springs for anything that moves position/scale.

## 2. Navigation

- **Push navigation** (Stack screens): iOS default slide-from-right with the outgoing screen parallax-dimming slightly — this is Expo Router's/`react-native-screens`' native default; do not override it with a custom JS-driven transition.
- **Modal presentation** (`presentation: 'modal'` in `_layout.tsx`, already used for `create-task`, `create-event`, `settings`, etc.): iOS default sheet-from-bottom. Keep using Expo Router's native `presentation: 'modal'` rather than a custom Reanimated bottom-sheet for full-screen modals — only build a custom bottom sheet (§6) for *partial-height* sheets that coexist with visible content behind them.
- **Tab switches**: no slide/fade transition between tabs — instant content swap is correct iOS tab bar behavior. Only the tab bar's own selection indicator animates (`motion.snappy`).
- Never build a custom screen-transition animation to replace what `expo-router`/`react-native-screens` already provides natively. Custom motion budget is spent on *content within* a screen, not on replacing OS navigation choreography.

## 3. Matched geometry (shared-element-style transitions)

Used for exactly three interaction classes, because overuse cheapens the effect:

1. **Card → detail**: tapping a Task/Event/Itinerary/Reward card should feel like that card *becomes* the detail screen's header, not like a new unrelated screen slid in. Implement with Reanimated's `sharedTransitionTag` where the list-row/card and the detail screen's hero element share layout (title text, leading icon/avatar, accent color chip).
2. **Avatar → profile switch**: the persona-switch popup's avatar animates from its tab-bar/settings position into the popup.
3. **FAB → create-sheet**: a floating action button's icon can morph into the create-flow sheet's close button (rotate 45°) rather than the sheet just appearing — reuses the existing `motion.smooth` spring.

Do not add matched-geometry transitions to list items in dense scrolling lists (Groceries, Tasks) beyond the tap-to-detail case above — it becomes distracting at high frequency.

## 4. Context menus

Long-press context menus (native iOS pattern) replace ad hoc "..." button menus and destructive inline icon rows wherever there are 2+ secondary actions on a list row:

- Trigger: long-press (300ms) with a `motion.snappy` scale-down-then-settle on the pressed row (haptic: `Haptics.impactAsync(Light)` on menu open).
- Content: use `expo-blur`'s `material.thin` (see `02-design-language.md` §6) as the menu's background, never a solid card.
- Placement: anchored to the pressed element, never centered full-screen.
- Where used in this rebuild: Task row (complete / reassign / delete), Grocery row (mark got it / edit / remove), Reward row (redeem / edit / archive — role-gated), Notification row (mark read / open / dismiss).
- Destructive actions inside a context menu are labeled in `danger` semantic color with a trailing icon, matching iOS convention — never require a second confirmation *within* the menu (confirmation, if needed, happens as a follow-up alert, not a nested menu state).

## 5. Haptics

Haptics confirm state changes the eye might miss, especially with one-handed or distracted use (see `01-product-philosophy.md`, calm technology). Existing usage (tab bar, persona switch, xp-wheel, reward claim, select-profile) becomes the pattern for every new component:

| Event | Haptic |
|---|---|
| Task/grocery item completed | `Haptics.impactAsync(Medium)` |
| XP awarded / badge unlocked | `Haptics.notificationAsync(Success)` |
| Toggle switch flipped | `Haptics.selectionAsync()` |
| Tab bar selection change | `Haptics.selectionAsync()` (already implemented — keep) |
| Destructive action confirmed (delete task, remove member) | `Haptics.impactAsync(Heavy)` |
| Error / validation failure | `Haptics.notificationAsync(Error)` |
| Pull-to-refresh triggered | `Haptics.impactAsync(Light)` at the release threshold |
| Context menu opened (long-press) | `Haptics.impactAsync(Light)` |

Rule: **haptics accompany a state change that already has a visual change** — never fire a haptic as the *only* feedback for an action; it must always pair with motion/color/text change so the interaction is legible with haptics disabled (accessibility setting) or on Android (haptics degrade gracefully, motion/color must carry full meaning alone).

## 6. Gesture priorities

When gestures could conflict (a swipeable list row inside a scrollable list, a bottom sheet inside a screen with pull-to-refresh):

1. **Vertical scroll wins** by default inside any `ScrollView`/`FlatList`.
2. **Horizontal swipe-to-reveal-actions** on a list row only activates after a clear horizontal intent threshold (`Math.abs(dx) > Math.abs(dy) * 1.5`), matching the existing pattern already used for the welcome-screen swipe-back gesture (`app/welcome.tsx`'s `PanResponder`) — reuse that threshold logic as the shared gesture-priority rule rather than reinventing it per screen.
3. **Swipe-back (screen dismissal)** takes priority only when the gesture starts within ~24px of the left edge (iOS default) or, for the welcome flow's custom implementation, only when `canGoBack` is true for the current step.
4. **Long-press (context menu) and drag (reorder)** are mutually exclusive per element — a row that supports reordering does not also get a long-press context menu; reordering rows use a leading grip handle instead, and the context menu moves to a trailing "..." affordance for those specific rows.

## 7. Scroll behavior

- **Large-title collapse**: screens with a `largeTitle`/`title1` header (see `02-design-language.md` §2.3) collapse that title into a smaller pinned title as the user scrolls, exactly like iOS nav bars. Implement via a Reanimated `useAnimatedScrollHandler` driving the header's font size (34→17) and vertical position, interpolated over the first ~80px of scroll — this is new shared behavior needed for Home, Tasks, Plan, Rewards headers (currently static headers under `GlobalHeaderChips`).
- **Sticky section headers**: where a list has grouped sections (Tasks by day, Notifications by date), section headers use `material.ultraThin` (see `02` §6) and stick to the top while scrolling, exactly like iOS grouped lists / Contacts.
- **Overscroll**: allow natural iOS rubber-band overscroll; never clip or disable it.

## 8. Pull to refresh

- Standard iOS pull-to-refresh (`RefreshControl` tinted with `accent.primary`) on every primary list screen (Home, Tasks, Plan, Rewards, Notifications, Groceries) wherever data can go stale from another household member's action.
- Haptic on release-to-trigger threshold (§5).
- Never pair pull-to-refresh with a separate visible "Refresh" button on the same screen — one mechanism, not two.

## 9. Bottom sheets

Two distinct patterns, used for different situations — do not conflate them:

1. **Full-screen modal sheet** (existing `presentation: 'modal'` Stack screens: create-task, create-event, settings, etc.) — native, full height or near-full height, its own nav-style header with a close button. This remains the primary create/edit pattern.
2. **Partial-height action sheet** (new pattern for this rebuild) — a custom Reanimated-driven sheet that covers 30–60% of the screen, drag-to-dismiss, `material.ultraThin` background, used for quick single-decision moments that shouldn't feel like "leaving" the current screen: e.g. "Mark as done — how much time did it take?", quick reward redemption confirmation, quick store-recommendation preview. Drag gesture uses `motion.smooth`; releasing past 40% of the sheet's height dismisses with `motion.settle`.

Rule: if a flow needs more than ~2 fields, it's a full-screen modal sheet, not a partial-height one. Partial sheets are for confirmations and single decisions.

## 10. Large Title collapsing (detail)

See §7. Interaction rule to pair with it: while collapsed, tapping the pinned small title scrolls the screen back to the top and re-expands the large title (`motion.smooth`) — standard iOS behavior, easy to miss when hand-rolling nav headers.

## 11. Interactive transitions

- Every dismiss gesture (swipe-down on a modal sheet, swipe-back on a stack screen, drag-down on a partial sheet) must be **interruptible and interactive** — the dismissal follows the finger in real time and can be released partway to snap back, never a binary "gesture recognized → animate fully" model. Reanimated's gesture handler + `withSpring`'s `velocity` param achieves this; this is the #1 thing that makes a hand-rolled transition feel "off" compared to native iOS if skipped.
- Cancel by releasing above the dismissal threshold snaps back with `motion.snappy`.

## 12. Search

- Search fields live in `material.liquidGlass` or `material.thin` (see `02` §6), never a flat opaque input — this matches iOS 15+ search-in-nav-bar convention.
- Search field expands from a compact "Search" affordance under the large title into a focused full-width field on tap/scroll, with the large title fading out — matches iOS Mail/Messages search behavior.
- Live results filter as-you-type with a `motion.snappy` fade/height animation on the results list, never a jarring full re-layout.
- Cancel button appears only while focused, animates in/out with the search field's expansion, and clears + dismisses keyboard in one tap.
- Used in this rebuild for: Tasks (filter by assignee/room), Groceries (find an item), Household Members (large households), Notifications (search history).

## Cross-reference

- Token values (spacing/radius/color) referenced here come from `02-design-language.md`.
- Material tiers referenced here (`liquidGlass`/`ultraThin`/`thin`) are fully specified in `08-liquid-glass-guidelines.md`.
- Concrete component implementations of context menus, bottom sheets, and search bars are specified in `05-component-library.md`.
