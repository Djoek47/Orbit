# Household invites — AirDrop & join

## Two invite types

| Type | Code | Who | Flow |
|------|------|-----|------|
| **Account holder** | `CMX-####` (digits) | Adults with email / Apple | Sign in → join → optional admin approval → welcome |
| **Profile-only** | `CMX-NAME` (letters) | Sidekicks, no account | Scan → pick name + avatar → optional approval → home |

Shared tablet mode is separate: scan multiple profile QRs on Get Started → Shared device.

## Admin settings

- **Require join approval** (Settings → House): when ON (default), new members land on Pending after they accept an invite and pick a name. When OFF, they enter immediately.
- **Add household member** (Settings → Members or Get Started roster): create profiles first, share invites later.

## How links work

1. **Share** (Settings → Share household invite, or onboarding after create) opens the iOS share sheet.
2. On iOS, Share’s `url` is `choremaxx://join/CMX-####` so **AirDrop opens Choremaxx** when the app is installed.
3. Message also includes `https://www.choremaxx.app/join/CMX-####` for Messages / web.
4. Deep link stashes the code and routes to **Join** (signed in) or **Welcome** with the code prefilled.
5. Join auto-submits once when the code arrived via link/AirDrop.

## Website deploy (required for https + Universal Links)

Cloud agents cannot push `Choremaxx-Website` (403). Deploy from a machine with write access:

- Landing: `site/app/join/[code]/page.tsx`
- AASA: `site/public/.well-known/apple-app-site-association` (Team `R98S6HMKZL`)
- Headers: `site/next.config.mjs`
- Zip: `/opt/cursor/artifacts/choremaxx-website-join-invite.zip`

After deploy, verify:

```bash
curl -sI https://www.choremaxx.app/.well-known/apple-app-site-association
curl -sI https://www.choremaxx.app/join/CMX-1234
```

Universal Links need a **new native build** after `associatedDomains` in `app.json` (OTA alone is not enough for AASA entitlement).

## Fallback HTTPS opener (already live)

```
https://dejrbyufotcvcillnneo.supabase.co/functions/v1/invite-open?code=CMX-1234
```

Redirects to `choremaxx://join/…`.

## TestFlight / Expo Go

| Path | Works? |
|------|--------|
| AirDrop custom scheme → TestFlight app | Yes (best) |
| Expo Go custom scheme | Limited — prefer TestFlight |
| Universal Links | After site AASA + new native build |
