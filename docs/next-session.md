# Next session — weekend App Store ship (in progress)

**Playbook:** [`docs/weekend-ship-automation.md`](./weekend-ship-automation.md)  
**Report:** [`WEEKEND_SHIP_COMPLETION_REPORT.md`](./WEEKEND_SHIP_COMPLETION_REPORT.md)  
**Branch:** `cursor/choremaxx-make-v10-5f8f` → [PR #29](https://github.com/Djoek47/Orbit/pull/29)

## Continue here (order)

1. **A3 ASC** — create IAP products from [`asc-iap-setup.md`](./asc-iap-setup.md) (human in App Store Connect)
2. **A2 live smoke** — enable Auth Send Email Hook; signup → `choremaxx://auth/callback`
3. **A6 device** — Poppins chat in TestFlight #27 (edge already green)
4. **A1 / B4 site** — website agent handoff: [`website-agent-handoff.md`](./website-agent-handoff.md) + brand kit `/opt/cursor/artifacts/choremaxx-website-brand-kit.zip`. Push `Choremaxx-Website` from a machine with write access; redeploy Vercel
5. **B5** — wire billing emails after A3 products fire events
6. **B6** — full device retest
7. **B7** — App Review submit
8. **LAST — key rotations** — Resend + OpenAI (+ hook secret if needed); see playbook Final section

## Do not redo

- Final Revision F core gates · House Rules · Canada grocery · Smart Shopping
- In-repo A1 legal · A2/A6 edge deploys · A4/A5/A7 unit greens
