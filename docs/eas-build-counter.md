# EAS / TestFlight build counter

Track **Expo iOS build slots** (account quota) and the **App Store `buildNumber`**.  
Update this file every time we cut or burn a build.

**Account:** `djoek47` (builds `@choremaxx-team/choremaxx`)  
**As of:** 2026-10-08 (user reported **45** slots after plan top-up)

---

## Live counters

| Meter | Value | Notes |
|-------|------:|-------|
| **EAS iOS slots remaining** | **42** | Started 45 → 123 + 124 + **125** |
| **Next App Store buildNumber** | **126** | Remote autoIncrement |
| **Latest shipped / in-flight** | **125** | make-v37 + v37-03 — finished + submitted to TestFlight |

### How to update after a cut

1. Decrement **EAS iOS slots remaining** by 1 (or by N if parallel).
2. Set **Latest** to the buildNumber EAS printed.
3. Set **Next** to Latest + 1 (unless a failed attempt burned a number without a build — note it in the log).
4. Append a row to the log below.

If Expo says quota exhausted, set remaining to **0** and stop cutting until topped up.

---

## Cut log (newest first)

| When (UTC) | buildNumber | Branch | EAS build | Result | Slots after |
|------------|------------:|--------|-----------|--------|------------:|
| 2026-10-08 | **125** | `cursor/make-v37-c30d` | [23e0cb50…](https://expo.dev/accounts/choremaxx-team/projects/choremaxx/builds/23e0cb50-dbf5-4c1e-8b35-b5ce48550a11) | finished + ASC submit [8cf4bae7…](https://expo.dev/accounts/choremaxx-team/projects/choremaxx/submissions/8cf4bae7-76c5-4b1d-80b8-7bd4a8d50400) | **42** |
| 2026-10-08 | **124** | `cursor/make-v37-c30d` | [73613804…](https://expo.dev/accounts/choremaxx-team/projects/choremaxx/builds/73613804-113e-46fa-9b12-d2169ec56058) | in progress → ASC submit [d585bf03…](https://expo.dev/accounts/choremaxx-team/projects/choremaxx/submissions/d585bf03-20f7-429c-b79a-6c4bf1222562) | **43** |
| 2026-10-08 | **123** | `cursor/make-v37-c30d` | [3aff88a9…](https://expo.dev/accounts/choremaxx-team/projects/choremaxx/builds/3aff88a9-4f1a-495e-ab8b-6e025588c3aa) | finished (v36-01 only — before v37-01) | **44** |
| 2026-10-08 | **122** | `cursor/make-v37-c30d` | — | **burned** — free-plan quota refused after number increment | (pre top-up) |
| 2026-10-07 | **121** | `cursor/make-v36-c30d` | [9d650e20…](https://expo.dev/accounts/choremaxx-team/projects/choremaxx/builds/9d650e20-249f-4214-ae59-67b73434b9b2) | finished + submitted | — |
| 2026-10-07 | **120** | `cursor/make-v35-c30d` | [fbf0926f…](https://expo.dev/accounts/choremaxx-team/projects/choremaxx/builds/fbf0926f-6f4a-4d9e-89ba-7947b2c8b653) | finished + submitted | — |

---

## Notes

- Remote `appVersionSource: remote` + `autoIncrement` advances `buildNumber` even when the build later fails (see **122**).
- Free-plan month reset was cited as **2026-11-01** before the top-up; prefer this counter over guessing.
- Project: https://expo.dev/accounts/choremaxx-team/projects/choremaxx  
- Billing: https://expo.dev/accounts/choremaxx-team/settings/billing  
