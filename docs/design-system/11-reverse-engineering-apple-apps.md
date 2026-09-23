# 11 — Reverse Engineering Apple Apps

> This document extracts patterns from Apple's own first-party apps (plus Instagram's iOS 27 Liquid Glass rollout) as the concrete reference library Cursor should emulate. Each pattern ends with an explicit "Translate this pattern into Choremaxx" line pointing at the exact screen/component that inherits it. Written from well-documented, widely-observed public design patterns — used as directional reference, not pixel-measured spec.

## Instagram (iOS 27 Liquid Glass rollout)

- **Navigation pattern**: bottom tab bar rendered as a floating, inset glass pill rather than a full-bleed opaque bar; content scrolls fully behind it with no hard content boundary.
- **Visual hierarchy**: chrome (nav, header controls) is glass; content (photos, video, text) is always fully opaque and undistorted — glass never touches the actual media being viewed.
- **Material usage**: exactly one glass layer visible at a time — when a sheet or menu opens, the tab bar beneath dims rather than both remaining visible glass simultaneously.
- **Immersive content**: full-bleed content with minimal chrome overlaid only where necessary (a few floating icon buttons), maximizing content-to-chrome ratio.

**Translate this pattern into Choremaxx:** the floating glass tab bar rebuild (`components/orbit/make-tab-bar.tsx`, see `08-liquid-glass-guidelines.md`) is a direct application. The Nova tab's "immersive content" analog is letting the Morning Brief card breathe with generous whitespace rather than surrounding it with chrome.

## Apple Reminders

- **List design**: flat rows, no card borders, grouped by list/date with plain section headers; a leading circle checkbox is the primary interactive element per row.
- **Inline metadata**: due date/flag/note indicators appear as small, muted inline text/icons directly under the title — never as separate rows or separate cards.
- **Editing flow**: tapping a row opens detail inline (expandable) for quick edits; a full "Add Details" sheet exists for deeper editing (priority, notes, tags) but isn't required for the common case of "just check it off."
- **Empty states**: a calm, centered single-line message ("No Reminders") with no illustration.

**Translate this pattern into Choremaxx:** this is the primary reference for the Task Row component (`05-component-library.md`) and the Tasks screen batch — flat rows, inline metadata (assignee, XP, due), leading checkbox, minimal-friction complete action, deeper editing one tap away via `task/[id].tsx`.

## Apple Home

- **Room-based organization**: devices/scenes are organized by room, with a room-switcher as a lightweight horizontal control, not a hard navigation boundary.
- **Contextual controls**: a device's primary control (on/off, brightness) is directly tappable from its card; secondary settings are one tap deeper.
- **Status-first cards**: cards lead with current state (on, 72°, locked) rather than the device's static name being the most prominent text.
- **Warm, approachable tone**: soft accent tinting per room/scene rather than a uniform cold-blue system chrome.

**Translate this pattern into Choremaxx:** household organization by room (already a first-class concept — `data/household-rooms.ts`, room assignment in tasks/groceries) should get the same "room switcher as lightweight horizontal control" treatment on Tasks/Groceries, and task/grocery cards should lead with *state* (overdue, low stock) the way Home leads with device state, not just the item name.

## Apple Journal

- **Calm layouts**: generous whitespace, large type, minimal chrome — entries read like a page, not a dashboard.
- **Photo-forward but text-first hierarchy**: when photos are present they support the text, they don't dominate the layout.
- **Prompt-based empty states**: gentle suggested prompts rather than a blank "create your first entry" CTA wall.

**Translate this pattern into Choremaxx:** Nova's Morning Brief and Household Summary surfaces (`07-nova-experience.md`) should read like a Journal entry — a few calm sentences with generous whitespace — not a data-dense card. Home's overall breathing room target is Journal-level whitespace, not dashboard density.

## Apple Fitness

