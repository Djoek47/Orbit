# Orbit App Store launch checklist

## Preconditions

- [ ] Supabase **staging** and **production** projects created
- [ ] `supabase/schema.sql` (or migrations) applied with RLS
- [ ] Edge functions deployed: `nova-briefing`, `nova-chat`, `join-household`
- [ ] `OPENAI_API_KEY` set as a Supabase secret
- [ ] Apple Developer Program membership active
- [ ] Privacy Policy + Terms hosted (`docs/legal/*` copies)
- [ ] EAS project created; replace `extra.eas.projectId` in `app.json`
- [ ] ASC App ID / Apple Team ID filled in `eas.json`

## Build / submit

```bash
npm i -g eas-cli
eas login
eas build:configure   # if needed
eas build --platform ios --profile production
eas submit --platform ios --profile production
```

## App Review notes (suggested)

- Demo account email/password for a staged household with Child + Adult roles
- Explain Child role is parental-gated
- Point reviewers to Settings → Delete account / Export data
- Note microphone and location permission rationale

## Age rating / kids

- Answer questionnaire for family utility with optional child users under guardian accounts
- Do not include unrestricted social chat or public UGC feeds

## Post-submit

- TestFlight internal + external groups
- Monitor crash/push delivery
- Enable production Cursor Automation for Figma sync (`docs/figma-sync-automation.md`)
