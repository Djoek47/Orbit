# Choremaxx Make v12 (today’s aggregate)

**Branch:** `cursor/choremaxx-make-v12`  
**App version:** `1.2.0`  
**Settings tip:** `make-v12 · aggregate`  
**Tomorrow:** cut **v13** from this tip as the final TestFlight / App Store push.

This branch is a strict superset of v11 plus everything landed 13 Aug 2026. Nothing from the stacked `-5f8f` line is left behind.

---

## Aggregated stack

| Layer | PR / branch | Highlights |
|-------|-------------|------------|
| v11 base | #33 `cursor/choremaxx-make-v11` | v10 + auth + Divine Voice + TestFlight 1.1.0 |
| IUI stage | #34 `cursor/realtime-interactive-menus-5f8f` | Poppins drives Tasks/Plan without tapping; HOLD silence commits |
| IUI timing | same line | HOLD waits, lip-sync beats, HoldRing breathes |
| Luna inbox | #35 `cursor/luna-inbox-confirm-5f8f` | Email-confirm hang fix; Luna replaces notification firehose |
| Assign + Event | #36 `cursor/assign-event-theme-5f8f` | Assign icon grid, themed Event, Poppins speaker route |
| Quality slice | #37 `cursor/poppins-iui-quality-5f8f` | TestFlight voice, IUI stepper, catch-up, places, homework roles |
| House Rules | #38 `cursor/house-rules-directions-5f8f` | HTML 4 directions × Admin / Sidekick |

---

## Today — major

### Poppins (TestFlight)

- Voice is **WebRTC-only** on TestFlight. Expo Go stays text + IUI (no Whisper/WS).
- Speak / Done copy. Conversation strip via `lib/voice/transcript-merge.ts`.
- Speaker routing plugin so playback is loud enough on device.

### IUI stepper

- Compose order: **who → category → task → when → HOLD**.
- `composeReady` gates HOLD. Never routes through `/assign-task`.
- Files: `lib/poppins/iui-compose.ts`, `components/orbit/poppins-stage/iui-stepper.tsx`.

### Task catch-up

- `ensureOccurrencesForDay` skips dates before a series start (no fake misses / doubles).
- Local `formatLocalDate`. Occurrence key `lib:${id}:${assignee}`.
- Monthly / as-needed → `None`, not Weekly.
- Expired: tap opens. Admin long-press Open / Delete.

### Places

- Nominatim address autocomplete.
- In-app `PlaceMap` (`react-native-maps` 1.20.1); Expo Go fallback.
- Settings Apple / Google / Waze lockups in `assets/brand/maps/`.

### Homework roles

- Homework hidden when the household has no kids.
- Admin reviews; does not get homework on their own to-do list.
- Assign homework to children only. Category `homework_education`.

### House Rules (HTML, last change)

- Four directions again: **Chapters, At a glance, The Track, Ask Poppins**.
- Mode chrome: **Admin / Sidekick** (no Child). Same `visibleRules` filter for both.
- Copy only from `data/house-rules.json`. No kid-card subset. No custom-rule composer on this screen.
- JSON still says Helper (locked). R30–R33 included.

---

## Today — smaller

- Sky / Citrus / Coral `backgroundSoft` / `shell` derived from tint (same as Berry).
- Email-confirm hang fix.
- Luna inbox instead of the notification firehose.
- Assign sticky icon grid + Event theme.
- IUI speech-timed HOLD / lip-sync / HoldRing.
- Late Credit + rescue constants still match the scoring engine (`npm run test:house-rules`).

---

## TestFlight env (`eas.json`)

- `EXPO_PUBLIC_DATA_MODE=supabase`
- `EXPO_PUBLIC_POPPINS_AI=openai`
- `EXPO_PUBLIC_POPPINS_REALTIME=1`
- `EXPO_PUBLIC_POPPINS_VOICE_WEBRTC=1`

EAS `autoIncrement` assigns the next iOS build number.

---

## Tomorrow — v13 (final app)

Cut `cursor/choremaxx-make-v13` from **this** tip. Do not start from v11 or v7.

**Ship checklist**

1. `npm run testflight:preflight`
2. `npm run build:ios:testflight` then `npm run submit:ios:testflight`
3. Device smoke on a **real** Supabase account (not `sarah@orbit.test`)
4. Poppins Connect → Speak → IUI HOLD → spoken summary
5. House Rules: all four directions, Admin and Sidekick
6. Places map + homework roles + expired tasks

**Still open (do on v13, do not redo v12 work)**

| Item | Notes |
|------|--------|
| Edge model | Redeploy with `OPENAI_POPPINS_CHAT_MODEL=gpt-5.6-luna` if staging is still on the old id |
| MapView native | Full `MapView` needs the TestFlight IPA; Expo Go uses the fallback |
| A1 site | HTTPS email-confirm bridge (`docs/website-agent-email-confirmation.md`) |
| A3 ASC | IAP products (`docs/asc-iap-setup.md`) |
| A2 | Auth Send Email Hook live smoke |
| B7 | App Review submit after device retest |

**Do not** re-port Figma Make, rewrite welcome/sign-in, or collapse House Rules back to the kid card.