- **Motivational progress, not dashboard overload**: the Activity rings are the single dominant visual, everything else (trends, awards) is secondary and reached by scrolling/tapping deeper.
- **Positive reinforcement framing**: closing a ring, awards, and streaks are celebrated warmly without ever framing an unclosed ring as failure.
- **Social features are opt-in and secondary**: sharing/competing with friends exists but never displaces your own personal ring as the primary focus of the app's home view.

**Translate this pattern into Choremaxx:** Rewards/Rankings (`app/(tabs)/rewards.tsx`) should adopt ring-based personal progress (XP/streak rings) as the dominant visual per member, with household rankings as a secondary, clearly-scoped section — matching Fitness's "your ring first, friends' activity second" priority order. Momentum (`momentum.tsx`, `components/orbit/momentum-ring.tsx`) is already ring-shaped and is the closest existing pattern to build from.

## Apple Wallet

- **Premium card transitions**: cards stack with a peek of the next card, expand with a smooth vertical push transition, and use rich, high-contrast branding per card.
- **Stacked presentation**: multiple cards of the same type collapse into a fanned stack when not actively viewing one, expanding on tap.
- **Card-native detail**: tapping a card expands it in place (matched-geometry-style) rather than navigating to an unrelated detail screen layout.

**Translate this pattern into Choremaxx:** Rewards' redeemable items and household member "profile cards" (in Household Members / persona switch) are strong candidates for a stacked-card presentation, and the Task/Event/Itinerary detail screens' matched-geometry transition from their list card (`03-motion-interaction.md` §3) is directly modeled on Wallet's card-native detail behavior.

## Apple Photos

- **Grid-first browsing, minimal chrome**: a nearly chrome-free grid with contextual selection controls that appear only when needed (long-press/selection mode).
- **Selection states**: multi-select mode transforms the toolbar contextually rather than requiring a separate "select mode" screen.
- **Search as a first-class, glass-backed overlay**: search expands over content with a translucent scrim, not a separate screen.

**Translate this pattern into Choremaxx:** Grocery item grids/photo-proof attachments (task proof photos, per `docs/legal/privacy-policy.md`'s mention of proof attachments) should adopt Photos' minimal-chrome grid + contextual selection toolbar pattern rather than a persistent multi-select header. Search overlays (`05-component-library.md`'s Search Bar) follow Photos' glass-scrim-over-content model.

## Apple Music

- **Now-playing persistent mini-surface**: a compact glass bar above the tab bar that expands to full detail on tap, never blocking navigation.
- **Editorial, large-type browsing**: browse surfaces use large type and generous card imagery rather than dense list rows for discovery contexts.

**Translate this pattern into Choremaxx:** the "Now Playing"-style persistent mini-surface pattern maps to a possible persistent "Active shopping trip" or "In progress task" mini-bar above the tab bar (future consideration, not required for the current screen list) — noted here as an available pattern if such a feature is scoped later, per `01-product-philosophy.md`'s "ambient awareness" principle.

## Apple Calendar

- **Grid clarity**: month/week grids use minimal chrome, relying on typography and subtle color dots for event density rather than filled colored blocks everywhere.
- **Day-detail as a clean list**: tapping into a day shows a flat, time-ordered list, not a re-rendered mini-grid.
- **Today emphasis**: today's date/column gets a single, restrained accent treatment (a filled circle on the date), not a saturated background wash.

**Translate this pattern into Choremaxx:** the Plan screen's calendar/event rendering (`app/(tabs)/plan.tsx`, `app/(tabs)/calendar.tsx` legacy) should adopt restrained today-emphasis and flat day-detail lists rather than heavier card-per-event treatments; this directly supports fixing the "trip suggestion card competing with calendar" finding in `09-ui-audit.md`.

## Cross-reference

- Every "Translate this pattern into Choremaxx" line above is picked up as a concrete design direction in the relevant screen's entry in `06-screen-specifications.md` and as numbered tasks in `10-cursor-tasks.md`.
- These patterns are directional references for feel and structure, not licensed assets or pixel-copied layouts — Choremaxx's own brand (`01-product-philosophy.md`, `constants/choremaxx-brand.ts`) remains the visual identity throughout.
