# Poppins pricing, metering, and AI cost control

**Status:** spec for implementation on `cursor/make-v19`.
**Supersedes:** the `$x of $4` meter in `docs/poppins-os.md` (that number was a measurement probe, not a budget).
**Conflicts:** where this file conflicts with `docs/adr-poppins-post-tool-response-create.md`, see §6 — that ADR is re-scoped, not revoked.

Product behaviour for IUI stays as specified in `docs/poppins-os.md`. This file changes **which model runs, when, and how often**. It does not change beats, HOLD, the one-viewport law, or the primitive set.

---

## 1. The budget

Retail pricing (decided Sep 2026):

| Surface | Gross / mo | Fees | Net / mo |
|---|---|---|---|
| Monthly $6.99 (in-app) | $6.99 | Apple 15% | $5.94 |
| Annual $49.99 (in-app) | $4.17 | Apple 15% | **$3.54** |
| Annual $49.99 (web) | $4.17 | Stripe 2.9% + $0.30 | $4.02 |

**Design to $3.54/household/month.** Annual in-app is the worst case and will be the majority surface.

| | Per household / mo |
|---|---|
| AI COGS target | **$0.70** |
| AI COGS hard ceiling (circuit breaker) | **$1.20** |
| Infra (Supabase, push, storage) budget | $0.30 |

Anything that pushes blended AI COGS above $1.20 is a P0.

Model rates (verified against OpenAI pricing, Sep 2026):

| Model | Input / 1M | Output / 1M |
|---|---|---|
| `gpt-5.6-luna` (current chat/monitor/briefing model) | **$0.20** | **$1.20** |
| `gpt-5.6-terra` | $2.00 | $12.00 |
| `gpt-realtime-2.1` (audio) | $32.00 | $64.00 |
| `gpt-4o-mini-transcribe` | $1.25 | — |
| cached input | 10% of standard input rate | — |

### P0 — `lib/ai/credits.ts` has the wrong Luna rate

```ts
// CURRENT — WRONG
'gpt-5.6-luna': { input: 5, output: 15 },
// CORRECT
'gpt-5.6-luna': { input: 0.20, output: 1.20 },
```

OpenAI cut Luna 80% on 2026-07-30. The meter has been over-reporting every non-voice call by **25x on input and 12.5x on output**. `gpt-realtime-2.1` at `{32, 64}` is correct.

Consequence: any `$4 trip` data already collected is not usable as-is. A household that showed "$4 spent" on mostly-Luna traffic actually spent closer to $0.20. Fix the constant, then re-read the data with corrected arithmetic before drawing conclusions.

Luna is cheap. **The cost problem in this repo is call frequency and prompt size, not model choice.** Do not solve it by downgrading models.

---

## 2. P0 — `poppins-monitor` must stop calling the model every pass

### Current behaviour (the bug)

`supabase/functions/poppins-monitor/index.ts`:

```ts
if (openaiKey) {
  const loop = await runToolLoop(openaiKey, household, metrics);
```

Unconditional. Inside, step 0 forces tools (`tool_choice: 'required'`) and loops up to 6 model rounds. Cron fires every 15 minutes.

Measured from `make-v19` @ `3166fe5`:

- `poppinsToolsAsOpenAIFunctions()` serializes **47 tools**, ~20KB JSON ≈ **5,000 tokens**, resent on **every round**.
- System message embeds `buildMajordomoSystemPrompt` + desk brief (`.slice(0, 2500)`) + household snapshot (`.slice(0, 6000)`) ≈ 2,200 tokens.
- `messages` grows each step; the whole array is resent every round.
- The user prompt mandates `list_holidays` before any nudge and 2–4 actions, guaranteeing multiple rounds.
- Prompt caching does **not** rescue this: OpenAI's cache TTL is minutes and passes are 15 minutes apart, so the 5,000-token tool prefix bills fresh every pass. Caching only helps between rounds inside one pass.

**~$0.004–0.010 per pass → $12–29 per household per month**, against $3.54 of revenue.

The per-call cost is trivial. Ninety-six calls a day, each carrying 47 tool schemas, is not.

### Verify before panicking

No `cron.schedule` exists anywhere in `supabase/migrations/`. The README shows example SQL but nothing in-repo schedules the job. **Check the Supabase dashboard for an active pg_cron entry or scheduled function before treating this as live spend.** If it is not scheduled, this is a latent bug, not an active fire — but it must be fixed before any cron is enabled.

