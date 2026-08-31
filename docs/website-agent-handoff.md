# ChoreMaxx Website — Agent Handoff Plan

**Audience:** Website agent working on `Djoek47/Choremaxx-Website`  
**Companion app repo:** `Djoek47/Orbit` (branch `cursor/choremaxx-make-v10-5f8f`)  
**Local site clone (Orbit cloud VM):** `/workspace/site` (gitignored nested clone)  
**Live:** https://www.choremaxx.app/ · fallback https://choremaxx.vercel.app/  
**Brand kit zip:** `/opt/cursor/artifacts/choremaxx-website-brand-kit.zip`  
**Prepared:** 2026-08-11 · for weekend A1 / B4 + invite/auth bridges  

> This file is the **source of truth for logos, palettes, product locks, and unfinished website work**.  
> Do **not** invent roommate modes, Free/$8.99 tiers, “Nova”, or randomize the **iOS app** palette.

---

## 0. Mission (what “done” looks like)

1. Marketing site ships **official house-mark branding** (Sky / Citrus / Coral / Berry) with **per-visit** palette rotation.  
2. Canonical URLs are **`https://www.choremaxx.app/*`** (privacy, terms, support, download).  
3. **Join** + **auth confirm** bridges work (`/join/[code]`, `/auth/callback`) with AASA / assetlinks.  
4. Copy matches App Store product locks (families only, Poppins, IAP pricing).  
5. Email assets served from the site (`/emails/logo-mark.png`, `/emails/sender-avatar.png`) so Resend HTML can leave GitHub-raw.  
6. Push + Vercel redeploy succeed (Orbit cloud agent often **403**s on the website repo — human/machine with write access may need to push).

---

## 1. Product locks (never violate)

| Lock | Rule |
|------|------|
| Product name | **Choremaxx** / **ChoreMaxx** (marketing may use ChoreMaxx); never “Orbit” in user-facing site copy |
| AI name | **Poppins** only (not Nova, not “AI Assistant”) |
| Audience | **Families** — no roommate mode promises |
| Allowance | Tracker only — “Mark as paid”; never send/pay/transfer money |
| Pricing | **7-day trial · $4.99/mo · $48/yr** (+ tax via Apple). No Free / $8.99 Family tiers |
| App palette | User-chosen in Settings — **do not** tell users the app randomizes |
| Site palette | **May rotate per browser visit/session** (see §3) |
| App Store ID | `6796850110` |
| Bundle ID | `app.choremaxx.household` |
| Apple Team / appIDs (AASA) | `R98S6HMKZL.app.choremaxx.household` |
| Support | `support@choremaxx.app` · Privacy `privacy@choremaxx.app` |
| Deep link scheme | `choremaxx://` |

---

## 2. Logo inventory (use these — ignore placeholders)

### 2.1 Canonical house mark (THE logo)

Classic house: sparkle + roof + body. **Not** the old checkmark / app-icon tile.

| Asset | Path (Orbit) | Site path | Use |
|-------|----------------|-----------|-----|
| Default / coral plate | `assets/brand/choremaxx-logo-mark.png` | `public/brand/choremaxx-logo-mark.png` | Favicon fallback, generic |
| Coral mark | `assets/brand/marks/choremaxx-mark-coral.png` | `public/brand/marks/choremaxx-mark-coral.png` | Visit palette = coral |
| Sky mark | `assets/brand/marks/choremaxx-mark-sky.png` | `public/brand/marks/choremaxx-mark-sky.png` | Visit palette = sky |
| Citrus mark | `assets/brand/marks/choremaxx-mark-citrus.png` | `public/brand/marks/choremaxx-mark-citrus.png` | Visit palette = citrus |
| Berry mark | `assets/brand/marks/choremaxx-mark-berry.png` | `public/brand/marks/choremaxx-mark-berry.png` | Visit palette = berry |

**Plating rule:** PNGs use a **cream/white roof plate** so the full house stays visible on colored washes. Roof must never disappear into the page background.

Regenerate from Orbit: `npm run generate:brand-marks` (see `assets/brand/marks/README.md`).

### 2.2 Wordmark (typography, not a PNG)

Always split:

- **chore** → CSS `var(--color-chore)` / palette secondary  
- **maxx** → CSS `var(--color-maxx)` / palette primary  

Implemented in site: `components/BrandLogo.tsx`  
In-app reference: `components/orbit/choremaxx-logo.tsx` + `constants/brand-lockup.ts`

Font direction: **Bricolage Grotesque** for marketing/email chrome (same family as confirm-email). Do not swap to Inter/Roboto.

