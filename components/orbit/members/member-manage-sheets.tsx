import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AppText as Text } from '@/components/orbit/app-text';
import { Avatar } from '@/components/orbit/avatar';
import { BottomSheet } from '@/components/orbit/bottom-sheet';
import { PersonalizeLookSheet } from '@/components/orbit/personalize-look-sheet';
import { radius, space, typography } from '@/constants/orbit-theme';
import { userFacingMessage } from '@/lib/auth/auth-errors';
import { isAvatarImageUri, memberDisplayEmoji } from '@/lib/game-levels';
import { formatHouseholdRole } from '@/lib/permissions';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useOrbit } from '@/store/orbit-store';
import type { HouseholdMember } from '@/types/orbit';

const DANGER = '#F87171';

function MemberFace({ member, size }: { member: HouseholdMember; size: 'l' | 'xl' }) {
  return (
    <Avatar
      name={member.name}
      emoji={
        member.avatar && !isAvatarImageUri(member.avatar)
          ? member.avatar
          : memberDisplayEmoji({ name: member.name, avatar: member.avatar })
      }
      imageUri={isAvatarImageUri(member.avatar) ? member.avatar : undefined}
      size={size}
    />
  );
}

/** Edit a person's name and picture. Works for people who have not been invited yet. */
export function MemberEditSheet({
  member,
  onDismiss,
}: {
  member: HouseholdMember | null;
  onDismiss: () => void;
}) {
  const { c, glass, glassBorder } = useOrbitColors();
  const { household, updateMemberDisplayName, updateMemberAvatar } = useOrbit();
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lookOpen, setLookOpen] = useState(false);

  // Always show the freshest copy of this person (a new picture lands in the household list).
  const live = member ? (household.members.find((m) => m.id === member.id) ?? member) : null;

  useEffect(() => {
    if (member) {
      setName(member.name);
      setError(null);
    }
  }, [member?.id]);

  const save = async () => {
    if (!live) return;
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Enter a name.');
      return;
    }
    if (trimmed === live.name) {
      onDismiss();
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await updateMemberDisplayName(live.id, trimmed);
      onDismiss();
    } catch (err) {
      setError(userFacingMessage(err, 'Could not save that name. Try again.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <BottomSheet visible={Boolean(member)} onDismiss={onDismiss} heightRatio={0.62}>
        {live ? (
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.body}>
            <Text style={[typography.caption1, { color: c.textSubtle }]}>EDIT PERSON</Text>
            <Text style={[styles.title, { color: c.text }]}>{live.name}</Text>
            <Text style={[styles.sub, { color: c.textMuted }]}>
              {formatHouseholdRole(live.role)}
              {live.status === 'invited' ? ' · not joined yet' : ''}. Changes show on their own phone within seconds.
            </Text>

            <Pressable
              onPress={() => setLookOpen(true)}
              style={[styles.row, { backgroundColor: glass(0.05), borderColor: glassBorder(0.12) }]}
              accessibilityRole="button"
              accessibilityLabel="Change picture">
              <MemberFace member={live} size="l" />
              <View style={{ flex: 1 }}>
                <Text style={[typography.headline, { color: c.text }]}>Change picture</Text>
                <Text style={[typography.caption1, { color: c.textMuted, marginTop: 2 }]}>
                  Photo, Image Playground, or emoji
                </Text>
              </View>
              <MaterialIcons name="chevron-right" size={22} color={c.textSubtle} />
            </Pressable>

            <Text style={[typography.caption1, { color: c.textMuted }]}>Name</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Name"
              placeholderTextColor={c.textSubtle}
              autoCapitalize="words"
              returnKeyType="done"
              onSubmitEditing={() => void save()}
              style={[styles.input, { color: c.text, borderColor: glassBorder(0.14), backgroundColor: glass(0.05) }]}
            />
            {error ? <Text style={[typography.footnote, { color: DANGER }]}>{error}</Text> : null}

            <View style={styles.actions}>
              <Pressable
                onPress={onDismiss}
                disabled={saving}
                style={[styles.btn, { borderColor: glassBorder(0.18), borderWidth: 1 }]}
                accessibilityRole="button">
                <Text style={[styles.btnLabel, { color: c.text }]}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => void save()}
                disabled={saving}
                style={[styles.btn, { backgroundColor: c.primary }]}
                accessibilityRole="button">
                {saving ? (
                  <ActivityIndicator color={c.ink} />
                ) : (
                  <Text style={[styles.btnLabel, { color: c.ink }]}>Save</Text>
                )}
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        ) : null}
      </BottomSheet>

      <PersonalizeLookSheet
        visible={lookOpen && Boolean(live)}
        memberName={live?.name ?? ''}
        otherNames={household.members.map((m) => m.name)}
        currentAvatar={live?.avatar}
        onDismiss={() => setLookOpen(false)}
        onSelect={async (avatar) => {
          if (live) await updateMemberAvatar(live.id, avatar);
        }}
      />
    </>
  );
}

