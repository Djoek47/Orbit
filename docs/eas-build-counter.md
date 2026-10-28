# EAS / TestFlight build counter

Track **Expo iOS build slots** (account quota) and the **App Store `buildNumber`**.  
Update this file every time we cut or burn a build.

**Account:** `djoek47` (builds `@choremaxx-team/choremaxx`)  
**As of:** 2026-10-08 (user reported **45** slots after plan top-up)

---

## Live counters

| Meter | Value | Notes |
|-------|------:|-------|
| **EAS iOS slots remaining** | **37** | Started 45 → … + **130** (make-v41 App Review cutting) |
| **Next App Store buildNumber** | **131** | Remote autoIncrement |
| **Latest shipped / in-flight** | **130** | make-v41 App Review — cutting |

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
| 2026-10-28 | **130** | `cursor/make-v41-c30d` | [a07537fa…](https://expo.dev/accounts/choremaxx-team/projects/choremaxx/builds/a07537fa-628e-4363-be7b-71cfc08548f3) | queued + ASC submit [c5268f15…](https://expo.dev/accounts/choremaxx-team/projects/choremaxx/submissions/c5268f15-f1e3-472b-acfd-0b4f3b04c299) | **37** |
| 2026-10-20 | **129** | `cursor/make-v40-c30d` | [928156c2…](https://expo.dev/accounts/choremaxx-team/projects/choremaxx/builds/928156c2-83a1-452a-ba98-688f005e374c) | finished + ASC submit [066831c0…](https://expo.dev/accounts/choremaxx-team/projects/choremaxx/submissions/066831c0-57e9-4f63-9ed1-a2d5001a6719) | **38** |
| 2026-10-18 | **128** | `cursor/make-v39-c30d` | [c6897bbd…](https://expo.dev/accounts/choremaxx-team/projects/choremaxx/builds/c6897bbd-d436-4697-87e6-e506760e54ab) | finished + ASC submit [14dd395d…](https://expo.dev/accounts/choremaxx-team/projects/choremaxx/submissions/14dd395d-e749-4382-8cbb-34f0cb30cac1) | **39** |
| 2026-10-18 | **127** | `cursor/make-v39-c30d` | [90c99cc9…](https://expo.dev/accounts/choremaxx-team/projects/choremaxx/builds/90c99cc9-b31b-4a68-bb73-a168b70796bb) | **ERRORED** — Associated Domains vs App Store profile | **40** |
| 2026-10-13 | **126** | `cursor/make-v38-c30d` | [75c6c07a…](https://expo.dev/accounts/choremaxx-team/projects/choremaxx/builds/75c6c07a-304f-43d7-89c9-533244c83439) | finished + ASC submit [7e2e4408…](https://expo.dev/accounts/choremaxx-team/projects/choremaxx/submissions/7e2e4408-1778-4c7b-a07a-a067a2c77f03) | **41** |
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