### 2.3 Email / inbox assets (fixed coral plate)

| Asset | Orbit | Site | Public URL when live |
|-------|-------|------|----------------------|
| In-email logo | `assets/brand/choremaxx-email-logo-mark.png` | `public/emails/logo-mark.png` | `https://www.choremaxx.app/emails/logo-mark.png` |
| Sender avatar 512² | `assets/brand/choremaxx-email-avatar.png` | `public/emails/sender-avatar.png` | `https://www.choremaxx.app/emails/sender-avatar.png` |

Emails currently fall back to GitHub raw on the Orbit tip (`emails/theme.ts` → `EMAIL_LOGO_URL`). After site deploy, prefer `EMAIL_LOGO_URL_SITE`.

Inbox avatar is **not** set by Resend API — see `docs/email-sender-avatar.md` (Gravatar / Apple Branded Mail / BIMI).

### 2.4 App icons (optional on marketing; do not use as wordmark)

Under `assets/brand/icons/`:

- `icon-{sky|citrus|coral|berry}.png`  
- `icon-*-dark.png`, `icon-*-tinted.png`, `icon-*-foreground.png`

App Store / Expo: `assets/images/icon.png`, `icon-light.png`, `icon-dark.png`, `splash-icon.png`.

### 2.5 Legacy — DO NOT USE ON THE WEBSITE

| Path | Why |
|------|-----|
| `assets/brand/orbit-logo-mark.png` | Old Orbit mark |
| `assets/brand/orbit-logo-lockup-dark.png` | Old Orbit lockup |
| `public/placeholder-logo.svg` / `.png` | Placeholder |
| `public/placeholder.svg` | Placeholder |
| Any checkmark-in-rounded-square “logo” | Superseded by house mark |

### 2.6 Brand kit for the other agent

Unpacked + zip:

- `/opt/cursor/artifacts/choremaxx-website-brand-kit/`  
- `/opt/cursor/artifacts/choremaxx-website-brand-kit.zip`

Copy into site as:

```
public/brand/choremaxx-logo-mark.png
public/brand/marks/choremaxx-mark-{coral,sky,citrus,berry}.png
public/emails/logo-mark.png
public/emails/sender-avatar.png
```

---

## 3. Palette logic (website vs app)

### 3.1 Four palettes (shared tokens)

| ID | Primary (maxx) | Secondary / chore | Mark file |
|----|----------------|-------------------|-----------|
| `coral` | `#D85A30` | chore `#C4922A`, sparkle `#FAC775` | `choremaxx-mark-coral.png` |
| `sky` | `#378ADD` | chore `#C4922A`, gold `#FAC775` | `choremaxx-mark-sky.png` |
| `citrus` | `#EF9F27` | chore `#712B13` | `choremaxx-mark-citrus.png` |
| `berry` | `#7F77DD` | chore `#C4789A`, pink `#F4C0D1` | `choremaxx-mark-berry.png` |

Authoritative site module: **`site/lib/palettes.ts`**  
App lockup: **`constants/brand-lockup.ts`** + **`constants/choremaxx-brand.ts`**

### 3.2 Website rotation (required behavior)

- One palette **per browser session** (`sessionStorage` key `choremaxx-site-palette`).  
- Prefer **not** repeating the previous visit (`localStorage` `choremaxx-site-palette-last`).  
- Pre-paint boot script: `siteThemeBootScript()` injected in `app/layout.tsx` (avoids FOUC).  
- React mirror: `components/SiteThemeProvider.tsx`.  
- Logo marks: all four PNGs stacked; CSS `html[data-palette]` shows the active mark (`BrandLogo`).

CSS variables to keep in sync:

```
--color-primary, --color-primary-dark, --color-primary-light
--color-secondary, --color-chore, --color-maxx
--color-bg-wash, --color-blob-a, --color-blob-b
--color-primary-rgb
```

### 3.3 App (do not change from the website)

iOS palette is **user-chosen in Settings**. Marketing may say “pick a look” — never “we randomize your app colors.”

---

## 4. Site architecture & logic the agent must preserve

### 4.1 Repo / branch

- GitHub: `https://github.com/Djoek47/Choremaxx-Website`  
- Local tip often on: `cursor/website-brand-palettes-5f8f`  
- Deploy target: Vercel → `www.choremaxx.app`  
- Stack: Next.js App Router, Tailwind, client theme provider  

### 4.2 Routes (expected)

