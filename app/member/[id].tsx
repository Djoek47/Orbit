/**
 * Sidekick / member hub — QR first, presence, rename, picture, remove.
 * Stack modal (not a BottomSheet over Settings) so dismiss never freezes the app.
 */
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText as Text, AppTextInput as TextInput } from '@/components/orbit/app-text';
import { Avatar } from '@/components/orbit/avatar';
import { MemberPresencePill } from '@/components/orbit/members/member-presence-pill';
import { ProfileQrCard } from '@/components/orbit/members/profile-qr-card';
import { orbitAlert } from '@/components/orbit/orbit-alert';
import { PersonalizeLookSheet } from '@/components/orbit/personalize-look-sheet';
import { SettingsModalChrome } from '@/components/orbit/settings/modal-chrome';
import { radius, space, typography } from '@/constants/orbit-theme';
import { userFacingMessage } from '@/lib/auth/auth-errors';
import { isAvatarImageUri, memberDisplayEmoji } from '@/lib/game-levels';
import { ensureProfileInviteCode } from '@/lib/household/profile-codes';
import { isSharedDeviceRole } from '@/lib/household/shared-device';
import { buildInviteLinks } from '@/lib/invites/parse-invite';
import { shareInvite } from '@/lib/invites/share-invite';
import { glassFill, useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useOrbit } from '@/store/orbit-store';

function todayProgress(
  member: { id: string; name: string },
  household: { tasks: { assignees?: string[]; assignee: string; status: string; due: string }[] }
) {
  const today = new Date().toISOString().slice(0, 10);
  const mine = household.tasks.filter((t) => {
    const ids = t.assignees?.length ? t.assignees : [t.assignee];
    return (ids.includes(member.id) || ids.includes(member.name)) && t.due.startsWith(today);
  });
  const done = mine.filter((t) => t.status === 'Completed').length;
  return { done, total: mine.length };
}

