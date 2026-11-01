# Sandbox testing — payments, trial, credits

TestFlight builds always buy in Apple's **sandbox**: nothing is charged. This is the run to do
on build 122+ before submitting. In the app, **Settings → My Subscription → Purchase
diagnostics** (or **Account → Purchase diagnostics** on the paywall) shows what StoreKit, the
phone and the household say at every step — check it after each row below.

## 1. One-time setup

**App Store Connect**
1. Business → Agreements: **Paid Apps** shows *Active*.
2. All 5 products *Ready to Submit* (name, price, review screenshot), both subscriptions in one
   group with **Introductory Offer: Free, 1 week, New subscribers**, and all 5 attached to the
   version. Changes take up to an hour to reach the sandbox.
3. Users and Access → **Sandbox → Test Accounts → +**: make 3 testers, each with a new email
   you control (e.g. `cmx.owner@…`, `cmx.admin2@…`, `cmx.lapsed@…`). Region: Canada.
4. Optional, per tester: **Renewal rate**. Sandbox compresses time (a week or a month becomes
   minutes, a year about an hour) and renews a limited number of times, then stops — check the
   current rates on the tester's page in App Store Connect.

**The test iPhone — no Mac needed**

Sandbox accounts live in **Settings → Developer**, and that menu needs Developer Mode. Without a
Mac, unlock it once with an EAS development build:

1. Register the iPhone: `npx eas device:create` → open the link on the iPhone → install the
   profile it offers (Settings → General → VPN & Device Management).
2. Build and install a development build: `npx eas build --profile development-device
   --platform ios`, open the install link from the build page on the iPhone. It doesn't need to
   run — installing a development-signed app is what makes the toggle appear.
3. Settings → Privacy & Security → **Developer Mode → On** → restart → confirm.
4. Install the real build from TestFlight with your normal Apple ID.
5. Settings → [your name] → **Media & Purchases → Sign Out**.
6. Settings → **Developer → Sandbox Apple Account → Sign In** with tester 1.
7. Settings → Developer → Sandbox Apple Account → **Manage**: *Clear Purchase History* (makes
   the tester eligible for the free trial again — sign out and back in after), renewal rate,
   *Interrupted Purchases*.

**Quick path, no Developer Mode at all:** TestFlight already buys in sandbox with your own
Apple ID — nothing is charged. Limits: subscriptions renew **daily, up to 6 times**, then stop;
you can't clear history, so the free trial can be tested **once per Apple ID** (use a second
Apple ID, e.g. a family member's phone, for a second trial run); no billing-retry tests.

Diagnostics should now show **all 5 products ✓ with CA$ prices**. If any is ✗, stop: that's
App Store Connect, not the app.

## 2. Test matrix

Mark each ✓ in Purchase diagnostics *and* on screen.

| # | Who / start state | Do | Expect |
|---|---|---|---|
| 1 | New account, tester 1 (history cleared) | Sign up → confirm email | Paywall "Try it free for 7 days", **Start free trial**, Monthly / Yearly, first charge date shown |
| 2 | — | Start free trial (Yearly) | Apple sheet says *free for 1 week*, then CA$49.99. App opens. Diagnostics: phone **Free trial = Yes**, household **Free trial = Yes** |
| 3 | On trial | Settings → My Subscription | Dashboard "Free trial · N days left", **First charge** date; no "Start free trial" anywhere |
| 4 | On trial, nothing bought | Poppins tab | Poppins trial page with the moving orb, **Subscribe** |
| 5 | On trial | Poppins credits → buy **200** | Apple sheet; balance +200; receipt email; Poppins unlocks; orb drains and refills with "+200 actions" |
| 6 | On trial | Inbox → Activity | Trial card shows the same days left as the dashboard |
| 7 | Wait ~3 min | Reopen app | Trial converted: dashboard **Active · Renews …**; Poppins monthly = 300; household **Free trial = No** |
| 8 | Paid | Use Poppins until 0 actions | Glass **out of actions** sheet with 200 / 700 / 2000; buy 700 → orb refills, counter counts up, receipt email |
| 9 | Paid | Dashboard → Manage or cancel → turn off renewal | Back in app: **Cancelled · Ends …**; household Will renew = No |
| 10 | Cancelled | Wait for the period to end (≈5 min monthly / 1 h yearly) | Owner: paywall **Welcome back · Renew my subscription**. Sidekick phone / tablet: **ChoreMaxx is paused**, names the owner, no buy button |
| 11 | Lapsed | Renew | App opens; bought credits from #5/#8 still there |
| 12 | Tester 2 on a second phone, joined as admin | Open app while #7 is active | Opens (household paid). Dashboard shows "another admin pays", no plan buttons |
| 13 | Any | Paywall → Restore | Restores an active plan, or says "No subscription found" |
| 14 | Any | Paywall → Account | Get help, Purchase diagnostics, Terms, Privacy, Transfer, Delete household, Delete account, **Sign out → lands on Get Started** |
| 15 | Interrupted purchases ON | Buy a pack | Apple asks to agree to terms; after agreeing the pack lands once (no double credit) |
| 16 | New tester, Canada → change region to US in ASC | Sign out/in sandbox, open paywall | Prices switch to US$ and match Apple's sheet |

**Billing retry / grace (3 days):** sandbox can only force this from Xcode's StoreKit testing.
On TestFlight, check instead that Diagnostics shows *Billing retry: No* during normal runs; the
warning on the dashboard is covered by the app's unit tests.

## 3. Before you submit

- Every row above ✓, and Diagnostics shows *Environment: Sandbox* with no ✗ products.
- App Review sign-in: `review@choremaxx.app`, household given Premium by the SQL in
  `build-121-release-checklist.md` (it needs no Apple purchase).
- Sign back in to your real Apple ID under Media & Purchases when you're done.
