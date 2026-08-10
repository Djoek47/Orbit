# Orbit App Store / TestFlight checklist

**Day-to-day dev:** Expo Go + mock (`EXPO_PUBLIC_DATA_MODE=mock`).  
**TestFlight / App Store:** EAS native builds + Supabase — see **`docs/testflight-setup.md`**.

## Preconditions

- [x] Apple Developer Program membership active
- [x] Expo account + `eas login` + `eas init` (writes `extra.eas.projectId` in `app.json`)
- [x] App Store Connect app created for `app.choremaxx.household` (ASC App ID `6796850110`)
- [x] `ascAppId` set in `eas.json`
- [ ] Supabase staging/production + RLS + edge functions deployed (incl. `send-auth-email`)
- [ ] `OPENAI_API_KEY` in Supabase secrets (Poppins)
- [x] EAS project env: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- [ ] EAS env: `EXPO_PUBLIC_PRIVACY_URL`, `EXPO_PUBLIC_TERMS_URL` → `https://choremaxx.vercel.app/privacy|terms`
- [x] Privacy + Terms source in `docs/legal/*` (re-host on Vercel after Nova→Poppins edit)
- [x] `npm run testflight:preflight` passes

## ASC listing draft (A8 — do not submit until B7)

| Field | Draft |
|-------|--------|
| **Name** | Choremaxx |
| **Subtitle** | Family chores, rewards & Poppins |
| **Promotional text** | Calm household OS for families — tasks, Plan, groceries, rewards, and Poppins your co-manager. |
| **Description** | Choremaxx is an AI household operating system for families. Assign chores, track Plan and itineraries, run groceries and Smart Shopping, mint rewards and allowances (Mark as paid — never transfers money), and ask Poppins for calm, household-aware help. Parents stay in control; kids get clear tasks and rewards under guardian rules. |
| **Keywords** | family,chores,tasks,rewards,allowance,grocery,calendar,kids,household,AI |
| **Support URL** | mailto:support@choremaxx.app (or https://choremaxx.vercel.app when /support exists) |
| **Marketing URL** | https://choremaxx.vercel.app/ |
| **Privacy Policy URL** | https://choremaxx.vercel.app/privacy |
| **Category** | Lifestyle (secondary: Productivity) |
| **Age rating** | 4+ / family utility; child role under guardian |
| **Pricing** | Auto-renewable: 7-day free trial · $4.99/mo · $48/yr (product IDs in `constants/billing.ts`) |

## App Review notes (suggested)

- Demo admin account for a staged household with Child + Adult roles
- Explain Child role is parental-gated
- Settings → Delete account / Export data
- Microphone (Poppins voice) and location (optional groceries) rationale
- Sign in with Apple enabled on native builds
- Allowance is tracker-only (**Mark as paid**); no money movement

## Age rating / kids

- Family utility with optional child users under guardian accounts
- No unrestricted public social chat or UGC feeds

## Build / submit

```bash
npm run testflight:preflight
npm run build:ios:testflight
npm run submit:ios:testflight
# or: eas build --platform ios --profile testflight --auto-submit
```

## Post-submit

- TestFlight internal group (your Apple ID) — instant
- External testers — Beta App Review + demo account
- Monitor crashes (EAS / ASC) and push delivery on device builds

## CI

- GitHub: `.github/workflows/ios-testflight.yml` (manual) — requires `EXPO_TOKEN` secret
