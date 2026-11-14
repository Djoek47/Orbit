# House Rules — Final Revision rewrite (v11, superseded)

**Current shipping UI (v12):** HTML four directions × Admin / Sidekick — see `docs/choremaxx-make-v12.md`. This note is the v11 kid-card rewrite, kept for history.

**Branch (historical):** `cursor/choremaxx-make-v11`  
**Spec:** Master Brief §3 + Rev D §4 + Rev E §4.2 + Rev F §13

## What changed

The 4-tab explorer (Chapters / At a glance / The Track / Ask Poppins) is **retired**. Shipping UI is:

| Surface | Behavior |
|---------|----------|
| Adult | Settings → House Rules. Chapter-grouped JSON clauses + current setting + Edit links |
| Kid | One-screen **How it works** card from Home. **No ScrollView** |
| Custom | Our House Rules at top of both views (10 × 500). Display only — does not change scoring/XP/allowance |

Copy lives in `data/house-rules.json`. `RWRD-04` matches Rev E (tracks / never moves money / marks it paid). Deadlines and the 30-minute nudge are tokenized from `constants`. Crowns (`MULTI_MEMBER`) hide when XP is off so an allowance household never sees XP copy.

## Kid one-screen (T4.5 / Rev F §13.b)

The kid card renders **only** the Rev D HOW IT WORKS subset (`DEAD-01`, `DEAD-03`, `DEAD-04`, `STRK-01`–`STRK-03`), filtered by visibility.

**Report:** dumping all 33 `kid.body` lines (including R30–R33) **does not fit** one 390pt screen. Per Rev F, we did not shrink type or add scroll. R30–R33 remain on the Adult manual. Custom rules on the kid card can overflow if an admin adds many — that is the design check, not a type shrink.

## Persistence

- Mock: `customHouseRules` on the household snapshot (AsyncStorage).
- Supabase: existing `custom_house_rules` table, loaded with the household, replaced on add/edit/remove. RLS added so members can read and admins can write.

## Tests

`npm run test:house-rules` covers HR decode/visibility + STOP GATE T4.1–T4.8.
`npm run test:revision-d-phase4` delegates to the same file (registry.ts is no longer a second copy source).
