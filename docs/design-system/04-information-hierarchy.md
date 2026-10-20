# 04 — Information Hierarchy

> This is the most important document for fixing what's actually wrong with Choremaxx today. The UI audit (`09-ui-audit.md`) repeatedly finds the same root cause across different screens: too much information presented at equal visual weight, with containers doing the job that typography and spacing should be doing. This document is the rule set that prevents that recurrence during the rebuild.

## 1. Primary, secondary, and hidden information

Every screen's content sorts into exactly three tiers. Naming them explicitly during each screen's spec (`06-screen-specifications.md`) is mandatory — "everything is important" is not an allowed answer.

| Tier | Definition | Visual treatment |
|---|---|---|
| **Primary** | The one thing this screen exists to tell or let the user do *right now*. There is exactly one primary information item per screen (occasionally one primary item + one primary action, if they differ — e.g. Home's primary info is "here's your day," its primary action is "open tasks"). | Largest type (`title1`/`largeTitle`/`metricLarge`), top of the screen, no competing color/size nearby. |
| **Secondary** | Context that supports the primary item — useful, not the reason the user opened the screen. | `body`/`headline` size, placed below/beside primary, can use `surface.card` grouping. |
| **Hidden** | Detail that's needed sometimes, by some people, in some situations — but would be noise if always visible. | Behind a tap: detail screen, "Show more," a settings toggle, a long-press context menu. Never crammed onto the primary view "just in case." |

Worked example — Home today: primary = "what does my household need from me today" (today's task count / all-clear state); secondary = momentum snapshot, rankings preview; hidden = full task list (behind "Open tasks"), full rankings (behind "Ranks"), per-member breakdown (behind a member's card).

## 2. Progressive disclosure

- A summary view shows the minimum a person needs to decide whether to go further, never the full detail pre-expanded.
- Expanding detail is always a deliberate action (tap), never automatic based on data volume (a task list with 1 item and a task list with 20 items use the *same* summary treatment — the count differs, the density does not).
- Multi-step forms (create-task, create-reward, create-household with rooms) disclose one decision at a time where possible rather than one long scrolling form — this is already the pattern in `app/welcome.tsx`'s step machine; the rebuild extends that pattern to `create-task.tsx`, `create-reward.tsx`, and `create-itinerary.tsx`, which today present many fields at once.
- Settings screens group related toggles under a collapsed section header by default when there are more than ~4 items in a group (already true for "Household default" theme picker behind a disclosure row in `app/settings.tsx` — that pattern should extend to any settings group that grows past 4 items).

## 3. One primary action per screen

- Every screen has exactly one visually dominant call-to-action (the filled `accent.primary` button, or the one `surface.cardStrong` card). Every other actionable element on the screen is visually secondary (outline/ghost button, plain list row, text link).
- If a screen currently has two dominant CTAs (e.g. a card with its own button *and* a floating action button doing similar things), the rebuild removes one — usually by making the floating action button the single global "create" affordance and demoting in-card buttons to row-level taps.
- Multi-action screens (Settings, admin screens) don't violate this rule because "open a settings row" isn't a competing *primary* action — it's list navigation. The rule targets competing CTAs, not list navigation density.

## 4. No dashboard mentality

"Dashboard mentality" = filling a screen with every metric/card the data model can produce because the data exists, rather than because the person needs it *there*. This is the single most common issue flagged in `09-ui-audit.md` (Home's card/pill count, Rewards' multiple simultaneous panels).

Rules to prevent it:

- A screen is not required to "use" every piece of state the store exposes. Absence of a metric on a screen is a valid, deliberate choice.
- Before adding a card to a screen, ask: does removing this card make the screen *worse* for the primary use case, or just *less complete-looking*? Only the former justifies keeping it.
- Metrics that exist purely for "at a glance completeness" (e.g. a secondary momentum trend arrow next to a headline momentum score) belong in a detail screen (`momentum.tsx`, `analytics.tsx`), not bolted onto every summary screen that happens to have access to the data.

## 5. Remove duplicate information

- If the same fact (XP total, next task, household name) is legitimately useful on two screens, it appears on both — but styled and sized for *that screen's* hierarchy tier, never copy-pasted as an identical card component. A member's XP is `metricLarge` hero content on Rewards, but only a small `footnote` badge on their avatar elsewhere.
- Within a single screen, never show the same fact twice (e.g. "3 tasks left" as both a headline and a progress-bar caption saying the same count) — pick the one representation that's clearest for that tier.
- When two cards on the same screen are both partially about the same domain (e.g. a "Today" card and a separate "Tasks" card both mentioning task counts on Home), merge them into one card with clear internal hierarchy rather than two cards that each say part of the story.

## 6. Reduce visual weight

Visual weight = color saturation + container borders/shadows + size, combined. A screen's *total* visual weight should be low even if it contains many elements, achieved by:

- Using color sparingly and semantically (see `02-design-language.md` §1.4) — a screen where every card has a different saturated accent color reads as "busy" regardless of layout quality. This is the specific "too much purple" / accent-color-per-card issue flagged in the audit.
- Preferring outline/ghost treatments over filled/bordered treatments for anything that isn't the screen's one primary CTA.
- Using at most one `surface.cardStrong` (bordered/shadowed emphasis) per screen — everything else is `surface.card` or `surface.flat`.

## 7. Use typography before containers

This is the core technique for fixing "too many cards" without losing organization:

- Default to `surface.flat` (text directly on the background, grouped by spacing and a `title2`/`title3` section header) for list-like content. Only promote to `surface.card` when the content genuinely needs a visual boundary — e.g. it's interactive and tappable as a unit, or it needs to visually separate from unrelated content immediately above/below with no spacing gap available.
- A section header (`title2`/`title3` + `space.xl` gap above it) does the organizational job a card border used to do, with far less visual weight — this single substitution is responsible for most of the "looks calmer already" effect a screen gets during its rebuild pass.
- When multiple small facts need grouping (e.g. three household health metrics), prefer a single row of typography-led stat labels over three separate small cards.

## Cross-reference

- This document is the primary lens applied to every entry in `06-screen-specifications.md`'s "Things to remove / Things to simplify" fields.
- `09-ui-audit.md` documents where today's screens violate these rules; this document is the rule set, that document is the enforcement record.
