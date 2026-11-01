# make-v34 TestFlight — release notes & tester brief

**Branch tip:** `cursor/make-v34-c30d`  
**Base:** `cursor/make-v33` + shared-device TF 118 tip  
**Data:** staging Supabase (`dejrbyufotcvcillnneo`) — live household data, not mock.  
**Status:** Fold of all Oct 7 PR tips (replay → whisper) for one ship IPA. Original PR branches left untouched.

---

## What’s in this build (on top of make-v33 / TF 117–118)

- Shared-device Pass A–E (join routing, atomic Switch, complete guard, presence channels, fresh-tablet Accept, picker same-face bind)
- Assign: proof side button → **request proof**
- Tour: premium **Replay a part** chapter sheet (no Settings freeze)
- Plan: hide homework on admin household calendar by default (opt-in show)
- Support: Send feedback delivers + in-screen confirmation
- Copy: “Tap your **profile**” (not face) on shared devices
- Tour: Groceries step 2 opens Browse (no skip)
- How-it-works: human assign/ask vocabulary + rebaked clips
- Onboarding: Orbit Brief pillars + Privacy/Terms under Continue
- Billing: StoreKit probe — unavailable credit packs greyed (“Not on this build”)
- Voice: Whisper MIME `audio/mp4` + `whisper-1` fallback; edge returns real HTTP status

**Already on staging edges (not in IPA):** `poppins-voice` v18, `sidekick-sync`, `redeem-profile-invite`.

---

## Release notes (App Store Connect / TestFlight)

make-v34 folds today’s fixes onto the shared-device TestFlight cut. Shared-tablet Switch and Accept are solid; Replay a part no longer freezes Settings; Support Send feedback confirms on screen; credit packs that aren’t in ASC stay disabled; Poppins voice transcription uses the corrected audio type. Please re-check admin, Sidekick, and shared-tablet Switch plus Support feedback and Poppins talk.

---

## Tester prompt (paste to testers)

Hi — please install the latest Choremaxx TestFlight (**make-v34**) and run on **staging / live household data** (not Expo Go mock).

Focus for ~20 minutes:

1. **Shared tablet** — Accept multi-code invite on a fresh device; Switch profiles; Mark complete while switching (should block cleanly); same-profile tap should not loop the picker.
2. **Tour** — How it works → Replay a part (chapter sheet, Settings still usable after). Groceries step 2 should open Browse.
3. **Assign** — Proof control reads **request proof**.
4. **Plan (admin)** — Homework hidden by default; toggle to show if present.
5. **Support** — Send feedback → confirmation in-screen.
6. **Credits** — Packs not on this ASC build show unavailable / disabled.
7. **Poppins voice** — short talk turn; no `whisper_failed · http_400 · http 200`.

Reply with: device + iOS, role, pass/fail, screenshots. Thanks.

---

## Cut checklist

1. [x] Fold PR tips #111–#121 onto shared-device tip (new branch only)
2. [x] Edges already deployed: `poppins-voice`, `sidekick-sync`, `redeem-profile-invite`
3. [x] EAS TestFlight build + ASC submit

| | |
|--|--|
| Version | **1.3.0 (119)** — make-v34 fold |
| Branch | `cursor/make-v34-c30d` @ `a61d722` |
| Build | https://expo.dev/accounts/choremaxx-team/projects/choremaxx/builds/76664dbd-3577-4092-b3b2-40b135e62fea — **FINISHED** |
| Submit | https://expo.dev/accounts/choremaxx-team/projects/choremaxx/submissions/9822326e-2df6-445f-922a-d0bf933d39bb — **submitted to ASC** |
| IPA | https://expo.dev/artifacts/eas/yT2gnC5S4G5VyHzeUaH5Ee67PjHjuWP8AOo8QAzWaxA.ipa |
| ASC | https://appstoreconnect.apple.com/apps/6796850110/testflight/ios |
| Prior (118) | shared-device only — https://expo.dev/accounts/choremaxx-team/projects/choremaxx/builds/4086249a-717b-4b32-9d81-99b5a42f5311 |
