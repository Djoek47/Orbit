# App Store Connect — IAP setup (weekend A3)

Create these **before** wiring native StoreKit / `expo-iap` on a TestFlight build.

## Products (locked)

| Plan | Product ID | Price | Trial |
|------|------------|-------|-------|
| Monthly | `app.choremaxx.household.premium.monthly` | $4.99 | 7-day free |
| Yearly | `app.choremaxx.household.premium.yearly` | $48 | 7-day free |

Source of truth: `constants/billing.ts`.

## ASC steps

1. App Store Connect → **Choremaxx** (`6796850110`) → **Subscriptions**
2. Create subscription group **Premium**
3. Add monthly + yearly with the product IDs above
4. Attach 7-day introductory offer (free) on each
5. Localizations: English — “Choremaxx Premium”
6. Submit products for review with the next binary (or attach to existing version)

## App code

- Settings → **Premium** uses `lib/billing/iap.ts`
- Expo Go / until StoreKit ships: mock trial via `startMockTrial`
- After products are **Ready to Submit / Approved**: install StoreKit path on next native build (do not invent Stripe)

## Blocked until ASC

- Real charge / restore from Apple
- **B5** billing emails (templates exist; send after purchase events exist)
- **B4** site CTAs that promise live checkout
