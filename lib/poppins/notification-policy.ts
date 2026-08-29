/**
 * Nova facts vs Luna contact — always-on policy (works without OpenAI).
 *
 * Interrupt: a person must decide.
 * Glance: coalesce celebrations into one Today card.
 * Insight: at most one per day.
 * Activity-only: Poppins Activity log, never a push.
 */

import { displayTrophyName, stripExampleCopy } from '@/lib/trophies/display-name';
import type { NotificationItem } from '@/types/orbit';

export const GLANCE_FLUSH_MS = 10_000;
export const GLANCE_MERGE_MS = 10 * 60 * 1000;

export type FactKind =
  | 'task_completed'
  | 'trophy_unlocked'
  | 'reward_requested'
  | 'proof_submitted'
  | 'proof_requested'
  | 'task_not_done'
  | 'reward_claimed'
  | 'reward_approved'
  | 'allowance_approved'
  | 'allowance_granted'
  | 'task_assigned'
  | 'task_reassigned'
  | 'ask_for_info'
  | 'streak_risk'
  | 'nudge'
  | 'deals'
  | 'propose_plan'
  | 'task_overdue'
  | 'unknown';

export type NotificationLane = 'interrupt' | 'glance' | 'insight' | 'activity_only' | 'passthrough';

export type NotificationUrgency = 'needs_action' | 'today' | 'insight' | 'activity_only';

export type HouseholdFact = {
  id: string;
  at: number;
  kind: FactKind;
  memberId?: string;
  memberName?: string;
  /** Task or reward title. */
  title?: string;
  xp?: number;
  trophyName?: string;
  category?: NotificationItem['category'];
  templateTitle?: string;
  templateBody?: string;
  extra?: Record<string, unknown>;
};

export type ComposeDecision = {
  decision: 'drop' | 'activity_only' | 'send' | 'merge';
  mergeKey?: string;
  urgency: NotificationUrgency;
  title: string;
  body: string;
  cta?: string;
  category: NotificationItem['category'];
  priority: NotificationItem['priority'];
  kind: string;
  factIds: string[];
  banner: boolean;
  memberId?: string;
};

export type ExistingInboxRow = {
  kind?: string;
  urgency?: string;
  createdAt: string;
  mergeKey?: string;
  isRead?: boolean;
};

export function parseComposerJson(raw: unknown, fallback: ComposeDecision): ComposeDecision {
  let parsed: Record<string, unknown> = {};
  if (typeof raw === 'string') {
    const trimmed = raw.trim().replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
    try {
      parsed = JSON.parse(trimmed) as Record<string, unknown>;
    } catch {
      return fallback;
    }
  } else if (raw && typeof raw === 'object') {
    parsed = raw as Record<string, unknown>;
  } else {
    return fallback;
  }

  const title = stripExampleCopy(String(parsed.title ?? fallback.title));
  const body = stripExampleCopy(String(parsed.body ?? fallback.body));
  const cta = parsed.cta != null ? String(parsed.cta) : fallback.cta;

  if (!title || !body) return fallback;
  return {
    ...fallback,
    title,
    body,
    cta,
  };
}

export function laneForKind(kind: string): NotificationLane {
  switch (kind) {
    case 'reward_requested':
    case 'proof_submitted':
    case 'proof_requested':
    case 'task_assigned':
    case 'task_not_done':
    case 'ask_for_info':
      return 'interrupt';
    case 'task_completed':
    case 'trophy_unlocked':
    case 'reward_claimed':
    case 'reward_approved':
    case 'allowance_approved':
    case 'allowance_granted':
    case 'task_reassigned':
    case 'glance':
      return 'glance';
    case 'streak_risk':
      return 'insight';
    case 'nudge':
    case 'deals':
    case 'propose_plan':
    case 'task_overdue':
      return 'activity_only';
    default:
      return 'passthrough';
  }
}

export function glanceMergeKey(memberId: string | undefined, memberName: string | undefined): string {
  const who = (memberName || memberId || 'household').trim().toLowerCase();
  return `glance:${who}`;
}

function asFactKind(raw: string): FactKind {
  const lane = laneForKind(raw);
  if (raw && lane !== 'passthrough') return raw as FactKind;
  return 'unknown';
}

