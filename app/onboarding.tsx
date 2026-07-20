import { useState } from 'react';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChoremaxxLogo } from '@/components/orbit/choremaxx-logo';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { orbitColors, orbitRadius, orbitSpacing, orbitTypography } from '@/constants/orbit-theme';
import {
  saveOnboardingPrefs,
  type MotivationMode,
  type OnboardingRole,
} from '@/lib/onboarding-prefs';

type Step = 'splash' | 'role' | 'motivation' | 'ready';

const ROLES: {
  id: OnboardingRole;
  emoji: string;
  title: string;
  subtitle: string;
  color: string;
  perks: string[];
}[] = [
  {
    id: 'parent',
    emoji: '👑',
    title: 'Parent',
    subtitle: 'Full household admin',
    color: '#3BB5F0',
    perks: ['Assign & approve tasks', 'Manage allowance & rewards', 'See all analytics', 'Invite members'],
  },
  {
    id: 'caregiver',
    emoji: '🤝',
    title: 'Caregiver',
    subtitle: 'Assign & approve tasks',
    color: '#2DD4BF',
    perks: ['Assign tasks to anyone', 'Complete & approve chores', 'View household progress'],
  },
  {
    id: 'child',
    emoji: '⭐',
    title: 'Child',
    subtitle: 'Earn XP & rewards',
    color: '#34D399',
    perks: ['See my tasks clearly', 'Earn XP & level up', 'Unlock rewards', 'Build good habits'],
  },
  {
    id: 'roommate',
    emoji: '🏠',
    title: 'Roommate',
    subtitle: 'Shared living, simplified',
    color: '#A78BFA',
    perks: ['Shared chores & bills', 'Rotation schedules', 'Shared groceries', 'No parenting language'],
  },
];

