import { dataMode } from '@/config/data-mode';
import {
  AuthRateLimitError,
  EmailNotConfirmedError,
  isAuthRateLimitMessage,
  throwAuthIssue,
  throwMappedAuthError,
} from '@/lib/auth/auth-errors';
import { isProfileNameComplete } from '@/lib/auth/display-name';
import { allowAuthStorageWrites } from '@/lib/auth/auth-storage';
import {
  clearPendingSignup,
  getEmailConfirmRedirectUrl,
  setPendingSignup,
} from '@/lib/auth/email-confirmation';
import { signOutEverywhere, wipeLocalAuthAndResetClient } from '@/lib/auth/local-sign-out';
import {
  clearMockSession,
  loadMockSession,
  saveMockSession,
  toAuthSession,
} from '@/lib/auth/mock-session';
import { mapProfileToUser } from '@/lib/mappers/orbit-mappers';
import { createLocalId, getConfiguredSupabase, isMockMode, mapDbError } from '@/repositories/repository-utils';
import type { AuthSession, CreateProfileInput, OrbitUser, SignInInput, SignUpInput } from '@/types/orbit';
import type { ProfileRow } from '@/types/database';

export type SignUpOutcome =
  | { status: 'ready'; session: AuthSession }
  | { status: 'needs_confirmation'; email: string };

const mockSarah: OrbitUser = {
  id: 'user-sarah',
  email: 'sarah@orbit.test',
  name: 'Sarah',
  avatar: 'S',
  profileComplete: true,
};

async function loadProfileUser(
  supabase: ReturnType<typeof getConfiguredSupabase>,
  userId: string,
  emailFallback: string
): Promise<OrbitUser> {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
  mapDbError('authRepository.loadProfile', error);

  if (data) {
    return mapProfileToUser({
      id: data.id,
      email: data.email || emailFallback,
      display_name: data.display_name,
      avatar_url: data.avatar_url,
    });
  }

  return mapProfileToUser({
    id: userId,
    email: emailFallback,
    display_name: null,
    avatar_url: null,
  });
}

