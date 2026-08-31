/** Shared Poppins tool registry (mirrors lib/ai/poppins-tools.ts). Prompt → majordomo-profiles. */

export {
  POPPINS_MAJORDOMO_SYSTEM,
  buildMajordomoSystemPrompt,
  getMajordomoProfile,
  resolveMajordomoProfileId,
  DEFAULT_MAJORDOMO_PROFILE_ID,
  MAJORDOMO_PROFILES,
} from './majordomo-profiles.ts';

export type PoppinsToolName =
  | 'list_overdue_tasks'
  | 'list_tasks'
  | 'nudge_member'
  | 'assess_xp_fairness'
  | 'award_completion_xp'
  | 'scan_deals'
  | 'list_groceries'
  | 'add_grocery'
  | 'set_grocery_status'
  | 'read_calendar'
  | 'list_holidays'
  | 'propose_plan'
  | 'ask_for_info'
  | 'remember_house_fact'
  | 'list_members'
  | 'list_rewards'
  | 'search_house_rules'
  | 'get_pending_approvals'
  | 'get_briefing_snapshot'
  | 'get_unread_notifications'
  | 'list_itineraries'
  | 'get_smart_home_state'
  | 'create_task_draft'
  | 'assign_task'
  | 'update_task'
  | 'complete_task'
  | 'create_calendar_event'
  | 'create_itinerary'
  | 'advance_itinerary_stop'
  | 'claim_reward'
  | 'navigate_to'
  | 'present_ui_scene'
  | 'delete_task'
  | 'clear_grocery_list'
  | 'delete_event'
  | 'approve_redemption'
  | 'reject_redemption'
  | 'approve_allowance'
  | 'reject_allowance'
  | 'grant_allowance'
  | 'remove_member'
  | 'change_member_role'
  | 'mass_reassign_tasks'
  | 'recess_everyone'
  | 'run_smart_home_scene'
  | 'update_reward_model'
  | 'ui_confirm_pending'
  | 'end_session';

export type PoppinsToolRisk = 'safe_parallel' | 'safe_serial' | 'risky' | 'session';

export type PoppinsToolDefinition = {
  name: PoppinsToolName;
  description: string;
  parameters: Record<string, unknown>;
  risk: PoppinsToolRisk;
};

/** Allowlisted in-app routes for navigate_to. */
export const POPPINS_NAV_ROUTES = [
  '/(tabs)',
  '/(tabs)/tasks',
  '/(tabs)/calendar',
  '/(tabs)/rewards',
  '/(tabs)/poppins',
  '/(tabs)/groceries',
  '/shopping-mode',
  '/create-task',
  '/assign-task',
  '/create-event',
  '/create-itinerary',
  '/create-reward',
  '/create-allowance',
  '/grant-allowance',
  '/house-rules',
  '/recess',
  '/settings',
  '/notifications',
  '/household-members',
  '/household-balance',
  '/momentum',
  '/weekly-report',
  '/places',
  '/smart-home',
  '/badge-gallery',
] as const;

