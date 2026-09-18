/**
 * Product act meter — user-facing tokens charged on commit only.
 * Provider COGS stays on AiUsageEvent (lib/ai/credits.ts).
 */
import {
  TOKEN_WEIGHT_LIVE,
  TOKEN_WEIGHT_SILENT,
  TOKEN_WEIGHT_SPOKEN,
  TOKENS_PER_DAY,
  TOKENS_PER_MONTH,
} from '@/constants/poppins-ai-rates';
import type { PoppinsActMode } from '@/lib/ai/credits';
import type { IuiWriteKind } from '@/lib/poppins/ui-scenes';

export type ActKind =
  | 'task'
  | 'grocery'
  | 'event'
  | 'homework'
  | 'itinerary_stop'
  | 'place_save'
  | 'complete'
  | 'reward';

export type ActOutcome = 'committed' | 'undone' | 'vetoed' | 'abandoned' | 'failed';

export type ActVoice = 'quiet' | 'spoken';
export type ActControl = 'guided' | 'direct';

export type ActEvent = {
  id: string;
  at: string;
  memberId: string;
  memberName: string;
  actKind: ActKind;
  voice: ActVoice;
  control: ActControl;
  tokens: number;
  outcome: ActOutcome;
  utteranceChars: number;
  turns: number;
  beatsPlayed: number;
  slotsFromSpeech: number;
  slotsFromTouch: number;
  slotsInherited: number;
  latencyMs: number;
  sessionId?: string;
  sessionSeconds?: number;
  audioInSeconds?: number;
  audioOutSeconds?: number;
  /** Beat id for undo pairing. */
  beatId?: string;
};

export type ActUsageSummary = {
  tokensUsedThisPeriod: number;
  tokensUsedToday: number;
  tokensRemaining: number;
  topUpBalance: number;
  periodResetsAt: string;
  tripped: boolean;
  trippedAt: string | null;
  byMember: { memberId: string; name: string; tokens: number; events: number }[];
};

export type SummarizeActUsageOpts = {
  periodStart?: string;
  periodEnd?: string;
  now?: Date | string;
  topUpBalance?: number;
  todayKey?: string;
};

/** Map legacy PoppinsActMode → WO3 axes + weight (Direct not shipped). */
export function axesFromPoppinsMode(mode: PoppinsActMode | undefined): {
  voice: ActVoice;
  control: ActControl;
  tokens: number;
} {
  switch (mode) {
    case 'live':
      return { voice: 'spoken', control: 'guided', tokens: TOKEN_WEIGHT_LIVE };
    case 'spoken':
      return { voice: 'quiet', control: 'guided', tokens: TOKEN_WEIGHT_SPOKEN };
    case 'silent':
    default:
      return { voice: 'quiet', control: 'guided', tokens: TOKEN_WEIGHT_SILENT };
  }
}

export function actKindFromWrite(write: IuiWriteKind | undefined): ActKind | null {
  switch (write) {
    case 'create_task':
    case 'update_task':
      return 'task';
    case 'create_homework':
      return 'homework';
    case 'add_grocery':
      return 'grocery';
    case 'create_event':
      return 'event';
    case 'create_itinerary_stop':
    case 'advance_itinerary':
      return 'itinerary_stop';
    case 'complete_task':
      return 'complete';
    case 'claim_reward':
      return 'reward';
    default:
      return null;
  }
}

