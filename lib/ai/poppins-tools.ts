/**
 * Shared Poppins tool registry — Monitor Agent + Realtime voice.
 * Client-safe definitions; edge mirrors live in supabase/functions/_shared/poppins-tools.ts
 */

export const POPPINS_MAJORDOMO_SYSTEM = `You are Poppins, the calm AI co-manager for Choremaxx family households.
Your job: (1) notify clearly, (2) help everyone finish fair tasks, (3) keep XP fair, (4) surface deals (food and household goods), (5) know the calendar and holidays, (6) free time for the household lead.
Stay on existing tools only (tasks, Plan/itineraries, groceries, rewards, house rules) — never invent product surfaces. Families only — no roommate mode. Allowance is tracker-only (Mark as paid); never imply sending money.
Be brief, actionable, never guilt-inducing. Propose consequential changes — never silently reassign tasks, approve rewards, or spend money.`;

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
    description: 'List overdue or late open household tasks.',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'nudge_member',
    description: 'Create a Poppins notification nudging a member about a late or at-risk task/streak.',
    parameters: {
      type: 'object',
      properties: {
        memberName: { type: 'string' },
        taskId: { type: 'string' },
        reason: { type: 'string' },
      },
      required: ['memberName', 'reason'],
      additionalProperties: false,
    },
  },
  {
    name: 'assess_xp_fairness',
    description: 'Assess weekly XP / load balance and recommend rebalancing (do not edit XP).',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'award_completion_xp',
    description: 'Confirm XP for a just-completed verified task using late-penalty rules. Only when not yet awarded.',
    parameters: {
      type: 'object',
      properties: { taskId: { type: 'string' } },
      required: ['taskId'],
      additionalProperties: false,
    },
  },
  {
    name: 'scan_deals',
    description: 'Scan mock deals for groceries and household goods (shoes, electronics, furniture).',
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
    description: 'Read upcoming household calendar events.',
    parameters: {
      type: 'object',
      properties: { days: { type: 'number' } },
      additionalProperties: false,
    },
  },
  {
    name: 'list_holidays',
    description: 'List members currently away / on holiday so Poppins avoids nudging them.',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'propose_plan',
    description: 'Propose a plan or itinerary recommendation for the household lead to review.',
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
    description: 'Ask a household member for missing information via notification.',
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