export const authRepository = {
  async getCurrentSession(): Promise<AuthSession | null> {
    if (isMockMode()) {
      const stored = await loadMockSession();
      return stored ? toAuthSession(stored.user) : null;
    }

    try {
      const supabase = getConfiguredSupabase('authRepository.getCurrentSession');
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) {
        console.warn('authRepository.getCurrentSession', sessionError.message);
        return null;
      }

      const session = sessionData.session;
      if (!session?.user) {
        return null;
      }

      const user = await loadProfileUser(supabase, session.user.id, session.user.email ?? '');
      return { user };
    } catch (error) {
      console.warn('authRepository.getCurrentSession', error);
      return null;
    }
  },

  async signIn(input: SignInInput): Promise<AuthSession> {
    allowAuthStorageWrites();
    if (isMockMode()) {
      const user: OrbitUser = {
        ...mockSarah,
        email: input.email.trim() || mockSarah.email,
      };
      await saveMockSession(user, 'm1');
      return { user };
    }

    const supabase = getConfiguredSupabase('authRepository.signIn');
    const { data, error } = await supabase.auth.signInWithPassword({
      email: input.email.trim(),
      password: input.password,
    });
    if (error) {
      const msg = (error.message ?? '').toLowerCase();
      if (msg.includes('email not confirmed') || msg.includes('email_not_confirmed')) {
        setPendingSignup(input.email.trim(), input.password);
        throw new EmailNotConfirmedError(input.email.trim());
      }
      if (isAuthRateLimitMessage(error.message) || error.status === 429) {
        throw new AuthRateLimitError();
      }
      if (msg.includes('invalid login') || msg.includes('invalid credentials')) {
        throwAuthIssue('invalid_credentials');
      }
      throwMappedAuthError(error);
    }

    if (!data.user || !data.session) {
      throwAuthIssue('generic', { message: 'Sign in didn’t complete. Please try again.' });
    }

    const user = await loadProfileUser(supabase, data.user.id, data.user.email ?? input.email.trim());
    return { user };
  },

  async signUp(input: SignUpInput): Promise<SignUpOutcome> {
    allowAuthStorageWrites();
    const email = input.email.trim();

    if (isMockMode()) {
      const user: OrbitUser = {
        id: createLocalId('user'),
        email,
        name: '',
        avatar: 'O',
        profileComplete: false,
      };
      await saveMockSession(user, null);
      clearPendingSignup();
      return { status: 'ready', session: { user } };
    }

    const supabase = getConfiguredSupabase('authRepository.signUp');
    const { data, error } = await supabase.auth.signUp({
      email,
      password: input.password,
      options: {
        emailRedirectTo: getEmailConfirmRedirectUrl(),
      },
    });
    if (error) {
      const msg = (error.message ?? '').toLowerCase();
      if (isAuthRateLimitMessage(error.message) || error.status === 429) {
        // Account may already exist from an earlier attempt — keep credentials for confirm flow.
        setPendingSignup(email, input.password);
        throw new AuthRateLimitError();
      }
      if (msg.includes('already registered') || msg.includes('already been registered')) {
        throwAuthIssue('email_taken');
      }
      if (msg.includes('password')) {
        throwAuthIssue('weak_password');
      }
      throwMappedAuthError(error);
    }

    // Confirm email on: user row exists but session is null until the inbox link is used.
    if (!data.session) {
      if (data.user && (!data.user.identities || data.user.identities.length === 0)) {
        throwAuthIssue('email_taken');
      }
      setPendingSignup(email, input.password);
      return { status: 'needs_confirmation', email };
    }

    if (!data.user) {
      throwAuthIssue('generic', { message: 'We couldn’t create your account. Please try again.' });
    }

    clearPendingSignup();
    const user = await loadProfileUser(supabase, data.user.id, data.user.email ?? email);
    return { status: 'ready', session: { user } };
  },

  async forgotPassword(email: string): Promise<void> {
    if (isMockMode()) {
      return;
    }

    const supabase = getConfiguredSupabase('authRepository.forgotPassword');
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
    if (error) {
      throwMappedAuthError(error);
    }
  },

  async createProfile(user: OrbitUser, input: CreateProfileInput): Promise<OrbitUser> {
    const trimmedName = input.name.trim();
    const avatar =
      input.avatar?.trim() ||
      trimmedName.charAt(0).toUpperCase() ||
      'O';
    const nextUser: OrbitUser = {
      ...user,
      name: trimmedName,
      avatar,
      profileComplete: isProfileNameComplete(trimmedName, user.email),
    };

    if (isMockMode()) {
      await saveMockSession(nextUser);
      return nextUser;
    }

    const supabase = getConfiguredSupabase('authRepository.createProfile');
    const { error } = await supabase
      .from('profiles')
      .update({ display_name: trimmedName } satisfies Partial<ProfileRow>)
      .eq('id', user.id);
    mapDbError('authRepository.createProfile', error);

    // Keep the owner's household_members.display_name in sync with the profile.
    const { error: memberError } = await supabase
      .from('household_members')
      .update({ display_name: trimmedName, avatar_symbol: avatar })
      .eq('user_id', user.id);
    if (memberError) {
      console.warn('authRepository.createProfile: member name sync skipped', memberError.message);
    }

    return nextUser;
  },

  /** Persist an in-memory user (kid/tablet invite, persona switch) for mock reloads. */
  async persistLocalSession(user: OrbitUser, activeMemberId?: string | null): Promise<void> {
    if (!isMockMode()) return;
    await saveMockSession(user, activeMemberId);
  },

  async signOut(): Promise<void> {
    if (isMockMode()) {
      try {
        const { teardownAllPoppinsVoice } = await import('@/lib/voice/poppins-voice-session');
        teardownAllPoppinsVoice();
      } catch {
        /* expo go */
      }
      await clearMockSession();
      return;
    }

    await signOutEverywhere();
  },

  async deleteAccount(feedback?: { reason: string; detail?: string }): Promise<void> {
    if (isMockMode()) {
      await clearMockSession();
      return;
    }

    const supabase = getConfiguredSupabase('authRepository.deleteAccount');

    if (feedback?.reason?.trim()) {
      const { error: feedbackError } = await supabase.rpc('submit_account_deletion_feedback', {
        p_reason: feedback.reason.trim(),
        p_detail: feedback.detail?.trim() || null,
      });
      // Feedback is best-effort — never block account deletion on analytics insert.
      if (feedbackError) {
        console.warn('authRepository.deleteAccount.feedback', feedbackError.message);
      }
    }

    const { error } = await supabase.rpc('delete_own_account');
    mapDbError('authRepository.deleteAccount', error);
    // RPC removes the user row; the JWT can still sit in storage and hydrate
    // the old household under a stacked Get Started screen. Always sign out.
    try {
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) {
        console.warn('authRepository.deleteAccount.signOut', signOutError.message);
      }
    } catch (signOutError) {
      console.warn('authRepository.deleteAccount.signOut', signOutError);
    }
    await wipeLocalAuthAndResetClient();
  },

  async exportUserData(): Promise<string> {
    if (isMockMode()) {
      const stored = await loadMockSession();
      return JSON.stringify(
        {
          profile: stored?.user ?? mockSarah,
          memberships: [],
          exportedAt: new Date().toISOString(),
          mode: dataMode,
        },
        null,
        2
      );
    }

    const supabase = getConfiguredSupabase('authRepository.exportUserData');
    const { data: authData, error: authError } = await supabase.auth.getUser();
    mapDbError('authRepository.exportUserData.auth', authError);

    const userId = authData.user?.id;
    if (!userId) {
      throw new Error('authRepository.exportUserData: No authenticated user.');
    }

    const [{ data: profile, error: profileError }, { data: memberships, error: membershipError }] =
      await Promise.all([
        supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
        supabase.from('household_members').select('*').eq('user_id', userId),
      ]);

    mapDbError('authRepository.exportUserData.profile', profileError);
    mapDbError('authRepository.exportUserData.memberships', membershipError);

    return JSON.stringify(
      {
        profile,
        memberships: memberships ?? [],
        exportedAt: new Date().toISOString(),
      },
      null,
      2
    );
  },
};
