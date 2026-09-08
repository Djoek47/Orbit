// Deno Edge Function — execute Poppins tools for the live WebRTC voice path.
// Always forceRiskyConfirmation so consequential actions stage a confirmation UI.

import {
  corsHeaders,
  jsonResponse,
  requireActiveMember,
} from '../_shared/poppins-auth.ts';
import {
  effectsToClientActions,
  executePoppinsTool,
  type HouseholdSnapshotEdge,
} from '../_shared/execute-poppins-tool.ts';
import { orderPoppinsToolCalls } from '../_shared/poppins-tools.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    const body = await req.json();
    const householdId = body.householdId as string | undefined;
    const household = (body.household ?? {}) as HouseholdSnapshotEdge;
    const metrics = (body.metrics ?? {}) as Record<string, unknown>;

    const auth = await requireActiveMember(authHeader, householdId);
    if (auth.error) {
      return auth.error;
    }

    // Batch: [{ name, arguments, call_id? }] or single { name, arguments }
    const rawCalls = Array.isArray(body.calls)
      ? body.calls
      : body.name
        ? [{ name: body.name, arguments: body.arguments ?? body.args ?? {}, call_id: body.call_id }]
        : [];

    if (!rawCalls.length) {
      return jsonResponse({ error: 'name or calls required' }, 400);
    }

    const ordered = orderPoppinsToolCalls(
      rawCalls.map((call: { name?: string; arguments?: unknown; args?: unknown; call_id?: string }) => ({
        name: String(call.name ?? ''),
        arguments: (call.arguments ?? call.args ?? {}) as Record<string, unknown>,
        call_id: call.call_id as string | undefined,
      }))
    );

    const results: Array<{
      name: string;
      call_id?: string;
      result: Record<string, unknown>;
    }> = [];
    const effects: Array<{
      tool: string;
      args: Record<string, unknown>;
      result: Record<string, unknown>;
    }> = [];

    for (const call of ordered) {
      const result = executePoppinsTool(call.name, call.arguments, household, metrics, {
        forceRiskyConfirmation: true,
      });
      results.push({ name: call.name, call_id: call.call_id, result });
      effects.push({ tool: call.name, args: call.arguments, result });
    }

    const pending_confirmations = results.flatMap((r) => {
      const pending = r.result.pending_confirmations;
      return Array.isArray(pending) ? pending : [];
    });
    const ui_actions = results.flatMap((r) => {
      const actions = r.result.ui_actions;
      return Array.isArray(actions) ? actions : [];
    });
    const session_control = results.find((r) => r.result.session_control)?.result.session_control;

    return jsonResponse({
      results,
      // Convenience for single-call clients
      result: results.length === 1 ? results[0]!.result : undefined,
      pending_confirmations,
      ui_actions,
      session_control,
      actions: effectsToClientActions(effects),
      forceRiskyConfirmation: true,
    });
  } catch (error) {
    return jsonResponse({ error: String(error) }, 500);
  }
});
