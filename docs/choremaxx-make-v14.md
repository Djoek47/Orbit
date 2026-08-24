# Choremaxx Make v14 (Revision G aggregate)

**Branch:** `cursor/choremaxx-make-v14`  
**Follows:** `cursor/choremaxx-make-v13` (TestFlight **1.3.0 (39)**)  
**App version:** `1.3.0`  
**TestFlight:** **1.3.0 (40)** — uploaded to App Store Connect  
**Settings tip:** `make-v14 · revision-g`  
**Content tip:** Revision G Sidekick access + login/signup dump sanitizer, on top of the v13 aggregate.

This is the next shipping cut after v13. Nothing from Revision G on `cursor/revision-g-sidekick-5f8f` is left behind.

---

## Aggregated stack

| Layer | Branch | Highlights |
|-------|--------|------------|
| v13 base | `cursor/choremaxx-make-v13` | v12 + House Rules expiry + invites + Places/GPS/shopping + AIUIC. TestFlight **1.3.0 (39)**. |
| Revision G | `cursor/revision-g-sidekick-5f8f` | Sidekick access, two-admin cap, Hold & Request + homework, grocery permission, reward proposals |
| Auth copy | same tip | Login/signup never shows raw Supabase HTTP/JSON dumps |

---

## Revision G — major

- **Owner** = subscription holder (exactly one). **Admin** = max two per household, Owner inclusive. **Sidekick** = child in storage; token role is `sidekick` \| `admin`.
- Invite tokens carry role **server-side only**. Client `role` is ignored.
- Sidekick redeem = instant `active` (one edge invoke + bootstrap). Adult redeem = `pending`.
- Tabs for Sidekick: Home · Tasks · Plan · Ranks. No Poppins tab; Poppins endpoints 403.
- Hold & Request: today’s tasks **and** homework. Late Credit completions count. Zero assigned items → gate **closed**.
- Grocery add = household-level, default **off**. Sidekick cannot check off / edit / remove.
- Propose = quiet “Suggest a reward” (name + optional note). One open proposal + **7-day** cooldown. Approve mints catalogue reward, no XP write.
- Two-admin cap counted **inside the same transaction as the write** (`SELECT … FOR UPDATE`).

Apply `supabase/migrations/20260820200000_revision_g_sidekick.sql` on the TestFlight / staging Supabase project before exercising Sidekick redeem, grocery add, or proposals.

---

## TestFlight env (`eas.json`)

- `EXPO_PUBLIC_DATA_MODE=supabase`
- `EXPO_PUBLIC_POPPINS_AI=openai`
- `EXPO_PUBLIC_POPPINS_REALTIME=1`
- `EXPO_PUBLIC_POPPINS_VOICE_WEBRTC=1`

EAS `autoIncrement` assigns the next iOS build number. Uploaded **1.3.0 (40)** to App Store Connect (EAS build `e3fb6dc6`, submission `c00b9b92` finished). Wait for Apple processing, then install 40 — 39 is the v13 cut without Revision G.

---

## Device smoke (v14 adds)

1. Real Supabase account (not `sarah@orbit.test`)
2. Sidekick invite redeem lands on Home with Plan + Ranks, no Poppins
3. Hold & Request closed on an empty day; open after today’s work (including Late Credit)
4. Household grocery-add toggle default off; Sidekick cannot check off items
5. Suggest a reward → admin approve/decline (no XP)
6. Failed signup shows short copy, not a JSON dump

**Still open** — [`remaining.md`](./remaining.md) (IUI memory, App Review, website ops).

**Do not** re-port Figma Make, rewrite welcome/sign-in, or collapse House Rules back to the kid card.
