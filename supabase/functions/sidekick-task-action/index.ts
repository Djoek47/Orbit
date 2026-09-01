/**
 * Sidekick task writes — profile-code auth for devices without Supabase JWT.
 * Actions: complete, submit_proof
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function normalizeCode(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/^CHOREMAXX-/, 'CMX-')
    .replace(/^(CMX|ORBIT)(?=[A-Z0-9])/, '$1-');
}

function memberMatchesAssignee(
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

async function resolveMember(admin: ReturnType<typeof createClient>, code: string) {
  const { data: member, error } = await admin
    .from('household_members')
    .select('*')
    .eq('profile_invite_code', code)
    .in('status', ['invited', 'active'])
    .maybeSingle();
  if (error || !member) return null;
  return member;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const code = normalizeCode(String(body.code ?? ''));
    const action = String(body.action ?? 'complete');
    const taskId = String(body.taskId ?? '').trim();

    if (!code || !taskId) {
      return new Response(JSON.stringify({ error: 'code_and_task_required' }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const member = await resolveMember(admin, code);
    if (!member) {
      return new Response(JSON.stringify({ error: 'not_found' }), {
        status: 404,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const { data: task, error: taskError } = await admin
      .from('tasks')
      .select('*')
      .eq('id', taskId)
      .eq('household_id', member.household_id)
      .maybeSingle();

    if (taskError || !task) {
      return new Response(JSON.stringify({ error: 'task_not_found' }), {
        status: 404,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    if (!memberMatchesAssignee(member, task)) {
      return new Response(JSON.stringify({ error: 'not_assignee' }), {
        status: 403,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'submit_proof') {
      const proofUri = String(body.proofUri ?? '').trim();
      if (!proofUri) {
        return new Response(JSON.stringify({ error: 'proof_uri_required' }), {
          status: 400,
          headers: { ...cors, 'Content-Type': 'application/json' },
        });
      }

      const nextStatus =
        task.status === 'pending' || task.status === 'overdue' ? 'in_progress' : task.status;

      const { data: updated, error: updateError } = await admin
        .from('tasks')
        .update({
          proof_uri: proofUri,
          proof_status: 'submitted',
          status: nextStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', taskId)
        .select('*')
        .single();

      if (updateError) {
        return new Response(JSON.stringify({ error: updateError.message }), {
          status: 500,
          headers: { ...cors, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ task: updated }), {
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    if (action !== 'complete') {
      return new Response(JSON.stringify({ error: 'unknown_action' }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    if (task.status === 'completed') {
      return new Response(JSON.stringify({ error: 'already_completed' }), {
        status: 409,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const completedAt = String(body.completedAt ?? new Date().toISOString());
    const awardedXp = Math.max(0, Number(body.awardedXp ?? 0) || 0);
    const completedLate = Boolean(body.completedLate);
    const verification = body.verification ?? 'not_required';
    const taskStatus = String(body.taskStatus ?? 'completed');
    const dueLabel = String(body.dueLabel ?? 'Completed today');
    const safeStatus =
      taskStatus === 'in_progress' || taskStatus === 'completed' ? taskStatus : 'completed';

    const updatePayload: Record<string, unknown> = {
      status: safeStatus,
      due_label: safeStatus === 'completed' ? dueLabel : task.due_label,
      completed_at: safeStatus === 'completed' ? completedAt : task.completed_at,
      awarded_xp: safeStatus === 'completed' ? awardedXp : task.awarded_xp,
      completed_late: completedLate,
      verification,
      updated_at: new Date().toISOString(),
    };

    const { data: updated, error: updateError } = await admin
      .from('tasks')
      .update(updatePayload)
      .eq('id', taskId)
      .select('*')
      .single();

    if (updateError) {
      return new Response(JSON.stringify({ error: updateError.message }), {
        status: 500,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    if (awardedXp > 0) {
      const { data: memberRow } = await admin
        .from('household_members')
        .select('id, xp, week_xp')
        .eq('id', member.id)
        .maybeSingle();

      if (memberRow) {
        await admin
          .from('household_members')
          .update({
            xp: (memberRow.xp ?? 0) + awardedXp,
            week_xp: (memberRow.week_xp ?? 0) + awardedXp,
          })
          .eq('id', member.id);

        await admin.from('xp_transactions').insert({
          household_id: member.household_id,
          user_id: null,
          member_id: member.id,
          amount: awardedXp,
          reason: completedLate
            ? `Completed task (late): ${task.title}`
            : `Completed task: ${task.title}`,
          related_task_id: taskId,
        });
      }
    }

    const bonusAwards = Array.isArray(body.bonusAwards)
      ? body.bonusAwards.filter(
          (row: unknown) =>
            row &&
            typeof row === 'object' &&
            typeof (row as { memberId?: string }).memberId === 'string' &&
            Number((row as { amount?: number }).amount) > 0
        )
      : [];

    for (const bonus of bonusAwards as { memberId: string; amount: number; reason?: string }[]) {
      const { data: bonusMember } = await admin
        .from('household_members')
        .select('id, xp, week_xp')
        .eq('id', bonus.memberId)
        .eq('household_id', member.household_id)
        .maybeSingle();
      if (!bonusMember) continue;
      await admin
        .from('household_members')
        .update({
          xp: (bonusMember.xp ?? 0) + bonus.amount,
          week_xp: (bonusMember.week_xp ?? 0) + bonus.amount,
        })
        .eq('id', bonusMember.id);
      await admin.from('xp_transactions').insert({
        household_id: member.household_id,
        user_id: null,
        member_id: bonusMember.id,
        amount: bonus.amount,
        reason: bonus.reason ?? `Split bonus: ${task.title}`,
        related_task_id: taskId,
      });
    }

    await admin
      .from('household_members')
      .update({ last_seen_at: new Date().toISOString() })
      .eq('id', member.id);

    return new Response(JSON.stringify({ task: updated, memberXpAwarded: awardedXp }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }
});
