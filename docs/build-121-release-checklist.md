# Build 121 — release checklist

Code is in `v34-06-payments-ipad.patch` (three commits on top of the five you already applied).
Everything below is **not code** — it's Supabase, App Store Connect and EAS. Order matters:
steps 1–2 must happen **before** build 121 reaches anyone.

---

## 1. Supabase — before the build ships

```bash
supabase db push                                  # applies 20261007120000_household_premium.sql
supabase functions deploy sync-entitlement        # new
supabase functions deploy grant-token-pack        # changed: packs now grant 700 / 2000
```

Why first: the app reads household Premium from the `households` row. The code fails *open* for
Sidekick phones and shared tablets if the columns are missing, so nothing locks — but no
household can record a subscription until the migration and function exist, and the packs keep
granting the old 600 / 1500 until `grant-token-pack` is redeployed.

**Check it worked** — in the SQL editor:

```sql
select column_name from information_schema.columns
where table_name = 'households' and column_name like 'premium_%';
-- expect 8 rows, including premium_will_renew
```

## 2. Give the App Review demo household Premium

Reviewers sign in with the **real Supabase account you create** (no in-app autofill). Run this in
the SQL editor (it runs without a user JWT, so the server-only trigger lets it through), replacing
the id with that account’s household:

```sql
update public.households
set premium_product_id              = 'app.choremaxx.household.premium.yearlyv',
    premium_in_trial                = false,
    premium_expires_at              = now() + interval '1 year',
    premium_original_transaction_id = 'app-review-demo-household',
    premium_environment             = 'Production',
    premium_will_renew              = true,
    premium_updated_at              = now()
where id = '<DEMO HOUSEHOLD ID>';
```

Then update **App Review Information → Remarques**. Replace the IN-APP PURCHASES paragraph with:

> ChoreMaxx is free to try for 7 days, then requires Premium: $6.99/month or $49.99/year
> (auto-renewing, 7-day free trial for new subscribers). The demo account's household already has
> Premium, so every feature is unlocked. To test purchasing: create a new account — after email
> confirmation the subscription screen appears; start the free trial with your sandbox Apple ID.
> Credit packs (200 / 700 / 2000 Poppins actions) are bought from Settings → Poppins → Credits and
> work on the demo account. Restore Purchases, Terms of Use and Privacy Policy are on the
> subscription screen. During a free trial, Poppins runs on purchased actions only; the monthly
> 300 begin when the trial converts.

## 3. App Store Connect — this is what "SKU not found" was

StoreKit returned nothing because of one of these. Check all of them:

- **Business → Agreements, Tax and Banking**: Paid Apps agreement shows **Active**.
- **Each of the 5 products** is at least *Ready to Submit* — not *Missing Metadata*. Each needs a
  display name, description, price, and a **review screenshot**.
- **Product IDs match character for character:**
  ```
  app.choremaxx.household.premium.monthlyv
  app.choremaxx.household.premium.yearlyv
  app.choremaxx.household.premium.tokens.smallv
  app.choremaxx.household.premium.tokens.mediumv
  app.choremaxx.household.premium.tokens.largev
  ```
- **Both subscriptions → Subscription Prices → Introductory Offers → Free, 1 week, New
  subscribers.** This *is* the trial. Apple runs it and charges automatically on day 8; the app
  only reads the state. If it is missing, the paywall now correctly says "Subscribe", not
  "Start Free Trial".
- **Version 1.3.0 → In-App Purchases and Subscriptions**: all five attached. New products are only
  reviewed with a version.
- New products can take up to an hour to appear in sandbox after they become ready.

## 4. Test on TestFlight with a sandbox account

Settings → App Store → Sandbox Account → sign in with a sandbox tester. Then:

| Test | Expect |
|---|---|
| New account → confirm email | Paywall with **no "Not now"**, only **Account** |
| Account link | Restore, Help, Terms, Privacy, Transfer, Delete household, Delete my account, Sign out |
| Start free trial | Lands in the app. Poppins tab shows **"Poppins runs on actions"** |
| Inbox → Activity | Trial card: days left, exact end time, price after, Manage |
| Buy the 200 pack | Poppins unlocks; credits screen shows 200 bought, "Monthly · starts <date>" |
| Sidekick phone in same house | Opens normally (household row says trial) |
| Wait out sandbox trial (~3 min for 1 week) | Apple renews automatically → Poppins gets 300/month |
| Cancel in sandbox, let it lapse | Admin: paywall, "Your free trial has ended." Sidekick: "ChoreMaxx is paused for now — ask Nero" |
| Prices | Show **CA$** on a Canadian storefront, matching Apple's sheet |

Sandbox compresses time: a 1-week trial lasts about 3 minutes, a month about 5.

## 5. EAS — leave the image alone

`eas.json` pins `macos-tahoe-26.5-xcode-26.6`. **Keep it.** Expo SDK 57 doesn't generate the
UIScene lifecycle that iOS 27 SDK apps require; a 57 build made with Xcode 27 uploads fine and then
aborts at launch.

## 6. iPad and iPhone Duo

- **iPad**: build 121 lays out in a centred column and supports all orientations. Retake the iPad
  screenshots on an iPad simulator or device after it lands.
- **iPhone Duo** (shipping Oct 23): build 121 runs letterboxed on the inner screen — works, not
  "optimized". Optimized needs Expo SDK 58 + an Xcode 27.1 image: a separate upgrade. Duo
  screenshots become mandatory in April 2027.

## Known, not done

- **App Store Server Notifications.** Renewals reach the household when an admin opens the app.
  Children's devices get Apple's 16-day grace in the meantime if renewal is on, 2 days if the admin
  cancelled. Notifications would write renewals directly — the proper fix, after launch.
- **Signed-transaction verification.** `sync-entitlement` and `grant-token-pack` trust an
  authenticated admin, not Apple's signature. One subscription per household and admin-only writes
  limit the damage; verifying the JWS should land before scale.
- Two tests fail on untouched v34, not from this work: `test:invite-intent` (join approval returns
  `approved` where the test expects `pending` — possibly a real regression) and `test:revision-e`
  (`window is not defined`, an environment issue).
