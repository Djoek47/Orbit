# Expo Go test matrix

Manual verification for Orbit MVP loops. Run with `npm run start:tunnel` when Metro is on a remote VM; use `npm run start:lan` on the same Wi‑Fi as your phone.

## Prerequisites

- `.env` copied from `.env.example`
- For live AI + join persistence: `EXPO_PUBLIC_DATA_MODE=supabase` + Supabase URL/anon key
- Edge functions deployed per [supabase-staging-setup.md](./supabase-staging-setup.md)

## Checklist

| # | Flow | Steps | Pass |
|---|------|-------|------|
| 1 | Auth | Sign up → create profile → sign out → sign in | ☐ |
| 1b | Auth Make UI | Welcome brand hero · Sign in/up sheets · profile avatar pick · create/join household paths · pending approval | ☐ |
| 2 | Create household | New household → invite code visible on Invite | ☐ |
| 3 | QR invite | Device A shows QR · Device B scans → code fills join screen | ☐ |
| 4 | Pending join | Device B joins → lands on Pending Approval · limited Home | ☐ |
| 5 | Approve member | Device A opens Members → Approve → Device B refreshes → full tabs | ☐ |
| 6 | Tasks | Create → edit → complete → week XP moves on Ranks | ☐ |
| 6b | Tasks Make UI | Tasks tab · filter chips · room filter · emoji assignee · complete celebration · open detail sheet | ☐ |
| 6c | Tasks by person (admin) | As Sarah/David · Tasks All → My tasks + David/Liam/Emma sections with N of M complete | ☐ |
| 7 | Task delete | Open task → Delete → removed from Tasks list | ☐ |
| 8 | Groceries | Add missing → mark purchased · mark available item Low | ☐ |
| 9 | Plan / Calendar | Plan tab → Calendar sub-nav → create event → day strip with real dates | ☐ |
| 10 | Itinerary Maps | Plan → Itineraries → open trip → Open in Maps · Arrived → next leg | ☐ |
| 11 | Nova suggest trip | Plan → Suggest trip with Nova → itinerary created from events + groceries | ☐ |
| 12 | Barcode grocery | Groceries (Home/Settings) → Scan barcode → mock catalog match OR Open Food Facts (ingredients/allergens/Nutri-Score) → Add to cart | ☐ |
| 12b | Barcode online | Airplane mode off · scan unknown UPC → Open Food Facts result card (quality/allergens/ingredients) · Add to cart | ☐ |
| 12c | Grocery uncheck | Groceries → check item Purchased → uncheck → status returns to Missing | ☐ |
| 13 | Preferred store | Adult sets preferred store · Start store itinerary | ☐ |
| 29a | Accent themes | Settings → pick accent theme · tab active + OrbitButton + header chips + grocery CTAs tint · persists after reload | ☐ |
| 29b | Member avatars | Settings → Members → emoji picker · avatar persists on Health / Ranks / Home / Create Task | ☐ |
| 29c | Rooms | Settings → Rooms add/remove · persists after reload · Create Task presets show room · Health cleaning strip | ☐ |
| 29d | Grocery Missing Item | Groceries → + → expanded categories + qty + storage location + note · Save | ☐ |
| 29e | Household Health | Home → Household Health sheet · Completion/Grocery Load/Plan Load · member load · cleaning by room | ☐ |
| 29f | Soft budget | Groceries progress · est. total includes checked items · leftover/over vs soft budget | ☐ |
| 29h | Auth chrome | Sign-in shows one Back · no Stack double header · logo + Sign in title | ☐ |
| 29i | Keyboard forms | Welcome account/profile/household · auth · add-grocery · settings · CTA stays above keyboard | ☐ |
| 29j | Header chips gutter | Home avatar + Groceries + not covered by Settings/Notifications | ☐ |
| 29k | Photo / Memoji avatar | Settings → Members → Photo / Memoji · shows on Home | ☐ |
| 29l | Household Games | Ranks → Household Games · coming-soon cards by vibe | ☐ |
| 29m | Grocery product lookup | Groceries search milk · $/L · $/gal · Open in Maps · Add to list | ☐ |
| 14 | Share invite | Create household → Invite · Share primary · Copy · QR tertiary | ☐ |
| 15 | Task presets | Create Task → pick preset · weight XP · optional proof · recurring spawn | ☐ |
| 15b | Attach proof | Task detail → Attach proof (camera/library) → admin gets inbox + local notify · Approve proof | ☐ |
| 15c | Two admins + split | Members → Make co-admin (max 2) · Tasks → Split open tasks between Sarah & David · Two admins filter | ☐ |
| 15d | Home week XP + layout | Home hero shows per-member week XP bars · Home/Groceries full-width (not left-locked) | ☐ |
| 15e | Cancel task (admin) | Task detail → Cancel · this occurrence or this+future · works when overdue · not delete | ☐ |
| 15f | App icon / splash | Cold start shows Choremaxx mark on splash + home icon | ☐ |
| 16 | Late XP | Complete overdue task · celebration shows penalty · Nova ai notification | ☐ |
| 17 | Rewards mint | Admin Mint reward · special request · approve/reject on Ranks | ☐ |
| 18 | Streaks / achievements | Complete task · streak bumps · achievements grid live | ☐ |
| 19 | Nova notifications | Settings toggles · inbox Nova filter · deep link to task/itinerary | ☐ |
| 20 | Rewards shop | Redeem reward → parent Approve/Reject on Ranks | ☐ |
| 21 | Nova text | Ask 3 questions · thread persists after leaving Nova tab | ☐ |
| 22 | Nova voice | Hold mic on Nova · spoken reply (Whisper fallback; Realtime when `EXPO_PUBLIC_NOVA_REALTIME=1`) | ☐ |
| 23 | Notifications | Unread badge on Home · open item · mark read | ☐ |
| 24 | Realtime | Complete task on A · B sees update without manual refresh (supabase) | ☐ |
| 25 | Nova Monitor | Open Nova → Activity shows nudges/deals/plans · Settings toggles deals/plans/XP fairness | ☐ |
| 26 | Run Nova check | Nova → Run Nova check · inbox + Activity update without OpenAI (mock) | ☐ |
| 27 | Mock deals | Groceries → Nova deals strip shows food + non-food from mock catalog | ☐ |
| 28 | Holiday skip | Member with away dates · Monitor skips nudges for them | ☐ |

## Automated checks (CI / agent)

```bash
npm run typecheck
npm run lint
```

## Known Expo Go limits

- Voice uses Whisper via `nova-voice` edge function when `EXPO_PUBLIC_NOVA_AI=openai` or supabase mode.
- OpenAI Realtime (`EXPO_PUBLIC_NOVA_REALTIME=1`) uses WebSocket + Whisper STT bridge in Expo Go; PCM mic streaming needs a custom Dev Client later if native audio quality is insufficient.
- Monitor Agent mock pass runs locally; live `nova-monitor` edge + cron needs service role + OpenAI secret.
- Universal links (`https://orbit.app/join/*`) need hosted redirect + EAS associated domains for production; custom scheme `orbit://join/CODE` works in dev.
