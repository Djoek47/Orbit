import { dataMode } from '@/config/data-mode';
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

    const supabase = getConfiguredSupabase('authRepository.getCurrentSession');
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    mapDbError('authRepository.getCurrentSession', sessionError);

    const session = sessionData.session;
    if (!session?.user) {
      return null;
    }

    const user = await loadProfileUser(supabase, session.user.id, session.user.email ?? '');
    return { user };
  },

  async signIn(input: SignInInput): Promise<AuthSession> {
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
      if (msg.includes('invalid login') || msg.includes('invalid credentials')) {
        throw new Error(
          'Email or password is incorrect. Tap Get Started to create a household account — demo emails like sarah@orbit.test only work in Expo Go.'
        );
      }
      if (msg.includes('email not confirmed')) {
        throw new Error('Confirm your email before signing in.');
      }
      throw new Error(error.message || 'Sign in failed. Try again.');
    }

    if (!data.user) {
      throw new Error('Sign in failed. Try again.');
    }

    const user = await loadProfileUser(supabase, data.user.id, data.user.email ?? input.email.trim());
    return { user };
  },

  async signUp(input: SignUpInput): Promise<AuthSession> {
    if (isMockMode()) {
      const user: OrbitUser = {
        id: createLocalId('user'),
        email: input.email.trim(),
        name: '',
        avatar: 'O',
        profileComplete: false,
      };
      await saveMockSession(user, null);
      return { user };
    }

    const supabase = getConfiguredSupabase('authRepository.signUp');
    const { data, error } = await supabase.auth.signUp({
      email: input.email.trim(),
      password: input.password,
    });
    if (error) {
      const msg = (error.message ?? '').toLowerCase();
      if (msg.includes('already registered') || msg.includes('already been registered')) {
        throw new Error('That email already has an account. Sign in instead.');
      }
      if (msg.includes('password')) {
        throw new Error(error.message || 'Choose a stronger password and try again.');
      }
      throw new Error(error.message || 'Could not create account. Try again.');
    }

    if (!data.user) {
      throw new Error('Could not create account. Try again.');
    }

    const user = await loadProfileUser(supabase, data.user.id, data.user.email ?? input.email.trim());
    return { user };
  },

  async forgotPassword(email: string): Promise<void> {
    if (isMockMode()) {
      return;
    }

    const supabase = getConfiguredSupabase('authRepository.forgotPassword');
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
    mapDbError('authRepository.forgotPassword', error);
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
      profileComplete: true,
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

    return nextUser;
  },

  /** Persist an in-memory user (kid/tablet invite, persona switch) for mock reloads. */
  async persistLocalSession(user: OrbitUser, activeMemberId?: string | null): Promise<void> {
    if (!isMockMode()) return;
    await saveMockSession(user, activeMemberId);
  },

  async signOut(): Promise<void> {
    if (isMockMode()) {
      await clearMockSession();
      return;
    }

    const supabase = getConfiguredSupabase('authRepository.signOut');
    const { error } = await supabase.auth.signOut();
    mapDbError('authRepository.signOut', error);
  },

  async deleteAccount(): Promise<void> {
    if (isMockMode()) {
      await clearMockSession();
      return;
    }

    const supabase = getConfiguredSupabase('authRepository.deleteAccount');
    const { error } = await supabase.rpc('delete_own_account');
    mapDbError('authRepository.deleteAccount', error);
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
