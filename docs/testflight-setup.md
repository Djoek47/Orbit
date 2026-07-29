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

EAS can enable these on first build if you allow credential setup when prompted.

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
eas secret:create --scope project --name EXPO_PUBLIC_PRIVACY_URL --value "https://choremaxx.app/privacy"
eas secret:create --scope project --name EXPO_PUBLIC_TERMS_URL --value "https://choremaxx.app/terms"
```

Deploy Supabase edge functions and set `OPENAI_API_KEY` in Supabase for Nova.

### 6. Host privacy & terms

App Review requires live URLs (already referenced in app):

- `https://choremaxx.app/privacy`
- `https://choremaxx.app/terms`

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

## Demo account for Apple Review

Create a staged Supabase household:

- **Admin:** `review+admin@choremaxx.app` / password you provide in Review Notes
- **Child:** Liam persona with rewards enabled
- Note: Child role is parent-gated; Sign in with Apple supported on device builds

Suggested Review Notes:

> Choremaxx is a household task and rewards app for families. Sign in with the demo email or Apple. Admin can mint rewards; child can request/redeem. Settings includes Delete account and Export data. Microphone is for optional Nova voice; location is optional for grocery suggestions.

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
| Push not working on TestFlight | Ensure Push Notifications capability + APNs key in EAS credentials |
| Sign in with Apple fails | Enable capability on App ID; use device/TestFlight build (not Expo Go) |
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