const MOTIVATIONS: { id: MotivationMode; emoji: string; label: string; desc: string; wide?: boolean }[] = [
  { id: 'none', emoji: '🧘', label: 'No rewards', desc: 'Just get things done' },
  { id: 'xp', emoji: '⚡', label: 'XP only', desc: 'Level up with points' },
  { id: 'xp_rewards', emoji: '🎁', label: 'XP + Rewards', desc: 'Points unlock fun prizes' },
  { id: 'allowance', emoji: '💰', label: 'Allowance', desc: 'Earn real money for chores' },
  { id: 'allowance_xp', emoji: '🌟', label: 'Allowance + XP', desc: 'Money & levels combined' },
  { id: 'allowance_rewards', emoji: '🏆', label: 'Full System', desc: 'Allowance, XP & rewards', wide: true },
  { id: 'custom', emoji: '✏️', label: 'Custom', desc: 'Build your own system', wide: true },
];

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<Step>('splash');
  const [selectedRole, setSelectedRole] = useState<OnboardingRole | null>(null);
  const [selectedMotivation, setSelectedMotivation] = useState<MotivationMode | null>(null);
  const [saving, setSaving] = useState(false);

  const handleRoleContinue = () => {
    if (!selectedRole) return;
    if (selectedRole === 'child' || selectedRole === 'roommate') {
      setStep('ready');
      return;
    }
    setStep('motivation');
  };

  const handleComplete = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await saveOnboardingPrefs({
        role: selectedRole ?? 'parent',
        motivation: selectedMotivation ?? 'xp',
      });
      router.replace('/sign-up' as never);
    } finally {
      setSaving(false);
    }
  };

  const roleMeta = ROLES.find((role) => role.id === selectedRole);

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16 }]}>
      {step === 'splash' ? (
        <View style={styles.centered}>
          <View style={styles.glow} pointerEvents="none" />
          <ChoremaxxLogo size="xl" />
          <View style={styles.splashCopy}>
            <Text style={styles.splashLead}>Your AI-powered</Text>
            <Text style={styles.splashSub}>Household Operating System</Text>
          </View>
          <View style={styles.bullets}>
            {[
              { text: 'Zero clutter. Maximum harmony.', color: orbitColors.primary },
              { text: 'AI that manages your home.', color: orbitColors.accent },
              { text: 'Family-first. Always.', color: orbitColors.rewardsGold },
            ].map((item) => (
              <View key={item.text} style={styles.bulletRow}>
                <View style={[styles.bulletDot, { backgroundColor: item.color }]} />
                <Text style={styles.bulletText}>{item.text}</Text>
              </View>
            ))}
          </View>
          <OrbitButton onPress={() => setStep('role')}>Get Started</OrbitButton>
          <Pressable onPress={() => router.push('/sign-in' as never)} style={styles.signInLink}>
            <Text style={styles.signInText}>Already have an account? Sign in</Text>
          </Pressable>
        </View>
      ) : null}

      {step === 'role' ? (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.topRow}>
            <ChoremaxxLogo size="sm" />
            <StepDots active={0} />
          </View>
          <Text style={orbitTypography.title}>Who are you?</Text>
          <Text style={[orbitTypography.caption, styles.mb]}>Choremaxx adapts to your role in the household.</Text>
          {ROLES.map((role) => {
            const active = selectedRole === role.id;
            return (
              <Pressable
                key={role.id}
                onPress={() => setSelectedRole(role.id)}
                style={[
                  styles.roleCard,
                  active && {
                    backgroundColor: `${role.color}22`,
                    borderColor: `${role.color}55`,
                  },
                ]}>
                <View style={[styles.roleEmoji, { backgroundColor: `${role.color}18`, borderColor: `${role.color}33` }]}>
                  <Text style={styles.emoji}>{role.emoji}</Text>
                </View>
                <View style={styles.roleBody}>
                  <View style={styles.roleTitleRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.roleTitle}>{role.title}</Text>
                      <Text style={[styles.roleSubtitle, { color: role.color }]}>{role.subtitle}</Text>
                    </View>
                    <View
                      style={[
                        styles.radio,
                        active && { backgroundColor: role.color, borderColor: role.color },
                      ]}>
                      {active ? <Text style={styles.radioCheck}>✓</Text> : null}
                    </View>
                  </View>
                  <View style={styles.perkWrap}>
                    {role.perks.map((perk) => (
                      <View key={perk} style={styles.perk}>
                        <Text style={styles.perkText}>{perk}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              </Pressable>
            );
          })}
          <OrbitButton disabled={!selectedRole} onPress={handleRoleContinue}>
            Continue
          </OrbitButton>
        </ScrollView>
      ) : null}

      {step === 'motivation' ? (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.topRow}>
            <ChoremaxxLogo size="sm" />
            <StepDots active={1} />
          </View>
          <Text style={orbitTypography.title}>How do you motivate your household?</Text>
          <Text style={[orbitTypography.caption, styles.mb]}>You can change this anytime in Settings.</Text>
          <View style={styles.motivationGrid}>
            {MOTIVATIONS.map((opt) => {
              const active = selectedMotivation === opt.id;
              return (
                <Pressable
                  key={opt.id}
                  onPress={() => setSelectedMotivation(opt.id)}
                  style={[
                    styles.motivationCard,
                    opt.wide && styles.motivationWide,
                    active && styles.motivationActive,
                  ]}>
                  <View style={styles.motivationTop}>
                    <Text style={styles.emoji}>{opt.emoji}</Text>
                    {active ? (
                      <View style={styles.miniCheck}>
                        <Text style={styles.radioCheck}>✓</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.motivationLabel}>{opt.label}</Text>
                  <Text style={styles.motivationDesc}>{opt.desc}</Text>
                </Pressable>
              );
            })}
          </View>
          <OrbitButton disabled={!selectedMotivation} onPress={() => setStep('ready')}>
            Continue
          </OrbitButton>
        </ScrollView>
      ) : null}

      {step === 'ready' ? (
        <View style={styles.centered}>
          <View style={[styles.glow, styles.glowStrong]} pointerEvents="none" />
          <View style={styles.readyBadge}>
            <Text style={styles.readyEmoji}>{roleMeta?.emoji ?? '🏠'}</Text>
          </View>
          <Text style={orbitTypography.title}>You&apos;re all set!</Text>
          <Text style={styles.readySub}>
            Welcome to Choremaxx, <Text style={styles.readyRole}>{roleMeta?.title ?? 'Parent'}</Text>
          </Text>
          <OrbitButton onPress={handleComplete}>{saving ? 'Saving…' : 'Enter Choremaxx →'}</OrbitButton>
        </View>
      ) : null}
    </View>
  );
}

