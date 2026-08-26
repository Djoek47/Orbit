# Remaining work

**Branch:** `cursor/choremaxx-make-v15`  
**TestFlight in ASC:** **1.3.0 (49)** uploaded (Apple processing). EAS `3e33b7de` / git `d7bc562` / submit `d326ebe9`. Install **49**. Skip 45–48.  
**Do not** start from v13 / v12 / v11 / v7. **Do not** re-port Figma Make, rewrite welcome/sign-in splash animations, or collapse House Rules to the kid card.

---

## TestFlight v15 (submitted)

v15 tip is `cursor/choremaxx-make-v15` @ git `d7bc562` — IUI tap keeps the live call + Speak abort + Poppins OS. IPA **1.3.0 (49)**. EAS `3e33b7de-9e01-41cc-a619-b0f86d954738`, submit `d326ebe9-0725-4bdb-b275-110561173eb4`. See [`choremaxx-make-v15.md`](./choremaxx-make-v15.md).

**45** is git `b4fc5a6` (EAS `abcf5726`) — two-mode without Poppins OS / sign-out wipe.

**SQL:** apply `supabase/migrations/20260825220000_ai_usage_events.sql` on staging for household-wide meter sync. Without it, each phone still meters locally.

### Device smoke on 46

- Second Speak after hangup starts. No orange idle-mic hold on Notifications.
- Kitchen + tomorrow skips the 14-category grid. HOLD creates the task — Tasks shows it.
- Tap while Poppins is talking wins.
- Bell never auto-opens. No hourglass. No Activity tab. No “Open Poppins” while already on Poppins.
- Speak failure says retry, Speak stays visible.
- Settings → Sign Out lands on Get Started and stays signed out after reopen.
- Settings → Poppins meter moves after Speak.

## TestFlight 44 (submitted, v14)

44 is git `38fc974` on `cursor/choremaxx-make-v14` (EAS `0b47cda0`, submit `9da23c50`). Listen-first Speak, house memory, Tuning in…, itinerary one-stop, Open Poppins.

## Parked (leave aside)

Poppins OS is **in IPA 46**. Older IUI notes: [`iui-ux-architecture.md`](./iui-ux-architecture.md), [`iui-method-note.md`](./iui-method-note.md).

### Needs live ops

- **W1 / W3 / W4** — website repo. **W6 / W8** — Resend. **W7** — App Store Server API.
- Apply `20260825220000_ai_usage_events.sql` on staging (household meter).

### Already done

- **S1** v13 cut — TestFlight **1.3.0 (39)**
- **S1b** v14 cut — TestFlight **(44)** @ `38fc974`
- Revision G Sidekick SQL on staging

Do not redo: v12 aggregate, re-porting Figma Make, collapsing House Rules to the kid card, welcome / sign-in splash rewrites unless explicitly asked.
