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
| 2 | Create household | New household → invite code visible on Invite | ☐ |
| 3 | QR invite | Device A shows QR · Device B scans → code fills join screen | ☐ |
| 4 | Pending join | Device B joins → lands on Pending Approval · limited Home | ☐ |
| 5 | Approve member | Device A opens Members → Approve → Device B refreshes → full tabs | ☐ |
| 6 | Tasks | Create → edit → complete → week XP moves on Ranks | ☐ |
| 7 | Task delete | Open task → Delete → removed from Tasks list | ☐ |
| 8 | Groceries | Add missing → mark purchased · mark available item Low | ☐ |
| 9 | Calendar | Create event → optional reminder → appears on Calendar | ☐ |
| 10 | Rewards | Redeem reward → parent Approve/Reject on Ranks | ☐ |
| 11 | Nova text | Ask 3 questions · thread persists after leaving Nova tab | ☐ |
| 12 | Nova voice | Talk to Nova · spoken reply (needs live OpenAI on edge) | ☐ |
| 13 | Notifications | Unread badge on Home · open item · mark read | ☐ |
| 14 | Realtime | Complete task on A · B sees update without manual refresh (supabase) | ☐ |

## Automated checks (CI / agent)

```bash
npm run typecheck
npm run lint
```

## Known Expo Go limits

- Voice uses Whisper via `nova-voice` edge function when `EXPO_PUBLIC_NOVA_AI=openai` or supabase mode.
- Universal links (`https://orbit.app/join/*`) need hosted redirect + EAS associated domains for production; custom scheme `orbit://join/CODE` works in dev.
