/**
 * Sidekick notification dismiss / mark-read — profile-code auth (no JWT).
 * Persists per-member dismiss via data.dismissedByMemberIds.
 */
import {
  jsonResponse,
  normalizeCode,
  resolveSidekickMember,
  serviceAdmin,
  sidekickCors,
  touchMemberSeen,
} from '../_shared/sidekick-auth.ts';

function asDataRecord(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return { ...(raw as Record<string, unknown>) };
  }
  return {};
}

function withMemberDismissed(
  data: Record<string, unknown>,
  memberId: string
): Record<string, unknown> {
  const existing = Array.isArray(data.dismissedByMemberIds)
    ? data.dismissedByMemberIds.filter((id): id is string => typeof id === 'string')
    : [];
  if (existing.includes(memberId)) {
    return { ...data, dismissedByMemberIds: existing };
  }
  return { ...data, dismissedByMemberIds: [...existing, memberId] };
}

function notificationVisibleToMember(
  data: Record<string, unknown>,
  memberId: string,
  role: string
): boolean {
  const audienceIds = data.audienceMemberIds;
  if (Array.isArray(audienceIds) && audienceIds.length > 0) {
    return audienceIds.some((id) => id === memberId);
  }
  const roles = data.audienceRoles;
  if (Array.isArray(roles) && roles.length > 0) {
    return roles.some((entry) => entry === role || (role === 'child' && entry === 'child'));
  }
  return true;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: sidekickCors });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const code = normalizeCode(String(body.code ?? ''));
    const action = String(body.action ?? 'dismiss');
    const notificationId = String(body.notificationId ?? '').trim();

    if (!code) {
      return jsonResponse({ error: 'code_required' }, 400);
    }
    if (!notificationId) {
      return jsonResponse({ error: 'notification_id_required' }, 400);
    }

    const admin = serviceAdmin();
    const member = await resolveSidekickMember(admin, code);
    if (!member) {
      return jsonResponse({ error: 'not_found' }, 404);
    }

    const { data: row, error: loadError } = await admin
      .from('notifications')
      .select('*')
      .eq('id', notificationId)
      .eq('household_id', member.household_id)
      .maybeSingle();

    if (loadError || !row) {
      return jsonResponse({ error: 'notification_not_found' }, 404);
    }

    const data = asDataRecord(row.data);
    if (!notificationVisibleToMember(data, member.id, String(member.role ?? 'child'))) {
      return jsonResponse({ error: 'forbidden' }, 403);
    }

    if (action === 'mark_read') {
      const { data: updated, error } = await admin
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId)
        .select('*')
        .maybeSingle();

      if (error) {
        return jsonResponse({ error: error.message }, 500);
      }

      await touchMemberSeen(admin, member.id);
      return jsonResponse({ ok: true, notification: updated ?? { ...row, is_read: true } });
    }

    // dismiss (default)
    const nextData = withMemberDismissed(data, member.id);
    const { data: updated, error } = await admin
      .from('notifications')
      .update({ data: nextData, is_read: true })
      .eq('id', notificationId)
      .select('*')
      .maybeSingle();

    if (error) {
      return jsonResponse({ error: error.message }, 500);
    }

    await touchMemberSeen(admin, member.id);
    return jsonResponse({
      ok: true,
      notification: updated ?? { ...row, data: nextData, is_read: true },
    });
  } catch (error) {
    return jsonResponse({ error: String(error) }, 500);
  }
});
