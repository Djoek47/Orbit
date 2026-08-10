# A1 / B4 — Marketing site copy patch

**Live site:** https://choremaxx.vercel.app/  
**Source repo:** https://github.com/Djoek47/Choremaxx-Website  
**Local working copy:** `/workspace/site` (nested clone — ignored by Orbit `.gitignore`)  
**Zip artifact:** `/opt/cursor/artifacts/choremaxx-website-a1.zip`  
**Do not push** the website repo until you say so.

## Applied locally (commit `68a754d` on site `main`)

| Area | Change |
|------|--------|
| AI name | Nova / AI Assistant → **Poppins** |
| Modes | Removed roommate mode; families / helpers / blended |
| Pricing | **7-day trial · $4.99/mo · $48/yr** (dropped Free / $8.99 Family) |
| Privacy / Terms | Re-hosted from Orbit `docs/legal/*` (2026-08-10) |
| Email logo | `public/emails/logo-mark.png` for Resend templates |

## When ready to ship the site

```bash
cd site
git push origin main   # or open a PR on Choremaxx-Website
# then redeploy Vercel
```

