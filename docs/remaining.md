# Remaining work

**Branch:** `cursor/choremaxx-make-v15`  
**TestFlight in ASC:** **1.3.0 (44)** is v14 (`38fc974`). v15 is the next IPA.  
**Do not** start from v13 / v12 / v11 / v7. **Do not** re-port Figma Make, rewrite welcome/sign-in splash animations, or collapse House Rules to the kid card.

---

## TestFlight v15 (this tip)

v15 is `cursor/choremaxx-make-v15` — two-mode IUI, second Speak, live-voice $4 meter. See [`choremaxx-make-v15.md`](./choremaxx-make-v15.md).

**SQL:** apply `supabase/migrations/20260825220000_ai_usage_events.sql` on staging for household-wide meter sync. Without it, each phone still meters locally.

### Device smoke on v15

- Second Speak after hangup starts. No orange idle-mic hold on Notifications.
- Kitchen + tomorrow skips the 14-category grid.
- Tap while Poppins is talking wins.
- Hourglass does not auto-open.
- Settings → Poppins meter moves after Speak.

## TestFlight 44 (submitted, v14)

44 is git `38fc974` on `cursor/choremaxx-make-v14` (EAS `0b47cda0`, submit `9da23c50`). Listen-first Speak, house memory, Tuning in…, itinerary one-stop, Open Poppins.

## Parked (leave aside)

Architecture: [`iui-ux-architecture.md`](./iui-ux-architecture.md). Method: [`iui-method-note.md`](./iui-method-note.md).

### Needs live ops

- **W1 / W3 / W4** — website repo. **W6 / W8** — Resend. **W7** — App Store Server API.
- Apply `20260825220000_ai_usage_events.sql` on staging (household meter).

### Already done

- **S1** v13 cut — TestFlight **1.3.0 (39)**
- **S1b** v14 cut — TestFlight **(44)** @ `38fc974`
- Revision G Sidekick SQL on staging

Do not redo: v12 aggregate, re-porting Figma Make, collapsing House Rules to the kid card, welcome / sign-in splash rewrites unless explicitly asked.
