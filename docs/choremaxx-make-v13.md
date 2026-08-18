# Choremaxx Make v13 (today’s aggregate)

**Branch:** `cursor/choremaxx-make-v13`  
**App version:** `1.3.0`  
**Settings tip:** `make-v13 · final`  
**Content tip:** `2da4542` (AIUIC) — strict superset of v12 plus everything landed 18 Aug 2026.

This is the TestFlight / App Store cut. Nothing from today’s stacked `-5f8f` line is left behind.

---

## Aggregated stack

| Layer | Branch | Highlights |
|-------|--------|------------|
| v12 base | `cursor/choremaxx-make-v12` | v11 + IUI + Luna + Assign/Event + Poppins quality + House Rules HTML |
| House Rules expiry | `cursor/house-rules-expiry-ui-5f8f` | Expiry, recess skip, same-day 23:59, Open tasks / Today polish, US/CA places, 3/day insights |
| Invite join | `cursor/invite-join-flow-5f8f` | Household `CMX-####` vs kid `CMX-NAME`; Check status stays on pending join |
| Places / GPS / shopping | `cursor/places-gps-poppins-5f8f` | GPS maps, nearby stores, clothing lane, in-place Ask Poppins |
| AIUIC | `cursor/aiuic-iui-control-5f8f` | Poppins drives Assign / groceries / shopping on the overlay — not “I can open that for you” |

---

## Today — major

### Invites

- Same `/join/CODE` URL: digits = grown-up household invite (pending until approved); letters = kid/profile ghost.
- Check status does not bounce owners back to an old household.

### Places, GPS, shopping

- Add Place / My Places maps preload GPS even with zero pins.
- Nearby grocery and clothing stores after Home.
- Clothing aisle on the shared list; in-store promo hints (US/CA).
- Near-shop ping includes shopping-list items, not only groceries.
- Ask Poppins in place (House Rules + long-press tab).

### AIUIC (IUI / EUI)

- Poppins owns the Activity overlay: Kitchen/dishes stages Assign (narrowed), milk shows **Added**, done tasks show **Done**.
- `navigate_to` Assign/Create Task no longer coach-navigates unless the person asked to assign it themselves.
- Jordan / sneakers go on the shopping lane; a future drop also lands on the calendar.

---

## TestFlight env (`eas.json`)

- `EXPO_PUBLIC_DATA_MODE=supabase`
- `EXPO_PUBLIC_POPPINS_AI=openai`
- `EXPO_PUBLIC_POPPINS_REALTIME=1`
- `EXPO_PUBLIC_POPPINS_VOICE_WEBRTC=1`

EAS `autoIncrement` assigns the next iOS build number.

---

## Device smoke

1. Real Supabase account (not `sarah@orbit.test`)
2. Assign a library task from Poppins (“clean dishes”) — overlay shows Kitchen, not a caption
3. Add milk / a shopping drop
4. House Rules Admin + Sidekick
5. Places map + nearby store
6. Invite join pending path

**Still open** — [`remaining.md`](./remaining.md) (IUI memory, App Review, website ops).

**Do not** re-port Figma Make, rewrite welcome/sign-in, or collapse House Rules back to the kid card.
