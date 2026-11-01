# 10 — Cursor Tasks

> Master execution checklist. Organized into the same batches as the plan's Phase B/C. Foundation infra tasks (Phase B) are fully numbered now since they execute next. Each screen batch's detailed numbered tasks are filled in immediately before that batch executes (marked **[Detailed]** once expanded; **[Skeleton]** until then, listing only the screens in scope). Task IDs are stable once assigned — do not renumber completed tasks when expanding later sections.

## Phase B — Foundation infrastructure [Detailed]

**Task 001** — Add the Apple spacing scale (4/8/12/16/20/24/32/40/48/64/96) as named tokens (`space.xxs`…`space.hero`) to `constants/orbit-theme.ts`, per `02-design-language.md` §3.1.

**Task 002** — Replace `orbitRadius` with the four-value radius system (`radius.control`=12, `radius.card`=20, `radius.cardLarge`=28, `radius.full`=999) per `02-design-language.md` §4.

**Task 003** — Replace `orbitTypography` with the full Apple-style type scale (`largeTitle`…`caption2`, `metricLarge`/`metricSmall`) per `02-design-language.md` §2.2, keeping old keys as deprecated aliases pointing at the migration map (§2.4) during the transition so unmigrated screens don't break.

**Task 004** — Add motion-timing constants (`motion.snappy`/`smooth`/`settle` spring configs) to a new `constants/motion-tokens.ts`, per `03-motion-interaction.md` §1.

**Task 005** — Add material-tier constants (`material.liquidGlass`/`ultraThin`/`thin`/`opaque` blur intensities) to a new `constants/material-tokens.ts`, per `02-design-language.md` §6.

**Task 006** — Add semantic shadow-tier styles (`shadow.floating`/`shadow.lifted`, dark+light variants) to `constants/orbit-theme.ts`, per `02-design-language.md` §5.

**Task 007** — Build a shared `Avatar` component (`components/orbit/avatar.tsx`) per `05-component-library.md`'s Avatar entry, consolidating inline avatar blocks.

**Task 008** — Build a shared `EmptyState` component (`components/orbit/empty-state.tsx`) per `05`'s Empty States entry.

**Task 009** — Build shared `Skeleton` loading primitives (`components/orbit/skeleton.tsx`) per `05`'s Loading States entry.

**Task 010** — Build a shared `SegmentedControl` component (`components/orbit/segmented-control.tsx`) per `05`'s Segmented Control entry; migrate `app/settings.tsx`'s Appearance-mode and Preferred-maps rows onto it as the first consumers.

**Task 011** — Rebuild `components/orbit/make-tab-bar.tsx` as a floating, inset `material.liquidGlass` bar per `08-liquid-glass-guidelines.md`'s concrete before/after, reusing `global-header-chips.tsx`'s proven `BlurView` + gradient-wash recipe.

**Task 012** — Add scroll-driven large-title collapse behavior to `global-header-chips.tsx` (or a new header primitive) per `03-motion-interaction.md` §7.

**Task 013** — Build a shared `BottomSheet` component (`components/orbit/bottom-sheet.tsx`) per `05`'s Bottom Sheet entry.

**Task 014** — Build a shared `ContextMenu` component (`components/orbit/context-menu.tsx`) per `05`'s Context Menu entry.

**Task 015** — Build a shared `SearchBar` component (`components/orbit/search-bar.tsx`) per `05`'s Search Bar entry.

**Task 016** — Build a shared `TaskRow`/generic `ListRow` component (`components/orbit/task-row.tsx`) per `05`'s Task Row entry, extending `orbit-list-item.tsx`.

**Task 017** — Build a shared `Leaderboard` component (`components/orbit/leaderboard.tsx`) per `05`'s Leaderboard entry.

**Task 018** — Build the new `NovaCard`/briefing primitive (`components/orbit/nova-card.tsx`) per `05`'s Nova Card entry and `07-nova-experience.md` §2.

**Task 019** — Update `constants/accent-themes.ts`/`background-themes.ts` docs comments to reference the new token names where they interoperate (no value changes — packs stay as-is per `02-design-language.md` §0).

**Task 020** — Run `npx tsc --noEmit`, fix any type errors from the token renames, commit Phase B as one PR update before starting Batch 1.

## Batch 1 — Tabs [Detailed]

**Task 021** — Home: replace the Nova chat-entry card with an inline `NovaCard` (`kind="morningBrief"`) composed from existing `novaBriefing`/task/grocery/event state, per `07-nova-experience.md` §2 and `06`'s Home entry.

**Task 022** — Home: merge Today's Tasks + Groceries/Upcoming chips into one typography-led "Today" section (remove per-chip cards), per `04-information-hierarchy.md` §5/§7.

**Task 023** — Home: demote "This week" rankings to a small tappable preview below the fold using the new `Leaderboard` (`variant="podium"`, compact), not competing with Today's section.