`services/poppins-monitor.ts` (`runMonitorPass`) already computes momentum, deals, empty plan, and streaks with **no model**, and the store runs it anyway. The edge model pass is largely re-deriving work already done.

Two further defects in the same path:

- `limit 50` with no offset or rotation — households past the first 50 rows are never checked.
- No timezone gate — passes fire at 3am local and bill for it.

### Required change

**Rules first. Model only on fire. Capped.**

1. Port `runMonitorPass` rule logic to the edge as `evaluateHouseholdRules(household, metrics)`. Deterministic, no network.
2. Enter `runToolLoop` **only if** all of these hold:
   - at least one rule fired, **and**
   - the fired rule is classified `needs_prose` (a rule that only needs a templated string does not call the model), **and**
   - the household is under its daily model-call cap, **and**
   - local time is inside the household's active window.
3. Cap model rounds at **2**, not 6. If the model hasn't settled in 2 rounds, emit the templated fallback.
4. Daily model-call cap per household: **3**.
5. Cron cadence drops from `*/15 * * * *` to **4 fixed local slots** (morning, after-school, dinner, evening), resolved per household timezone.
6. Replace `limit 50` with a rotating cursor so every household is covered.

Target after change: **~$0.18/household/month.**

```ts
const fired = evaluateHouseholdRules(household, metrics);
if (!fired.length) return { effects: [], summary: null };

const prose = fired.filter(r => r.needsProse);
if (!prose.length) return { effects: applyTemplates(fired), summary: null };

if (!withinActiveWindow(household) || await atDailyModelCap(household.id)) {
  return { effects: applyTemplates(fired), summary: null };
}

const loop = await runToolLoop(openaiKey, household, metrics, { maxRounds: 2 });
```

---

## 3. P2 — template `poppins-notify` and most of `poppins-briefing`

> At Luna rates these paths cost cents per household per month, not dollars. This section is about latency, determinism, and not depending on a model to render a sentence you already have the facts for. It is **not** urgent for cost. Do it after §2 and §5, or after launch.

`poppins-notify` currently calls `gpt-5.6-luna` to write one inbox sentence from structured facts. Facts to a sentence is a template. Remove the model from this path entirely.

`poppins-briefing`:

