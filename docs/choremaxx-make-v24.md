# Choremaxx Make v24

**Branch:** `cursor/make-v24` — **canonical shipping line**  
**Follows:** `cursor/make-v23` at TestFlight **1.3.0 (81)** (`17645a3`, recorded in `856f5d5`)

Everything landed after that release is on this branch. Do not keep shipping from the stacked `cursor/*-c30d` lines.

## Included since TestFlight 1.3.0 (81)

| Source | What |
|---|---|
| `cursor/make-v23` after the cut | Coach card scroll, Assign unstick |
| `cursor/tour-home-scroll-c30d` | Home pans under the coach card on iOS |
| `cursor/tour-assign-fix-c30d` | Assign overlay stall + practice chore on skip |
| `cursor/tour-itineraries-c30d` | Itinerary / rewards / Poppins tour chapters |
| `cursor/wo10-launch-c30d` | Quiet capture, local confirm, grocery rules, multi-stop trips |
| `cursor/wo11-fluidity-c30d` | Multi-act cards, one HOLD, turn undo, chain continuity |
| `cursor/wo12-iui-stage-c30d` | IUI stage, slot order, coach how-to, trouble states |
| make-v24 tip | Board visuals + UI audit (light-card AA, batch `IuiCard`, ModelDown, chips a11y) |

## TestFlight

| Build | Git | EAS build | Submit |
|-------|-----|-----------|--------|
| **1.3.0 (82)** queued | `cursor/make-v24` @ `6f683b0` | [b7b3b78b](https://expo.dev/accounts/djoek47/projects/choremaxx/builds/b7b3b78b-55f4-4190-b1aa-ab06effe3815) — IUI audit P1 contrast + P2 seams | [93075466](https://expo.dev/accounts/djoek47/projects/choremaxx/submissions/93075466-dd88-45f9-be40-5adc63a70ba6) auto-submit |

## Verify

Settings build tip: `cursor/make-v24 · 6f683b0`  
Tour: Home and info steps scroll under the card; Assign does not stall; skip seeds a practice chore.  
Poppins: batch grocery/task cards, slot order follows the sentence, “show me how” costs 0 actions.  
Light theme: domain kickers / “All set” / faint footers ≥4.5:1 on the white card.
