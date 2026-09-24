# WO15 flag-back — Make Base actually work

Branch: `cursor/wo15-base-voice-c30d` (off `cursor/make-v24`).

## Claim checks (§1)

| Claim | Verdict |
| --- | --- |
| §1.1 Mic gated on `nativeVoice` / WebRTC at `poppins.tsx:141`, `:1262`, `:1332` | **Confirmed.** Pre-fix rendered `{nativeVoice ? <Pressable/> : <View style={styles.micWrap} />}` and labeled with `cfg.label` when WebRTC was missing. Root cause of Base having no button. |
| §1.1 Fix: gate by transport | **Done.** `micUiForPrefs` / `speakTransportForPrefs` decide. Base needs `expo-audio`; Max without WebRTC shows disabled mic + "switch to Base". Never an empty `micWrap`. |
| §1.2 Four failures, one face | **Confirmed + fixed.** Quiet path now classifies `ai_off` / `signed_out` / `whisper_failed` / `budget_tripped`, writes `orbit.lastError.v1` with `voice:` prefix, and shows distinct copy. |
| §1.3 `prefsForTier` wiped advanced keys | **Confirmed + fixed.** `prefsForTier(tier, current)` preserves advanced knobs; only `speakBack` flips. Wired in Poppins tab + Settings. |

## Contract / capture / keyboard

| Section | Status |
| --- | --- |
| §2 Base contract | `docs/poppins-base.md` + `lib/poppins/base-offline.test.ts` (`askPoppins` throw → jam still commits). |
| §3 Hold-to-talk | Hold records; release sends; tap → 10s window with countdown + Stop; &lt;700ms → "Hold while you speak" tip only; metering waveform-only. |
| §4 Thread drawer | Stage permanent; keyboard opens lower-half drawer; orb stays at 72; "Show me how" removed; typed turns inject into live Max session unchanged. |

## Env / build questions (need from user where noted)

### `EXPO_PUBLIC_POPPINS_VOICE_WEBRTC` and `EXPO_PUBLIC_POPPINS_AI` in TestFlight profile?

**Yes, in `eas.json`.** Both `testflight` and `production` set:

- `EXPO_PUBLIC_POPPINS_AI`: `"openai"`
- `EXPO_PUBLIC_POPPINS_VOICE_WEBRTC`: `"1"`
- plus `EXPO_PUBLIC_POPPINS_REALTIME`: `"1"`

(`development` / `preview` do **not** set the Poppins AI / WebRTC flags.)

### Does `react-native-webrtc` actually load in build 81?

**Cannot verify from this cloud run** (no device / no IPA inspect). Code path: `isPoppinsNativeVoiceAvailable()` = flag `=== '1'` **and** `loadReactNativeWebRtc() != null`. Build 81 was TestFlight **1.3.0 (81)** on `cursor/make-v23` @ `17645a3` (`docs/choremaxx-make-v23.md`). Max working on device is strong evidence WebRTC loaded; Base’s empty mic was the transport-gate bug, not necessarily a missing native module.

**Ask on device:** Settings → Help → Last error after a Base attempt, and whether Speak shows on Base after this build.

### Is `poppins-voice` deployed with `OPENAI_API_KEY` on the TestFlight Supabase project?

**Documented as required** (`docs/testflight-setup.md`, `docs/supabase-staging-setup.md`, `supabase/functions/README.md`). Staging project ref in older notes: `dejrbyufotcvcillnneo`. This agent cannot read live Supabase secrets from here.

**Need from user:** confirm `npx supabase functions list` shows `poppins-voice` ACTIVE and secrets include `OPENAI_API_KEY` on the TF project.

### Exact Base error text on device

**Still needed from user** (§7). After this fix, each cause should surface as:

- `Poppins AI is off in this build.` → `voice:ai_off`
- `You're signed out — sign in to use Poppins.` → `voice:signed_out`
- `I couldn't reach the transcriber.` → `voice:whisper_failed`
- `You're out of actions until tomorrow.` → `voice:budget_tripped`
