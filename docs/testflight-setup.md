# Choremaxx TestFlight setup (Apple Developer Program)

Use this guide after your **Apple Developer Program** membership is active. Builds run on **EAS** (Expo Application Services) — no Mac required for compiling the `.ipa`.

## What you need

| Item | Where |
|------|--------|
| Apple Developer account (paid) | [developer.apple.com](https://developer.apple.com) |
| Expo account (free) | [expo.dev](https://expo.dev) |
| App Store Connect access | [appstoreconnect.apple.com](https://appstoreconnect.apple.com) |
| Supabase staging project | For TestFlight data (not mock) |

**Bundle ID (already in repo):** `app.choremaxx.household`  
**App name:** Choremaxx

---

## One-time setup (≈30–45 min)

### 1. Link the repo to EAS

```bash
npm install
npm i -g eas-cli   # or use npx eas
eas login
eas init           # creates/links EAS project — writes projectId into app.json
```

After `eas init`, commit the updated `app.json` `extra.eas.projectId`.

### 2. Register the app in App Store Connect

1. App Store Connect → **Apps** → **+** → **New App**
2. Platform: **iOS**
3. Name: **Choremaxx**
4. Primary language: English
5. Bundle ID: **app.choremaxx.household** (create under [Certificates, Identifiers & Profiles](https://developer.apple.com/account/resources/identifiers/list) if missing)
6. SKU: e.g. `choremaxx-ios-001`
7. User access: Full access

Copy the **Apple ID** (numeric App ID) from App Information → **Apple ID** (e.g. `6751234567`).

### 3. Enable capabilities on the App ID

In Apple Developer → Identifiers → `app.choremaxx.household`:

- **Sign In with Apple**
- **Push Notifications**
- **Associated Domains** — only when `ios.associatedDomains` is set in `app.json` (Universal Links). Auth deep links use `choremaxx://` and do **not** require this.

EAS can enable supported capabilities on build when Apple authentication is available (look for **✔ Synced capabilities**). Non-interactive CI builds that skip Apple login reuse the remote provisioning profile as-is — if entitlements and the profile disagree, the archive fails.

### 4. Fill `eas.json` submit config

Replace `REPLACE_ASC_APP_ID` in `eas.json` with your numeric App Store Connect App ID:

```json
"submit": {
  "testflight": {
    "ios": {
      "ascAppId": "6751234567"
    }
  }
}
```

Team ID and Apple ID email are stored by EAS after `eas credentials` / first submit (interactive).

### 5. EAS secrets (Supabase + Nova for TestFlight builds)

TestFlight builds use **supabase** mode (see `eas.json` env). Set secrets once:

```bash
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value "https://YOUR_PROJECT.supabase.co"
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "YOUR_ANON_KEY"
eas secret:create --scope project --name EXPO_PUBLIC_PRIVACY_URL --value "https://choremaxx.vercel.app/privacy"
eas secret:create --scope project --name EXPO_PUBLIC_TERMS_URL --value "https://choremaxx.vercel.app/terms"
```

Deploy Supabase edge functions and set `OPENAI_API_KEY` in Supabase for Nova.

### 6. Host privacy & terms

App Review requires live URLs (already referenced in app):

- `https://choremaxx.vercel.app/privacy`
- `https://choremaxx.vercel.app/terms`

Source copies: `docs/legal/privacy-policy.md`, `docs/legal/terms-of-service.md`

---

## Build & upload to TestFlight

### Preflight (local)

```bash
npm run testflight:preflight
```

### Build for TestFlight

```bash
npm run build:ios:testflight
```

First run: EAS will ask to create **Distribution Certificate**, **Provisioning Profile**, and **Push Key** — choose **Let EAS handle it**.

### Submit to App Store Connect

```bash
npm run submit:ios:testflight
```

Or combine build + submit:

```bash
eas build --platform ios --profile testflight --auto-submit
```

### In App Store Connect

1. **TestFlight** tab → wait for processing (5–30 min)
2. **Internal testing** → add yourself (no Beta App Review)
3. Fill **Export Compliance** (app uses `ITSAppUsesNonExemptEncryption: false` — typically “No” for custom encryption)
4. **App Privacy** questionnaire (data linked to user: account, household tasks, etc.)
5. For **external** testers: add Beta App Review info + demo account (see below)

---

## Auth for TestFlight (required)

TestFlight builds use **Supabase** (`EXPO_PUBLIC_DATA_MODE=supabase`). They do **not** accept Expo Go mock credentials.

| Credential | Works where? |
|------------|----------------|
| `sarah@orbit.test` / `orbit-demo` | **Expo Go mock only** — will fail on TestFlight with “invalid login” |
| Real email + password created in Supabase Auth (or via Get Started) | TestFlight / production |
| Sign in with Apple | Device builds **after** Apple is enabled in Supabase Auth → Providers |

### Email confirmation (supported)

Get Started → email/password sends a confirmation email when **Confirm email** is on. Supabase Auth still owns the flow; delivery should go through **Resend** (Custom SMTP or `send-auth-email` hook) — see [resend-auth-email.md](./resend-auth-email.md). The app opens `confirm-email`, and the mail link should redirect to `choremaxx://auth/callback`.

In Supabase → **Authentication** → **URL configuration**, allow:

- `choremaxx://auth/callback`

Optional: disable Confirm email for faster internal testing, or use **Add user** + **Auto Confirm**.

### Create a demo user (Dashboard)

1. Supabase → **Authentication** → **Users** → **Add user**
2. Email + password, enable **Auto Confirm User** (required if Confirm email is still on)
3. Sign in once in TestFlight → complete onboarding / create household
4. Put that email/password in App Store Connect **Beta App Review** / Review Notes

If a tester already signed up while Confirm email was on: open that user in the Dashboard → confirm / verify them (or delete and recreate with Auto Confirm).

### Enable Sign in with Apple (Supabase)

Apple capability on the App ID alone is not enough — Supabase must have the Apple provider:

1. Apple Developer → Keys → create a **Sign in with Apple** key (`.p8`), note Key ID + Team ID
2. Services ID for web callback (Supabase docs): callback `https://YOUR_PROJECT.supabase.co/auth/v1/callback`
3. Supabase → **Authentication** → **Providers** → **Apple** → enable, paste Services ID, Team ID, Key ID, `.p8` secret
4. No app rebuild required once the provider is live — next Sign in with Apple attempt should succeed

Until Apple is enabled, testers should use **Get Started** or a real email/password account. Build 3+ shows friendly copy instead of raw `authRepository…` / provider errors.

## Demo account for Apple Review

Create a staged Supabase household:

- **Admin:** a real Supabase Auth user (not `sarah@orbit.test`) / password you provide in Review Notes
- **Child:** Liam persona with rewards enabled
- Note: Child role is parent-gated; Sign in with Apple only after Supabase Apple provider is configured

Suggested Review Notes:

> Choremaxx is a household task and rewards app for families. Sign in with the demo email/password in these notes (or Apple if enabled). Admin can mint rewards; child can request/redeem. Settings includes Delete account and Export data. Microphone is for optional Nova voice; location is optional for grocery suggestions.

---

## CI pipeline (optional)

GitHub Actions workflow: `.github/workflows/ios-testflight.yml`

Requires repository secret:

- `EXPO_TOKEN` — from [expo.dev/settings/access-tokens](https://expo.dev/settings/access-tokens)

Trigger manually: **Actions → iOS TestFlight → Run workflow**

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `No bundle identifier` | Run `eas init`; confirm `app.choremaxx.household` in `app.json` |
| `ASC App ID invalid` | Use numeric ID from App Store Connect, not bundle id |
| Provisioning profile doesn't support **Associated Domains** / missing `com.apple.developer.associated-domains` | Entitlements and the App Store profile disagree. Either (A) remove `ios.associatedDomains` from `app.json` and rebuild (custom scheme still works), or (B) enable **Associated Domains** on the App ID → Confirm → run an **interactive** `eas build -p ios --profile testflight` (or `eas credentials` → delete the App Store provisioning profile) so EAS regenerates a profile that includes the capability. Non-interactive builds that skip Apple login will keep the stale profile. |
| Push not working on TestFlight | Ensure Push Notifications capability + APNs key in EAS credentials |
| Sign in with Apple fails (`Provider apple not installed` / issuer not enabled) | Enable **Apple** under Supabase Auth → Providers (Services ID, Team ID, Key ID, `.p8`). App ID capability alone is not enough. |
| `Invalid login credentials` / `sarah@orbit.test` | Mock-only email. Create a Supabase Auth user or use Get Started on device. |
| Sign-up lands on Confirm email | Expected when Confirm email is on — open the mail link (redirect `choremaxx://auth/callback`) or Resend. Allow that URL in Supabase Auth → URL configuration. |
| `Email not confirmed` on sign-in | App should open Confirm email. Or confirm the user in Dashboard → Authentication → Users. |
| Raw `authRepository.signIn: …` error text | Fixed in shipping branch after Build 2 — ship a new TestFlight build |
| Build uses mock data | Check `eas.json` `testflight.env.EXPO_PUBLIC_DATA_MODE=supabase` |

---

## Commands cheat sheet

```bash
npm run testflight:preflight      # offline checks
npm run build:ios:testflight      # EAS cloud build → .ipa
npm run submit:ios:testflight       # upload latest build to ASC
eas build:list                    # see build status
eas submit:list                   # see submission status
eas credentials                   # manage certs / profiles / push key
```
