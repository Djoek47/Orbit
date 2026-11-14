# 05 — Component Library

> Every screen in `06-screen-specifications.md` is built exclusively from the components documented here. This is both a spec for components that need to be **built/upgraded** (Phase B of the plan) and a reference for components that are **already correct and should be reused as-is**. Each entry: Purpose, Variants, Spacing, Animation, Accessibility, Implementation notes.

Status legend: **Keep** (already matches this spec, reuse as-is) · **Upgrade** (exists, needs rework) · **New** (doesn't exist yet, build in Phase B).

## Foundation

### Button — Upgrade (`components/orbit/orbit-button.tsx`)

- **Purpose:** The one primary/secondary/danger action control.
- **Variants:** `primary` (gradient fill, `accent.primary`→`accent.secondary`, dark ink label), `secondary` (outline, 1px `border`, `text` label), `danger` (outline, `danger` border+label; filled-danger only for a final destructive confirmation, never a default state), `plain` (text-only link style, no container — for tertiary actions).
- **Spacing:** height 50 (was 52 — round to nearest control rhythm), horizontal padding `space.lg` (20), label `headline` weight 600 (was 700/14 — move to 17/600 per the type scale).
- **Animation:** press scales to 0.97 with `motion.snappy`; disabled state fades opacity to 0.4, no scale.
- **Accessibility:** minimum 44×44 hit target regardless of visual height; `accessibilityRole="button"`; loading state announces via `accessibilityLabel` change, not just a spinner.
- **Implementation:** keep the existing gradient-primary/outline-secondary structure; swap in new type scale + `radius.control`/`radius.card` sizing depending on button size variant (small chip-style vs. full-width primary).

### FAB (Floating Action Button) — New

- **Purpose:** Single global "create" affordance where a screen supports quick-add (Tasks, Groceries, Plan). Replaces per-card "+" buttons competing with it.
- **Variants:** `standard` (56×56 circle, `radius.full`, `material.liquidGlass` background + `accent.primary` icon) · `extended` (pill with label, used only on Home for "Add task").
- **Spacing:** floats `space.md` (16) from trailing/bottom safe-area edge.
- **Animation:** icon rotates 45° (`motion.smooth`) when it morphs into a create-sheet's close affordance (see `03-motion-interaction.md` §3); scale-press feedback like Button.
- **Accessibility:** `accessibilityLabel="Add task"` (context-specific, never generic "Add").
- **Implementation:** `expo-blur` `material.liquidGlass` background, absolute-positioned within the tab screen's container, respects safe-area + tab-bar height.

### Input — Upgrade (`components/orbit/orbit-input.tsx`)

- **Purpose:** Single-line text entry (email, password, name, search).
- **Variants:** `standard`, `search` (leading icon, `material.thin` background, pill radius), `secure` (existing `secureTextEntry`), `multiline` (grows with content, used for notes/descriptions).
- **Spacing:** height 50 for standard, padding `space.sm`/`space.md` internal.
- **Animation:** focus state animates border/background tint over 150ms (`motion.snappy`), not an instant snap.
- **Accessibility:** always paired with a visible label (never placeholder-as-label); error state exposes `accessibilityLabel` with the error text appended.
- **Implementation:** keep current structure, retint border/background per §1 of `02-design-language.md`; add `search` and `multiline` variants.

### Cards — Upgrade (`components/orbit/glass-card.tsx`)

- **Purpose:** Grouped content container at `surface.card` or `surface.cardStrong` tier (see `02-design-language.md` §1.2).
- **Variants:** `card` (default), `cardStrong` (`elevated` prop, renamed conceptually — one per screen max), `cardLarge` (radius.cardLarge, used for hero moments — Momentum ring, Nova briefing).
- **Spacing:** internal padding `space.lg` (20) for standard, `space.xl` (24) for `cardLarge`; internal gap `space.sm` (12).
- **Animation:** none at rest; press feedback only if the whole card is tappable (opacity 0.85 on press, no scale — scale is reserved for buttons/FABs).
- **Accessibility:** if tappable, `accessibilityRole="button"` on the card itself, not just an inner element.
- **Implementation:** rename the mental model from "glass" to "surface" (it's translucent fill, not blur — real glass lives in `08-liquid-glass-guidelines.md`'s material components below); enforce `radius.card`/`radius.cardLarge`, drop the current `orbitRadius.lg` (24) default down to `radius.card` (20) per the new radius scale; **never nest a Card inside a Card** (see `04-information-hierarchy.md` §2).

### Avatar — New (extract from inline usage across `settings.tsx`, `today-tasks-card.tsx`, etc.)

- **Purpose:** Person representation — emoji, initial, or photo.
- **Variants:** size `xs` (24) / `s` (32) / `m` (44) / `l` (56) / `xl` (80); shape always `radius.full` circle; optional trailing status dot (online/active) or edit badge (settings context).
- **Spacing:** n/a (self-contained).
- **Animation:** tap feedback (opacity 0.85) only when interactive (persona switch, edit).
- **Accessibility:** `accessibilityLabel` = person's name, not "avatar."
- **Implementation:** single shared component replacing the several inline avatar `View`+`Text`/`Image` blocks scattered per-screen today; accepts `emoji | imageUri | initial`.

### Status Chip — Keep, minor upgrade (`components/orbit/status-pill.tsx`)

- **Purpose:** Small semantic-colored label (success/warning/danger/info states).
- **Variants:** existing tones map onto `02-design-language.md` §1.4 semantic colors + `accent.primary` for `info`.
- **Spacing:** padding stays `space.xs`/near current values; radius moves from `orbitRadius.sm` (12) to `radius.control` (12 — unchanged, already correct).
- **Animation:** none — status chips are static.
- **Accessibility:** color is never the *only* signal — label text always present (already true).
- **Implementation:** no structural change needed, just re-point at new token names.

## Navigation

### Tab Bar — Upgrade (`components/orbit/make-tab-bar.tsx`)

- **Purpose:** Primary 5-tab navigation (Home/Tasks/Plan/Rewards/Nova), role-filtered.
- **Variants:** none — one tab bar, role visibility handled by the existing `TAB_ORDER` filtering logic.
- **Spacing:** floats above the home indicator with `space.sm` (12) margin on all sides rather than spanning full width — this is the single biggest visual change needed (see `08-liquid-glass-guidelines.md`): a floating pill/rounded-rect glass bar, not a full-bleed bottom bar.
- **Animation:** active-tab indicator (a small dot or filled-icon state) transitions with `motion.snappy`; icon swaps between outline (inactive) and filled (active) — matches iOS tab bar convention, not just a color change.
- **Accessibility:** `accessibilityRole="tab"`, `accessibilityState={{ selected }}` per tab (verify present).
- **Implementation:** rebuild background from the current `LinearGradient` wrapper to `material.liquidGlass` (`expo-blur`) + a subtle accent-tinted gradient overlay at low opacity, matching `GlobalHeaderChips`' existing blur+gradient recipe (already a `Keep`-quality pattern — reuse that exact recipe here).

### Top chrome / header — Keep pattern, extend (`components/orbit/global-header-chips.tsx`)

- **Purpose:** Sticky top chrome (logo, notifications, settings) — already uses real `BlurView` + accent gradient wash, the closest existing thing to the target Liquid Glass aesthetic.
- **Variants:** add a `largeTitle` variant per screen that collapses per `03-motion-interaction.md` §7 (currently static height only).
- **Spacing/Animation/Accessibility:** unchanged from current implementation; only addition is the scroll-driven collapse behavior.
- **Implementation:** this component is the reference recipe for `material.liquidGlass` everywhere else — new glass components should copy its `BlurView` + `LinearGradient` layering approach.

### Bottom Sheet — New

- **Purpose:** Partial-height, drag-dismissible sheet for quick single-decision moments (see `03-motion-interaction.md` §9).
- **Variants:** `compact` (~30% height, single confirmation), `standard` (~50%, short form).
- **Spacing:** `space.lg` (20) padding, `radius.cardLarge` top corners only, drag handle centered at top with `space.xs` margin.
- **Animation:** interactive drag-to-dismiss (§11 of `03`), backdrop fades in/out with the sheet.
- **Accessibility:** backdrop tap dismisses; sheet content is keyboard-avoiding when it contains inputs; announces as a modal to screen readers.
- **Implementation:** Reanimated + `react-native-gesture-handler` pan gesture on the drag handle + sheet body; `material.ultraThin` background.

### Context Menu — New

- **Purpose:** Long-press secondary actions on list rows (see `03-motion-interaction.md` §4).
- **Variants:** n/a — one behavior, arbitrary action list (icon + label + optional `danger` styling per item).
- **Spacing:** `space.xs` internal row padding, `radius.card` container.
- **Animation:** scale/fade in from the anchor point, `motion.snappy`.
- **Accessibility:** each action is a real button with a label; menu is dismissible via tap-outside or Escape-equivalent (Android back).
- **Implementation:** thin wrapper around `react-native-context-menu-view`-style behavior — if no suitable Expo-compatible native module exists, build with a Reanimated overlay anchored via `onLongPress` + measured layout, backed by `material.thin`.

### Search Bar — New

- **Purpose:** Live-filter search input living in the header/nav area (see `03-motion-interaction.md` §12).
- **Variants:** `inline` (always visible, e.g. Groceries), `expandable` (collapsed under large title until tapped/scrolled, e.g. Tasks/Notifications).
- **Spacing:** height 36, `radius.full`, horizontal padding `space.sm`.
- **Animation:** expand/collapse `motion.smooth`; results list fade/height animate on filter.
- **Accessibility:** `accessibilityRole="search"`; cancel button always reachable.
- **Implementation:** built on the upgraded `Input` `search` variant + `material.thin` background + the expand animation described in `03`.

### Segmented Control — New (extract pattern from `app/settings.tsx`'s appearance mode row, `app/create-itinerary.tsx` chips)

- **Purpose:** Mutually-exclusive 2–4 option picker (Dark/Light/System, Auto/Apple/Google/Waze, etc.).
- **Variants:** `compact` (pill row, current settings pattern) — this becomes the one shared implementation replacing several inline hand-rolled segmented rows across `settings.tsx`.
- **Spacing:** container `radius.control`, `material.thin`-ish flat `surface.card` background (not blur — this sits within content, it's not floating chrome), each segment `space.xs` padding.
- **Animation:** selected-segment background slides between options with `motion.snappy` (currently an instant color swap — upgrade to a sliding indicator).
- **Accessibility:** `accessibilityRole="tablist"`/`"tab"` per segment.
- **Implementation:** single new shared component; replace all inline segmented rows in `settings.tsx` with it.

## Dashboard / domain

### Task Row — Upgrade (extract from `today-tasks-card.tsx` / `(tabs)/tasks.tsx` inline rows)

- **Purpose:** One task, list context (Home preview, full Tasks list).
- **Variants:** `compact` (Home preview — title + assignee avatar + due chip only), `full` (Tasks screen — adds room/category icon, XP value, completion checkbox).
- **Spacing:** row height ~56 (compact) / ~64 (full), `space.md` horizontal padding, `space.sm` internal gaps.
- **Animation:** completion checkbox fills with `motion.snappy` + strike-through text animates in; swipe actions per `03-motion-interaction.md` §6.
- **Accessibility:** whole row is one accessible element describing title + assignee + due state; checkbox has its own accessible toggle state.
- **Implementation:** reuse `OrbitListItem` as the base and extend with a leading checkbox + trailing XP/due chip; this becomes the "Reminders-style row" referenced in `11-reverse-engineering-apple-apps.md`.

### Leaderboard / Rankings — Upgrade (`(tabs)/rewards.tsx` inline ranking UI)

- **Purpose:** Household member ranking by XP/streak, motivational not competitive-shaming.
- **Variants:** `podium` (top 3, Fitness-ring-style avatars with rank badge), `list` (remaining members, flat rows).
- **Spacing:** podium row `space.lg` gaps, list rows `space.sm`.
- **Animation:** rank-change reorder animates with `motion.smooth` (layout animation), new #1 gets a one-time `motion.settle` highlight pulse.
- **Accessibility:** rank position + name + XP all in one accessible label per row.
- **Implementation:** extract into a shared `Leaderboard` component consumed by both Rewards' Rankings section and Home's "This week" preview (currently separate implementations).

### Nova Card / Briefing — New (see `07-nova-experience.md` for full behavior spec)

- **Purpose:** The primary Nova surface — a calm summary card with one-tap actions, not a chat bubble.
- **Variants:** `morningBrief`, `eveningWrap`, `recommendation`, `alert` (rare, only for things that genuinely need attention).
- **Spacing:** `cardLarge`, `space.xl` internal padding.
- **Animation:** content fades/settles in (`motion.settle`) when a new briefing arrives; one-tap action buttons use standard Button press feedback.
- **Accessibility:** briefing text is fully readable by screen reader as a single paragraph, action buttons individually labeled.
- **Implementation:** new component, replaces the current `nova-orb.tsx`-centric chat-first presentation as the *primary* Nova surface (the orb remains for the fallback conversational mode, see `07`).

### Progress Ring — Upgrade (`components/orbit/momentum-ring.tsx`, `fire-edge-progress.tsx`)

- **Purpose:** Circular progress visualization (Momentum, task completion, streak).
- **Variants:** `momentum` (existing), `taskCompletion` (new, smaller, used inline).
- **Spacing:** ring stroke width scales with diameter (8% of diameter, capped 6–14px).
- **Animation:** fill animates with `motion.settle` on value change; never jump-cuts to a new value.
- **Accessibility:** exposes the percentage as an `accessibilityValue`, not just a visual arc.
- **Implementation:** consolidate `momentum-ring.tsx` and `fire-edge-progress.tsx` into one parameterized ring component if their SVG approach is compatible; otherwise keep both but ensure consistent stroke/animation language.

### XP Capsule / Notification Badge — Keep pattern, retint

- **Purpose:** Small numeric callouts (XP delta, unread count).
- **Variants:** `xp` (accent-tinted pill), `badgeCount` (danger-tinted circle, tab bar / bell icon).
- **Spacing/Animation:** unchanged; retint to new semantic/accent tokens.
- **Accessibility:** unread counts always paired with an `accessibilityLabel` stating the count, not just a visual numeral (verify — several places may render count-only Text with no label).

### Empty States — New (currently ad hoc per-screen text, e.g. "All clear for today.")

- **Purpose:** Calm, positive "nothing here" moments — a design *feature* per `01-product-philosophy.md`, not a placeholder.
- **Variants:** `allClear` (positive framing — tasks/groceries done), `noneYet` (neutral — no rewards created yet), `noResults` (search/filter yielded nothing).
- **Spacing:** centered, generous `space.section`/`space.screen` vertical padding.
- **Animation:** simple fade-in, no looping illustration animation (calm, not playful-loop).
- **Accessibility:** the empty-state message is the accessible content of that region, not decorative only.
- **Implementation:** one shared `EmptyState` component (icon + headline + optional caption), replacing each screen's bespoke empty-state text block.

### Loading States — New

- **Purpose:** Content-shape-matching skeletons instead of a single centered spinner, for any list/card that can take >300ms to populate.
- **Variants:** `row` (matches Task/Notification row shape), `card` (matches a summary card's shape).
- **Spacing:** matches the real content's spacing exactly so there's no layout jump on load.
- **Animation:** subtle shimmer/opacity pulse, `motion.smooth` looped at low amplitude — never a spinning indicator for list content (spinners remain fine for button-level async actions).
- **Accessibility:** `accessibilityLabel="Loading"` on the container, content itself not individually announced.
- **Implementation:** new shared `Skeleton` primitives; short (<300ms) loads should not show a skeleton at all (avoid flash-of-loading-state) — gate with a short delay timer.

## Cross-reference

- Material tiers (`liquidGlass`/`ultraThin`/`thin`/`opaque`) referenced throughout are specified in `08-liquid-glass-guidelines.md`.
- Motion tokens (`motion.snappy`/`smooth`/`settle`) are specified in `03-motion-interaction.md`.
- Color/spacing/radius/type tokens are specified in `02-design-language.md`.
- Every component above is assigned to specific screens in `06-screen-specifications.md` and gets numbered build tasks in `10-cursor-tasks.md`.