function StepDots({ active }: { active: number }) {
  return (
    <View style={styles.dots}>
      {[0, 1, 2].map((index) => (
        <View
          key={index}
          style={[
            styles.dot,
            index === active && styles.dotActive,
            index < active && styles.dotDone,
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bulletDot: {
    borderRadius: 999,
    height: 6,
    width: 6,
  },
  bulletRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  bulletText: {
    color: orbitColors.textMuted,
    fontSize: 14,
  },
  bullets: {
    alignSelf: 'stretch',
    gap: 10,
    marginBottom: orbitSpacing.md,
  },
  centered: {
    alignItems: 'center',
    flex: 1,
    gap: orbitSpacing.lg,
    justifyContent: 'center',
    paddingHorizontal: orbitSpacing.lg,
  },
  dot: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 999,
    height: 4,
    width: 8,
  },
  dotActive: {
    backgroundColor: orbitColors.primary,
    width: 20,
  },
  dotDone: {
    backgroundColor: orbitColors.primary,
  },
  dots: {
    flexDirection: 'row',
    gap: 6,
  },
  emoji: {
    fontSize: 24,
  },
  glow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },
  glowStrong: {
    // ambient feel without heavy effects
  },
  mb: {
    marginBottom: orbitSpacing.md,
  },
  miniCheck: {
    alignItems: 'center',
    backgroundColor: orbitColors.primary,
    borderRadius: 999,
    height: 16,
    justifyContent: 'center',
    width: 16,
  },
  motivationActive: {
    backgroundColor: 'rgba(59,181,240,0.15)',
    borderColor: 'rgba(59,181,240,0.35)',
  },
  motivationCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: 'rgba(255,255,255,0.08)',
    borderCurve: 'continuous',
    borderRadius: orbitRadius.lg,
    borderWidth: 2,
    gap: 4,
    padding: orbitSpacing.md,
    width: '48%',
  },
  motivationDesc: {
    color: orbitColors.textSubtle,
    fontSize: 12,
  },
  motivationGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: orbitSpacing.md,
  },
  motivationLabel: {
    color: orbitColors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  motivationTop: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  motivationWide: {
    width: '100%',
  },
  perk: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  perkText: {
    color: orbitColors.textMuted,
    fontSize: 11,
  },
  perkWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  radio: {
    alignItems: 'center',
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 999,
    borderWidth: 2,
    height: 20,
    justifyContent: 'center',
    width: 20,
  },
  radioCheck: {
    color: orbitColors.background,
    fontSize: 11,
    fontWeight: '800',
  },
  readyBadge: {
    alignItems: 'center',
    backgroundColor: orbitColors.primary,
    borderCurve: 'continuous',
    borderRadius: orbitRadius.lg,
    height: 96,
    justifyContent: 'center',
    width: 96,
  },
  readyEmoji: {
    fontSize: 48,
  },
  readyRole: {
    color: orbitColors.primary,
    fontWeight: '600',
  },
  readySub: {
    color: orbitColors.textMuted,
    fontSize: 14,
    marginBottom: orbitSpacing.md,
    textAlign: 'center',
  },
  roleBody: {
    flex: 1,
  },
  roleCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: 'rgba(255,255,255,0.08)',
    borderCurve: 'continuous',
    borderRadius: orbitRadius.lg,
    borderWidth: 2,
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
    overflow: 'hidden',
    padding: orbitSpacing.md,
  },
  roleEmoji: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: orbitRadius.md,
    borderWidth: 1,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  roleSubtitle: {
    fontSize: 12,
    fontWeight: '500',
  },
  roleTitle: {
    color: orbitColors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  roleTitleRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 8,
  },
  root: {
    backgroundColor: orbitColors.background,
    flex: 1,
  },
  scroll: {
    gap: 4,
    paddingHorizontal: orbitSpacing.lg,
    paddingBottom: orbitSpacing.xl,
  },
  signInLink: {
    paddingVertical: 8,
  },
  signInText: {
    color: orbitColors.textMuted,
    fontSize: 14,
    fontWeight: '500',
  },
  splashCopy: {
    alignItems: 'center',
    gap: 4,
  },
  splashLead: {
    color: orbitColors.text,
    fontSize: 18,
    fontWeight: '600',
  },
  splashSub: {
    color: orbitColors.textMuted,
    fontSize: 18,
  },
  topRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: orbitSpacing.md,
  },
});
