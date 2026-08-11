# Next session — v11 TestFlight + Realtime Interactive Menus

**Playbook:** [`docs/weekend-ship-automation.md`](./weekend-ship-automation.md)  
**Tonight:** [`choremaxx-make-v11.md`](./choremaxx-make-v11.md) — TestFlight **1.1.0 build 32**  
**Tomorrow:** [`realtime-interactive-menus.md`](./realtime-interactive-menus.md) — **Phase C1**  
**Branch:** `cursor/choremaxx-make-v11` → [PR #33](https://github.com/Djoek47/Orbit/pull/33)

## Tonight (TestFlight smoke)

1. Install **build 32** (1.1.0) from ASC  
2. Poppins Connect → tools → confirm sheet → idle hangup  
3. House Rules + auth flows as needed  
4. Note gaps for tomorrow’s interactive menu work  

## Tomorrow (Phase C1 — Realtime Interactive Menus)

1. **C1.1** — `PoppinsUiOrchestrator` + `usePoppinsUiDrive()` session bus  
2. **C1.2** — Tasks: create-task prefill animation, row highlight, assignment sheet  
3. **C1.3** — Plan: itinerary stop advance, calendar agenda highlight  
4. **C1.4** — Mini rail + orb sync on driven tabs  
5. **C1.5** — Wire voice + text `ui_actions`; update test matrix  

Say: *Implement Phase C1 from docs/realtime-interactive-menus.md on cursor/choremaxx-make-v11*

## Still open from weekend playbook (when not blocked on C1)

1. **A3 ASC** — IAP products from [`asc-iap-setup.md`](./asc-iap-setup.md)  
2. **A2 live smoke** — Auth Send Email Hook  
3. **A1 / B4 site** — [`website-agent-handoff.md`](./website-agent-handoff.md)  
4. **B5** — billing emails after A3  
5. **B6** — full device retest  
6. **B7** — App Review submit  

## Do not redo

- v11 aggregate (v10 + auth + house rules + Divine Voice)  
- Final Revision F core gates · House Rules · Canada grocery · Smart Shopping  
- Edge deploys for Poppins Realtime SDP + voice-tool on staging  