export function buildActEvent(input: {
  memberId: string;
  memberName: string;
  actKind: ActKind;
  mode?: PoppinsActMode;
  outcome?: ActOutcome;
  beatId?: string;
  utteranceChars?: number;
  at?: string;
  id?: string;
}): ActEvent {
  const axes = axesFromPoppinsMode(input.mode);
  const outcome = input.outcome ?? 'committed';
  const tokens = outcome === 'committed' ? axes.tokens : 0;
  return {
    id: input.id ?? `act-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    at: input.at ?? new Date().toISOString(),
    memberId: input.memberId,
    memberName: input.memberName,
    actKind: input.actKind,
    voice: axes.voice,
    control: axes.control,
    tokens,
    outcome,
    utteranceChars: Math.max(0, Math.round(input.utteranceChars ?? 0)),
    turns: 0,
    beatsPlayed: 0,
    slotsFromSpeech: 0,
    slotsFromTouch: 0,
    slotsInherited: 0,
    latencyMs: 0,
    beatId: input.beatId,
  };
}

function startOfUtcMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0, 0));
}

function nextUtcMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1, 0, 0, 0, 0));
}

function localDayKey(iso: string, fallback: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return fallback;
  return d.toISOString().slice(0, 10);
}

/** Net tokens: committed adds, undone subtracts matching prior charge. */
export function summarizeActUsage(
  events: ActEvent[],
  members: { id: string; name: string }[] = [],
  opts: SummarizeActUsageOpts = {}
): ActUsageSummary {
  const now = opts.now ? new Date(opts.now) : new Date();
  const periodStart = opts.periodStart ? new Date(opts.periodStart) : startOfUtcMonth(now);
  const periodEnd = opts.periodEnd ? new Date(opts.periodEnd) : nextUtcMonth(now);
  const todayKey = opts.todayKey ?? now.toISOString().slice(0, 10);
  const topUpBalance = Math.max(0, Math.round(opts.topUpBalance ?? 0));

  const chronological = [...events].sort((a, b) => a.at.localeCompare(b.at));
  let tokensUsedThisPeriod = 0;
  let tokensUsedToday = 0;
  let trippedAt: string | null = null;
  const totals = new Map<string, { name: string; tokens: number; events: number }>();

  for (const event of chronological) {
    const at = new Date(event.at);
    const inPeriod = !Number.isNaN(at.getTime()) && at >= periodStart && at < periodEnd;
    let delta = 0;
    if (event.outcome === 'committed') {
      delta = Math.max(0, Math.round(event.tokens));
    } else if (event.outcome === 'undone') {
      const prior = chronological
        .filter(
          (row) =>
            row.outcome === 'committed' &&
            row.at <= event.at &&
            (event.beatId ? row.beatId === event.beatId : row.id !== event.id) &&
            row.memberId === event.memberId &&
            row.actKind === event.actKind
        )
        .pop();
      delta = -Math.max(0, Math.round(prior?.tokens ?? event.tokens));
    }
    if (inPeriod && delta !== 0) {
      tokensUsedThisPeriod += delta;
      if (localDayKey(event.at, todayKey) === todayKey) {
        tokensUsedToday += delta;
      }
    }
    tokensUsedThisPeriod = Math.max(0, tokensUsedThisPeriod);
    tokensUsedToday = Math.max(0, tokensUsedToday);

    const prev = totals.get(event.memberId) ?? {
      name: event.memberName,
      tokens: 0,
      events: 0,
    };
    totals.set(event.memberId, {
      name: event.memberName || prev.name,
      tokens: Math.max(0, prev.tokens + (inPeriod ? delta : 0)),
      events: prev.events + (event.outcome === 'committed' ? 1 : 0),
    });

    const allowanceExhausted =
      tokensUsedThisPeriod > TOKENS_PER_MONTH || tokensUsedToday > TOKENS_PER_DAY;
    if (!trippedAt && allowanceExhausted) trippedAt = event.at;
  }

  const monthlyRemaining = Math.max(0, TOKENS_PER_MONTH - tokensUsedThisPeriod);
  const dailyRemaining = Math.max(0, TOKENS_PER_DAY - tokensUsedToday);
  const tokensRemaining = Math.max(0, Math.min(monthlyRemaining, dailyRemaining) + topUpBalance);
  const allowanceExhausted =
    tokensUsedThisPeriod >= TOKENS_PER_MONTH || tokensUsedToday >= TOKENS_PER_DAY;

  const byMember = members.map((member) => {
    const row = totals.get(member.id);
    return {
      memberId: member.id,
      name: member.name,
      tokens: row?.tokens ?? 0,
      events: row?.events ?? 0,
    };
  });
  for (const [memberId, row] of totals) {
    if (byMember.some((item) => item.memberId === memberId)) continue;
    byMember.push({
      memberId,
      name: row.name || memberId,
      tokens: row.tokens,
      events: row.events,
    });
  }
  byMember.sort((a, b) => b.tokens - a.tokens);

  return {
    tokensUsedThisPeriod,
    tokensUsedToday,
    tokensRemaining,
    topUpBalance,
    periodResetsAt: periodEnd.toISOString(),
    tripped: allowanceExhausted && topUpBalance <= 0,
    trippedAt,
    byMember,
  };
}

export function personalActTokens(
  summary: ActUsageSummary,
  memberId: string | null | undefined
): number {
  if (!memberId) return 0;
  return summary.byMember.find((row) => row.memberId === memberId)?.tokens ?? 0;
}

export function mergeActEvents(local: ActEvent[], remote: ActEvent[]): ActEvent[] {
  const byId = new Map<string, ActEvent>();
  for (const event of [...local, ...remote]) {
    byId.set(event.id, event);
  }
  return [...byId.values()].sort((a, b) => a.at.localeCompare(b.at)).slice(-400);
}

/** Module sink so commitIuiBeat can charge without editing stage files. */
type ActMeterHooks = {
  onCommitted: (beatId: string, write: IuiWriteKind | undefined) => void | Promise<void>;
  onUndone: (beatId: string, write: IuiWriteKind | undefined) => void | Promise<void>;
};

let actMeterHooks: ActMeterHooks | null = null;

export function setActMeterHooks(hooks: ActMeterHooks | null) {
  actMeterHooks = hooks;
}

export async function notifyActCommitted(
  beatId: string,
  write: IuiWriteKind | undefined
): Promise<void> {
  await actMeterHooks?.onCommitted(beatId, write);
}

export async function notifyActUndone(
  beatId: string,
  write: IuiWriteKind | undefined
): Promise<void> {
  await actMeterHooks?.onUndone(beatId, write);
}
