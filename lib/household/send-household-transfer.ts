/**
 * Client → transfer-household edge (create / accept / eligibility).
 */
import {
  buildHouseholdTransferDeepLink,
  buildHouseholdTransferShareLink,
  buildHouseholdTransferWebLink,
  isEmptyAccountForTransfer,
  mintMockTransferToken,
  transferTokenExpiresAt,
  type TransferMembership,
} from '@/lib/household/household-transfer';
import { getSupabaseClient } from '@/lib/supabase/client';
import { edgeErrorMessage, friendlyTransferError } from '@/lib/supabase/edge-error';

export type CreateTransferResult =
  | {
      ok: true;
      token: string;
      expiresAt: string;
      householdName: string;
      deepLink: string;
      webLink: string;
      shareLink: string;
    }
  | { ok: false; error: string };

export type AcceptTransferResult =
  | {
      ok: true;
      householdId: string;
      householdName: string;
      memberId?: string;
    }
  | { ok: false; error: string; code?: 'not_empty' | 'expired' | 'used' | 'other' };

/** In-memory mock tokens for Expo Go (per process). */
const mockTokens = new Map<
  string,
  {
    householdId: string;
    householdName: string;
    createdBy: string;
    expiresAt: string;
    redeemed?: boolean;
  }
>();

export async function createHouseholdTransferToken(input: {
  householdId: string;
  householdName: string;
  userId: string;
  mock?: boolean;
}): Promise<CreateTransferResult> {
  if (input.mock || !getSupabaseClient()) {
    const minted = mintMockTransferToken();
    mockTokens.set(minted.token, {
      householdId: input.householdId,
      householdName: input.householdName,
      createdBy: input.userId,
      expiresAt: minted.expiresAt,
    });
    return {
      ok: true,
      token: minted.token,
      expiresAt: minted.expiresAt,
      householdName: input.householdName,
      deepLink: buildHouseholdTransferDeepLink(minted.token),
      webLink: buildHouseholdTransferWebLink(minted.token),
      shareLink: buildHouseholdTransferShareLink(minted.token),
    };
  }

  try {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return { ok: false, error: 'Not connected.' };
    }
    const { data, error } = await supabase.functions.invoke('transfer-household', {
      body: { action: 'create', householdId: input.householdId },
    });
    if (error) {
      return {
        ok: false,
        error: friendlyTransferError(
          await edgeErrorMessage(error, 'Could not create transfer QR.')
        ),
      };
    }
    if (data && typeof data === 'object' && 'error' in data && (data as { error?: string }).error) {
      return {
        ok: false,
        error: friendlyTransferError(String((data as { error: string }).error)),
      };
    }
    const token = String((data as { token?: string }).token ?? '');
    const expiresAt = String(
      (data as { expiresAt?: string }).expiresAt ?? transferTokenExpiresAt()
    );
    const householdName = String(
      (data as { householdName?: string }).householdName ?? input.householdName
    );
    if (!token) {
      return { ok: false, error: 'Could not create transfer QR.' };
    }
    return {
      ok: true,
      token,
      expiresAt,
      householdName,
      deepLink: buildHouseholdTransferDeepLink(token),
      webLink: buildHouseholdTransferWebLink(token),
      shareLink: buildHouseholdTransferShareLink(token),
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Could not create transfer QR.',
    };
  }
}

export async function checkTransferEligibility(input: {
  memberships: TransferMembership[];
  mock?: boolean;
}): Promise<{ ok: true; eligible: boolean } | { ok: false; error: string }> {
  if (input.mock || !getSupabaseClient()) {
    return { ok: true, eligible: isEmptyAccountForTransfer(input.memberships) };
  }
  try {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return { ok: true, eligible: isEmptyAccountForTransfer(input.memberships) };
    }
    const { data, error } = await supabase.functions.invoke('transfer-household', {
      body: { action: 'eligibility' },
    });
    if (error) {
      return {
        ok: false,
        error: friendlyTransferError(await edgeErrorMessage(error, 'Could not check eligibility.')),
      };
    }
    if (data && typeof data === 'object' && 'error' in data && (data as { error?: string }).error) {
      return {
        ok: false,
        error: friendlyTransferError(String((data as { error: string }).error)),
      };
    }
    return { ok: true, eligible: Boolean((data as { eligible?: boolean }).eligible) };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Could not check eligibility.',
    };
  }
}

export async function acceptHouseholdTransfer(input: {
  token: string;
  userId: string;
  memberships: TransferMembership[];
  mock?: boolean;
  /** Mock-only: apply ownership change via callback */
  onMockAccept?: (householdId: string) => Promise<void>;
}): Promise<AcceptTransferResult> {
  const token = input.token.trim();
  if (!token) {
    return { ok: false, error: 'Missing transfer token.', code: 'other' };
  }

  if (input.mock || !getSupabaseClient()) {
    if (!isEmptyAccountForTransfer(input.memberships)) {
      return {
        ok: false,
        error:
          'Transfer only works on an empty account — use a new account, or one that only has a household already scheduled for deletion.',
        code: 'not_empty',
      };
    }
    const stored = mockTokens.get(token);
    if (!stored) {
      return { ok: false, error: 'This transfer QR was not found.', code: 'other' };
    }
    if (stored.redeemed) {
      return { ok: false, error: 'This transfer QR was already used.', code: 'used' };
    }
    if (new Date(stored.expiresAt).getTime() < Date.now()) {
      return { ok: false, error: 'This transfer QR expired.', code: 'expired' };
    }
    if (stored.createdBy === input.userId) {
      return {
        ok: false,
        error: 'Scan this QR on a different empty account.',
        code: 'other',
      };
    }
    stored.redeemed = true;
    if (input.onMockAccept) {
      await input.onMockAccept(stored.householdId);
    }
    return {
      ok: true,
      householdId: stored.householdId,
      householdName: stored.householdName,
    };
  }

  try {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return { ok: false, error: 'Not connected.', code: 'other' };
    }
    const { data, error } = await supabase.functions.invoke('transfer-household', {
      body: { action: 'accept', token },
    });
    if (error) {
      return {
        ok: false,
        error: friendlyTransferError(
          await edgeErrorMessage(error, 'Could not complete the transfer.')
        ),
        code: 'other',
      };
    }
    if (data && typeof data === 'object' && 'error' in data && (data as { error?: string }).error) {
      const code =
        (data as { code?: string }).code === 'not_empty'
          ? 'not_empty'
          : ('other' as const);
      return {
        ok: false,
        error: friendlyTransferError(String((data as { error: string }).error)),
        code,
      };
    }
    const householdId = String((data as { householdId?: string }).householdId ?? '');
    if (!householdId) {
      return { ok: false, error: 'Could not complete the transfer.', code: 'other' };
    }
    return {
      ok: true,
      householdId,
      householdName: String((data as { householdName?: string }).householdName ?? 'Household'),
      memberId: (data as { memberId?: string }).memberId,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Could not complete the transfer.',
      code: 'other',
    };
  }
}
