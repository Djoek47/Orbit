# Itinerary live banner (replaces Lock Screen shopping banner)

The grocery-only Lock Screen shopping banner was removed (unstable). Trips now own
the Live Activity: **Uber / Waze style** distance → arrival → list / next stop.

## Flow

1. Start a trip (status `active`) and open Directions — `TripLiveWatcher` tracks GPS.
2. Banner head: `Stop 1 of 3 · 840 m · Metro` while en route.
3. Within ~120 m → `Arrived` (or `Arrived · open list` for grocery/shop stops).
4. Tap the Lock Screen / notification:
   - Grocery stop → `/shopping-mode`
   - Other stop → `/itinerary/{id}` → mark **I’m done · next**
5. Advancing a stop opens the next stop in the preferred maps app (existing store logic).

## Pieces

| Piece | Role |
| --- | --- |
| `TripLiveWatcher` | Foreground GPS + banner updates + arrival notify |
| `trip-live-session` | Shared arrived / distance for the itinerary screen |
| `trip-banner-copy` | Banner protocol (distance + shopping hint) |
| `trip-live-activity` | expo-live-activity start/update/stop |

Shopping-mode Lock Screen check-off stays available if an older banner is still up;
new runs use the trip banner only.
