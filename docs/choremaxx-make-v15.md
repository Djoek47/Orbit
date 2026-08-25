# Choremaxx Make v15 (two-mode IUI)

**Branch:** `cursor/choremaxx-make-v15`  
**Follows:** `cursor/choremaxx-make-v14` (TestFlight **1.3.0 (44)**)  
**App version:** `1.3.0`  
**TestFlight:** **1.3.0 (45)** uploaded to App Store Connect (Apple processing). EAS `abcf5726` / git `b4fc5a6` / submit `a6cf66fe`.  
**Settings tip:** `make-v15 · two-mode`

This is the next shipping cut after v14. It is v14 plus two-mode Poppins IUI, Speak start fixes, and the per-person $4 AI meter on live voice.

---

## What landed from today

- Two-mode IUI — talking fills unknown beats only; a tap wins while Poppins is still speaking.
- Second Speak — no idle mic on tab focus; warm at Speak tap; reuse live tracks only.
- Activity stays hourglass-only. In-place Ask is not a second stage on the Poppins tab.
- Usage meter records live Speak turns (not only typed chat) and dual-writes to Supabase when `ai_usage_events` exists.

## TestFlight env (`eas.json`)

- `EXPO_PUBLIC_DATA_MODE=supabase`
- `EXPO_PUBLIC_POPPINS_AI=openai`
- `EXPO_PUBLIC_POPPINS_REALTIME=1`
- `EXPO_PUBLIC_POPPINS_VOICE_WEBRTC=1`

## SQL you must apply on staging

The meter works on-device without SQL (AsyncStorage). For a **household-wide** $4 trip across phones, run:

`supabase/migrations/20260825220000_ai_usage_events.sql`

Until that lands, each TestFlight phone still meters locally and still pauses Speak/chat at $4 on that device.

## Device smoke (v15 adds)

1. Speak works on a fresh session **and** a second Speak after hangup — not “Poppins could not start. Type instead.”
2. “Schedule a task for kitchen tomorrow” skips the 14-category grid.
3. Tap a face/chip while Poppins is talking — the choice sticks and speech stops talking over it.
4. Hourglass does not open itself.
5. Settings → Poppins meter moves after a Speak turn. After **$4** household AI, Speak pauses.
