/**
 * Sidekick task writes — profile-code auth.
 * Actions: complete, submit_proof, create_homework
 */
import {
  jsonResponse,
  memberMatchesAssignee,
  normalizeCode,
  resolveSidekickMember,
  serviceAdmin,
  sidekickCors,
  touchMemberSeen,
} from '../_shared/sidekick-auth.ts';
import { notifyAdminsAndPush } from '../_shared/sidekick-notify.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: sidekickCors });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const code = normalizeCode(String(body.code ?? ''));
    const action = String(body.action ?? 'complete');

    if (!code) {
      return jsonResponse({ error: 'code_required' }, 400);
    }

    const admin = serviceAdmin();
    const member = await resolveSidekickMember(admin, code);
    if (!member) {
      return jsonResponse({ error: 'not_found' }, 404);
    }

    if (action === 'create_homework') {
      const title = String(body.title ?? '').trim();
      if (!title) {
        return jsonResponse({ error: 'title_required' }, 400);
      }

      const xp = Math.max(1, Number(body.xp ?? 10) || 10);
      const homeworkSubject = body.homeworkSubject ? String(body.homeworkSubject).trim() : null;
      const dueLabel = String(body.dueLabel ?? 'Today').trim() || 'Today';
      const category = String(body.category ?? 'Homework').trim() || 'Homework';

      const { data: task, error } = await admin
        .from('tasks')
        .insert({
          household_id: member.household_id,
          title,
          category,
          assignee_name: member.display_name,
          assignee_member_id: member.id,
          due_label: dueLabel,
          xp_value: xp,
          repeat_rule: 'none',
          status: 'pending',
          difficulty: 'medium',
          proof_required: Boolean(body.proofRequired),
          homework_subject: homeworkSubject,
        })
        .select('*')
        .single();

      if (error || !task) {
        return jsonResponse({ error: error?.message ?? 'insert_failed' }, 500);
      }

      await touchMemberSeen(admin, member.id);
      return jsonResponse({ task });
    }

    const taskId = String(body.taskId ?? '').trim();
    if (!taskId) {
      return jsonResponse({ error: 'task_id_required' }, 400);
    }

    const { data: task, error: taskError } = await admin
      .from('tasks')
      .select('*')
      .eq('id', taskId)
      .eq('household_id', member.household_id)
      .maybeSingle();

    if (taskError || !task) {
      return jsonResponse({ error: 'task_not_found' }, 404);
    }

    if (!memberMatchesAssignee(member, task)) {
      return jsonResponse({ error: 'not_assignee' }, 403);
    }

    if (action === 'submit_proof') {
      const proofUri = String(body.proofUri ?? '').trim();
      if (!proofUri) {
        return jsonResponse({ error: 'proof_uri_required' }, 400);
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
        return jsonResponse({ error: updateError.message }, 500);
      }

      await touchMemberSeen(admin, member.id);

      const isHomework = /homework|education/i.test(String(task.category ?? ''));
      await notifyAdminsAndPush(admin, {
        householdId: member.household_id,
        title: isHomework ? 'Homework ready to check' : 'Proof submitted',
        body: `${member.display_name} submitted proof for "${task.title}".`,
        category: 'tasks',
        priority: 'high',
        data: {
          notificationId: isHomework ? 'N19' : 'N20',
          kind: isHomework ? 'homework_ready' : 'proof_submitted',
          taskId,
          memberName: member.display_name,
          task: task.title,
        },
      });

      return jsonResponse({ task: updated });
    }

    if (action !== 'complete') {
      return jsonResponse({ error: 'unknown_action' }, 400);
    }

    if (task.status === 'completed') {
      return jsonResponse({ error: 'already_completed' }, 409);
    }

    const completedAt = String(body.completedAt ?? new Date().toISOString());
    const awardedXp = Math.max(0, Number(body.awardedXp ?? 0) || 0);
    const completedLate = Boolean(body.completedLate);
    const verification = body.verification ?? 'not_required';
    const taskStatus = String(body.taskStatus ?? 'completed');
    const dueLabel = String(body.dueLabel ?? 'Completed today');
    const safeStatus =
      taskStatus === 'in_progress' || taskStatus === 'completed' ? taskStatus : 'completed';

    const { data: updated, error: updateError } = await admin
      .from('tasks')
      .update({
        status: safeStatus,
        due_label: safeStatus === 'completed' ? dueLabel : task.due_label,
        completed_at: safeStatus === 'completed' ? completedAt : task.completed_at,
        awarded_xp: safeStatus === 'completed' ? awardedXp : task.awarded_xp,
        completed_late: completedLate,
        verification,
        updated_at: new Date().toISOString(),
      })
      .eq('id', taskId)
      .select('*')
      .single();

    if (updateError) {
      return jsonResponse({ error: updateError.message }, 500);
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

    await touchMemberSeen(admin, member.id);

    if (safeStatus === 'completed') {
      await notifyAdminsAndPush(admin, {
        householdId: member.household_id,
        title: 'Task completed',
        body: `${member.display_name} completed "${task.title}". +${awardedXp} XP.`,
        category: 'ai',
        priority: completedLate ? 'high' : 'medium',
        data: {
          notificationId: 'N18',
          kind: 'task_completed',
          taskId,
          name: member.display_name,
          memberName: member.display_name,
          task: task.title,
          xp: awardedXp,
        },
      });
    }

    return jsonResponse({ task: updated, memberXpAwarded: awardedXp });
  } catch (error) {
    return jsonResponse({ error: String(error) }, 500);
  }
});