**Task 024** — Home: migrate all inline `fontSize`/`orbitRadius`/`orbitSpacing` usage to `typography`/`radius`/`space`; drop the `groceryEmoji` ad hoc styling table in favor of `MaterialIcons`-consistent iconography.

**Task 025** — Home: wrap primary `ScrollView` with a `scrollY` shared value and mount `LargeTitleHeader` for the greeting per `03-motion-interaction.md` §7 (keep existing header greeting/avatar/persona-switch chrome as-is per `06`'s "Keep").

**Task 026** — Tasks: replace hand-rolled task rows with shared `TaskRow`; group by day with sticky `material.ultraThin` section headers.

**Task 027** — Tasks: add `SearchBar` (expandable) for assignee/room filtering, wire into existing task list state.

**Task 028** — Tasks: add `ContextMenu` (complete/reassign/delete) on long-press per `03-motion-interaction.md` §4.

**Task 029** — Tasks: migrate inline styling to new tokens; add `EmptyState` (`tone="allClear"`) for the zero-tasks state.

**Task 030** — Plan: extract `locationShort` and trip-suggestion heuristic into a `NovaCard` (`kind="recommendation"`) shown contextually rather than a standalone competing card, per `06`'s Plan entry.

**Task 031** — Plan: apply restrained "today emphasis" (filled dot, not background wash) to the calendar/day rendering per `11-reverse-engineering-apple-apps.md` (Apple Calendar).

**Task 032** — Plan: migrate inline styling to new tokens.

**Task 033** — Rewards: replace inline ranking implementation with shared `Leaderboard`; consolidate with Home's preview so there is one implementation, two render sizes.

**Task 034** — Rewards: adopt ring-based personal XP/streak progress (`momentum-ring.tsx`-style) as the dominant visual per member per `11` (Fitness reference), demoting the full rankings list to a secondary section.

**Task 035** — Rewards: migrate the ~46 inline `fontSize` values to `typography`/`space`/`radius` tokens; keep `RewardClaimPress` hold-to-claim control as-is.

**Task 036** — Nova: restructure the screen around a briefing feed of `NovaCard`s (Morning Brief / Evening Wrap-up / Recommendations) as the default view, replacing the Chat/Activity segmented top-level split, per `07-nova-experience.md` §3.

**Task 037** — Nova: demote the existing chat UI to an "Ask Nova" fallback reachable via a compact affordance below the briefing feed; keep the Nova orb + voice pipeline for that mode.

**Task 038** — Nova: demote the Activity/monitor log to a detail view reachable from a card's context menu ("History"), using the new `ContextMenu` component.

**Task 039** — All five tab screens: verify `npx tsc --noEmit` clean, commit Batch 1, update PR.

## Batch 2 — Onboarding / Auth [Skeleton]

Screens: `welcome.tsx`, `sign-in.tsx`, `confirm-email.tsx`, `forgot-password.tsx`, `select-profile.tsx`, `pending-approval.tsx`.

Detailed tasks added before this batch executes.

## Batch 3 — Household setup [Skeleton]

Screens: `create-household.tsx`, `join-household.tsx`, `invite-household.tsx`, `household-members.tsx`, `setup-kid-device.tsx`.

Detailed tasks added before this batch executes.

## Batch 4 — Create / modal flows [Skeleton]

Screens: `create-task.tsx`, `add-grocery.tsx`, `scan-grocery.tsx`, `create-event.tsx`, `create-itinerary.tsx`, `create-reward.tsx`, `grant-allowance.tsx`, `special-reward-request.tsx`, `shopping-mode.tsx`, `reward-tally.tsx`, `shopping-recommendations.tsx`, `places.tsx`.

Detailed tasks added before this batch executes.

## Batch 5 — Settings / notifications [Skeleton]

Screens: `settings.tsx`, `notifications.tsx`, `household-balance.tsx`, `household-games.tsx`.

Detailed tasks added before this batch executes.

## Batch 6 — Detail / stack screens [Skeleton]

Screens: `task/[id].tsx`, `event/[id].tsx`, `itinerary/[id].tsx`, `momentum.tsx`, `badge-gallery.tsx`, `weekly-report.tsx`, `analytics.tsx`, `smart-home.tsx`.

Detailed tasks added before this batch executes.

## Phase D — Polish pass [Skeleton]

- Cross-screen spacing/radius/typography drift check against `02-design-language.md`.
- Dynamic Type / accessibility pass across all rebuilt screens.
- Remove remaining inline magic-number styles found via `rg 'fontSize:|borderRadius:' app/`.
- `npx tsc --noEmit` + lint clean.
- Update `.cursor/rules/figma-make-sync.mdc` per the plan's Notes section.
- Final PR summary update.

## Cross-reference

- Screen-level detail source: `06-screen-specifications.md`.
- Audit findings source: `09-ui-audit.md`.
- Component specs referenced by task number: `05-component-library.md`.
