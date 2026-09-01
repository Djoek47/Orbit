/**
 * Sidekick grocery writes — profile-code auth.
 */
import {
  assertCapability,
  loadHouseholdSettings,
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: sidekickCors });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const code = normalizeCode(String(body.code ?? ''));
    const action = String(body.action ?? 'add_item');
    const name = String(body.name ?? '').trim();

    if (!code || !name) {
      return jsonResponse({ error: 'code_and_name_required' }, 400);
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

    if (!settings.sidekickGroceryAdd) {
      return jsonResponse({ error: 'grocery_add_disabled' }, 403);
    }

    const capDenied = assertCapability(settings, 'allowGroceryAdd');
    if (capDenied) return capDenied;

    if (action !== 'add_item') {
      return jsonResponse({ error: 'unknown_action' }, 400);
    }

    const category = String(body.category ?? 'Other').trim() || 'Other';
    const quantity = String(body.quantity ?? '1').trim() || '1';
    const location = String(body.location ?? 'pantry').toLowerCase();
    const safeLocation = ['fridge', 'freezer', 'pantry', 'bathroom', 'cleaning'].includes(location)
      ? location
      : 'pantry';

    const { data: item, error } = await admin
      .from('grocery_items')
      .insert({
        household_id: member.household_id,
        name,
        category,
        quantity,
        location: safeLocation,
        status: 'missing',
        requested_by: member.display_name,
        note: body.note ? String(body.note) : null,
      })
      .select('*')
      .single();

    if (error || !item) {
      return jsonResponse({ error: error?.message ?? 'insert_failed' }, 500);
    }

    await touchMemberSeen(admin, member.id);

    await notifyAdminsAndPush(admin, {
      householdId: member.household_id,
      title: 'Grocery item added',
      body: `${member.display_name} added ${name} to the list.`,
      category: 'groceries',
      priority: 'medium',
      data: { kind: 'grocery_added', groceryId: item.id, name: member.display_name },
    });

    return jsonResponse({ item });
  } catch (error) {
    return jsonResponse({ error: String(error) }, 500);
  }
});