| Route | Purpose |
|-------|---------|
| `/` | Marketing home — brand-first hero |
| `/how-it-works` | Plain English |
| `/features` | Modules |
| `/download` | App Store CTA |
| `/support` | FAQ + contact |
| `/privacy` | Legal (ASC) |
| `/terms` | Legal (ASC) |
| `/cookies` | Cookie notice |
| `/copyright` | Copyright |
| `/kids` | Kids / parental |
| SEO landings | `/household-os`, `/family-chore-app`, `/ai-family-organizer`, … |
| `/join/[code]` | Invite landing → `choremaxx://join/CODE` + App Store fallback |
| `/auth/callback` | Email confirm bridge → `choremaxx://auth/callback?token_hash=…` |

### 4.3 Invite bridge logic (`/join/[code]`)

1. Normalize code uppercase.  
2. Auto-redirect (short delay) to `choremaxx://join/{code}`.  
3. CTA “Open in Choremaxx” same scheme.  
4. Fallback App Store: `https://apps.apple.com/app/id6796850110`.  
5. Calm, minimal card — coral wordmark default is fine on this page (or respect visit palette).

### 4.4 Auth email bridge (`/auth/callback`) — critical

**Problem we fixed in-app:** Supabase verify → custom scheme often **drops `#access_token`**, leaving a forever spinner.

**Website job:**

1. Accept query: `token_hash`, `type`, optional `code` / tokens.  
2. Also read `location.hash` if Supabase still redirects with fragments.  
3. Forward to `choremaxx://auth/callback?token_hash=…&type=…` (query, **not** hash).  
4. Show calm “Opening Choremaxx…” + fallback button.  
5. `robots: noindex`.

Local implementation: `site/app/auth/callback/page.tsx` (commit `99b2563` on site branch — may be unpushed).

Orbit app handler: `app/auth/callback.tsx` (verifyOtp + success/continue states).  
Edge emails: `supabase/functions/send-auth-email` builds `choremaxx://…?token_hash=` (or HTTPS when redirect_to is choremaxx.app).

### 4.5 Universal Links / AASA

File: `public/.well-known/apple-app-site-association` (no extension, `application/json`).

Must include:

- `/join/*`  
- `/auth/callback` (+ optional `/auth/callback/*`)  
- `appIDs`: `R98S6HMKZL.app.choremaxx.household`

Also: `public/.well-known/assetlinks.json` for Android.

**Note:** App `associatedDomains` already lists `applinks:choremaxx.app` + `www`. New native build may be required before Universal Links open the app cold; custom scheme still works today.

### 4.6 Headers / next.config

Ensure `/.well-known/*` is served with correct content-type and not blocked by redirects. See `site/next.config.mjs`.

---

## 5. Weekend plan items owned by the website agent

From `docs/weekend-ship-automation.md` + `docs/next-session.md`:

### A1 — Website URLs + legal live

- [ ] Push `Choremaxx-Website` (write-access machine)  
- [ ] Vercel production on **`https://www.choremaxx.app`**  
- [ ] Verify live: `/privacy`, `/terms`, `/support`, `/download`  
- [ ] Confirm ASC / EAS env can use those URLs (`EXPO_PUBLIC_PRIVACY_URL`, `EXPO_PUBLIC_TERMS_URL`)  
- [ ] Favicon + OG use house mark / current `og.png`  
- [ ] `/emails/logo-mark.png` and `/emails/sender-avatar.png` return **200** (coral house, not old tile)

### B4 — Site payment gates / copy

- [ ] CTAs match IAP: trial + $4.99/mo + $48/yr  
- [ ] Zero roommate-mode promises  
- [ ] Poppins naming everywhere  
- [ ] No “free forever” / competing price tables  

### Bridges (ship with A1)

- [ ] `/join/[code]` live + AASA  
- [ ] `/auth/callback` live + AASA  
- [ ] Smoke: open confirm link → bridge → app confirms (no infinite spinner)

### Optional polish

- [ ] Hero: brand-first, one CTA group, no dashboard clutter (Apple-calm)  
- [ ] Per-visit palette still works after deploy  
- [ ] Remove leftover `placeholder-logo*` from user-facing chrome  

---

## 6. Copy & visual direction (Apple-caliber)

- Radical simplicity; brand is hero-level on the homepage.  
- Soft washes from `--color-bg-wash` / blobs — not flat SaaS purple.  
- Sparse accent = active palette primary.  
- Large type, generous whitespace, Bricolage.  
- Functional beauty > decoration.  
- Screenshots: prefer real app UI under `public/screenshots/` when available.

