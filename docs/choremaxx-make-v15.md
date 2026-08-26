# Choremaxx Make v15 (two-mode IUI)

**Branch:** `cursor/choremaxx-make-v15`  
**Follows:** `cursor/choremaxx-make-v14` (TestFlight **1.3.0 (44)**)  
**App version:** `1.3.0`  
**TestFlight:** **1.3.0 (49)** has working IUI taps; sign-out still crashes (`B88D6E93`). This tip is the remount/worklets fix — next IPA after Apple processes. Skip 45–48. Install **49** only to confirm IUI; use the next build for sign-out.

This is the next shipping cut after v14. It is v14 plus two-mode Poppins IUI, Speak start fixes, the per-person $4 AI meter on live voice, and the Poppins OS one-viewport rework.

---

## Sign-out crash (TestFlight 45)

Signing out could leave the JWT in SecureStore when the logout HTTP call failed, then remount the tree while WebRTC was still live. That matched the Hermes `EXC_BAD_ACCESS` on Thread 6 (`arrayPrototypeMap`) plus “already logged in” after reopen.

Fix on this branch: always wipe local auth (chunked SecureStore), block refresh writes, tear down Poppins voice before the session remount, and still land on Get Started if sign-out throws.

## Poppins OS (TestFlight 46)

See [`poppins-os.md`](./poppins-os.md). IPA **1.3.0 (46)** from git `1769d06`. Bell never auto-opens over a live scene. Notifications is one list (no Activity tab, no hourglass on the Poppins tab). HOLD writes a real `createTask`. Speak failures say retry, not “Type instead.” In-place Ask from House Rules / tab long-press routes to the Poppins tab.

EAS `b0959c6b-9349-4ceb-abac-4d110c3c39ba`, submit `caac30b9-c7e2-4cef-8368-901ea39ead48`.

### TestFlight 1.3.0 (49)

IUI tap hangup + Speak abort. EAS `3e33b7de-9e01-41cc-a619-b0f86d954738`, git `d7bc562`, submit `d326ebe9-0725-4bdb-b275-110561173eb4`. Settings tip `make-v15 · iui-tap`. Apple is processing.

### Hermes / Speak crash (45 + 46)

Not a missing webhook. Voice is `poppins-realtime-sdp` + `poppins-voice-tool`.

- **45** `C24F15C6`: `EXC_BAD_ACCESS` in Hermes `Object.entries` / `Array.map` while WebRTC threads are live. Same family as sign-out remounting the JS tree over a live `PeerConnection`.
- **46** `2B1E08FD`: `SIGABRT` 10s after launch via Expo Updates `ErrorRecovery.crash()`. Speak had already started WebRTC. Thread 1 is `RCTBlobManager` / `suggestedFilename` on the SDP response (`application/sdp` + `FormData`). Expo then waits for an OTA, gets none, and aborts. After relaunch the frozen IUI returns with “Couldn't start voice.”

47: JSON SDP (no FormData), `text/plain` answer, unbind `RTCView` before `PeerConnection.close`, no IUI mount animations under live voice, delayed sign-out remount, OTA check only on error recovery.

- **49** `B88D6E93`: IUI taps work. Sign-out still `EXC_BAD_ACCESS`. Thread 4 is Reanimated `makeSerializableObject` / `arrayPrototypeMap`; Thread 15 is Hermes `HiddenClass::addProperty` while `convertNSExceptionToJSError` runs for a void TurboModule. 160ms remount of `OrbitProvider` + `Stack` over live worklets. Fix on this tip: wait 400ms after `pc.close()` before unmounting tabs, dismiss/replace at 400ms, remount **only the Stack** at 900ms, skip Reanimated entering/exiting on that remount.

A tap on the IUI is not a webhook. It is a Realtime data-channel user line (`On the IUI I chose …`). IPA 46 sent `response.cancel` on every press, including while listening; OpenAI replied `response_cancel_not_active` and we treated that as fatal, so hands-off voice worked and a chip press hung up. Taps now inject the choice, cancel only while a reply is in flight, queue during tool calls, and never hang up on `response_cancel_not_active`.

## What landed from today

- Two-mode IUI — talking fills unknown beats only; a tap wins while Poppins is still speaking.
- Second Speak — no idle mic on tab focus; warm at Speak tap; reuse live tracks only.
- Poppins OS — one viewport: no Activity tab, no hourglass, no auto-opening inbox. HOLD creates the task.
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

1. Speak works on a fresh session **and** a second Speak after hangup — retry copy if voice fails, Speak stays visible.
2. “Schedule a task for kitchen tomorrow” skips the 14-category grid. HOLD creates the task — Tasks shows it.
3. Tap a face/chip while Poppins is talking — the choice sticks and speech stops talking over it.
4. Bell never opens itself over a live scene. No hourglass. No Activity tab. No “Open Poppins” while already on Poppins.
5. Settings → Poppins meter moves after a Speak turn. After **$4** household AI, Speak pauses.
