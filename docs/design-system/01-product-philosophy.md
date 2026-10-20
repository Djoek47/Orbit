# 01 — Product Philosophy

> This document defines *why* Choremaxx exists and the values every visual and interaction decision in this design system must serve. Every later document (`02`–`11`) is a downstream consequence of this one. When a screen spec and this philosophy disagree, this document wins.

## Choremaxx is a Household OS, not a task manager

Choremaxx does not compete with Todoist, Notion, or a family whiteboard. It is the operating system for a household: the layer that quietly keeps tasks, groceries, plans, rewards, and Nova's awareness in sync so the *people* in the household don't have to hold it all in their heads.

Consequences for design:

- Screens are **surfaces of the household's state**, not lists of app features. Home is a status report on the household, not a menu.
- We never design a screen by asking "what data do we have to show." We ask "what does this person need to know or do *right now*, and what can stay invisible until asked for."
- Cross-domain awareness (a task depends on a grocery item, a trip depends on today's events) is a first-class visual concern, not an edge case bolted onto a list.

## Calm technology

Calm technology (Mark Weiser / Amber Case) informs Choremaxx more than any chat-app or productivity-app precedent:

- Technology should require the smallest possible amount of attention.
- Notifications and Nova should feel like ambient awareness, not demands.
- The app should be usable from the periphery of attention (a glance at Home) as often as it is used with full focus (creating a task).
- Silence is a valid design outcome. An empty state that says "nothing needs you right now" is a feature, not a placeholder waiting for content.

Consequences for design:

- No infinite scroll, no engagement loops, no streak-shaming, no red badge anxiety-farming. Streaks and XP exist to *reward* follow-through, never to *punish* absence.
- Color, motion, and sound are used to communicate state changes (something changed, something needs you), not to compete for attention.
- Every screen should have a legible "at rest" state — what does this look like on a boring Tuesday when nothing is wrong.

## Apple Intelligence first

Nova is not a chatbot bolted onto a chore app. Nova is modeled after how Apple Intelligence behaves system-wide: contextual, summarizing, one-tap, and mostly invisible until it has something genuinely useful to say. See `07-nova-experience.md` for the full reframe. The philosophy point here is narrower: **AI is a feature of the household's calm, not a feature we show off.**

- Nova should never require the user to know it's "an AI" to get value from it. It should feel like the house itself got smarter.
- Conversational UI is a fallback for open-ended questions, not the primary interaction model. The primary interaction model is a briefing card with a one-tap action.

## Family-first interactions

Every interaction must be legible to the full range of household members: a stressed parent glancing between meetings, a kid who can't read well yet, a roommate who opted out of half the app's surface area, a grandparent visiting for the week.

- Interactions default to the **lowest cognitive-load version**: large tap targets, obvious primary actions, minimal required text entry.
- Role-appropriate simplicity is a design requirement, not a permissions afterthought — a child's Tasks screen and an admin's Tasks screen should both feel calm, just calibrated differently in density and controls.
- Emotional tone matters as much as function: completing a task should feel good in a quiet, sincere way (not gamified confetti-spam); an overdue task should feel like a gentle nudge, not a scolding.

## Reduce cognitive load

Every household already carries mental load. Choremaxx's job is to *carry* some of that load, not add a new kind of it (a second inbox to check, a second app to remember, a second set of jargon to learn).

Operating rules that follow from this:

- **One primary action per screen.** If a screen has two calls to action fighting for attention, the design has failed (see `04-information-hierarchy.md`).
- **Progressive disclosure everywhere.** Default views show the minimum needed to decide "do I need to act." Detail is one tap away, never crammed onto the summary.
- **No duplicate information.** If XP is shown on Home, Rewards, and the tab bar badge, that's three chances to get it visually inconsistent and cognitively redundant — pick the one place it belongs at each zoom level.
- **Defaults do the thinking.** Smart defaults (today's date, the likely assignee, the usual store) exist so users almost never have to make a decision they've already made before.

## Invisible complexity

Underneath, Choremaxx is complex: multi-household roles, mock vs. Supabase data modes, realtime sync, permission matrices, Nova's context assembly, grocery intelligence, mental-load scoring. None of that complexity should ever leak into the interface as complexity.

- Complexity is allowed in `store/orbit-store.tsx`, `repositories/`, and Supabase functions. It is not allowed in a screen's visual hierarchy.
- If a feature needs an explanation tooltip to be understood, the design has failed and needs simplification, not documentation.
- Settings should feel like a small number of calm decisions, not a control panel. If a setting exists only for edge cases, it should be discoverable but not prominent.

## Premium craftsmanship

Choremaxx should feel like it was made by people who care about the details, the same way Apple's own first-party apps do. This is a *craft* commitment, not a decoration budget:

- Consistent spacing, radius, and type scale everywhere (see `02-design-language.md`) — sloppy alignment is the fastest way to make an app feel cheap.
- Motion has intent (see `03-motion-interaction.md`) — nothing animates "because it can," but nothing important changes state without *some* motion to make the change legible.
- Materials (glass, blur, elevation) are used sparingly and correctly (see `08-liquid-glass-guidelines.md`) — glass-on-glass, over-blurring, and gratuitous gradients are the opposite of craftsmanship.
- Every screen gets an explicit list of what to **remove**, not just what to add (see `06-screen-specifications.md`, `09-ui-audit.md`). Craft is as much subtraction as addition.

## Emotional design

Choremaxx handles something emotionally loaded: who does the work in a household, and whether that work is seen and appreciated. The interface has to hold that gently.

- Celebrate effort without turning the household into a leaderboard-of-shame. Rankings exist for households that want them (`accentTheme`/role-aware), but the tone is always "look how well we're doing together," not "look who's losing."
- Nova should sound like a thoughtful, calm co-manager who is on the family's side — never smug, never chirpy-corporate, never guilt-tripping.
- Momentum, streaks, and XP are framed as *reflections* of effort already made, not as gamified pressure to perform more.

## The north star

> "The best interface is the one the user doesn't notice."

A successful Choremaxx screen is one where, a week after using it, a household member couldn't describe the UI in detail — they'd just describe what got done. Every subsequent document in this suite (`02`–`11`) exists to make that true across all ~40 screens, consistently, at Apple's level of craft.
