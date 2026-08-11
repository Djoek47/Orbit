/**
 * Shared Poppins tool registry — Monitor Agent + Realtime voice + chat tool loop.
 * Keep in sync with supabase/functions/_shared/poppins-tools.ts
 */

export const POPPINS_MAJORDOMO_SYSTEM = `You are Poppins, the calm AI co-manager for Choremaxx family households.

Mission: (1) notify clearly, (2) help everyone finish fair tasks, (3) keep XP fair, (4) surface deals for food and household goods, (5) know the calendar and holidays, (6) free time for the household lead.

Hard locks:
- Existing tools only (tasks, Plan/itineraries, groceries, rewards, house rules). Never invent product surfaces or tabs.
- Families only — no roommate mode.
- Allowance is tracker-only (Mark as paid). Never imply sending, transferring, or paying money.
- Propose consequential changes — never silently reassign tasks, approve rewards, or spend.
- Never route grocery aisle classification through AI.
- Be brief, actionable, never guilt-inducing. No cute baby talk. No emoji spam.

Playbooks (pick tools cunningly):
- Morning desk: list_overdue_tasks + read_calendar + assess_xp_fairness when load looks uneven.
- Fairness audit: assess_xp_fairness first; only then soft rebalance language — never edit XP.
- Weekend / outing: propose_plan with a clear title, detail, and dayLabel for the lead to review.
- Away-aware: call list_holidays before nudge_member; never nudge someone who is away.
- Kid viewers: encourage and clarify next step; never shame. Adults/admins: clearer tradeoffs.
- Deals: scan_deals when groceries are Missing/Low or the user asks about shopping.

Use tools when they improve the answer. Cap yourself to a few useful calls. Speak like a trusted household majordomo.`;

export type PoppinsToolName =
  | 'list_overdue_tasks'
  | 'nudge_member'
  | 'assess_xp_fairness'
  | 'award_completion_xp'
  | 'scan_deals'
  | 'read_calendar'
  | 'list_holidays'
  | 'propose_plan'
  | 'ask_for_info';

export type PoppinsToolDefinition = {
  name: PoppinsToolName;
  description: string;
  parameters: Record<string, unknown>;
};

export const POPPINS_TOOL_DEFINITIONS: PoppinsToolDefinition[] = [
  {
    name: 'list_overdue_tasks',
    description:
      'List overdue or late open household tasks. Use first when assessing load, morning desk, or before nudging.',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'nudge_member',
    description:
      'Create a calm Poppins notification nudging a member about a late or at-risk task/streak. Call list_holidays first — never nudge someone who is away. Never guilt.',
    parameters: {
      type: 'object',
      properties: {
        memberName: { type: 'string' },
        taskId: { type: 'string' },
        reason: { type: 'string', description: 'Short neutral reason, no guilt.' },
      },
      required: ['memberName', 'reason'],
      additionalProperties: false,
    },
  },
  {
    name: 'assess_xp_fairness',
    description:
      'Assess weekly XP / load balance and recommend soft rebalancing. Does not edit XP. Use for “who’s overloaded?” / fairness questions.',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'award_completion_xp',
    description:
      'Confirm XP rules for a just-completed verified task. App owns the actual award — this only confirms eligibility.',
    parameters: {
      type: 'object',
      properties: { taskId: { type: 'string' } },
      required: ['taskId'],
      additionalProperties: false,
    },
  },
  {
    name: 'scan_deals',
    description:
      'Scan the household deal catalog for groceries and household goods matching Missing/Low lists or asked categories.',
    parameters: {
      type: 'object',
      properties: {
        categories: {
          type: 'array',
          items: { type: 'string', enum: ['grocery', 'shoes', 'electronics', 'furniture'] },
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'read_calendar',
    description:
      'Read upcoming household calendar events for the next N days (default 7). Use for planning and morning desk.',
    parameters: {
      type: 'object',
      properties: { days: { type: 'number' } },
      additionalProperties: false,
    },
  },
  {
    name: 'list_holidays',
    description:
      'List members currently away / on holiday. Always check before nudge_member.',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'propose_plan',
    description:
      'Propose a Plan / itinerary for the household lead to review (not auto-created). Include dayLabel when the user names a day (e.g. Saturday).',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        detail: { type: 'string' },
        dayLabel: { type: 'string' },
      },
      required: ['title', 'detail'],
      additionalProperties: false,
    },
  },
  {
    name: 'ask_for_info',
    description:
      'Ask a household member for a missing detail via notification when you cannot proceed without it.',
    parameters: {
      type: 'object',
      properties: {
        memberName: { type: 'string' },
        question: { type: 'string' },
      },
      required: ['memberName', 'question'],
      additionalProperties: false,
    },
  },
];

/** OpenAI Chat Completions tool schema format. */
export function poppinsToolsAsOpenAIFunctions() {
  return POPPINS_TOOL_DEFINITIONS.map((tool) => ({
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }));
}

/** OpenAI Realtime session tool schema. */
export function poppinsToolsAsRealtimeTools() {
  return POPPINS_TOOL_DEFINITIONS.map((tool) => ({
    type: 'function' as const,
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
  }));
}
