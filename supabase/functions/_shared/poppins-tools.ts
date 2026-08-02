/** Shared Poppins tool registry + majordomo prompt (mirrors lib/ai/poppins-tools.ts). */

export const POPPINS_MAJORDOMO_SYSTEM = `You are Poppins, the calm AI majordomo for Orbit households (like a family butler).
Your job: (1) notify clearly, (2) help everyone finish fair tasks, (3) keep XP fair, (4) surface deals (food and household goods), (5) know the calendar and holidays, (6) free time for the household lead.
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

export const POPPINS_TOOL_DEFINITIONS = [
  {
    name: 'list_overdue_tasks' as const,
    description: 'List overdue or late open household tasks.',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'nudge_member' as const,
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
    name: 'assess_xp_fairness' as const,
    description: 'Assess weekly XP / load balance and recommend rebalancing (do not edit XP).',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'award_completion_xp' as const,
    description: 'Confirm XP for a just-completed verified task using late-penalty rules. Only when not yet awarded.',
    parameters: {
      type: 'object',
      properties: { taskId: { type: 'string' } },
      required: ['taskId'],
      additionalProperties: false,
    },
  },
  {
    name: 'scan_deals' as const,
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
    name: 'read_calendar' as const,
    description: 'Read upcoming household calendar events.',
    parameters: {
      type: 'object',
      properties: { days: { type: 'number' } },
      additionalProperties: false,
    },
  },
  {
    name: 'list_holidays' as const,
    description: 'List members currently away / on holiday so Poppins avoids nudging them.',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'propose_plan' as const,
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
    name: 'ask_for_info' as const,
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

/** Compact mock deal catalog for edge monitor (mirrors data/mock-deals.ts). */
export const MOCK_DEALS = [
  {
    id: 'deal-milk',
    category: 'grocery',
    title: 'Organic whole milk 1gal',
    store: 'FreshMart',
    typicalPrice: 5.49,
    salePrice: 3.99,
    keywords: ['milk', 'dairy'],
  },
  {
    id: 'deal-berries',
    category: 'grocery',
    title: 'Blueberries 1 pint',
    store: 'FreshMart',
    typicalPrice: 4.5,
    salePrice: 2.5,
    keywords: ['blueberry', 'blueberries', 'produce'],
  },
  {
    id: 'deal-sneakers',
    category: 'shoes',
    title: 'Kids running sneakers',
    store: 'Stride Outlet',
    typicalPrice: 64,
    salePrice: 39,
    keywords: ['shoes', 'sneakers', 'kids'],
  },
  {
    id: 'deal-headphones',
    category: 'electronics',
    title: 'Wireless headphones',
    store: 'ByteBarn',
    typicalPrice: 129,
    salePrice: 79,
    keywords: ['headphones', 'electronics', 'audio'],
  },
  {
    id: 'deal-desk',
    category: 'furniture',
    title: 'Compact study desk',
    store: 'Nest & Form',
    typicalPrice: 189,
    salePrice: 129,
    keywords: ['desk', 'furniture', 'study'],
  },
];

export function scanMockDeals(groceryNames: string[], categories?: string[]) {
  const names = groceryNames.map((n) => n.toLowerCase());
  return MOCK_DEALS.filter((deal) => {
    if (categories?.length && !categories.includes(deal.category)) return false;
    if (deal.category === 'grocery') {
      return deal.keywords.some((kw) => names.some((n) => n.includes(kw) || kw.includes(n)));
    }
    return true;
  }).map((deal) => ({
    ...deal,
    savings: Math.round((deal.typicalPrice - deal.salePrice) * 100) / 100,
  }));
}
