# Remaining work

**Single list.** Everything still to do after TestFlight **1.3.0 (38)**.  
**Branch:** `cursor/choremaxx-make-v13`  
**Do not** start from v12 / v11 / v7. **Do not** re-port Figma Make, rewrite welcome/sign-in, or collapse House Rules to the kid card.

Shipped on this tip (do not redo): v12 stack, House Rules expiry, invite join paths, GPS/places/shopping, AIUIC overlay (Assign / groceries / done / shopping drops).

---

## 1. Poppins IUI rework (the product work)

IUI is the key: spoken intent + a constrained scene graph in **one Activity viewport**, not a chatbot around the orb.

Beats: **SHOW → NARROW → UNFOLD → HOLD → SETTLE → CHAIN**. Silence is assent. Compound clauses become a playlist of scenes — they should not fall back into a transcript.

Do not start until MYTIKAS says go. Detail: [`poppins-rework.md`](./poppins-rework.md), method: [`iui-method-note.md`](./iui-method-note.md).

| # | Item | Notes |
|---|------|--------|
| P1 | **Memory / continuity** | Do not start brand new every Speak. Persist household + conversation across hangup, background, and the next Speak (who we are, what we just assigned, open HOLD, last beats). WebRTC `end()` currently wipes the realtime session (`lib/voice/poppins-voice-session.ts`). |
| P2 | **Stage as the primary surface** | IUI Activity is what you look at while you speak. Captions become a thin live line, or go away. Stop treating YOU/POPPINS chat as the product. |
| P3 | **Beats / HOLD / barge-in** | Grammar must be reliable on TestFlight voice. Barge-in rewinds a beat, not the whole act. |
| P4 | **Strip mixed leftover** | Chat-style stacked transcripts, duplicate rails, hourglass-as-log, Assign/Create forms competing with HOLD-commit. |
| P5 | **Settings / billing / account** | Coach-navigate only; never HOLD-commit. |

Code today: `lib/poppins/ui-scenes.ts`, `ui-tool-map.ts`, `ui-orchestrator.ts`, `components/orbit/poppins-stage.tsx`.

---

## 2. v13 cut + App Store

Cut **done:** `cursor/choremaxx-make-v13` @ 1.3.0 (`make-v13 · final`). Continue smoke and Review from this tip.

| # | Item | Notes |
|---|------|--------|
| S1 | Cut v13 | **Done.** Branch off today’s aggregate. `app.json` **1.3.0**, `BUILD_INFO` `make-v13 · final`. |
| S2 | Device smoke | Real Supabase account (not `sarah@orbit.test`). Assign a library task. Poppins Speak → IUI HOLD. House Rules 4 directions × Admin/Sidekick. Places map. Homework roles. Expired tasks. Delete account → Get Started. |
| S3 | Luna edge model | Redeploy with `OPENAI_POPPINS_CHAT_MODEL=gpt-5.6-luna` if staging is still on the old id. |
| S4 | MapView on IPA | Full `MapView` needs the TestFlight binary; Expo Go uses the fallback. Verify on device. |
| S5 | App Review (B7) | After S2 + live legal URLs + demo account. Draft: [`app-store-checklist.md`](./app-store-checklist.md). |
| S6 | Key rotation | After B7: rotate Resend, OpenAI, `SEND_EMAIL_HOOK_SECRET`; confirm Auth Hook + Poppins still work. |

---

## 3. Website, email, billing (ops leftovers)

| # | Item | Notes |
|---|------|--------|
| W1 | **A1 — HTTPS email-confirm bridge** | Site `/auth/callback` must forward `token_hash` into `choremaxx://auth/callback`. Brief: [`website-agent-email-confirmation.md`](./website-agent-email-confirmation.md). Live host `https://www.choremaxx.app`. Website repo push was 403 last attempt. |
| W2 | **A2 — Auth Send Email Hook smoke** | Enable hook in Supabase dashboard if not live; signup → Resend → confirm in app. [`resend-auth-email.md`](./resend-auth-email.md). |
| W3 | Join + AASA | `/join/[code]` bridge + Apple AASA for Universal Links. [`website-agent-handoff.md`](./website-agent-handoff.md). |
| W4 | Site copy / CTAs (B4) | Families only, Poppins not Nova, IAP $4.99 / $48. Remove roommate promises. |
| W5 | **A3 — ASC IAP on the binary** | Monthly live in ASC; attach products to the next review binary. Yearly CTA still Settings-only. StoreKit needs native IPA (`expo-iap`). [`asc-iap-setup.md`](./asc-iap-setup.md). |
| W6 | Billing emails (B5) | After real purchase events: started / receipt / failed / cancelled / trial ending. Templates exist in `emails/`; not dispatched. |
| W7 | Server receipt verify | App Store Server API — not in app yet. |
| W8 | Transactional emails not wired | Welcome, household invite, task assigned/completed, weekly summary, security alert. Templates only — [`email-templates.md`](./email-templates.md). |

---

## 4. Product polish still open (not blocking Review)

From Rev F / weekend ship — do after Poppins IUI unless a bug blocks testers.

| # | Item |
|---|------|
| F1 | Contrast audit (Rev F §7) |
| F2 | Add-member 4-step wizard (Rev F §8) |
| F3 | Invite RLS (Rev F §3.6) |
| F4 | PersistentScrollView sweep on remaining lists |
| F5 | Create Task Quick presets cleanup on the legacy screen |
| F6 | Allowance period-close ledger write |
| F7 | Trophy **Part 1** definitions (engine is example-seed only — do not invent 100 names) |
| F8 | Master Brief **Q2** — monthly Rescue token vs lifetime free-first (already shipping monthly; confirm) |

---

## 5. Later (not this app-store pass)

| Surface | What |
|---------|------|
| Apple Watch | Complication + today’s tasks / groceries; complete / purchased. After phone ships. [`ecosystem/watch-vision-roadmap.md`](./ecosystem/watch-vision-roadmap.md) |
| iPad | Wider Home / analytics breakpoints; Stage Manager. |
| Vision Pro | Windowed Home + Poppins later. Do not block iPhone. |
| Smart home | Matter / Home Assistant adapters as edge functions. |
| Design-system rebuild | `docs/design-system/10-cursor-tasks.md` (iOS 27 / Liquid Glass batches). Largely superseded by Make v7–v12 shipping UI — do not treat as the v13 checklist. |

---

## Do not redo

- v12 aggregate (IUI, Luna, Assign/Event, Poppins quality, House Rules HTML Admin/Sidekick)
- Assign `difficulty` default, live captions, delete landing, email-confirm UUID, used-link resume
- v11 Divine Voice + auth + v10 billing / grocery / Rev F gates
- Re-porting Figma Make
- Collapsing House Rules to the kid card
- Welcome / sign-in splash rewrites unless explicitly asked
