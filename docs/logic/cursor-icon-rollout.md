# ChoreMaxx — replace all emoji iconography with the ChoreMaxx icon set

Do this as one focused change. Nothing in this task touches logic, data models, XP math,
or copy. It swaps every emoji and every placeholder glyph for a drawn icon from a single
set, and routes them through one component.

Two files are provided and must be added **verbatim**:

- `src/design/icons.ts` — geometry for all 29 marks (24×24 grid). Do not hand-edit the path data.
- `src/design/Icon.tsx` — the only component allowed to render an icon.

If the project already has a `design/`, `theme/`, or `ui/` folder, put both files there and
update the import paths in this document accordingly. Keep them together.

---

## The two variants

The set has one geometry and two treatments. Nothing else is permitted.

**`duotone`** — everything except the XP trophies.
Cream body stroke, one rust accent per mark carrying the meaningful detail (the washer
drum, the broom bristles, the check, the flame core). Fixed colors: body `#F1E6D6`,
accent `#E4552B`. These are the icon's identity — do **not** recolor duotone icons per
screen, per domain, or per state.

**`halo`** — XP trophies only, and it is **colorless by design**.
One line weight, one tone, plus a soft bloom. The tone is never hard-coded: it is passed
in from whatever palette already governs that surface, so the trophy shelf inherits the
app's colors instead of introducing new ones. The bloom is faked with two wide,
low-opacity stroke passes because `react-native-svg` has no dependable filter support —
do not replace it with `feGaussianBlur` or a shadow prop.

```tsx
<Icon name="kitchen" size={28} />                       // duotone, the default
<Icon name="tierCrown" variant="halo" tone={tier.color} size={44} />
<Icon name="tierCup" variant="halo" tone={tier.color} muted />   // locked tier
```

---

## Step 1 — wire the palette for the halo

The trophy tone must come from the app's existing palette, not from a new constant.
Find the module that already defines the trophy/tier colors (or the surface palette the
trophy shelf sits on) and export a resolver:

```ts
// src/design/tierTone.ts
import { theme } from '../theme';

/** One tone per XP tier, taken from the palette that already exists. */
export function tierTone(tierIndex: number, earned: boolean): string {
  if (!earned) return theme.colors.textMuted;
  return theme.colors.tierRamp[tierIndex] ?? theme.colors.accent;
}
```

If `tierRamp` does not exist, build it from palette values that are already in the theme
(warm at the low tiers climbing to the brand rust and gold at the top). **Do not invent new
hex values, and do not use the blue/violet from the design comp** — that was the sample tone,
not the spec.

---

## Step 2 — replace the domain tiles

All 15 library domains. Currently these render a house glyph (and a lotus for hygiene).
Attach the icon name to the domain config object so a screen never picks an icon by string
matching.

| Domain | `IconName` | Rust accent falls on |
|---|---|---|
| Kitchen & Dining | `kitchen` | knife blade |
| Trash & Recycling | `trash` | the two bin slats |
| Bathroom | `bathroom` | the falling droplets |
| Laundry | `laundry` | drum + dial buttons |
| Bedroom | `bedroom` | the pillow |
| Living Room & Shared Spaces | `livingRoom` | seat seam + legs |
| Floors & Deep Clean | `floors` | the bristles |
| Pets | `pets` | the four toe pads |
| Car | `car` | the wheels |
| Yard & Outdoors | `yard` | the ground line |
| Personal Hygiene | `hygiene` | bristles + sparkle |
| Daily Routine | `dailyRoutine` | the eight rays |
| Meals, Groceries & Shopping | `groceries` | the bag handle |
| Home Maintenance | `maintenance` | — (single mark) |
| Homework | `homework` | the spine |

Render at **28** inside the tile, centered, with the tile's existing background untouched.

## Step 3 — replace the achievement badges

