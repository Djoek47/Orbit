# A1 / B4 — Marketing site copy patch (external)

**Live site:** https://choremaxx.vercel.app/  
**Source:** not in the Orbit repo — apply in the Vercel/marketing project.

## Must change (families-only + Poppins)

| Area | Current (wrong) | Target |
|------|-----------------|--------|
| AI name | “Nova”, “AI Assistant” as product name | **Poppins** (co-manager) |
| Modes | Parents / **Roommates** / Couples / … | **Families only** — remove Roommates mode and roommate testimonials |
| FAQ “roommates” | “dedicated Roommates mode…” | Remove or replace with family/helper roles |
| Pricing | Free / Premium $4.99 / Family $8.99 | Align with Apple IAP: **7-day trial · $4.99/mo · $48/yr** (drop conflicting Free/Family SKUs until product decides) |
| Privacy/Terms pages | Still say Nova | Re-host from `docs/legal/*` (updated 2026-08-10) |

## Privacy & Terms re-host

Replace hosted `/privacy` and `/terms` content with:

- `docs/legal/privacy-policy.md`
- `docs/legal/terms-of-service.md`

## Support

Keep `support@choremaxx.app` (mailto). Optional: add `/support` that mailto-redirects.
