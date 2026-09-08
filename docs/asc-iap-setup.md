# App Store Connect — IAP setup (weekend A3)

## Products (locked)

| Plan | Product ID | Price | Trial | Status |
|------|------------|-------|-------|--------|
| Monthly | `app.choremaxx.household.premium.monthly` | $4.99 | 7-day free | Live in ASC (Choremaxx Premium Monthly) |
| Yearly | `app.choremaxx.household.premium.yearly` | $48 | 7-day free | Catalog ready; not on onboarding sheet |

Source of truth: `constants/billing.ts`.

## App paywall

- **Route:** `/premium` — Apple-caliber sheet after email confirm (soft gate).
- **Onboarding:** Start Free Trial (monthly) · Restore · Not now → welcome setup.
- **Settings:** Open Premium + Restore (shared sheet with `source=settings`).
- **Facade:** `lib/billing/iap.ts`
  - Expo Go → mock trial
  - Native TestFlight/production → StoreKit via `expo-iap`

## ASC steps

1. App Store Connect → **Choremaxx** (`6796850110`) → **Subscriptions**
2. Subscription group **Premium**
3. Monthly product id above with 7-day introductory offer
4. Localization: English — “Choremaxx Premium”
5. Attach products to the next binary for review

## Native build required for StoreKit

`expo-iap` is a native module. After merging paywall code:

```bash
npm run build:ios:testflight
```

OTA alone updates JS UI; StoreKit purchases need a binary that includes `expo-iap`.

## Still later

- **B5** billing emails after purchase events
- Server-side App Store Server API receipt verification
- Yearly CTA on onboarding (Settings footnote only for now)
