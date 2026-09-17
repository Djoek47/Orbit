/**
 * Token top-up grants — monthly allowance first, then oldest top-ups.
 * Authoritative balance is server-side; client cache for display + Expo Go mock.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { IAP_CONSUMABLES, type IapTokenPackKey } from '@/constants/billing';
import {
  applyTopUpConsumption,
  topUpBalanceFromGrants,
  type TokenGrantBalance,
} from '@/lib/billing/token-grants-math';
import { isPersistedHouseholdId } from '@/lib/household/persisted-household-id';
import { getSupabaseClient } from '@/lib/supabase/client';

export type TokenGrant = TokenGrantBalance;
export { applyTopUpConsumption, topUpBalanceFromGrants };

const keyFor = (householdId: string) => `orbit.token-grants.${householdId}`;

export async function loadTokenGrants(
  householdId: string | null | undefined
): Promise<TokenGrant[]> {
  const local = await loadLocal(householdId);
  if (!isPersistedHouseholdId(householdId)) return local;
  const remote = await loadRemote(householdId!);
  if (!remote) return local;
  await saveLocal(householdId!, remote);
  return remote;
}

export async function saveTokenGrants(
  householdId: string | null | undefined,
  grants: TokenGrant[]
): Promise<void> {
  if (!householdId) return;
  await saveLocal(householdId, grants);
  if (!isPersistedHouseholdId(householdId)) return;
  await syncConsumedRemote(householdId, grants);
}

async function loadLocal(householdId: string | null | undefined): Promise<TokenGrant[]> {
  if (!householdId) return [];
  try {
    const raw = await AsyncStorage.getItem(keyFor(householdId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isGrant);
  } catch {
    return [];
  }
}

async function saveLocal(householdId: string, grants: TokenGrant[]): Promise<void> {
  await AsyncStorage.setItem(keyFor(householdId), JSON.stringify(grants));
}

async function loadRemote(householdId: string): Promise<TokenGrant[] | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('token_grants')
      .select('id, household_id, pack, tokens, consumed, transaction_id, granted_at')
      .eq('household_id', householdId)
      .order('granted_at', { ascending: true });
    if (error) {
      console.warn('[token-grants] remote load skipped', error.message);
      return null;
    }
    return (data ?? []).map((row) => {
      const item = row as Record<string, unknown>;
      return {
        id: String(item.id),
        householdId: String(item.household_id),
        pack: String(item.pack),
        tokens: Number(item.tokens) || 0,
        consumed: Number(item.consumed) || 0,
        transactionId: String(item.transaction_id),
        grantedAt: String(item.granted_at),
      };
    });
  } catch (error) {
    console.warn('[token-grants] remote load failed', error);
    return null;
  }
}

async function syncConsumedRemote(householdId: string, grants: TokenGrant[]): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;
  for (const grant of grants) {
    if (!grant.id || grant.id.startsWith('mock-') || grant.id.startsWith('local-')) continue;
    try {
      const { error } = await supabase
        .from('token_grants')
        .update({ consumed: grant.consumed } as never)
        .eq('id', grant.id)
        .eq('household_id', householdId);
      if (error) console.warn('[token-grants] consume sync skipped', error.message);
    } catch (error) {
      console.warn('[token-grants] consume sync failed', error);
    }
  }
}

function isGrant(value: unknown): value is TokenGrant {
  if (!value || typeof value !== 'object') return false;
  const row = value as TokenGrant;
  return (
    typeof row.id === 'string' &&
    typeof row.householdId === 'string' &&
    typeof row.transactionId === 'string' &&
    typeof row.tokens === 'number'
  );
}

export type GrantTokenPackInput = {
  householdId: string;
  packKey: IapTokenPackKey | 'mock';
  transactionId: string;
  /** Product id from StoreKit; validated against catalog. */
  productId?: string;
  /** Expo Go mock only — unreachable in production builds. */
  mock?: boolean;
};

/**
 * Validate → grant. Server path uses grant-token-pack edge (unique transaction_id).
 * Expo Go mock writes local-only grant clearly marked.
 */
export async function grantTokenPack(input: GrantTokenPackInput): Promise<TokenGrant> {
  const pack =
    input.packKey === 'mock'
      ? { pack: 'mock' as const, tokens: 50, productId: 'mock' }
      : IAP_CONSUMABLES[input.packKey];

  if (input.productId && input.packKey !== 'mock') {
    if (pack.productId !== input.productId) {
      throw new Error('token_pack_product_mismatch');
    }
  }

  if (input.mock || input.packKey === 'mock') {
    // Expo Go / unit tests only — never trust this path in a production binary.
    const grant: TokenGrant = {
      id: `mock-${input.transactionId}`,
      householdId: input.householdId,
      pack: 'mock',
      tokens: pack.tokens,
      consumed: 0,
      transactionId: input.transactionId,
      grantedAt: new Date().toISOString(),
    };
    const existing = await loadTokenGrants(input.householdId);
    if (existing.some((g) => g.transactionId === input.transactionId)) {
      return existing.find((g) => g.transactionId === input.transactionId)!;
    }
    const next = [...existing, grant];
    await saveTokenGrants(input.householdId, next);
    return grant;
  }

  const supabase = getSupabaseClient();
  if (supabase && isPersistedHouseholdId(input.householdId)) {
    const { data, error } = await supabase.functions.invoke('grant-token-pack', {
      body: {
        householdId: input.householdId,
        pack: pack.pack,
        tokens: pack.tokens,
        transactionId: input.transactionId,
        productId: pack.productId,
      },
    });
    if (error) throw new Error(error.message || 'grant_token_pack_failed');
    const row = (data as { grant?: TokenGrant } | null)?.grant;
    if (row) {
      const existing = await loadTokenGrants(input.householdId);
      const merged = existing.some((g) => g.transactionId === row.transactionId)
        ? existing
        : [...existing, row];
      await saveLocal(input.householdId, merged);
      return row;
    }
  }

  // Offline / no edge: local grant with unique transaction id (replay-safe locally).
  const grant: TokenGrant = {
    id: `local-${input.transactionId}`,
    householdId: input.householdId,
    pack: pack.pack,
    tokens: pack.tokens,
    consumed: 0,
    transactionId: input.transactionId,
    grantedAt: new Date().toISOString(),
  };
  const existing = await loadTokenGrants(input.householdId);
  if (existing.some((g) => g.transactionId === input.transactionId)) {
    return existing.find((g) => g.transactionId === input.transactionId)!;
  }
  await saveTokenGrants(input.householdId, [...existing, grant]);
  return grant;
}

export async function consumeTopUpTokens(
  householdId: string | null | undefined,
  amount: number
): Promise<number> {
  if (!householdId || amount <= 0) return 0;
  const grants = await loadTokenGrants(householdId);
  const { grants: next, consumed } = applyTopUpConsumption(grants, amount);
  if (consumed > 0) await saveTokenGrants(householdId, next);
  return consumed;
}