export function factFromNotificationInput(input: {
  title: string;
  body: string;
  category: NotificationItem['category'];
  data?: Record<string, unknown>;
}): HouseholdFact {
  const data = input.data ?? {};
  const kind = asFactKind(typeof data.kind === 'string' ? data.kind : '');
  const memberName =
    (typeof data.name === 'string' && data.name) ||
    (typeof data.memberName === 'string' && data.memberName) ||
    (typeof data.assignee === 'string' && data.assignee) ||
    undefined;
  const trophyRaw =
    (typeof data.trophy === 'string' && data.trophy) ||
    (kind === 'trophy_unlocked' ? input.body.replace(/^Trophy unlocked:\s*/i, '').replace(/\.$/, '') : undefined);
  const xp = typeof data.xp === 'number' ? data.xp : undefined;
  const entity =
    (typeof data.task === 'string' && data.task) ||
    (typeof data.reward === 'string' && data.reward) ||
    (typeof data.title === 'string' && data.title) ||
    undefined;

  return {
    id:
      typeof data.factId === 'string'
        ? data.factId
        : `fact-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    at: Date.now(),
    kind,
    memberId: typeof data.memberId === 'string' ? data.memberId : undefined,
    memberName,
    title: entity,
    xp,
    trophyName: trophyRaw ? displayTrophyName(trophyRaw) : undefined,
    category: input.category,
    templateTitle: input.title,
    templateBody: stripExampleCopy(input.body),
    extra: data,
  };
}

function interruptCopy(fact: HouseholdFact): { title: string; body: string; cta?: string; category: NotificationItem['category'] } {
  const name = fact.memberName ?? 'Someone';
  const entity = fact.title ?? 'this';
  switch (fact.kind) {
    case 'reward_requested':
      return {
        title: 'Poppins · Reward',
        body: stripExampleCopy(`${name} asked for ${entity}.`),
        cta: 'Open Rewards',
        category: 'rewards',
      };
    case 'proof_submitted':
      return {
        title: 'Poppins · Photo',
        body: stripExampleCopy(`${name} sent a photo of ${entity}.`),
        cta: 'Open Task',
        category: 'tasks',
      };
    case 'proof_requested':
      return {
        title: 'Poppins · Photo',
        body: stripExampleCopy(fact.templateBody || `A grown-up asked for a photo of ${entity}.`),
        cta: 'Open Task',
        category: 'tasks',
      };
    case 'task_not_done':
      return {
        title: 'Poppins · Tasks',
        body: stripExampleCopy(fact.templateBody || `${entity} was marked not done yet.`),
        cta: 'Open Task',
        category: 'tasks',
      };
    case 'ask_for_info':
      return {
        title: 'Poppins needs a detail',
        body: stripExampleCopy(fact.templateBody || fact.title || 'Poppins needs a detail to continue.'),
        cta: 'Ask Poppins',
        category: 'ai',
      };
    default:
      return {
        title: stripExampleCopy(fact.templateTitle || 'Poppins'),
        body: stripExampleCopy(fact.templateBody || ''),
        category: fact.category ?? 'general',
      };
  }
}

export function glanceCopy(facts: HouseholdFact[]): { title: string; body: string } {
  const name = facts.find((f) => f.memberName)?.memberName ?? 'Someone';
  const tasks = facts.filter((f) => f.kind === 'task_completed' && f.title);
  const trophies = facts
    .filter((f) => f.kind === 'trophy_unlocked')
    .map((f) => displayTrophyName(f.trophyName || ''))
    .filter(Boolean);
  const uniqueTrophies = [...new Set(trophies)];
  const xp = facts.reduce((sum, f) => sum + (f.xp ?? 0), 0);
  const claimed = facts.filter((f) => f.kind === 'reward_claimed' || f.kind === 'reward_approved');
  const reassigned = facts.filter((f) => f.kind === 'task_reassigned');

  const parts: string[] = [];
  if (tasks.length === 1) {
    parts.push(`finished ${tasks[0]!.title}`);
  } else if (tasks.length > 1) {
    parts.push(`finished ${tasks.length} tasks`);
  }
  if (uniqueTrophies.length === 1) {
    parts.push(`earned ${uniqueTrophies[0]}`);
  } else if (uniqueTrophies.length === 2) {
    parts.push(`earned ${uniqueTrophies[0]} and ${uniqueTrophies[1]}`);
  } else if (uniqueTrophies.length > 2) {
    parts.push(`earned ${uniqueTrophies.length} trophies`);
  }
  if (claimed.length && !parts.length) {
    parts.push(`reward update for ${claimed[0]!.title ?? 'a reward'}`);
  }
  if (reassigned.length && !parts.length) {
    parts.push(reassigned[0]!.templateBody || `a task was reassigned`);
  }

  let body = name;
  if (parts.length === 0) {
    body = xp > 0 ? `${name} earned +${xp} XP.` : `${name} made progress.`;
  } else if (parts.length === 1) {
    body = `${name} ${parts[0]}.`;
  } else {
    body = `${name} ${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}.`;
  }
  if (xp > 0 && !/XP/.test(body) && uniqueTrophies.length === 0) {
    body = body.replace(/\.$/, '') + ` (+${xp} XP).`;
  }

  return {
    title: 'Poppins',
    body: stripExampleCopy(body),
  };
}

function insightCopy(facts: HouseholdFact[]): { title: string; body: string } {
  const first = facts[0];
  return {
    title: stripExampleCopy(first?.templateTitle || 'Poppins'),
    body: stripExampleCopy(first?.templateBody || 'Something at home needs a look later.'),
  };
}

function isSameLocalDay(iso: string, now: number): boolean {
  const d = new Date(iso);
  const n = new Date(now);
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
}

export function coalesceFacts(
  facts: HouseholdFact[],
  options?: {
    now?: number;
    existing?: ExistingInboxRow[];
    insightAlreadyToday?: boolean;
    bannerSentMembers?: Set<string>;
  }
): ComposeDecision[] {
  const now = options?.now ?? Date.now();
  const existing = options?.existing ?? [];
  const insightAlready =
    options?.insightAlreadyToday ??
    existing.some(
      (row) => row.urgency === 'insight' && !row.isRead && isSameLocalDay(row.createdAt, now)
    );
  const bannerSent = options?.bannerSentMembers ?? new Set<string>();

  const interrupts: HouseholdFact[] = [];
  const glances: HouseholdFact[] = [];
  const insights: HouseholdFact[] = [];
  const passthrough: HouseholdFact[] = [];

  for (const fact of facts) {
    const lane = laneForKind(fact.kind);
    if (lane === 'interrupt') interrupts.push(fact);
    else if (lane === 'glance') glances.push(fact);
    else if (lane === 'insight') insights.push(fact);
    else if (lane === 'passthrough') passthrough.push(fact);
  }

  const out: ComposeDecision[] = [];

  for (const fact of interrupts) {
    const copy = interruptCopy(fact);
    out.push({
      decision: 'send',
      urgency: 'needs_action',
      title: copy.title,
      body: copy.body,
      cta: copy.cta,
      category: copy.category,
      priority: 'high',
      kind: fact.kind,
      factIds: [fact.id],
      banner: true,
      memberId: fact.memberId,
    });
  }

  const glanceGroups = new Map<string, HouseholdFact[]>();
  for (const fact of glances) {
    const key = glanceMergeKey(fact.memberId, fact.memberName);
    const list = glanceGroups.get(key) ?? [];
    list.push(fact);
    glanceGroups.set(key, list);
  }

  for (const [mergeKey, group] of glanceGroups) {
    const copy = glanceCopy(group);
    const memberKey = group[0]?.memberId || group[0]?.memberName || mergeKey;
    const recent = existing.find(
      (row) =>
        row.mergeKey === mergeKey &&
        !row.isRead &&
        now - new Date(row.createdAt).getTime() <= GLANCE_MERGE_MS
    );
    const alreadyBannered = bannerSent.has(memberKey);
    out.push({
      decision: recent ? 'merge' : 'send',
      mergeKey,
      urgency: 'today',
      title: copy.title,
      body: copy.body,
      cta: 'View',
      category: 'ai',
      priority: 'medium',
      kind: 'glance',
      factIds: group.map((f) => f.id),
      banner: !alreadyBannered,
      memberId: group[0]?.memberId,
    });
  }

  if (insights.length && !insightAlready) {
    const copy = insightCopy(insights);
    out.push({
      decision: 'send',
      urgency: 'insight',
      title: copy.title,
      body: copy.body,
      cta: 'Ask Poppins',
      category: 'ai',
      priority: 'low',
      kind: insights[0]!.kind,
      factIds: insights.map((f) => f.id),
      banner: false,
    });
  } else if (insights.length) {
    out.push({
      decision: 'activity_only',
      urgency: 'activity_only',
      title: '',
      body: '',
      category: 'ai',
      priority: 'low',
      kind: insights[0]!.kind,
      factIds: insights.map((f) => f.id),
      banner: false,
    });
  }

  for (const fact of passthrough) {
    out.push({
      decision: 'send',
      urgency: 'today',
      title: stripExampleCopy(fact.templateTitle || 'Poppins'),
      body: stripExampleCopy(fact.templateBody || ''),
      category: fact.category ?? 'general',
      priority: 'medium',
      kind: fact.kind,
      factIds: [fact.id],
      banner: true,
    });
  }

  return out;
}

/** Fold already-sent glance spam (old TestFlight rows) into one card per person. */
export function foldGlanceNotifications(
  items: NotificationItem[],
  now = Date.now()
): NotificationItem[] {
  const kept: NotificationItem[] = [];
  const glanceIndex = new Map<string, number>();

  for (const item of items) {
    const kind = typeof item.data?.kind === 'string' ? item.data.kind : '';
    const lane = laneForKind(kind);
    const urgency = typeof item.data?.urgency === 'string' ? item.data.urgency : '';
    const isGlance =
      urgency === 'today' ||
      lane === 'glance' ||
      kind === 'trophy_unlocked' ||
      kind === 'task_completed' ||
      kind === 'glance';

    if (!isGlance || item.isRead) {
      kept.push({
        ...item,
        title: stripExampleCopy(item.title),
        body: stripExampleCopy(item.body),
      });
      continue;
    }

    const member =
      (typeof item.data?.memberId === 'string' && item.data.memberId) ||
      (typeof item.data?.name === 'string' && item.data.name) ||
      (typeof item.data?.memberName === 'string' && item.data.memberName) ||
      glanceMergeKey(undefined, undefined);
    const key = glanceMergeKey(typeof member === 'string' ? member : undefined, undefined);
    const existingAt = glanceIndex.get(key);
    if (existingAt == null) {
      glanceIndex.set(key, kept.length);
      kept.push({
        ...item,
        title: stripExampleCopy(item.title),
        body: stripExampleCopy(item.body),
        data: { ...item.data, urgency: 'today', kind: 'glance', mergeKey: key },
      });
      continue;
    }

    const prev = kept[existingAt]!;
    const age = Math.abs(new Date(prev.createdAt).getTime() - new Date(item.createdAt).getTime());
    if (age > GLANCE_MERGE_MS) {
      kept.push({
        ...item,
        title: stripExampleCopy(item.title),
        body: stripExampleCopy(item.body),
      });
      continue;
    }

    const facts: HouseholdFact[] = [
      factFromNotificationInput(prev),
      factFromNotificationInput(item),
    ];
    const copy = glanceCopy(facts);
    kept[existingAt] = {
      ...prev,
      title: copy.title,
      body: copy.body,
      data: { ...prev.data, urgency: 'today', kind: 'glance', mergeKey: key },
    };
  }

  return kept;
}

export function factToActivityItem(fact: HouseholdFact): {
  id: string;
  action: string;
  detail: string;
  createdAt: string;
  category: string;
} {
  const trophy = fact.trophyName ? displayTrophyName(fact.trophyName) : '';
  const action =
    fact.kind === 'trophy_unlocked'
      ? `Trophy · ${trophy || 'unlocked'}`
      : fact.kind === 'task_completed'
        ? `${fact.memberName ?? 'Someone'} finished a task`
        : fact.templateTitle || fact.kind.replace(/_/g, ' ');
  const detail =
    fact.kind === 'trophy_unlocked'
      ? trophy
      : fact.templateBody || fact.title || '';
  return {
    id: fact.id,
    action: stripExampleCopy(action),
    detail: stripExampleCopy(detail),
    createdAt: new Date(fact.at).toISOString(),
    category: fact.category ?? 'ai',
  };
}
