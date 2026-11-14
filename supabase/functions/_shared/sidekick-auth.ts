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

/**
 * Stamp presence. When hostKind is shared-tablet, updates shared_* columns;
 * otherwise personal_last_seen_at. Always keeps last_seen_at for legacy clients.
 */
export async function touchMemberSeen(
  admin: SupabaseClient,
  memberId: string,
  options?: {
    hostKind?: 'sidekick' | 'shared-tablet' | string | null;
    sharedDeviceId?: string | null;
    disconnect?: boolean;
  }
) {
  const seenAt = options?.disconnect
    ? new Date(Date.now() - 6 * 60 * 1000).toISOString()
    : new Date().toISOString();
  const isShared =
    options?.hostKind === 'shared-tablet' || options?.hostKind === 'shared';
  const patch: Record<string, unknown> = { last_seen_at: seenAt };
  if (isShared) {
    patch.shared_last_seen_at = seenAt;
    patch.shared_active_on_device_id = options?.disconnect
      ? null
      : options?.sharedDeviceId?.trim() || null;
  } else {
    patch.personal_last_seen_at = seenAt;
  }
  await admin.from('household_members').update(patch).eq('id', memberId);
}

export function serviceAdmin() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
}
