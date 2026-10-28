# make-v41 TestFlight — release notes (build 130)

**Branch tip:** `cursor/make-v41-c30d`  
**Base:** make-v40 / TF **1.3.0 (129)**  
**Status:** App Review fixes — cutting **1.3.0 (130)**.

---

## What's in this build (on top of 129)

### App Review 2.5.4 — unused background modes
- Removed `UIBackgroundModes: remote-notification` from `app.json`
- `expo-audio`: `enableBackgroundPlayback` / `enableBackgroundRecording` **false**
- Built Info.plist declares **no** background modes (app does not play audio in background or use silent pushes)

### App Review 5.1.2(i) — ask before OpenAI
- **Poppins uses OpenAI** consent sheet: names provider, what is sent, Allow / Not now
- Asked on first Poppins visit and whenever a cloud call needs it
- `profiles.ai_consent_at`; every Poppins edge function checks it
  - chat / voice / live voice **refuse** without consent
  - notify / briefing / monitor use plain text and never call OpenAI
- Settings → **Poppins & OpenAI** to see or withdraw
- Without permission Poppins still works on-device

### Staging this cut
- Migration `20261027120000_ai_consent` applied
- Redeployed: poppins-chat, voice, voice-tool, realtime-session, realtime-sdp, briefing, notify, monitor (consent-aware)

---

## Matrix pass

| Check | Result |
|-------|--------|
| `git am` App Review patch | OK |
| `tsc --noEmit` | OK |
| No `UIBackgroundModes` / associatedDomains | OK |
| Staging `ai_consent_at` column | Applied |
| Poppins edge redeploys | OK |
| testflight:preflight | (run at cut) |

---

## Cut

| | |
|--|--|
| Version | **1.3.0 (130)** |
| Branch | `cursor/make-v41-c30d` |
| PR | (fill) |
| Build | (fill) |
| Submit | (fill) |
| Prior (129) | https://expo.dev/accounts/choremaxx-team/projects/choremaxx/builds/928156c2-83a1-452a-ba98-688f005e374c |
