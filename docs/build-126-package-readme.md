# ChoreMaxx — build 126 package

Everything since `make-v37` (commit 39932ac), in one patch.

## Apply (Cursor, on cursor/make-v37)
```bash
git checkout cursor/make-v37
git am choremaxx-v37-all.patch      # all 12 commits at once
git push
```
Already applied v37-01 to v37-03 (files 0001 to 0005) earlier? Then apply only the newer files from
`patches-step-by-step/` (0006 onward): `git am patches-step-by-step/00{06..12}-*.patch`.
If `git am` stops on a conflict: `git am --abort` and send me the message.

## Supabase (once, from the repo root)
```bash
supabase db push
#   20261008120000_support_console.sql
#   20261008130000_console_live.sql
#   20261008140000_household_email_log.sql
#   20261008150000_support_attachments.sql
supabase functions deploy send-household-email send-support-feedback support-reply
supabase functions deploy support-inbound --no-verify-jwt
```

## Then
- `eas build --profile testflight --platform ios --auto-submit` gives build 126.
- Console: redeploy on Vercel from `choremaxx-console.zip`.
- Halloween ships OFF. After App Review approves, set `HALLOWEEN_RELEASED = true` in
  `lib/theme/seasonal.ts` and ship the update. It switches itself off on November 1.

## What's inside
1. Support console backend, error reports, purchase diagnostics (TestFlight only), sandbox doc
2. Build 125: Monthly/Yearly picker, confirmation emails (Sidekick, shared device, trial ending), support screenshots in the console
3. Payments: unfinished purchases recovered, Apple grace period, no unconfirmed trial promises, clearer restore
4. Calendar holidays: 7 regions, 56 days with their own icons, Holidays menu
5. Halloween theme (off until released): night look, monster per color, witch-hat logo and app icons, cobwebs, spiders, bats, masked vampire kitten
6. Lighter payment pages with motion, ChoreMaxx wordmark on the trial page, pulsing savings badge, friendly payment-error cards

`paywall-previews.html`: the clickable previews.
