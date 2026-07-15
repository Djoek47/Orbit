import { dataMode } from '@/config/data-mode';
import { requireMockOrSupabaseReady } from '@/repositories/repository-utils';
import type { AuthSession, CreateProfileInput, OrbitUser, SignInInput, SignUpInput } from '@/types/orbit';

const mockSarah: OrbitUser = {
  id: 'user-sarah',
  email: 'sarah@orbit.test',
  name: 'Sarah',
  avatar: 'S',
  profileComplete: true,
};

export const authRepository = {
  async getCurrentSession(): Promise<AuthSession | null> {
    if (dataMode === 'mock') {
      return null;
    }

    requireMockOrSupabaseReady('authRepository.getCurrentSession');
    return null;
  },

  async signIn(input: SignInInput): Promise<AuthSession> {
    if (dataMode === 'mock') {
      return {
        user: {
          ...mockSarah,
          email: input.email.trim() || mockSarah.email,
        },
      };
    }

    requireMockOrSupabaseReady('authRepository.signIn');
    return { user: mockSarah };
  },

  async signUp(input: SignUpInput): Promise<AuthSession> {
    if (dataMode === 'mock') {
      return {
        user: {
          id: `user-${Date.now()}`,
          email: input.email.trim(),
          name: '',
          avatar: 'O',
          profileComplete: false,
        },
      };
    }

    requireMockOrSupabaseReady('authRepository.signUp');
    return { user: mockSarah };
  },

  async forgotPassword(_email: string): Promise<void> {
    if (dataMode === 'mock') {
      return;
    }

    requireMockOrSupabaseReady('authRepository.forgotPassword');
  },

  async createProfile(user: OrbitUser, input: CreateProfileInput): Promise<OrbitUser> {
    const trimmedName = input.name.trim();
    const nextUser = {
      ...user,
      name: trimmedName,
      avatar: trimmedName.charAt(0).toUpperCase() || 'O',
      profileComplete: true,
    };

    if (dataMode === 'mock') {
      return nextUser;
    }

    requireMockOrSupabaseReady('authRepository.createProfile');
    return nextUser;
  },

  async signOut(): Promise<void> {
    if (dataMode === 'mock') {
      return;
    }

    requireMockOrSupabaseReady('authRepository.signOut');
  },
};