/** Confirm taking someone out of the household, with their face so the right person is obvious. */
export function MemberRemoveSheet({
  member,
  onDismiss,
}: {
  member: HouseholdMember | null;
  onDismiss: () => void;
}) {
  const { c, glassBorder } = useOrbitColors();
  const { removeMember } = useOrbit();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (member) setError(null);
  }, [member?.id]);

  const remove = async () => {
    if (!member) return;
    setBusy(true);
    setError(null);
    try {
      await removeMember(member.id);
      onDismiss();
    } catch (err) {
      setError(userFacingMessage(err, 'Could not remove this person. Try again.'));
    } finally {
      setBusy(false);
    }
  };

  const invitedOnly = member?.status === 'invited';

  return (
    <BottomSheet visible={Boolean(member)} onDismiss={onDismiss} heightRatio={0.5}>
      {member ? (
        <View style={[styles.body, styles.center]}>
          <View style={[styles.ring, { borderColor: `${DANGER}88` }]}>
            <MemberFace member={member} size="xl" />
          </View>
          <Text style={[styles.title, { color: c.text, textAlign: 'center' }]}>Remove {member.name}?</Text>
          <Text style={[styles.sub, { color: c.textMuted, textAlign: 'center' }]}>
            {invitedOnly
              ? 'Their invite code stops working and they leave your household list.'
              : 'They get a notice, then their phone signs out. Their invite code stops working. Past tasks and XP stay in your history.'}
          </Text>
          {error ? <Text style={[typography.footnote, { color: DANGER, textAlign: 'center' }]}>{error}</Text> : null}
          <View style={styles.actions}>
            <Pressable
              onPress={onDismiss}
              disabled={busy}
              style={[styles.btn, { borderColor: glassBorder(0.18), borderWidth: 1 }]}
              accessibilityRole="button">
              <Text style={[styles.btnLabel, { color: c.text }]}>Keep {member.name}</Text>
            </Pressable>
            <Pressable
              onPress={() => void remove()}
              disabled={busy}
              style={[styles.btn, { backgroundColor: DANGER }]}
              accessibilityRole="button">
              {busy ? <ActivityIndicator color="#2A0A0A" /> : <Text style={[styles.btnLabel, { color: '#2A0A0A' }]}>Remove</Text>}
            </Pressable>
          </View>
        </View>
      ) : null}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: { gap: 12, paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: space.md },
  center: { alignItems: 'center' },
  title: { fontSize: 22, fontWeight: '700', letterSpacing: -0.4 },
  sub: { fontSize: 14, lineHeight: 20 },
  row: {
    alignItems: 'center',
    borderRadius: radius.card,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 12,
  },
  input: { borderRadius: 14, borderWidth: 1, fontSize: 16, minHeight: 48, paddingHorizontal: 14 },
  ring: { borderRadius: 999, borderWidth: 2, padding: 4 },
  actions: { alignSelf: 'stretch', flexDirection: 'row', gap: 12, marginTop: 4 },
  btn: { alignItems: 'center', borderRadius: 999, flex: 1, justifyContent: 'center', minHeight: 50 },
  btnLabel: { fontSize: 16, fontWeight: '700' },
});
