# 09 — UI Audit

> Screen-by-screen record of what's wrong today and how the design language (`01`–`05`, `07`, `08`) fixes it. This is the enforcement record for `04-information-hierarchy.md`'s rules — every finding below becomes a "Remove/Simplify" entry in that screen's `06-screen-specifications.md` entry and numbered tasks in `10-cursor-tasks.md`.

## Home (`app/(tabs)/index.tsx`)

- Too many simultaneous cards at equal visual weight: Nova card, "This week"/Ranks card, Today's Tasks card, Groceries chip, Upcoming chip — five distinct containers above the fold with no single clear primary focus (confirmed live in-app screenshot: all five visible in first screen height).
- Rankings ("This week" podium) competes with Today's Tasks for primary attention — Home's primary job is "what does my day need," not "who's winning," per `04-information-hierarchy.md` §1's worked example.
- Nova presented as a chat-entry card at the very top — per `07-nova-experience.md`, this should be a Morning Brief sentence, not an invitation to start a conversation.
- `groceryEmoji` hardcoded lookup table and multiple ad hoc `.slice(0, 3)` truncations for events/groceries suggest the screen is trying to preview *everything* rather than committing to one clear "today" narrative.
- Header greeting + avatar + persona switch is good and should be **kept** — it's genuinely calm, single-purpose chrome.

**How Apple would fix it:** One `largeTitle` greeting, one Morning Brief sentence (Nova, inline, not card-framed), one "Today" section (typography-led, not a card) showing task/grocery/event counts as a single unified line, then "This week" rankings demoted to a small tappable preview below the fold, not competing above it.

## Tasks (`app/(tabs)/tasks.tsx`)

- Task rows are hand-rolled per-screen rather than a shared component (per `05-component-library.md`'s Task Row entry) — likely visual drift between Home's preview rows and this screen's full rows.
- No search/filter affordance despite this being the screen most likely to have many items across household members.

**How Apple would fix it:** Reminders-style flat rows (see `11-reverse-engineering-apple-apps.md`), grouped by day with sticky section headers, search revealed on scroll, swipe actions instead of always-visible action icons.

## Plan (`app/(tabs)/plan.tsx`)

- Combines calendar events and itineraries/trips in one screen with locally-defined helper functions (`locationShort`) suggesting layout logic is embedded in the screen rather than shared.
- Trip-suggestion heuristic (`locationEvents.length >= 2 || ...`) surfaces as another card-shaped nudge — likely another Nova-adjacent card competing with the main calendar content, same pattern as Home's Nova card issue.

**How Apple would fix it:** Calendar-first layout (see Apple Calendar reference in `11`), itineraries as a secondary, clearly-labeled section beneath, trip suggestions folded into the Nova Smart Recommendations surface (`07-nova-experience.md`) rather than a standalone card fighting for attention.

## Rewards (`app/(tabs)/rewards.tsx`)

- Combines Rewards + Allowance + Rankings in one screen (~46 inline `fontSize` values per the inventory) — highest inline-magic-number screen in the app, strong signal of ad hoc layout accretion over time.
- Rankings/leaderboard living here *and* previewed on Home (see Home finding above) is the exact duplicate-information case `04-information-hierarchy.md` §5 warns against — needs one consistent `Leaderboard` component, sized differently per context, not two separate implementations.

**How Apple would fix it:** Apple Fitness rings for progress/motivation (see `11`), Wallet-style stacked cards for reward "shop" items, rankings as one clearly-scoped section (not the whole screen's identity).

## Nova (`app/(tabs)/nova.tsx`)

- Chat/Activity segmented top-level split makes Nova feel like a messaging app, contradicting `07-nova-experience.md`'s entire premise. This is the single most consequential reframe in the whole rebuild.
- Chat-bubble UI as the *default* landing view means most users' first impression of Nova is "an empty text box to type into" rather than "the house already told me something useful."

**How Apple would fix it:** Briefing-feed-first (`07-nova-experience.md` §3), chat demoted to an "Ask Nova" fallback, Activity log demoted to a detail view.

## Onboarding / Welcome (`app/welcome.tsx`)

- Already the best-structured flow in the app (explicit step machine, one field-group per step) — largely **keep** the interaction model; the rebuild here is primarily visual (spacing/type/radius token migration), not structural.
- Splash/role/motivation steps likely already close to calm-Apple in feel; verify against `02-design-language.md`'s type scale during the batch pass rather than assuming a rewrite is needed.

**How Apple would fix it:** Minimal change — retint to new tokens, add Apple-style page-dot/segment progress indicator if not already present, ensure large-title-style headline per step.

## Settings (`app/settings.tsx`)

- ~32 inline `fontSize` values per the inventory; multiple hand-rolled segmented controls (Appearance mode, Preferred maps) that should consolidate into the one shared Segmented Control (`05-component-library.md`).
- Long flat scroll of many `SectionCard`s — a candidate for the "no dashboard mentality" rule (`04-information-hierarchy.md` §4): verify every section is genuinely needed at the top level vs. nested under a parent category (Apple Settings' own grouping-of-groups pattern, see `11`).

**How Apple would fix it:** Apple Settings-style grouped list with clear top-level categories (Household, Appearance, Notifications, Account, Legal) rather than a flat stack of ungrouped section cards.

## Create flows (`create-task.tsx`, `create-reward.tsx`, `create-itinerary.tsx`, etc.)

- `create-task.tsx` has the highest inline `fontSize` count in the app (~54 per the inventory) — strong signal this screen presents many fields at once rather than progressively disclosing them, contradicting `04-information-hierarchy.md` §2.

**How Apple would fix it:** Step-by-step disclosure matching `welcome.tsx`'s already-good pattern (title → assignee/room → schedule/XP → review), not a single long form.

## Cross-screen findings

- **Radius drift**: 10/14/18/20/22/26/28/80/999 values appear across screens per the inventory, against a documented 12/16/24/999 (`orbit-theme.ts`) that itself differs from `docs/ux-design-system.md`'s stated 12/18/24/32. `02-design-language.md`'s four-value system (12/20/28/999) is the single resolution.
- **No real glass except header chrome**: only `global-header-chips.tsx` uses `BlurView`; the tab bar (visible on every primary screen) uses a flat gradient — this is the highest-leverage single fix for "looks like a new app," per `08-liquid-glass-guidelines.md`.
- **Shadows sparse and inconsistent**: currently used ad hoc (tab bar glow, task dots, accent selection) rather than per the three allowed cases in `02-design-language.md` §5.
- **Accent-color-per-card**: several screens tint different cards with different accent/domain colors simultaneously (Home's Nova/Ranks/Tasks cards each carrying their own color identity) — reads as "busy," per `04-information-hierarchy.md` §6; the rebuild moves most cards to neutral `surface.card` with color reserved for the one primary element and true semantic/domain meaning.

## Cross-reference

- Every finding above is addressed by the rule set in `04-information-hierarchy.md` and the token system in `02-design-language.md`.
- Detailed per-screen specs (Purpose/Hierarchy/Remove/Simplify/Keep) are filled in `06-screen-specifications.md` per batch, using this audit as the starting "what's wrong" input.
