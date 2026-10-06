# make-v33 TestFlight — release notes & tester brief

**Branch tip:** `cursor/make-v33`  
**Data:** staging Supabase (`dejrbyufotcvcillnneo`) — live household data, not mock.  
**Status:** Code folded and pushed. Voice-preview GPT bake + avatar storage migration must clear before the cut (see blockers below).

---

## What’s in this build (last ~36h)

- Credits / Privacy legal open timing
- Premium Alerts prefs + Activity person showcase
- Fifth-tab multipass (Poppins for admin, Switch on shared tablet only)
- Activity streak chips use Playground photos
- Playground avatars upload to Supabase Storage (durable https)
- Household Health glass popovers + streak unify (personal streak = Today’s Tasks)
- Voice colour-wheel preview + hub warm-up
- Maps logos, shared-tablet 6-person cap copy, error → Support feedback
- Itinerary GPS live banner (distance → grocery list → next stop)
- Plan tab hidden for Sidekick / shared-tablet faces

---

## Release notes (App Store Connect / TestFlight)

This build is our make-v33 TestFlight cut on live staging data. Streaks on Household Health now match Today’s Tasks for whoever is signed in or switched on the tablet. Settings Alerts, Credits, Privacy, Activity photos, and the fifth tab (Poppins vs Switch) are tightened for admin, Sidekick, and shared devices. Poppins voice colour picks can play a short offline sample once GPT clips are baked. Plan trips show a live distance banner and can open the grocery list when you arrive. Maps picker logos and error → Send feedback are included. Please exercise admin, Sidekick, and shared-tablet Switch before we ship to Apple tomorrow.

---

## Tester prompt (paste to testers)

Hi — please install the latest Choremaxx TestFlight (make-v33) and run on **staging / live household data** (not Expo Go mock).

Focus for ~20 minutes:

1. **Admin phone** — Home Today’s Tasks streak vs Household Health streak (same number). Tap Health chips (open tasks / groceries). Settings → Alerts prefs. Credits pack (if testing IAP) and Privacy & legal. Poppins tab present; pick a voice colour and listen for the short preview.
2. **Sidekick** — No Plan tab; complete a task / proof if available; confirm you cannot assign. Sign-out lands on Get Started.
3. **Shared tablet** — Switch faces (Emma/Jack etc.); Switch in the fifth slot; streaks and accents follow the face; max 6 people messaging if you hit the cap.
4. **Plan / trip** — Start a multi-stop trip; confirm distance banner; at a grocery stop open the list; advance stop.
5. **Maps** — Places / trip open: AutoNav / Apple Plans / Google / Waze logos look correct.
6. **Error path** — If something fails, use Send feedback → Support with the error attached.

Reply with: device + iOS version, role tested (admin / Sidekick / tablet face), pass/fail per item, and any screenshots of bugs. Thank you — we’re aiming App Store tomorrow.

---

## Blockers before EAS submit (agent checklist)

1. **Valid `OPENAI_API_KEY` (`sk-…`)** — bake `assets/voice-previews/*.m4a` (~$0.005). Current key is rejected by OpenAI TTS.
2. **Staging SQL** — apply `supabase/migrations/20261005160000_member_avatars_storage.sql` (`member-avatars` bucket was empty on staging when checked).
3. Then: `npm run testflight:preflight` → `npm run build:ios:testflight` → `npm run submit:ios:testflight` from `cursor/make-v33`.
