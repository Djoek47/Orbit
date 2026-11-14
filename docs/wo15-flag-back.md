# WO15 flag-back — Make Base actually work

Branch: `cursor/wo15-base-voice-c30d` (off `cursor/make-v24`).

## Claim checks (§1)

| Claim | Verdict |
| --- | --- |
| §1.1 Mic gated on `nativeVoice` / WebRTC | **Confirmed + fixed** via `micUiForPrefs`. |
| §1.2 Four failures, one face | **Fixed**; see audit follow-up below for mis-routing fixes. |
| §1.3 `prefsForTier` wiped advanced keys | **Fixed** in prefs + Settings + onboarding panel. |

## Audit 24 Sep follow-up (WO15 §3)

| Finding | Status |
| --- | --- |
| P1 offline test stubs unused module | **Fixed** — `submitUtterance` calls `resolveBaseUtterance`; test commits through `commitIuiBeat` and asserts jam lands. |
| P1 re-entrant `stopQuietCapture` | **Fixed** — null `quietRef` before await + `quietStoppingRef`. |
| P2 longPress swallows next tap | **Fixed** — clear `longPressArmedRef` on `pressOut`; `delayLongPress={700}`. |
| P2 budget error tone / "until tomorrow" | **Fixed** — `POPPINS_PAUSED_COPY` as muted `statusNotice`, not danger. |
| P2 glyph on wrong messages | **Fixed** — sources keyed by absolute user ordinal. |
| P2 onboarding `prefsForTier` wipe | **Fixed** — passes `current` prefs. |
| P2 waveform never sees metering | **Fixed** — `onLevel` → `levelDb` on waveform. |
| P2 classify mis-routes | **Fixed** — empty→whisper; 401/expired→signed_out; no config→whisper detail; no_audio no longer writes `voice:whisper_failed`. |

## Env / build (§7)

- **`EXPO_PUBLIC_POPPINS_VOICE_WEBRTC` / `EXPO_PUBLIC_POPPINS_AI` in TestFlight?** Yes in `eas.json` testflight + production.
- **`react-native-webrtc` in build 81?** Not verifiable here.
- **`poppins-voice` + `OPENAI_API_KEY`?** Need live Supabase confirm.
- **Exact Base error + `voice:` last-error** — still needed from device.

## Merge order (audit §0.1)

1. `wo14-settings-c30d`
2. `wo15-base-voice-c30d` (this branch)
3. `iui-board-gaps-c30d` last — keep WO15 mic/dock/orbSize; take IUI light colours + `STAGE.dock`; merge both `test:iui` lists; add `undoWindowOpen` into `orbIsSettle`.
