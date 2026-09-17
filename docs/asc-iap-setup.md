# App Store Connect — IAP setup

## Products (locked in code)

| Plan | Product ID | Price | Trial | Status |
|------|------------|-------|-------|--------|
| Monthly | `app.choremaxx.household.premium.monthly` | **$6.99** | 7-day free | Confirm/edit ASC price point |
| Yearly | `app.choremaxx.household.premium.yearly` | **$49.99** | 7-day free | Lead CTA · 40% off vs monthly |

Source of truth: `constants/billing.ts`. Existing ASC tiers cannot silently change — create or edit price points before shipping strings that show $6.99 / $49.99.

Allowance copy: **300 Poppins actions a month, 30 a day.**

## App paywall

- **Route:** `/premium` — annual-led sheet after email confirm (soft gate).
- **Onboarding:** Start Free Trial (yearly) · monthly alt · Restore · Not now.
- **Settings:** Open Premium + usage panel when subscribed.
- **Facade:** `lib/billing/iap.ts`
  - Expo Go → mock trial
  - Native TestFlight/production → StoreKit via `expo-iap`

## ASC steps

1. App Store Connect → **Choremaxx** (`6796850110`) → **Subscriptions**
2. Subscription group **Premium**
3. Monthly + yearly product ids above with 7-day introductory offer at the new price points
4. Localization: English — “Choremaxx Premium”
5. Attach products to the next binary for review

## Native build required for StoreKit

`expo-iap` is a native module. After merging paywall code:

```bash
npm run build:ios:testflight
```

OTA alone updates JS UI; StoreKit purchases need a binary that includes `expo-iap`.

## Still later

- Token top-up consumables (Part E)
- Server-side App Store Server API receipt verification
