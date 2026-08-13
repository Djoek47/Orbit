# Next session — v13 final push

**Tonight’s aggregate:** [`choremaxx-make-v12.md`](./choremaxx-make-v12.md) — TestFlight **1.2.0**  
**Tomorrow:** cut **v13** from `cursor/choremaxx-make-v12` and ship the final app.  
**Branch:** `cursor/choremaxx-make-v12` → PR into `main`

## Tomorrow (v13)

1. Branch `cursor/choremaxx-make-v13` off `cursor/choremaxx-make-v12` (do not start from v11 / v7).
2. Bump `app.json` version to `1.3.0` and `BUILD_INFO` to `make-v13 · final`.
3. `npm run testflight:preflight` then `npm run build:ios:testflight` / `submit:ios:testflight`.
4. Device smoke: Poppins WebRTC, IUI HOLD, House Rules 4 directions × Admin/Sidekick, places, homework, expired tasks.
5. Close leftover ops only: Luna edge model, MapView native IPA, email-confirm site bridge, ASC IAP, App Review.

Say: *Cut v13 from cursor/choremaxx-make-v12 and ship the final TestFlight.*

## Do not redo

- v12 aggregate (IUI, Luna, Assign/Event, Poppins quality, House Rules HTML Admin/Sidekick)
- v11 Divine Voice + auth + v10 billing / grocery / Rev F gates
- Re-porting Figma Make or collapsing House Rules to the kid card