export const POPPINS_TOOL_DEFINITIONS: PoppinsToolDefinition[] = [
  {
    name: 'list_overdue_tasks',
    description: 'List overdue or late open household tasks.',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
    risk: 'safe_parallel',
  },
  {
    name: 'list_tasks',
    description: 'List open tasks with optional filters (assignee name, status).',
    parameters: {
      type: 'object',
      properties: {
        assignee: { type: 'string' },
        status: { type: 'string' },
        limit: { type: 'number' },
      },
      additionalProperties: false,
    },
    risk: 'safe_parallel',
  },
  {
    name: 'nudge_member',
    description:
      'Calm nudge notification for a member. Call list_holidays first — never nudge someone away. Never guilt.',
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
    risk: 'safe_serial',
  },
  {
    name: 'assess_xp_fairness',
    description: 'Assess weekly XP balance. Does not edit XP.',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
    risk: 'safe_parallel',
  },
  {
    name: 'award_completion_xp',
    description: 'Confirm XP eligibility for a completed task. App owns the award.',
    parameters: {
      type: 'object',
      properties: { taskId: { type: 'string' } },
      required: ['taskId'],
      additionalProperties: false,
    },
    risk: 'safe_serial',
  },
  {
    name: 'scan_deals',
    description:
      'Match Missing/Low grocery names to researched catalog products. Never invent sale prices or fake stores.',
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
    risk: 'safe_parallel',
  },
  {
    name: 'list_groceries',
    description: 'List grocery items, optionally filtered by status Missing|Low|Purchased.',
    parameters: {
      type: 'object',
      properties: { status: { type: 'string' } },
      additionalProperties: false,
    },
    risk: 'safe_parallel',
  },
  {
    name: 'add_grocery',
    description:
      'Stage an item on the IUI grocery/shopping card. HOLD silence commits. Clothing, sneakers, Jordan drops go on the shopping lane. If it releases in the future, also call create_calendar_event for that date. Never navigate_to Groceries unless they asked to open the list themselves.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        category: { type: 'string' },
        lane: { type: 'string', enum: ['grocery', 'clothing'] },
        releaseDate: { type: 'string' },
      },
      required: ['name'],
      additionalProperties: false,
    },
    risk: 'safe_serial',
  },
  {
    name: 'set_grocery_status',
    description: 'Set grocery item status to Missing, Low, or Purchased.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        status: { type: 'string', enum: ['Missing', 'Low', 'Purchased'] },
      },
      required: ['name', 'status'],
      additionalProperties: false,
    },
    risk: 'safe_serial',
  },
  {
    name: 'read_calendar',
    description: 'Read upcoming calendar events for the next N days (default 7).',
    parameters: {
      type: 'object',
      properties: { days: { type: 'number' } },
      additionalProperties: false,
    },
    risk: 'safe_parallel',
  },
  {
    name: 'list_holidays',
    description: 'List members currently away. Always check before nudge_member.',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
    risk: 'safe_parallel',
  },
  {
    name: 'propose_plan',
    description: 'Propose a Plan/itinerary draft for lead review (not auto-created).',
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
    risk: 'safe_serial',
  },
  {
    name: 'ask_for_info',
    description: 'Ask a member for a missing detail via notification.',
    parameters: {
      type: 'object',
      properties: {
        memberName: { type: 'string' },
        question: { type: 'string' },
      },
      required: ['memberName', 'question'],
      additionalProperties: false,
    },
    risk: 'safe_serial',
  },
  {
    name: 'remember_house_fact',
    description:
      'Remember a household like, dislike, or routine (who prefers which chore, preferred store). Do not store medical, passwords, or home address. One short fact.',
    parameters: {
      type: 'object',
      properties: {
        kind: { type: 'string', enum: ['like', 'dislike', 'routine', 'note'] },
        subject: { type: 'string', description: 'Member name or house' },
        text: { type: 'string' },
      },
      required: ['kind', 'text'],
      additionalProperties: false,
    },
    risk: 'safe_serial',
  },
  {
    name: 'list_members',
    description: 'List active household members with role and week XP.',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
    risk: 'safe_parallel',
  },
  {
    name: 'list_rewards',
    description: 'List rewards and pending redemptions.',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
    risk: 'safe_parallel',
  },
  {
    name: 'search_house_rules',
    description: 'Search house rules by keyword (Admin or Sidekick voice).',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        voice: { type: 'string', enum: ['admin', 'sidekick'] },
      },
      required: ['query'],
      additionalProperties: false,
    },
    risk: 'safe_parallel',
  },
  {
    name: 'get_pending_approvals',
    description: 'Pending proofs, redemptions, and allowances awaiting review.',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
    risk: 'safe_parallel',
  },
  {
    name: 'get_briefing_snapshot',
    description: 'Compact household desk brief for the current day.',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
    risk: 'safe_parallel',
  },
  {
    name: 'get_unread_notifications',
    description: 'Unread in-app notifications.',
    parameters: {
      type: 'object',
      properties: { limit: { type: 'number' } },
      additionalProperties: false,
    },
    risk: 'safe_parallel',
  },
  {
    name: 'list_itineraries',
    description: 'Active or recent itineraries / Plan trips.',
    parameters: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['active', 'planned', 'any'] },
        limit: { type: 'number' },
      },
      additionalProperties: false,
    },
    risk: 'safe_parallel',
  },
  {
    name: 'get_smart_home_state',
    description: 'Smart-home scene / device summary when linked.',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
    risk: 'safe_parallel',
  },
  {
    name: 'create_task_draft',
    description:
      'Assign a household task on the IUI stage. Pass a short chore name (“Wash the car”, “tend to the dishes”), never the spoken sentence (“I’ll set a task to…”). If the household already has a close open task, reuse that title. Pass libraryTaskId when it is a catalog chore. Pass assignee when they said me or a member name. Pass category kitchen_dining when they said dishes/kitchen. HOLD writes the task — never say draft. One short spoken sentence per beat; wait for tap or HOLD.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        assignee: { type: 'string' },
        due: { type: 'string' },
        detail: { type: 'string' },
        category: { type: 'string' },
        libraryTaskId: { type: 'string' },
        taskQuery: { type: 'string' },
        repeat: { type: 'string', enum: ['Daily'] },
      },
      additionalProperties: false,
    },
    risk: 'safe_serial',
  },
  {
    name: 'update_task',
    description: 'Update fields on an existing task (title, assignee, due, status).',
    parameters: {
      type: 'object',
      properties: {
        taskId: { type: 'string' },
        title: { type: 'string' },
        assignee: { type: 'string' },
        due: { type: 'string' },
        status: { type: 'string' },
        detail: { type: 'string' },
      },
      required: ['taskId'],
      additionalProperties: false,
    },
    risk: 'safe_serial',
  },
  {
    name: 'complete_task',
    description: 'Mark a task complete by id or title match. Returns ui_action for the app.',
    parameters: {
      type: 'object',
      properties: {
        taskId: { type: 'string' },
        title: { type: 'string' },
      },
      additionalProperties: false,
    },
    risk: 'safe_serial',
  },
  {
    name: 'create_calendar_event',
    description:
      'Stage a calendar event on the IUI stage (lattice → card). HOLD silence commits. Use navigate_to /create-event only if they asked for the full editor.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        date: { type: 'string' },
        time: { type: 'string' },
        location: { type: 'string' },
        notes: { type: 'string' },
      },
      required: ['title', 'date'],
      additionalProperties: false,
    },
    risk: 'safe_serial',
  },
  {
    name: 'create_itinerary',
    description:
      'Stage a Plan stop on the IUI itinerary stage. HOLD silence commits. Use navigate_to /create-itinerary only if they asked for the full editor.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        startsAt: { type: 'string' },
        notes: { type: 'string' },
      },
      required: ['title'],
      additionalProperties: false,
    },
    risk: 'safe_serial',
  },
  {
    name: 'advance_itinerary_stop',
    description: 'Advance the current itinerary stop.',
    parameters: {
      type: 'object',
      properties: { itineraryId: { type: 'string' } },
      required: ['itineraryId'],
      additionalProperties: false,
    },
    risk: 'safe_serial',
  },
  {
    name: 'claim_reward',
    description: 'Claim or request a reward by name for the current member.',
    parameters: {
      type: 'object',
      properties: { rewardName: { type: 'string' } },
      required: ['rewardName'],
      additionalProperties: false,
    },
    risk: 'safe_serial',
  },
  {
    name: 'navigate_to',
    description:
      'Coach-navigate ONLY when they asked to drive a human screen (Settings, billing, House Rules, or “open Assign so I can pick it myself”). Never use this for add-task, dishes, kitchen, groceries, or shopping — those are create_task_draft / add_grocery / complete_task on the IUI stage. Never say “I can open that for you” or “I’ll draft a task”.',
    parameters: {
      type: 'object',
      properties: {
        route: { type: 'string' },
        reason: { type: 'string' },
        openEditor: { type: 'boolean' },
      },
      required: ['route'],
      additionalProperties: false,
    },
    risk: 'safe_serial',
  },
  {
    name: 'present_ui_scene',
    description:
      'Advance a closed IUI beat (thinking, task_compose, calendar_zoom, itinerary_stage, grocery_add, reward_mint, list_peek, member_pick, confirm, navigate_coach, task_done, result_mark). Never invent widgets. Prefer create_task_draft / add_grocery over navigate_coach. After HOLD, the task exists — say assigned, never draft.',
    parameters: {
      type: 'object',
      properties: {
        scene: {
          type: 'string',
          enum: [
            'thinking',
            'task_compose',
            'calendar_zoom',
            'itinerary_stage',
            'grocery_add',
            'reward_mint',
            'list_peek',
            'member_pick',
            'confirm',
            'navigate_coach',
            'task_done',
            'result_mark',
          ],
        },
        payload: { type: 'object' },
        commit: { type: 'string', enum: ['hold', 'confirm', 'none'] },
      },
      required: ['scene'],
      additionalProperties: false,
    },
    risk: 'safe_serial',
  },
  {
    name: 'delete_task',
    description: 'RISKY — request deletion of a task. Stages confirmation; does not execute alone.',
    parameters: {
      type: 'object',
      properties: {
        taskId: { type: 'string' },
        title: { type: 'string' },
      },
      additionalProperties: false,
    },
    risk: 'risky',
  },
  {
    name: 'clear_grocery_list',
    description: 'RISKY — wipe the grocery list. Stages confirmation.',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
    risk: 'risky',
  },
  {
    name: 'delete_event',
    description: 'RISKY — delete a calendar event by id or title. Stages confirmation.',
    parameters: {
      type: 'object',
      properties: {
        eventId: { type: 'string' },
        title: { type: 'string' },
      },
      additionalProperties: false,
    },
    risk: 'risky',
  },
  {
    name: 'approve_redemption',
    description: 'RISKY — approve a pending reward redemption. Stages confirmation.',
    parameters: {
      type: 'object',
      properties: { redemptionId: { type: 'string' } },
      required: ['redemptionId'],
      additionalProperties: false,
    },
    risk: 'risky',
  },
  {
    name: 'reject_redemption',
    description: 'RISKY — reject a pending reward redemption. Stages confirmation.',
    parameters: {
      type: 'object',
      properties: {
        redemptionId: { type: 'string' },
        reason: { type: 'string' },
      },
      required: ['redemptionId'],
      additionalProperties: false,
    },
    risk: 'risky',
  },
  {
    name: 'approve_allowance',
    description: 'RISKY — approve a pending allowance request. Stages confirmation.',
    parameters: {
      type: 'object',
      properties: { requestId: { type: 'string' } },
      required: ['requestId'],
      additionalProperties: false,
    },
    risk: 'risky',
  },
  {
    name: 'reject_allowance',
    description: 'RISKY — reject a pending allowance request. Stages confirmation.',
    parameters: {
      type: 'object',
      properties: {
        requestId: { type: 'string' },
        reason: { type: 'string' },
      },
      required: ['requestId'],
      additionalProperties: false,
    },
    risk: 'risky',
  },
  {
    name: 'grant_allowance',
    description: 'RISKY — grant allowance to a member. Stages confirmation.',
    parameters: {
      type: 'object',
      properties: {
        memberName: { type: 'string' },
        amount: { type: 'number' },
        note: { type: 'string' },
      },
      required: ['memberName', 'amount'],
      additionalProperties: false,
    },
    risk: 'risky',
  },
  {
    name: 'remove_member',
    description: 'RISKY — remove a household member. Never use for self. Stages confirmation.',
    parameters: {
      type: 'object',
      properties: {
        memberId: { type: 'string' },
        memberName: { type: 'string' },
        reason: { type: 'string' },
      },
      additionalProperties: false,
    },
    risk: 'risky',
  },
  {
    name: 'change_member_role',
    description: 'RISKY — change a member role. Stages confirmation.',
    parameters: {
      type: 'object',
      properties: {
        memberId: { type: 'string' },
        memberName: { type: 'string' },
        role: { type: 'string', enum: ['admin', 'adult', 'teen', 'child', 'roommate'] },
      },
      required: ['role'],
      additionalProperties: false,
    },
    risk: 'risky',
  },
  {
    name: 'mass_reassign_tasks',
    description: 'RISKY — reassign many tasks at once. Stages confirmation.',
    parameters: {
      type: 'object',
      properties: {
        fromMemberName: { type: 'string' },
        toMemberName: { type: 'string' },
        taskIds: { type: 'array', items: { type: 'string' } },
      },
      required: ['toMemberName'],
      additionalProperties: false,
    },
    risk: 'risky',
  },
  {
    name: 'recess_everyone',
    description: 'RISKY — put the whole household on recess. Stages confirmation.',
    parameters: {
      type: 'object',
      properties: {
        until: { type: 'string' },
        reason: { type: 'string' },
      },
      required: ['until'],
      additionalProperties: false,
    },
    risk: 'risky',
  },
  {
    name: 'run_smart_home_scene',
    description: 'RISKY — run a smart-home scene. Stages confirmation.',
    parameters: {
      type: 'object',
      properties: {
        sceneId: { type: 'string' },
        sceneName: { type: 'string' },
      },
      additionalProperties: false,
    },
    risk: 'risky',
  },
  {
    name: 'update_reward_model',
    description: 'RISKY — change reward / XP model settings. Stages confirmation.',
    parameters: {
      type: 'object',
      properties: {
        settingKey: { type: 'string' },
        value: {},
        reason: { type: 'string' },
      },
      required: ['settingKey'],
      additionalProperties: false,
    },
    risk: 'risky',
  },
  {
    name: 'ui_confirm_pending',
    description:
      'Acknowledge that a confirmation sheet was shown; do not execute risky actions yourself.',
    parameters: {
      type: 'object',
      properties: {
        confirmationIds: { type: 'array', items: { type: 'string' } },
      },
      additionalProperties: false,
    },
    risk: 'session',
  },
  {
    name: 'end_session',
    description:
      'End the live voice session to stop Realtime cost when the request is done and the user is finished. Prefer after clear goodbye or when they say thanks/bye. Always last.',
    parameters: {
      type: 'object',
      properties: { reason: { type: 'string' } },
      additionalProperties: false,
    },
    risk: 'session',
  },
];

