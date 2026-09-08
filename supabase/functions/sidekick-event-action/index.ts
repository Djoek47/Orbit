/**
 * Sidekick calendar event writes — profile-code auth.
 */
import {
  assertCapability,
  loadHouseholdSettings,
  resolveSidekickEventApproval,
} from '../_shared/household-settings.ts';
import {
  jsonResponse,
  normalizeCode,
  resolveSidekickMember,
  serviceAdmin,
  sidekickCors,
  touchMemberSeen,
} from '../_shared/sidekick-auth.ts';
import { notifyAdminsAndPush } from '../_shared/sidekick-notify.ts';

function normalizeCategory(raw: string) {
  const value = raw.trim().toLowerCase();
  const map: Record<string, string> = {
    school: 'school',
    activity: 'activity',
    practice: 'activity',
    appointment: 'appointment',
    family: 'family',
    routine: 'routine',
  };
  return map[value] ?? 'family';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: sidekickCors });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const code = normalizeCode(String(body.code ?? ''));
    const action = String(body.action ?? 'create_event');
    const title = String(body.title ?? '').trim();

    if (!code || !title) {
      return jsonResponse({ error: 'code_and_title_required' }, 400);
    }

    if (action !== 'create_event') {
      return jsonResponse({ error: 'unknown_action' }, 400);
    }

    const admin = serviceAdmin();
    const member = await resolveSidekickMember(admin, code);
    if (!member) {
      return jsonResponse({ error: 'not_found' }, 404);
    }

    const settings = await loadHouseholdSettings(admin, member.household_id);
    if (!settings) {
      return jsonResponse({ error: 'household_not_found' }, 404);
    }

    const capDenied = assertCapability(settings, 'allowCalendarCreate');
    if (capDenied) return capDenied;

    const category = normalizeCategory(String(body.category ?? 'family'));
    const approvalStatus = resolveSidekickEventApproval(settings, category);
    const dateLabel = String(body.date ?? 'Today').trim() || 'Today';
    const timeLabel = String(body.time ?? '').trim() || 'All day';
    const location = String(body.location ?? '').trim();
    const householdWide = Boolean(body.householdWide);
    const startsAt = body.startsAt ? String(body.startsAt) : null;
    const attendeeIds = Array.isArray(body.attendeeMemberIds)
      ? body.attendeeMemberIds.filter((id: unknown): id is string => typeof id === 'string')
      : [member.id];

    const { data: event, error } = await admin
      .from('calendar_events')
      .insert({
        household_id: member.household_id,
        title,
        category,
        date_label: dateLabel,
        time_label: timeLabel,
        location,
        responsible_name: member.display_name,
        responsible_member_id: member.id,
        household_wide: householdWide,
        starts_at: startsAt,
        approval_status: approvalStatus,
        created_by_member_id: member.id,
      })
      .select('*')
      .single();

    if (error || !event) {
      return jsonResponse({ error: error?.message ?? 'insert_failed' }, 500);
    }

    if (attendeeIds.length) {
      await admin.from('event_assignments').insert(
        attendeeIds.map((memberId: string) => ({
          event_id: event.id,
          household_id: member.household_id,
          member_id: memberId,
        }))
      );
    }

    await touchMemberSeen(admin, member.id);

    if (approvalStatus === 'pending') {
      await notifyAdminsAndPush(admin, {
        householdId: member.household_id,
        title: 'Plan item needs approval',
        body: `${member.display_name} submitted "${title}" for your review.`,
        category: 'events',
        priority: 'high',
        data: {
          kind: 'event_pending',
          eventId: event.id,
          memberName: member.display_name,
        },
      });
    }

    return jsonResponse({ event, attendeeMemberIds: attendeeIds, approvalStatus });
  } catch (error) {
    return jsonResponse({ error: String(error) }, 500);
  }
});
