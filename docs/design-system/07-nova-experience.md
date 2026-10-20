# 07 — Nova Experience

> Today's `app/(tabs)/nova.tsx` is a two-tab (Chat / Activity) screen with a message-bubble conversation as its primary surface. This document is the reframe: Nova becomes an Apple-Intelligence-style layer across the app, not a destination chat screen. The chat surface doesn't disappear — it becomes the *fallback* for open-ended questions, not the *default* view.

## 1. Not ChatGPT, not Gemini, not a chatbot

Apple Intelligence's product shape (Siri suggestions, Mail/Messages summaries, Notification summaries, Photos memories) is the reference, not any chat product:

- Apple Intelligence rarely asks the user to type a question into an empty text field as the primary entry point — it *surfaces* a relevant, already-composed insight and lets the user act on it or dismiss it.
- Apple Intelligence's tone is quiet and factual, occasionally warm, never chatty/exclamatory, never pretending to have a "personality" beyond calm competence.
- Apple Intelligence is *everywhere in small doses* (a summary line in a notification, a suggested action in Mail) more than it is *one big destination screen*.

Nova should follow the same shape: small, contextual, one-tap surfaces distributed across Home/Tasks/Plan/Rewards, with the Nova tab itself becoming a calm "everything Nova has noticed" surface rather than a chat window you open to ask questions.

## 2. The core surfaces

### Morning Brief

- Appears on Home (top of the primary content, above the task list) each morning, once — not a persistent chat bubble.
- Content: 1–2 sentences, synthesized from today's tasks, missing groceries, and calendar events (existing `event-groups.ts`'s `suggestItinerarySummary` and household state already compute the raw ingredients — Morning Brief composes them into one calm sentence rather than three separate cards).
- Example tone: "Light day — 2 tasks, nothing on the calendar until 3pm. Milk's still on the list if you're near a store." Never: "Good morning! 🌞 Here's what I found for you today!"
- One-tap actions attached directly (e.g. "Add milk to today's trip") — the brief is actionable, not just informative.

### Evening Wrap-up

- Appears once in the evening (Home or a gentle notification), summarizing what got done, framed positively per `01-product-philosophy.md`'s emotional-design principle.
- Example: "Nice — 4 of 5 done today. Trash goes out tomorrow morning." Never guilt-framed ("You still haven't...").

### Smart Recommendations

- Grocery store suggestions (already exists via `lib/grocery/location-suggestions.ts`, `lib/places/nearby-stores.ts`), itinerary optimization (`lib/calendar/suggest-itinerary.ts`) — these become Nova Card surfaces (see `05-component-library.md`'s Nova Card) shown *in context* (on the Plan/Groceries screen at the moment they're relevant) rather than requiring a trip to the Nova tab to discover them.

### Household Summary

- A weekly-cadence card (surfaces on the Nova tab and/or `weekly-report.tsx`) summarizing load distribution, momentum trend, and any pattern worth a family conversation ("Tasks have been mostly on Sarah this week") — always factual and neutral in framing, never assigning blame.

### One-tap actions

- Every Nova surface's primary interaction is a button, not a typed reply: "Add to list," "Move to tomorrow," "Optimize this trip," "Dismiss." Typing is available (chat fallback, §4) but never required to get value from a Nova surface.

### Context awareness / family context

- Nova's suggestions should visibly reflect household context already known to the app (who's assigned what, upcoming events, low-stock groceries) — the existing `nova-*` Supabase functions and `store/orbit-store.tsx` context assembly are the data source; this document only changes how that context surfaces visually (calm cards, not a chat transcript reciting facts back to the user).
- Predictive suggestions (e.g. noticing a recurring Tuesday pattern) surface as a single Smart Recommendation card, not a proactive chat message.

### Invisible AI

- The goal state: a family member gets Nova's value (a completed grocery list, a well-timed reminder, a fair task assignment) without necessarily opening the Nova tab at all in a given week. If Nova's *only* value is delivered through its own tab, the reframe has failed.

## 3. The Nova tab itself

Rebuilt structure (replaces the Chat/Activity segmented tabs as the primary structure):

1. **Briefing feed** (top) — Morning Brief / Evening Wrap-up / Smart Recommendations / Household Summary, most recent/relevant first, each a Nova Card with one-tap actions. This is the tab's default, landing view.
2. **Ask Nova** (secondary, reachable via a compact search-style affordance below the briefing feed, not a permanent chat input bar) — opens the conversational fallback (§4) for open-ended questions ("What's left to do before the trip?").
3. Activity/monitor log (existing "Activity" tab content) becomes a detail view reachable from a briefing card's "..." context menu or a small "History" link, not a co-equal top-level tab — it's audit/debug-adjacent info, not a primary surface (see `04-information-hierarchy.md`).

## 4. Conversational fallback

- Chat still exists (current `nova.tsx` message-bubble UI, `nova-realtime`/`nova-voice` voice input) for genuinely open-ended questions, but it's one tap deeper than the briefing feed, not the tab's default state.
- When in the chat fallback, Nova's message bubbles adopt the calm tone from §2 — factual sentences, no emoji decoration, no exclamation-heavy enthusiasm.
- Voice input (existing Realtime/Whisper pipeline) remains available from the chat fallback; the Nova orb's idle/listening/thinking/speaking states (`components/orbit/nova-orb.tsx`) remain the visual anchor for that specific mode only, not for the briefing feed.

## 5. What gets removed from today's Nova tab

- The permanent Chat/Activity segmented-control top-level split (Activity moves to secondary/detail per §3.3).
- Any framing of Nova responses as a "conversation you're having" when the underlying content is really a status summary — those become cards, not bubbles.
- Chatty/exclamatory copy patterns ("Here's what I found! 🎉") anywhere in Nova's generated or templated text.

## Cross-reference

- The Nova Card component is specified in `05-component-library.md`.
- Nova's placement on Home (Morning Brief) is detailed in `06-screen-specifications.md`'s Home entry.
- This reframe changes presentation only — `store/orbit-store.tsx`'s Nova state, the `nova-*` Supabase edge functions, and `repositories/nova-repository.ts` are unchanged (per the plan's "no business-logic changes" constraint); Morning Brief / Evening Wrap-up / Household Summary are new *compositions* of existing data, not new backend features, unless a follow-up explicitly scopes new data needs.