export default function MemberHubScreen() {
  const insets = useSafeAreaInsets();
  const { id: rawId } = useLocalSearchParams<{ id?: string }>();
  const memberId = Array.isArray(rawId) ? rawId[0] : rawId;
  const {
    ensureMemberProfileInviteCode,
    household,
    permissions,
    removeMember,
    rotateMemberProfileInviteCode,
    updateMemberAvatar,
    updateMemberDisplayName,
  } = useOrbit();
  const { c, isDark, glassBorder } = useOrbitColors();
  const accent = c.primary;

  const member = useMemo(
    () => household.members.find((m) => m.id === memberId) ?? null,
    [household.members, memberId]
  );

  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [personalizeOpen, setPersonalizeOpen] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [readyCode, setReadyCode] = useState<string | null>(null);

  useEffect(() => {
    if (!member || isSharedDeviceRole(member.role)) return;
    let cancelled = false;
    void (async () => {
      const code =
        (await ensureMemberProfileInviteCode(member.id)) ?? ensureProfileInviteCode(member);
      if (!cancelled) setReadyCode(code);
    })();
    return () => {
      cancelled = true;
    };
  }, [ensureMemberProfileInviteCode, member]);

  useEffect(() => {
    if (member) setNameDraft(member.name);
  }, [member?.id, member?.name]);

  if (!member || isSharedDeviceRole(member.role)) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <SettingsModalChrome backLabel="People" title="Person">
          <Text style={[typography.body, { color: c.textMuted, padding: space.lg }]}>
            This person isn’t here anymore.
          </Text>
        </SettingsModalChrome>
      </>
    );
  }

  const code = readyCode ?? ensureProfileInviteCode(member);
  const links = buildInviteLinks(code);
  const progress = todayProgress(member, household);
  const canManage = permissions.canManageHousehold;

  const saveName = async () => {
    const trimmed = nameDraft.trim();
    if (!trimmed || trimmed === member.name) {
      setEditingName(false);
      setNameDraft(member.name);
      return;
    }
    setSavingName(true);
    try {
      await updateMemberDisplayName(member.id, trimmed);
      setEditingName(false);
    } catch (error) {
      orbitAlert('Name', userFacingMessage(error, 'Could not save that name.'));
    } finally {
      setSavingName(false);
    }
  };

  const regenerate = async () => {
    setRegenerating(true);
    try {
      const next = await rotateMemberProfileInviteCode(member.id);
      if (next) setReadyCode(next);
      orbitAlert('New QR ready', `Old codes for ${member.name} no longer work.`);
    } catch (error) {
      orbitAlert('QR', userFacingMessage(error, 'Could not make a new code.'));
    } finally {
      setRegenerating(false);
    }
  };

  const doRemove = async () => {
    setRemoving(true);
    try {
      await removeMember(member.id);
      if (router.canGoBack()) router.back();
      else router.replace('/settings' as never);
    } catch (error) {
      setConfirmRemove(false);
      orbitAlert('Remove', userFacingMessage(error, 'Could not remove this person.'));
    } finally {
      setRemoving(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SettingsModalChrome
        backLabel="People"
        title={member.name}
        purpose="Connect their phone, edit their profile, or remove them.">
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <Animated.View
            entering={FadeInDown.duration(280)}
            style={[
              styles.hero,
              { backgroundColor: glassFill(isDark), borderColor: glassBorder(0.1) },
            ]}>
            <View style={[styles.avatarRing, { borderColor: `${accent}55`, backgroundColor: `${accent}18` }]}>
              {isAvatarImageUri(member.avatar) ? (
                <Image source={{ uri: member.avatar }} style={styles.avatarImg} contentFit="cover" />
              ) : memberDisplayEmoji(member) ? (
                <Text style={styles.avatarEmoji}>{memberDisplayEmoji(member)}</Text>
              ) : (
                <Avatar name={member.name} size="l" />
              )}
            </View>
            <View style={styles.heroCopy}>
              {editingName ? (
                <View style={styles.nameEditRow}>
                  <TextInput
                    value={nameDraft}
                    onChangeText={setNameDraft}
                    autoFocus
                    style={[
                      styles.nameInput,
                      { color: c.text, borderColor: glassBorder(0.14), backgroundColor: glassFill(isDark) },
                    ]}
                    onSubmitEditing={() => void saveName()}
                  />
                  <Pressable
                    onPress={() => void saveName()}
                    disabled={savingName}
                    style={[styles.nameSave, { backgroundColor: accent }]}
                    accessibilityRole="button"
                    accessibilityLabel="Save name">
                    {savingName ? (
                      <ActivityIndicator color={c.ink} />
                    ) : (
                      <MaterialIcons name="check" size={18} color={c.ink} />
                    )}
                  </Pressable>
                </View>
              ) : (
                <View style={styles.nameRow}>
                  <Text style={[styles.name, { color: c.text }]} numberOfLines={1}>
                    {member.name}
                  </Text>
                  {canManage ? (
                    <Pressable
                      onPress={() => setEditingName(true)}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel="Edit name">
                      <MaterialIcons name="edit" size={18} color={accent} />
                    </Pressable>
                  ) : null}
                </View>
              )}
              <MemberPresencePill member={member} variant="full" />
            </View>
          </Animated.View>

          <Animated.View
            entering={FadeInDown.delay(60).duration(280)}
            style={[
              styles.stats,
              { backgroundColor: glassFill(isDark), borderColor: glassBorder(0.1) },
            ]}>
            <View style={styles.stat}>
              <Text style={[styles.statValue, { color: accent }]}>
                {progress.done}/{progress.total}
              </Text>
              <Text style={[styles.statLabel, { color: c.textSubtle }]}>Done today</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: glassBorder(0.12) }]} />
            <View style={styles.stat}>
              <Text style={[styles.statValue, { color: accent }]}>{member.xp ?? 0}</Text>
              <Text style={[styles.statLabel, { color: c.textSubtle }]}>XP</Text>
            </View>
          </Animated.View>

          <Animated.View
            entering={FadeInDown.delay(110).duration(280)}
            style={[
              styles.card,
              { backgroundColor: glassFill(isDark), borderColor: glassBorder(0.1) },
            ]}>
            <Text style={[typography.eyebrow, { color: c.textSubtle }]}>CONNECT</Text>
            <Text style={[typography.title3, { color: c.text, marginTop: 4 }]}>
              Their QR code
            </Text>
            <ProfileQrCard
              qrValue={links.webLink}
              displayCode={links.code}
              caption={`Scan or AirDrop this to ${member.name}'s phone. They open Get Started → Sidekick — no sign-in.`}
              onShare={async () => {
                await shareInvite({
                  householdName: household.householdName,
                  inviteCode: links.code,
                  deepLink: links.deepLink,
                  webLink: links.webLink,
                  kind: 'kid',
                  childName: member.name,
                });
              }}
              onRegenerate={canManage ? regenerate : undefined}
              regenerating={regenerating}
            />
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(160).duration(280)} style={styles.actions}>
            <Pressable
              onPress={() => setPersonalizeOpen(true)}
              style={[
                styles.actionBtn,
                { backgroundColor: glassFill(isDark), borderColor: glassBorder(0.12) },
              ]}
              accessibilityRole="button">
              <MaterialIcons name="face" size={20} color={accent} />
              <Text style={[typography.footnote, { color: c.text, fontWeight: '700', flex: 1 }]}>
                Edit picture
              </Text>
              <MaterialIcons name="chevron-right" size={20} color={c.textSubtle} />
            </Pressable>

            {canManage ? (
              confirmRemove ? (
                <View
                  style={[
                    styles.confirmBox,
                    {
                      borderColor: 'rgba(248,113,113,0.45)',
                      backgroundColor: 'rgba(248,113,113,0.1)',
                    },
                  ]}>
                  <Text style={[typography.headline, { color: c.text }]}>
                    Remove {member.name}?
                  </Text>
                  <Text style={[typography.footnote, { color: c.textMuted, marginTop: 6 }]}>
                    They leave this household. Tasks stay; their profile is gone.
                  </Text>
                  <View style={styles.confirmRow}>
                    <Pressable
                      onPress={() => setConfirmRemove(false)}
                      style={[
                        styles.confirmBtn,
                        { borderColor: glassBorder(0.14), backgroundColor: glassFill(isDark) },
                      ]}>
                      <Text style={[typography.footnote, { color: c.textSoft, fontWeight: '700' }]}>
                        Cancel
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => void doRemove()}
                      disabled={removing}
                      style={[styles.confirmBtn, styles.dangerBtn]}>
                      {removing ? (
                        <ActivityIndicator color="#F87171" />
                      ) : (
                        <Text style={[typography.footnote, { color: '#F87171', fontWeight: '700' }]}>
                          Remove
                        </Text>
                      )}
                    </Pressable>
                  </View>
                </View>
              ) : (
                <Pressable
                  onPress={() => setConfirmRemove(true)}
                  style={[styles.actionBtn, styles.dangerOutline]}
                  accessibilityRole="button">
                  <MaterialIcons name="person-remove" size={20} color="#F87171" />
                  <Text style={[typography.footnote, { color: '#F87171', fontWeight: '700', flex: 1 }]}>
                    Remove from household
                  </Text>
                </Pressable>
              )
            ) : null}
          </Animated.View>
        </ScrollView>
      </SettingsModalChrome>

      <PersonalizeLookSheet
        visible={personalizeOpen}
        memberName={member.name}
        otherNames={household.members.map((m) => m.name)}
        currentAvatar={member.avatar}
        onDismiss={() => setPersonalizeOpen(false)}
        onSelect={async (avatar) => {
          await updateMemberAvatar(member.id, avatar);
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  scroll: {
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
  },
  hero: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: space.md,
    padding: space.md,
  },
  avatarRing: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 28,
    borderWidth: 2,
    height: 72,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 72,
  },
  avatarImg: { height: '100%', width: '100%' },
  avatarEmoji: { fontSize: 34 },
  heroCopy: { flex: 1, gap: 6, minWidth: 0 },
  nameRow: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  name: { ...typography.title2, flexShrink: 1 },
  nameEditRow: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  nameInput: {
    borderCurve: 'continuous',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  nameSave: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 12,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  stats: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    paddingVertical: space.md,
  },
  stat: { alignItems: 'center', flex: 1 },
  statValue: { fontSize: 22, fontWeight: '800' },
  statLabel: { ...typography.caption1, marginTop: 2 },
  statDivider: { height: 28, width: StyleSheet.hairlineWidth },
  card: {
    borderCurve: 'continuous',
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    gap: space.sm,
    padding: space.md,
  },
  actions: { gap: space.sm },
  actionBtn: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: space.md,
    paddingVertical: 14,
  },
  dangerOutline: {
    backgroundColor: 'rgba(248,113,113,0.08)',
    borderColor: 'rgba(248,113,113,0.35)',
  },
  confirmBox: {
    borderCurve: 'continuous',
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    padding: space.md,
  },
  confirmRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  confirmBtn: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 12,
  },
  dangerBtn: {
    backgroundColor: 'rgba(248,113,113,0.12)',
    borderColor: 'rgba(248,113,113,0.45)',
  },
});