Avoid: Inter default stacks, purple-on-white clichés, roommate lifestyle claims, Nova naming, fake social proof.

---

## 7. Sync checklist (Orbit → Website)

When Orbit regenerates marks:

```bash
# From Orbit repo
npm run generate:brand-marks

# Copy into website public/
cp assets/brand/choremaxx-logo-mark.png          ../Choremaxx-Website/public/brand/
cp assets/brand/marks/choremaxx-mark-*.png       ../Choremaxx-Website/public/brand/marks/
cp assets/brand/choremaxx-email-logo-mark.png    ../Choremaxx-Website/public/emails/logo-mark.png
cp assets/brand/choremaxx-email-avatar.png       ../Choremaxx-Website/public/emails/sender-avatar.png
```

Keep `lib/palettes.ts` hex values aligned with `constants/brand-lockup.ts` / `constants/choremaxx-brand.ts`.

---

## 8. File map (website — important paths)

```
site/
  app/
    layout.tsx                 # boot script + SiteThemeProvider + metadataBase www
    page.tsx                   # home
    join/[code]/page.tsx      # invite bridge
    auth/callback/page.tsx     # email confirm bridge
    privacy|terms|support|…    # legal + marketing
  components/
    BrandLogo.tsx              # 4 marks + wordmark
    SiteThemeProvider.tsx
    Header.tsx / Footer.tsx
  lib/palettes.ts              # rotation + CSS vars
  public/
    brand/marks/*.png
    emails/logo-mark.png
    emails/sender-avatar.png
    .well-known/apple-app-site-association
    .well-known/assetlinks.json
    og.png
  DEPLOYMENT.md
```

Orbit references:

```
constants/choremaxx-brand.ts
constants/brand-lockup.ts
assets/brand/**/*
emails/theme.ts
docs/resend-auth-email.md
docs/email-sender-avatar.md
docs/invites-airdrop.md
docs/site-copy-a1-patch.md
app/auth/callback.tsx
supabase/functions/send-auth-email/
```

---

## 9. Current local status (as of this handoff)

| Item | Status |
|------|--------|
| Site branch | `cursor/website-brand-palettes-5f8f` |
| Local commits (may be unpushed) | Palette rotation, join+AASA, email house mark, auth bridge `99b2563` |
| Orbit cloud push to website | Often **403 / invalid token** — human push required |
| Auth edge function | Deployed with `token_hash` deep links |
| App OTA | Expo Go + testflight OTAs for confirm UX |
| Brand kit artifact | `/opt/cursor/artifacts/choremaxx-website-brand-kit.zip` |

---

## 10. Agent prompt (paste to website agent)

```
You are shipping the ChoreMaxx marketing site (Djoek47/Choremaxx-Website).

Read and follow docs/website-agent-handoff.md from the Orbit repo (or the copy attached).

Rules:
1. Use ONLY the official house-mark PNGs (coral/sky/citrus/berry) + split wordmark chore/maxx.
2. Keep per-visit palette rotation (sessionStorage) — do not remove it.
3. Canonical host: https://www.choremaxx.app
4. Product locks: Poppins, families only, 7-day trial / $4.99/mo / $48/yr, allowance = tracker.
5. Ship /join/[code] and /auth/callback bridges + AASA paths.
6. Host /emails/logo-mark.png and /emails/sender-avatar.png from the coral house assets.
7. Do not use Orbit legacy logos or placeholder logos in chrome.
8. Push + redeploy Vercel; verify privacy/terms/support/emails URLs return 200.

Brand kit: choremaxx-website-brand-kit.zip (marks/, emails/, icons/).
```

---

## 11. Smoke tests after deploy

```bash
curl -I https://www.choremaxx.app/privacy
curl -I https://www.choremaxx.app/terms
curl -I https://www.choremaxx.app/emails/logo-mark.png
curl -I https://www.choremaxx.app/emails/sender-avatar.png
curl -I https://www.choremaxx.app/.well-known/apple-app-site-association
curl -I https://www.choremaxx.app/join/CMX-TEST
curl -I "https://www.choremaxx.app/auth/callback?token_hash=test&type=signup"
```

Manual:

1. Hard-refresh home twice → palette can change across sessions, stable within one.  
2. Logo house color matches wordmark maxx color.  
3. Invite link opens app or App Store.  
4. Auth confirm link opens app and leaves “Confirming…” (success or Continue — never infinite spinner).

---

*End of handoff. App weekend playbook remains `docs/weekend-ship-automation.md`; this file is the website slice.*
