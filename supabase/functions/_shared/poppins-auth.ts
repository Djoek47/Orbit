import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function isSidekickRole(role: string | null | undefined) {
  return role === 'child' || role === 'sidekick';
}

/** Revision G §4.g — Poppins is 403 for Sidekick unless admin enabled sidekick_poppins_ai. */
export function requireNonSidekick(
  role: string | null | undefined,
  options?: { allowed?: boolean }
) {
  if (isSidekickRole(role) && !options?.allowed) {
    return jsonResponse({ error: 'Poppins is not available on this profile.' }, 403);
  }
  return null;
}

async function sidekickPoppinsAiEnabled(
  userClient: ReturnType<typeof createClient>,
  householdId: string
): Promise<boolean> {
  const { data } = await userClient
    .from('households')
    .select('sidekick_poppins_ai')
    .eq('id', householdId)
    .maybeSingle();
  return Boolean(data?.sidekick_poppins_ai);
}

export async function requireActiveMember(
  authHeader: string | null,
  householdId: string | null | undefined
) {
  if (!authHeader) {
    return { error: jsonResponse({ error: 'Unauthorized' }, 401) };
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser();

  if (userError || !user) {
    return { error: jsonResponse({ error: 'Unauthorized' }, 401) };
  }

  if (!householdId) {
    return { error: jsonResponse({ error: 'householdId required' }, 400) };
  }

  const { data: membership, error: memberError } = await userClient
    .from('household_members')
    .select('id, role, status, display_name')
    .eq('household_id', householdId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (memberError || !membership || membership.status !== 'active') {
    return { error: jsonResponse({ error: 'Active household membership required' }, 403) };
  }

  let allowSidekick = false;
  if (isSidekickRole(membership.role)) {
    allowSidekick = await sidekickPoppinsAiEnabled(userClient, householdId);
  }
  const sidekickBlock = requireNonSidekick(membership.role, { allowed: allowSidekick });
  if (sidekickBlock) {
    return { error: sidekickBlock };
  }

  return { user, membership, userClient };
}

export function buildCompactHouseholdContext(household: Record<string, unknown> | null | undefined) {
  if (!household || typeof household !== 'object') {
    return {};
  }

  const tasks = Array.isArray(household.tasks) ? household.tasks : [];
  const groceries = Array.isArray(household.groceries) ? household.groceries : [];
  const events = Array.isArray(household.events) ? household.events : [];
  const members = Array.isArray(household.members) ? household.members : [];

  return {
    householdName: household.householdName ?? household.household_name,
    greetingName: household.greetingName ?? household.greeting_name,
    openTasks: tasks
      .filter((t: { status?: string }) => t.status !== 'Completed' && t.status !== 'completed')
      .slice(0, 8)
      .map((t: { title?: string; assignee?: string; due?: string; status?: string }) => ({
        title: t.title,
        assignee: t.assignee,
        due: t.due,
        status: t.status,
      })),
    missingGroceries: groceries
      .filter((g: { status?: string }) => g.status === 'Missing' || g.status === 'missing')
      .slice(0, 6)
      .map((g: { name?: string; category?: string }) => ({ name: g.name, category: g.category })),
    upcomingEvents: events.slice(0, 5).map((e: { title?: string; date?: string; time?: string }) => ({
      title: e.title,
      date: e.date,
      time: e.time,
    })),
    members: members
      .filter((m: { status?: string }) => m.status === 'active')
      .map((m: { name?: string; role?: string; weekXp?: number; xp?: number; streak?: number }) => ({
        name: m.name,
        role: m.role,
        weekXp: m.weekXp ?? m.week_xp,
        xp: m.xp,
        streak: m.streak,
      })),
  };
}
