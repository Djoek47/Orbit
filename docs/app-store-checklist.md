# Orbit App Store / TestFlight checklist

**Day-to-day dev:** Expo Go + mock (`EXPO_PUBLIC_DATA_MODE=mock`).  
**TestFlight / App Store:** EAS native builds + Supabase — see **`docs/testflight-setup.md`**.

## Preconditions

- [ ] Apple Developer Program membership active
- [ ] Expo account + `eas login` + `eas init` (writes `extra.eas.projectId` in `app.json`)
- [ ] App Store Connect app created for `app.choremaxx.household`
- [ ] `REPLACE_ASC_APP_ID` in `eas.json` → numeric App Store Connect App ID
- [ ] Supabase staging/production + RLS + edge functions deployed
- [ ] `OPENAI_API_KEY` in Supabase secrets (Nova)
- [ ] EAS project secrets: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- [ ] Privacy + Terms hosted at URLs in `app.json` (`docs/legal/*` source)
- [ ] `npm run testflight:preflight` passes

## Build / submit

```bash
npm run testflight:preflight
npm run build:ios:testflight
npm run submit:ios:testflight
# or: eas build --platform ios --profile testflight --auto-submit
```

## App Review notes (suggested)

- Demo admin account for a staged household with Child + Adult roles
- Explain Child role is parental-gated
- Settings → Delete account / Export data
- Microphone (Nova voice) and location (optional groceries) rationale
- Sign in with Apple enabled on native builds

## Age rating / kids

- Family utility with optional child users under guardian accounts
- No unrestricted public social chat or UGC feeds

## Post-submit

- TestFlight internal group (your Apple ID) — instant
- External testers — Beta App Review + demo account
- Monitor crashes (EAS / ASC) and push delivery on device builds

## CI

- GitHub: `.github/workflows/ios-testflight.yml` (manual) — requires `EXPO_TOKEN` secret