export function getPoppinsToolDef(name: string): PoppinsToolDefinition | undefined {
  return POPPINS_TOOL_DEFINITIONS.find((t) => t.name === name);
}

export function isRiskyPoppinsTool(name: string): boolean {
  return getPoppinsToolDef(name)?.risk === 'risky';
}

export function orderPoppinsToolCalls<T extends { name: string }>(calls: T[]): T[] {
  const rank = (name: string) => {
    const risk = getPoppinsToolDef(name)?.risk ?? 'safe_serial';
    if (risk === 'safe_parallel') return 0;
    if (risk === 'safe_serial') return 1;
    if (risk === 'risky') return 2;
    return 3;
  };
  return [...calls].sort((a, b) => rank(a.name) - rank(b.name));
}

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

export function poppinsToolsAsRealtimeTools() {
  return POPPINS_TOOL_DEFINITIONS.map((tool) => ({
    type: 'function' as const,
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
  }));
}

/** Household grocery names still needed — no invented stores or sale prices. */
export function scanGroceryNeeds(groceryNames: string[], _categories?: string[]) {
  return groceryNames
    .map((name) => name.trim())
    .filter(Boolean)
    .slice(0, 5)
    .map((title) => ({
      id: `need-${title.toLowerCase().replace(/\s+/g, '-')}`,
      category: 'grocery',
      title,
      store: '',
      keywords: [title.toLowerCase()],
    }));
}

