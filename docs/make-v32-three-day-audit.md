# make-v30 → make-v32 three-day tip audit (TestFlight gate)

**Tip:** `cursor/make-v32` @ `d51b9ca`  
**Window:** ~last 72h of tip line (`make-v30` polish → `make-v31` fin → `make-v32` logic/security)  
**Purpose:** One place to see what landed before private TestFlight.

---

## 1. What shipped (by theme)

### A. Settings / leave / legal (make-v31 → v32)
- Native menus for Privacy & Sign Out (no nested Modal freeze)
- Root legal sheet after Settings dismiss
- Sign-out leave harden + GlobalSigningOutCover
- Get Started (Help) → Home checklist
- My Subscription + catalog prices `$6.99/mo · $49.99/yr (40% off)`
- Mock token bank refresh on buy

### B. Shared-device / accents (make-v32)
- Jack = Coral, Emma = Citrus everywhere Switch / Who’s on / tab chrome
- Connected pill parity; Emma+Jack mock tablet
- Switch account → Who’s on filter

### C. Security (make-v32)
- CRITICAL RLS: invites members-only, members insert lock, role trigger, token INSERT revoked, invite RPC admin gate
- Staging-safe repair (`*_safe.sql`) when Rev D tables missing
- `grant-token-pack` JWT + admin check
- Advisor: `nova_briefings` invoker; profiles `(select auth.uid())`
- Rotation checklist (names only — rotate later)

### D. Task logic (make-v32)
- Full logic audit vs House Rules (`LOGIC_AUDIT_V32.md`)
- Smart reassign: Who in Edit; full XP tonight or next day; overnight carry; Late only day-2 late; this-occurrence series
- Hygiene B (out of chore streak)
- Split Late Credit = solo table
- Expired tab hide 7d / keep history
- Rollover wires streak cliffs / Rescue engine

### E. Fin / household ops (make-v31 stops)
- Support v2, deletion grace, QR transfer, Premium glass, credit receipts
- Smart notification reduction

### F. make-v30 carry-in
- Household Health live breakdown, Request Proof on Assign, How-it-works voices, House Rules stack

---

## 2. TestFlight readiness

| Gate | Status |
|------|--------|
| Preflight script | **PASSED** |
| EAS auth / project | OK (`choremaxx-team`, ascAppId `6796850110`) |
| Tip branch pushed | `cursor/make-v32` |
| Product polish for private TF | Ready |
| Staging RLS `_safe` applied | **Confirm ops** (SQL editor) |
| `grant-token-pack` redeployed | **Confirm ops** |
| Key rotation | Deferred (list only) |
| StoreKit server verify | Not required for private TF |

**Verdict:** Private TestFlight **cut and submitted** (sign-out → Get Started fix in **113**).

| | |
|--|--|
| Version | **1.3.0 (113)** |
| Build | https://expo.dev/accounts/choremaxx-team/projects/choremaxx/builds/1a519900-9ab2-4d22-b679-b0b1aad41300 |
| Submit | https://expo.dev/accounts/choremaxx-team/projects/choremaxx/submissions/ad7cc4ec-66a2-4f5a-a7d5-4aa37d47a532 |
| ASC | https://appstoreconnect.apple.com/apps/6796850110/testflight/ios |
| Tip commit | `a22e6e0` on `cursor/make-v32` |
| Prior | 1.3.0 (111) blank after sign-out — fixed: `dismissTo('/welcome')` + tabs/leave safety nets |

Apple processing usually 5–10 minutes after build finishes, then install from TestFlight. Staging SQL/edge should still be applied before relying on live supabase paths.

---

## 3. Creative / improvement ideas (non-blocking)

Ship TF first; pick from this list next tip:

1. **Expired history sheet** — one tap from Expired tab into household-health-style history (copy already teases it).  
2. **“Assign again tomorrow”** on Expired detail — one tap new occurrence without revive.  
3. **Rescue UI polish** — now that rollover wires offers, make the Home Rescue sheet unmistakable (cost preview, decline = keep XP).  
4. **Unassign** Remove today / permanently (Rev F) when reassign isn’t enough.  
5. **Settings remaining `orbitAlert`s** → native menus (Replay / Restore / hygiene).  
6. **Person-accent** on Settings domain icons + legal footer.  
7. **StoreKit verify** before public App Store (P0 for store, not TF).  
8. **Poppins quiet mode** after smart-notif digests — prove fewer pings feel calmer on device.

Nothing in this list should block the TF binary.

---

## 4. TF smoke matrix (device)

- [ ] Admin sign-out → Get Started / scan / have account (no blank dark screen; TF 113)  
- [ ] Privacy & legal opens after Settings dismisses  
- [ ] Shared tablet Jack/Emma accents + Connected  
- [ ] Edit task → Who → reassign before/after deadline (grace copy)  
- [ ] Complete own task only (admin cannot complete for kid)  
- [ ] Mock/live token buy if testing Credits  
- [ ] Join household still works (after staging RLS)  
- [ ] Overnight: unfinished reassigned task carries (not silent expire)  
- [ ] Rescue / streak number moves after a real miss day (may need two calendar days)

---

## 5. Ops while build runs

1. Run `supabase/migrations/20261006014806_security_harden_rls_v32_safe.sql` on staging if not done.  
2. Redeploy Edge `grant-token-pack`.  
3. Confirm `POPPINS_VOICE_GRANT_ALL` unset on staging.  
