# WO14 flag-back

## Boards vs doc

| Claim | Code / boards | What we did |
| --- | --- | --- |
| WO says “What Sidekicks can do”; board title is **Sidekick permissions** | HTML board title | Used **Sidekick permissions** (board). |
| WO says “Places & maps”; board title is **Places** | HTML board | Used **Places**. |
| WO says six chapters; JSON has **7** | `data/house-rules.json` | Kept all 7; digest shows live chapter count. Subtitle “Six chapters” on Settings home matches the board copy (not a hard filter). |
| WO: `chapters` empty / missing id·title | Already had key/adminLabel/sidekickLabel; not empty | Filled `id`/`title`/`description`/`icon` + every rule `chapterId`. |
| Themes omitted from Settings redesign HTML | User asked to keep Themes | Kept Themes / Day·Night / household default under **You** (and Sidekick **YOUR LOOK**). |
| About vs Choremaxx group | Board ends with About; product uses Choremaxx legal | Kept **Choremaxx** group (legal, build). |

## Screens that previously lacked a labelled back + close X

- House rules (now `SettingsModalChrome`)
- Shared devices (list + flow)
- Places list
- People (`household-members`)
- Settings sub-sections already had Back + close; Back label is now **Settings**

## Grocery permission

- Removed the duplicate `allowGroceryAdd` row from the old House wall; single switch lives on **Sidekick permissions** (`sidekickGroceryAdd`).
- Migrates disagreeing households via `mergeGroceryPermission` (permissive only if both were set).

## Maps (§5)

- Neutral letter tiles until official files land in `assets/maps/` (README added). Legacy `assets/brand/maps/` not used for Settings tiles.

## Shared devices / Sidekick mirrors

- Shared devices: list-first + peek pager + pills (no “iPad” in user-facing copy).
- Sidekick Settings: themes retained; House rules / Shared switch / look card unchanged in role.
