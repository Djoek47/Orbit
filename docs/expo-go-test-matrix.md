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
| 1b | Auth Make UI | Welcome opening animation · centered “Run the household” · Get Started / Sign in · **sign-in success brand beat** · profile · create/join household · pending approval | ☐ |

| 30a | Slim onboarding roles | Who are you? title + one-line subtitle only (no perk chips) · Shared/tablet “One device · several profiles” · Child “Join with a parent invite” | ☐ |
| 30b | Member permissions | Settings (admin) → Member permissions: redeem · special request · grocery add · calendar create | ☐ |
| 30c | Rewards member shop | As child: Redeem only · no Mint/Archive/tally · Request special only when toggle on | ☐ |
| 30d | Kid Plan / create event | Child events filtered to theirs · simplified create (title/when/place) when calendar create allowed | ☐ |
| 30e | Create Task shared + library | Shared device tablet card · hold to split · Quick 12 + Browse library search/domains | ☐ |
| 6i | Rewards shop + tally | Ranks shop · Mint admin-only · special request gated by Member permissions · Redeem tally admin · member Redeem only when allowed | ☐ |
| 6j | Task presets + library | Create Task quick 12 + Browse library (136) · Customize quick set · overdue Reassign still works | ☐ |
| 6k | Badge gallery + Home fire streak | Badge gallery Material icons + polished tiles · Home Today’s Tasks fire-edge progress · per-person chips · daily streak on full completion | ☐ |
| 2 | Create household | New household → Manage Members → Add new member shows invite code | ☐ |
| 3 | QR invite | Device A: Manage Members → Add new member QR · Device B scans → code fills join | ☐ |
| 4 | Pending join | Device B joins → lands on Pending Approval · limited Home | ☐ |
| 5 | Approve member | Device A opens Members → Approve → Device B refreshes → full tabs | ☐ |
| 6 | Tasks | Create → edit → complete → week XP moves on Ranks | ☐ |
| 6b | Tasks Make UI | Tasks tab · filter chips · room filter · emoji assignee · complete celebration · open detail sheet | ☐ |
| 6c | Tasks by person (admin) | As Sarah/David · Tasks All → My tasks + David/Liam/Emma sections with N of M complete | ☐ |
| 6d | Shared tablet accounts | Settings → Members → Shared tablet shows Josh & Todd underneath · switch Josh/Todd (own XP) · Create task → Shared tablet → pick Josh → “Clean dishes - Josh” · Home “Shared tablet · Name ▾” / avatar opens persona popup | ☐ |
| 6f | Persona switch + personal themes | Home avatar or Shared tablet chip → popup → switch Josh↔Todd · accent color + greeting type weight change · Settings Your look sets personal theme · admin Household default separate · persists after reload | ☐ |
| 6g | Shared tablet kid Home/Tasks | As Josh: Home hides week leaderboard / groceries · My progress (tasks/streak/trophy) · personal XP · Rewards shortcut · Tasks mine-only · “Who’s on” profile picker | ☐ |
| 6l | Admin remove + create shared device | Settings → Manage Members → Create shared device · link people · Remove member / Remove device · profile codes shown (CMX-JOSH) | ☐ |
| 6m | Kid multi-profile device | Welcome or Settings → Set up profiles · enter/scan CMX-JOSH + CMX-TODD · Continue → Who’s logging in? · pick Josh → kid Home · sign out/in asks again | ☐ |
| 6h | Ranks shared tablet people | Ranks shows Josh & Todd as separate rows with their own XP · Shared tablet chip next to each name · tablet shell itself is not a ranked person | ☐ |
| 6e | Split multi-assign | Create task → long-press Emma then tap Liam → split · each finishes for own XP · all-done bonus · admin Penalize on pending share | ☐ |
| 7 | Task delete | Open task → Delete → removed from Tasks list | ☐ |
| 8 | Groceries | Add missing → mark purchased · mark available item Low | ☐ |
| 9 | Plan / Calendar | Plan tab → Calendar → create event · **Build trip for this day** when day has stops | ☐ |
| 10 | Itinerary Maps | Plan → Itineraries → open trip → Open full trip · Arrived → next on active stop | ☐ |
| 11 | Nova suggest trip | Plan → Itineraries → Ask Nova (Efficient/Spread) → trip from events + groceries | ☐ |
| 11b | Create trip | Plan → New → calendar chips + places + reorder · Optimize with Nova · Create trip | ☐ |
| 11c | Preferred routines | Save preferred on trip detail · Preferred section → Run again | ☐ |
| 12 | Barcode grocery | Groceries (Home/Settings) → Scan barcode → mock catalog match OR Open Food Facts (ingredients/allergens/Nutri-Score) → Add to cart | ☐ |
| 12b | Barcode online | Airplane mode off · scan unknown UPC → Open Food Facts result card (quality/allergens/ingredients) · Add to cart | ☐ |
| 12c | Grocery uncheck | Groceries → check item Purchased → uncheck → status returns to Missing | ☐ |
| 13 | Preferred store | Adult sets preferred store · Start store itinerary | ☐ |
| 29a | Accent themes | Settings → Your look · pick personal theme (incl. forest/slate/amber/violet) · tab active + OrbitButton + header chips tint · type vibe label under swatch · persists after reload | ☐ |
| 29n | Light/dark + background | Settings → Appearance Dark/Light/System · Background packs (Midnight/Dusk/Paper/Mist/Contrast) under Your look · Household default folded under Your look (admin) · Preferred maps Auto/Apple/Google/Waze | ☐ |
| 29o | Multi-stop itineraries | Plan → New trip · places + today events + nearby · pass-by hint · Open full trip · Preferred · Recent · Run again | ☐ |
| 29p | Shopping mode + near shop | Groceries → Shopping mode · large checkboxes only · Settings Near shop / Missing on the way · foreground near-shop local notify (Expo Go best-effort) | ☐ |
| 29b | Member avatars | Settings → Members → emoji picker · avatar persists on Health / Ranks / Home / Create Task | ☐ |
| 29c | Rooms | Settings → Rooms add/remove · persists after reload · Create Task presets show room · Health cleaning strip | ☐ |
| 29d | Grocery Missing Item | Groceries → + → expanded categories + qty + storage location + note · Save | ☐ |
| 29e | Household Health | Role metrics: Admin Completion/Fairness/Streak · Kid My tasks/Streak/Next trophy · Roommate Completion/Open chores/Grocery · no Grocery/Plan bars on admin card | ☐ |
| 29f | Soft budget | Groceries progress · est. total includes checked items · leftover/over vs soft budget | ☐ |
| 29h | Auth chrome | Sign-in shows one Back · no Stack double header · logo + Sign in title | ☐ |
| 29i | Keyboard forms | Welcome account/profile/household · auth · add-grocery · settings · CTA stays above keyboard | ☐ |
| 29j | Header chips gutter | Home/Tasks/Plan/Ranks/Nova/Groceries titles never under Settings/Notifications (gutter 148) | ☐ |
| 29k | Photo / Memoji avatar | Settings → Members → Photo / Memoji · shows on Home | ☐ |
| 29l | Household Games | Ranks → Household Games · coming-soon cards by vibe | ☐ |
| 29m | Grocery product lookup | Groceries search milk · $/L · $/gal · Open in Maps · Add to list | ☐ |
| 14 | Share invite | Settings → Manage Members → Add new member · Share · Copy · QR | ☐ |
| 15 | Task presets | Create Task → pick preset · weight XP · optional proof · recurring spawn | ☐ |
| 15b | Attach proof | Task detail → Attach proof (camera/library) → admin gets inbox + local notify · Approve proof | ☐ |
| 15c | Two admins + split | Members → Make co-admin (max 2) · Tasks → Split open tasks between Sarah & David · Two admins filter | ☐ |
| 15d | Home week XP + layout | Home “This week” lean board (top 5 · slim bars · Ranks link) · full-width Home/Groceries | ☐ |
| 15e | Cancel task (admin) | Task detail → Cancel · this occurrence or this+future · works when overdue · not delete | ☐ |
| 15f | App icon / splash | Cold start shows Choremaxx mark on splash + home icon | ☐ |
| 15g | Header logo mark | Sticky chrome uses transparent house mark (no dark plate) on frosted glass | ☐ |
| 16 | Late XP | Complete overdue task · celebration shows penalty · Nova ai notification | ☐ |
| 17 | Rewards mint | Admin Mint reward · special request · approve/reject on Ranks | ☐ |
| 18 | Streaks / achievements | Complete task · streak bumps · achievements grid live | ☐ |
| 19 | Nova notifications | Settings toggles · inbox Nova filter · deep link to task/itinerary | ☐ |
| 20 | Rewards shop | Hold-to-claim Instant (auto-spend XP + notify) · Approval queues request · admin Approve/Reject | ☐ |
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