| Content | Source |
|---|---|
| Daily brief (task count, next event, missing groceries) | Template. No model. |
| Evening wrap (n of m done, tomorrow's first item) | Template. No model. |
| Weekly household pattern line ("tasks have been mostly on Sarah") | **Model.** Once per week per household. |

One model call per household per week. Everything else is string composition over data the app already has.

---

## 4. Three voice modes

The core finding: **duplex Realtime is not required for IUI.** What the method actually needs:

| IUI behaviour | Requirement | Cost |
|---|---|---|
| Silence is assent (HOLD commit) | on-device VAD | $0 |
| Barge-in rewinds a beat | mic open + streaming STT | $0 on-device |
| Touch wins mid-speech | local | $0 |
| Stage paints as words arrive | streaming STT | $0 on-device |
| Interrupt a long spoken reply | **duplex Realtime** | expensive |

Poppins does not give long spoken replies. "Assigned to Drako" is three words. There is nothing to interrupt. Duplex buys almost nothing that IUI uses.

### Mode definitions

| Mode | STT | Understanding | Response | Est. cost / act |
|---|---|---|---|---|
| **Silent** | on-device | small text model, closed enum | stage only | ~$0.0010 |
| **Spoken** (default) | on-device | same | stage + short TTS confirm (≤ 30 chars) | ~$0.0016 |
| **Live** | `gpt-realtime` duplex | same session | continuous duplex | ~$0.05–0.15 |

- **Silent** and **Spoken** ship in the base subscription.
- **Live** is opt-in, metered separately, and off by default. It is not required for any core journey.
- Mode is a household setting, changeable in Settings (coach-navigate only, never HOLD-commit).

### Blocking test before this ships

Silent mode has **never been validated**. Build 38/39 proved stage-as-product with voice running; the repo records no silent smoke test. Run this on TestFlight before locking the default:

> Speak in → stage fills → HOLD or tap commits → no TTS at any point.

If the stage reads as complete, default to **Silent**. If it reads as dead, default to **Spoken**. Do not default to **Live**.

---

## 5. STT goes on-device

TestFlight / native is the shipping target. Expo Go is legacy.

- Primary: on-device speech recognition (`expo-speech-recognition` → `SFSpeechRecognizer` on iOS). **$0.00.**
- Fallback when on-device is unavailable or permission-limited: Deepgram streaming (~$0.0043/audio min) or `gpt-realtime-whisper` (~$0.017/min).
- Expo Go path keeps the existing Whisper fallback. It is a dev path and is not metered against the household budget.

This removes the single largest recurring charge in the system.

---

## 6. Re-scoping the post-tool `response.create` ADR

`docs/adr-poppins-post-tool-response-create.md` mandates `response.create` after every tool round, plus a recovery `response.create` at ~14s of silence. That is **correct in Live mode and only in Live mode**.

Amend the ADR:

- **Live mode:** unchanged. Always `response.create` after `function_call_output`. Recovery at 14s. Never `response.modalities`.
- **Spoken mode:** no Realtime session exists. The confirm string is generated locally from the committed write and sent to TTS. No recovery timer.
- **Silent mode:** the settle mark on the stage is the response. There is nothing to recover.

Without this amendment Cursor will follow the ADR and keep Poppins talking in every mode.

---

## 7. Prompt caching (Live mode only)

Cached audio input bills at roughly $0.40/1M against $32/1M uncached — a ~98.75% reduction. This is currently unrealised because the desk brief is interleaved with the system prompt, invalidating the prefix every session.

Split the context:

```
[ STABLE PREFIX — cacheable ]
  persona / majordomo profile
  tool schemas
  closed scene enum + primitive vocabulary
  beat grammar instructions

[ VOLATILE SUFFIX — never cached ]
  desk brief (overdue by who, groceries, next events)
  session turns restored from IuiContinuity
  house memory facts
```

The prefix must be byte-identical across sessions for the same majordomo profile. Any per-household string in the prefix kills the cache.

---

## 8. Metering

### Meter in acts, not dollars

Replace the `$x of $4` caption. Showing users your provider spend invites arbitrage and breaks the moment provider prices change.

**Unit: the act.** One committed household write via Poppins (task assign, grocery add, complete, calendar event, itinerary stop) = 1 act. Vetoed and abandoned acts do not count. Reading and listening do not count.

Caption under Speak: `24 of 30 today`.

### Caps

| Tier | Acts/day | Live minutes/mo | Est. AI COGS/mo |
|---|---|---|---|
| Base (included in $6.99 / $49.99) | 30 | 0 | ~$0.30–0.50 |
| Live add-on | 30 | 60 | ~$3.50–9.00 |
| Act top-up (consumable IAP) | +200 acts | — | ~$0.32 |

30 acts/day/household is generous — no real family reaches it — while a runaway or abusive household is bounded at roughly $0.30/month of intent calls.

**Live is priced as a consumable or separate add-on, never bundled into the base subscription.** At $0.05–0.15/act it cannot live inside a $3.54 net.

### Cap behaviour

Degrade, never break:

| State | Behaviour |
|---|---|
| Under cap | Normal. |
| At 80% | Caption changes colour. No modal, no interruption. |
| At cap | Speak disabled with existing pause copy. **Type still works** and still commits — typed acts skip STT and cost the same intent call, so they count against the cap too. |
| Cap + top-up available | One-tap offer in the pause copy. Coach-navigate to Settings, never HOLD-commit an IAP. |
| Circuit breaker (household > $1.20/mo measured) | Force Silent mode, log, alert. Do not silently disable Poppins. |

### Instrumentation

Current state in `make-v19`:

| Defect | Location | Effect |
|---|---|---|
| `kind` check is `('chat','voice','briefing')` | `20260825220000_ai_usage_events.sql` | `'monitor'` is not a legal value. The largest cost center **cannot be logged**. |
| `poppins-monitor` never captures `payload.usage` | `poppins-monitor/index.ts` | Monitor spend is invisible even if the constraint allowed it. Only `poppins-chat` records usage. |
| `unique (household_id, client_key)` + upsert | `credit-ledger.ts:85` | This is a dedupe table, not an event log. Per-call history is not queryable. |
| No `cached_input_tokens` column | schema | Cannot verify whether prompt caching (§7) is working. |

Required migration:

- Extend `kind` to `('chat','voice','briefing','monitor','notify','realtime')`.
- Add `cached_input_tokens integer not null default 0`.
- Add `audio_input_seconds`, `audio_output_seconds` (numeric, default 0).
- Add `surface text` and `mode text` (`silent` / `spoken` / `live`).
- Make `client_key` unique **per call**, not per household, or drop the unique constraint and dedupe in the writer. A spend meter needs an append-only event log.

Every model call on every edge path writes a row. Call sites to cover: `poppins-chat`, `poppins-monitor`, `poppins-briefing`, `poppins-notify`, `poppins-voice`, `poppins-voice-tool`, `poppins-realtime-session`.

Without `cached_input_tokens` broken out you cannot tell whether §7 is working. Without a `monitor` kind you cannot tell where the money went.

---

## 9. Kill switches

Ship all of these as remote config, not build flags:

| Flag | Default | Effect |
|---|---|---|
| `POPPINS_MONITOR_MODEL` | `off` | Rules-only monitor. Never calls a model. |
| `POPPINS_MODE_DEFAULT` | `spoken` | Set to `silent` after the §4 smoke test passes. |
| `POPPINS_LIVE_ENABLED` | `off` | Global Live kill. |
| `POPPINS_ACTS_PER_DAY` | `30` | Tune without shipping a build. |

`POPPINS_VOICE_GRANT_ALL` appears in the deploy secrets in `supabase/functions/README.md`. Confirm it is a dev-only bypass of the credit gate and that it cannot be set in the production project. If it can, it is a P0.

---

## 10. Order of work

| # | Task | Saves |
|---|---|---|
| 0 | Fix the Luna rate in `lib/ai/credits.ts` (§1) | one line; makes the meter true |
| 1 | Confirm whether pg_cron is actually scheduled in the Supabase dashboard | decides whether item 2 is a fire or a latent bug |
| 2 | Rules-first gate on `poppins-monitor` + cadence to 4 slots + rotation cursor + trim the 47-tool payload to the subset a monitor pass can use | **~$12–29/household/mo** |
| 3 | `ai_usage_events` migration + write from every edge call site (§8) | visibility (nothing else is trustworthy without it) |
| 4 | On-device STT on native | largest per-act line |
| 5 | Silent-mode smoke test on TestFlight | decides the default |
| 6 | Re-scope the post-tool ADR to Live only | unblocks silent/spoken |
| 7 | Prompt-cache prefix split | only matters if Live ships |
| 8 | Template `poppins-notify` and daily/evening briefs | ~$0.05–0.10 |
| 9 | Live add-on as consumable IAP | revenue |

Item 0 takes a minute and should ship regardless. Items 1–3 are backend-only, touch no IUI behaviour, and are the whole cost problem. Ship 0–3 before October 5; the rest can wait.

A note on item 2: a monitor pass does not need `create_task_draft`, `claim_reward`, `navigate_to`, `present_ui_scene`, `remove_member`, `run_smart_home_scene`, or most of the other 47. Passing a monitor-scoped tool subset cuts ~5,000 tokens per round to a few hundred and is a smaller change than the rules gate.

---

## 11. Re-measure before trusting any number here

Every dollar figure above is an estimate built on published provider rates and assumed usage. After items 1–3 land, pull a week of `ai_usage_events`, compute real blended cost per household, and rewrite §1 and §8 with measured figures. Set the act cap from the measured p95 household, not from this document.

---

## 12. Quiet re-measure (WO9 B8)

Provisional Speak-back weight is `TOKEN_WEIGHT_SPEAK_BACK = 35`:

- Numerator **MEASURED 2026-09-20**: 5 Speak-back (Realtime) acts ≈ $0.26 → ~$0.052/act.
- Denominator **ESTIMATED**: Quiet ≈ $0.0015/act → 0.052 / 0.0015 ≈ 35.

**After Quiet ships:** run 5 Quiet acts (Speak back off — batch Whisper + `poppins-chat`), note the OpenAI dashboard delta, divide by 5, replace the Quiet denominator, and recompute `TOKEN_WEIGHT_SPEAK_BACK`. Do not change `TOKENS_PER_MONTH` / `TOKENS_PER_DAY` without a human pricing decision.