| Achievement | `IconName` | Replaces |
|---|---|---|
| First Step | `firstStep` | ✅ |
| Week Warrior | `weekWarrior` | 🔥 |
| Homework Ace | `homeworkAce` | 📚 |
| Team Player | `teamPlayer` | 🤝 |
| Clean Sweep | `cleanSweep` | 🧹 |
| Early Bird | `earlyBird` | 🌅 |
| Month Master | `monthMaster` | ⚡ |
| Poppins's Favorite | `poppinsFavorite` | 🤖 |

Duotone, size **32** in the achievements grid, **24** in the live-collection rows.
Locked state: pass `muted` — it drops the whole mark to 28% opacity. **Delete the 🔒 lock
emoji overlay entirely**; the dimmed mark is the locked state, and the row already says
"Locked" in text.

## Step 4 — replace the XP trophies

Twelve tiers, six marks, ascending — the ladder is exported as `TIER_ICONS`:

```
1–2 tierMedal · 3–4 tierStar · 5–6 tierCup · 7–8 tierShield · 9–10 tierLaurel · 11–12 tierCrown
```

Tier 12 (**Most Glorious**, 100,000 XP) is `tierCrown`. **Eternal Laurel** must land on
`tierLaurel` — if the current tier order puts it elsewhere, reorder `TIER_ICONS` so it
does, and leave every tier name and threshold exactly as it is.

```tsx
<Icon name={TIER_ICONS[i]} variant="halo" tone={tierTone(i, earned)} muted={!earned} size={44} />
```

---

## Sizing

| Context | Size |
|---|---|
| Domain tile, assign-tasks sheet | 28 |
| Task row inline | 20 |
| Achievement grid card | 32 |
| Achievement / live-collection row | 24 |
| Trophy shelf card | 44 |
| Trophy unlock moment | 64 |

Never render below 20 — the accent detail collapses. Never scale an icon with a
`transform`; pass `size` so the stroke stays true.

## Step 5 — sweep

1. Grep the codebase for emoji in JSX, in the task library, in the reward presets, and in
   any `emoji`/`icon` string field. Every hit is either replaced with an `<Icon />` or removed.
2. Delete the emoji picker remnants if any survive in the Mint Reward sheet — that sheet is
   name + frequency + approval only.
3. Delete any now-unused emoji constant maps, the house-glyph placeholder component, and
   any `require`d PNG badge stubs.
4. If a task or reward row still needs a visual and has no domain, use its parent domain's icon.

---

## Acceptance checklist

- [ ] `icons.ts` and `Icon.tsx` added unmodified; every icon in the app renders through `<Icon />`.
- [ ] Zero emoji characters remain in rendered UI. Grep is clean.
- [ ] All 15 domains, 8 achievements and 12 tiers resolve to a mark — no fallbacks, no blanks.
- [ ] Duotone icons are cream + rust everywhere, identical on every screen.
- [ ] Trophy tones come from the theme. No hex literal for a trophy anywhere outside the theme file.
- [ ] Locked achievements and locked tiers are dimmed, not padlocked.
- [ ] Nothing renders below 20pt.
- [ ] Typography, spacing, copy, XP values, thresholds and tier names are byte-for-byte unchanged.

## Do not

- Do not add a third variant, a filled variant, or a per-domain color scheme.
- Do not recolor duotone icons for pressed, selected, or disabled states — change the tile
  background or its opacity instead.
- Do not animate the icons. The bloom is static.
- Do not swap in an icon library (Lucide, Feather, Ionicons) for any mark that is "missing" —
  if something has no icon, list it and stop; a new mark gets drawn into the set, not borrowed.
- Do not touch the task library, reward library, deadlines, or the proof-request logic.

---

### If a web surface needs the same set

The marketing and support pages can reuse `icons.ts` unchanged. Write a second thin
component that maps `t: 'p'` → `<path>` and `t: 'c'` → `<circle>` with the same stroke
widths, and there the halo bloom may use a real `filter: drop-shadow()` since the browser
supports it. Never fork the geometry file.
