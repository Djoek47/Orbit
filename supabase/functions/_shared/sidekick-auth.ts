import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

export const sidekickCors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...sidekickCors, 'Content-Type': 'application/json' },
  });
}

export function normalizeCode(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/^CHOREMAXX-/, 'CMX-')
    .replace(/^(CMX|ORBIT)(?=[A-Z0-9])/, '$1-');
}

export function memberMatchesAssignee(
  member: { id: string; display_name: string },
  task: { assignee_name: string; assignee_member_id?: string | null }
): boolean {
  if (task.assignee_member_id && task.assignee_member_id === member.id) {
    return true;
  }
  const name = member.display_name.trim().toLowerCase();
  const assignee = task.assignee_name.trim().toLowerCase();
  if (!name || !assignee) return false;
  if (assignee === name) return true;
  const parts = assignee.split(/\s*(?:&|,)\s*/).map((part) => part.trim()).filter(Boolean);
  return parts.some((part) => part === name);
}

export async function resolveSidekickMember(admin: SupabaseClient, code: string) {
  const { data: member, error } = await admin
    .from('household_members')
    .select('*')
    .eq('profile_invite_code', code)
    .in('status', ['invited', 'active'])
    .maybeSingle();
  if (error || !member) return null;
  return member;
}

export async function touchMemberSeen(admin: SupabaseClient, memberId: string) {
  await admin
    .from('household_members')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('id', memberId);
}

export function serviceAdmin() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
}
