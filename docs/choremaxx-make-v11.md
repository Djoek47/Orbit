# Choremaxx Make v11 (pre-final TestFlight)

**Branch:** `cursor/choremaxx-make-v11`  
**App version:** `1.1.0`  
**Target:** Tonight iOS TestFlight smoke

## Aggregated stack (this branch)

Built from the full `-5f8f` shipping line:

| Layer | PR / branch | Highlights |
|-------|-------------|------------|
| v10 base | #29 `cursor/choremaxx-make-v10-5f8f` | Billing/paywall, majordomo roster, associated-domains fix, Poppins craft |
| Auth UX | #30 `cursor/email-confirm-deletion-ux-3686` | HTTPS confirm, OTP, deletion feedback |
| House rules | #31 `cursor/house-rules-full-5f8f` | HTML-faithful 4 directions, splash hooks |
| Divine Voice | #32 `cursor/poppins-divine-voice-5f8f` | WebRTC duplex, Luna, expanded tools, idle hangup |

`cursor/poppins-divine-voice-5f8f` is a strict superset of v10 — no commits left behind.

## TestFlight env (eas.json)

- `EXPO_PUBLIC_DATA_MODE=supabase`
- `EXPO_PUBLIC_POPPINS_AI=openai`
- `EXPO_PUBLIC_POPPINS_REALTIME=1`
- `EXPO_PUBLIC_POPPINS_VOICE_WEBRTC=1`

## Edge functions (staging)

Deploy before device smoke:

```bash
npx supabase functions deploy poppins-realtime-sdp --project-ref dejrbyufotcvcillnneo
npx supabase functions deploy poppins-voice-tool --project-ref dejrbyufotcvcillnneo
# plus chat, monitor, briefing, voice, realtime-session (see docs/supabase-staging-setup.md)
```

Secrets already set on staging: `POPPINS_VOICE_GRANT_ALL=1`, Realtime 2.1 + Luna model IDs.

## Tonight smoke checklist

1. Sign in with **real Supabase account** (not mock `sarah@orbit.test`)
2. Poppins → **Connect** → greet without second mic tap
3. Tool request (“add milk”) → **spoken** summary
4. Risky action → confirmation sheet
5. Walk away ~2 min → idle hangup
6. Type in composer during live session
7. House Rules → all 4 directions render
8. Email confirm / delete-account flows if testing auth

## Build

```bash
npm run testflight:preflight
npm run build:ios:testflight
npm run submit:ios:testflight
```

EAS `autoIncrement` assigns the next iOS build number (32+ after build 31).
