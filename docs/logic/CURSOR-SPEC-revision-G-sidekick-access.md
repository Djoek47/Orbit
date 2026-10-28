# Revision G — Sidekick Access

Implementation spec for Choremaxx Sidekick (child) access. Storage role stays `child`. Invite token role is `sidekick` | `admin`.

## Owner / Admin / Sidekick

- **Owner** = subscription holder. Exactly one. Nothing auto-promotes if the owner leaves or the subscription lapses.
  - `// TODO(product): What happens to the household if the Owner leaves or the subscription lapses? Default shipped: nothing auto-promotes.`
- **Admin** = max **two** per household, **Owner inclusive**.
- **Sidekick** = child profile. Token role `sidekick`; DB role remains `child`.

## Invite tokens

- Token carries role, written **server-side only**. Client `role` is ignored (A2.1 / A2.2).
- Non-owners can only mint `sidekick` tokens.
- Sidekick redeem → member `active` immediately.
- Adult/admin redeem → member `pending` (existing approval path).
- One client round-trip: `POST` edge `redeem-member-invite` runs `redeem_member_invite` in one DB transaction and returns a bootstrap payload. The client must not hydrate after that invoke.

## Two-admin cap (A2.5)

Count-then-write without a lock races to a third admin. Production SQL:

```sql
SELECT … FROM households WHERE id = $hh FOR UPDATE;
-- then count active owner+admin, then UPDATE
```

Used in `promote_member_to_admin` and `enforce_admin_cap`. JS `withHouseholdLock` is mock / in-process only. `readMembers()` must run **inside** the lock against the shared store.

Blocked copy: `Only two admins per household. Demote [name] first.`

## Hold & Request

A Sidekick may request a catalogue reward only when **today’s assigned tasks AND homework** are complete (Late Credit completions count; expired items keep the gate closed).

- Zero assigned qualifying items → **gate CLOSED**.
  - `// TODO(product): Should a Sidekick with zero assigned items be able to ask for a reward? Default shipped: No — gate closed.`
- Blocked body: `Finish today's tasks and homework to ask for a reward.`

## Grocery

Household-level flag `sidekick_grocery_add`, **default OFF**.

- `// TODO(product): Should the grocery permission be per-member rather than household-level?`
- Sidekick cannot check off, edit, or remove groceries. Add only when the household flag is on. RLS enforces this.

## Propose

Quiet “Suggest a reward” row: name + optional note. One open proposal. **Seven-day** cooldown.

- `// TODO(product): Is a seven-day proposal cooldown the right cadence? Default shipped: seven days.`
- Approve adds a catalogue reward assigned to that member. **No XP write.**

## Sidekick surface

Tabs: **Home · Tasks · Plan · Ranks**. No Poppins tab. Every Poppins endpoint **403**. Settings / members / invites / subscription are denied.

## Appendix defaults (do not invent)

| Question | Shipped default |
|---|---|
| Owner departure / subscription lapse | Nothing auto-promotes |
| Grocery permission | Household-level, default OFF |
| Zero assigned items | Gate closed |
| Propose cooldown | Seven days |
