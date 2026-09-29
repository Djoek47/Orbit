# Itinerary detail — product thinking

This is how a trip **thinks**, not how it is painted. Visual tokens stay in `docs/design-system/`. Implementation: `lib/itinerary/trip-intent.ts`, `app/itinerary/[id].tsx`.

## Primary goal

Get the person to the **current stop**, do the thing, mark arrived, and (if there is a next stop) go there. Everything else is supporting.

The job is not “inspect a route database.” It is “leave the house and finish this run.”

## What the user actually needs

| Need | Surface |
|---|---|
| Where am I going **now**? | Hero: trip title + current stop name |
| How do I get there? | One primary button: **Directions** |
| I’m standing here | **I’m here** (finish, if last stop) |
| I’m shopping | **Open list** — only for grocery/shop |
| What’s after this? | **Coming up** — only if 2+ remaining stops |
| Change order | **Edit route** — only if 2+ remaining, collapsed until asked |
| Do this again later | Header star (preferred). **Run again** only when the trip is done |

## What to remove

- A **Route** card that repeats the current stop
- A **Current stop** card that repeats it a third time
- **Reorder** as a always-on third list
- **Start trip in Maps** + **Open this stop** as two names for Directions
- **Arrived → next** as system jargon
- Status chips (Active / 0/1 / Preferred / Poppins) competing with the hero
- A footer **Save preferred** chip (star lives in the header)
- Raw **lat/lng** as the address line
- **“1 stops.”**

If the trip has one remaining stop, the screen is: title, that place, Directions, I’m here, optional shopping list. Stop.

## Product hierarchy

1. **Plan tab** — calendar + trips (first-class navigation)
2. **Trip detail** (this screen) — execute one itinerary
3. **Maps** (system) — turn-by-turn; we hand off, we do not rebuild navigation
4. **Shopping mode** — contextual from a grocery stop
5. **Preferred trips** — memory, not a mode
6. Settings / maps-app preference — already in Settings → Places

Search, notifications, and account do not belong on this screen.

## Mental model (not the database)

The user thinks: **now → next → done.**

The database has `stops[]`, `sortOrder`, `status`. The UI never leads with that. `tripIntent()` projects:

- `current` — the open stop at the front
- `upcoming` — the rest of the open stops
- `completed` — a recap, only if some are already done mid-trip

## User flows

### Execute a 1-stop grocery run

1. **Entry:** Plan → trip card, or Poppins deep link `/itinerary/:id`
2. **Intent:** Buy groceries at Metro
3. **Primary:** Directions (opens Maps to Metro)
4. **Secondary:** I’m here — finish; Open list
5. **System:** Maps handoff; list opens shopping mode
6. **Next:** After I’m here, trip is completed
7. **Success:** “Today · Done” + Run again
8. **Error:** “Couldn’t update this stop. Try again.”
9. **Empty:** “No stops yet” + Back to Plan
10. **Recovery:** Back to Plan; star still available; Run again creates a fresh trip for today

### Execute a multi-stop run

Same as above, except:

- Coming up lists later stops
- I’m here marks arrived and opens Maps to the **next** stop (existing store behavior)
- Tap a coming-up row for directions there without reordering
- Long-press → **Go here next** (reversible, no confirm)
- Edit route to reorder with handles (no long-press on those rows)

### Run again (completed)

Primary becomes Run again. No Directions until the new trip exists, then replace to that id.

## Interaction rules

| Input | Result |
|---|---|
| Tap Directions | Open the trip (or current stop) in the preferred maps app |
| Tap I’m here | Optimistic complete; haptic Medium; Maps to next if any. No confirm |
| Tap Open list | Push shopping mode |
| Tap coming-up row | Directions to that stop |
| Long-press coming-up | Go here next |
| Tap Edit route | Disclose reorder handles |
| Drag/up-down while editing | Reorder remaining only; first remaining becomes current |
| Tap star | Toggle preferred. Undo is tap again. No confirm |
| Swipe from left edge | Back to Plan (system) |
| Pull to refresh | Not on this screen (trip is local + household cache) |
| Deep link | Same intent projection |
| Offline | Favorite/I’m here still update locally in mock; Maps error is calm and specific |
| Maps permission | Not requested here — we have an address or coordinates already |
| Voice | Poppins can advance a stop; this screen just reflects state |

Do not add skip, share, or optimize unless the trip is failing. Those are rare; they are not chrome.

## Confirmation

- I’m here: **no** (reversible by not being the last stop in spirit; last stop completes the trip — still no dialog, because the alternative is standing at the store tapping twice)
- Go here next / reorder: **no** (reversible)
- Star: **no**
- Delete trip: not offered here
- Run again: **no** (creates a new trip; original remains)

## Intelligence (only where it pays)

- Remember preferred maps app (already)
- Remember preferred trips (star)
- Hide lists when they would repeat the hero
- After reorder, the first remaining stop **is** current
- Hide coordinate strings
- Local calendar “Today”, not UTC date-slice
- Grocery stop → shopping list, without a settings toggle
- Current stop name lives in the hero once — not in the eyebrow, Route, and Reorder

Do not auto-start Maps on open. Do not invent ETAs. Do not ask which stop is current.

## States

| State | Screen |
|---|---|
| First use / 1 stop | Hero + Directions + I’m here |
| Returning mid-trip | Hero is the current open stop; recap of done stops if any |
| Empty | No stops yet |
| Loading | Instant from store; no spinner unless fetch is slow later |
| Completed | Done subtitle + Run again + quiet recap |
| Error | Specific, one recovery action |
| Offline | Local actions work; Maps explains it could not open |
| Interrupted | Returning tomorrow: same current stop; date line updates |

## Accessibility

- Back: “Back to Plan”
- Star: “Save as preferred trip” / “Remove from preferred trips”
- Hero + current name read as one heading group
- Primary and secondary CTAs are full-width, 52pt
- Coming-up rows 44pt minimum; VoiceOver name + place line
- Reduce Motion: no extra motion beyond existing button press
- Dynamic Type via `AppText`

## Why this screen exists

Because a trip card on Plan cannot both preview and drive the run. Detail is the **now** surface. If it cannot answer “where do I go?” in one glance, it has failed.
