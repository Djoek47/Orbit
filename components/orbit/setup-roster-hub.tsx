/**
 * Household roster hub (§3.4) — list members, add, create / finish later.
 */

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Pressable, StyleSheet, View } from 'react-native';

import { OrbitButton } from '@/components/orbit/orbit-button';
import { radius, space, typography } from '@/constants/orbit-theme';
import {
  draftHasCompleteMember,
  memberIsComplete,
  memberStatusLine,
  type DraftMember,
  type HouseholdSetupDraft,
} from '@/lib/onboarding/setup-draft';
import { incompleteMemberCount } from '@/lib/onboarding/materialize-setup';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { AppText as Text } from '@/components/orbit/app-text';

type SetupRosterHubProps = {
  draft: HouseholdSetupDraft;
  onEditName: () => void;
  onAddMember: () => void;
  onEditMember: (member: DraftMember) => void;
  onCreateHousehold: () => void;
  onFinishLater: () => void;
  busy?: boolean;
};

export function SetupRosterHub({
  draft,
  onEditName,
  onAddMember,
  onEditMember,
  onCreateHousehold,
  onFinishLater,
  busy,
}: SetupRosterHubProps) {
  const { c, glass, glassBorder } = useOrbitColors();
  const canCreate = draftHasCompleteMember(draft);
  const incomplete = incompleteMemberCount(draft);

  return (
    <View style={styles.wrap}>
      <View style={styles.titleRow}>
        <Text style={[typography.title1, { color: c.text, flex: 1 }]} numberOfLines={2}>
          {draft.householdName || 'Your household'}
        </Text>
        <Pressable
          onPress={onEditName}
          accessibilityLabel="Edit household name"
          hitSlop={8}
          style={[styles.pencil, { backgroundColor: glass(0.06), borderColor: glassBorder(0.12) }]}>
          <MaterialIcons name="edit" size={16} color={c.textMuted} />
        </Pressable>
      </View>
      <Text style={[typography.footnote, { color: c.textMuted, marginBottom: space.md }]}>
        Add everyone who&apos;ll be pitching in.
      </Text>

      <View style={styles.list}>
        {draft.members.map((member) => {
          const complete = memberIsComplete(member);
          return (
            <Pressable
              key={member.id}
              onPress={() => onEditMember(member)}
              style={[
                styles.card,
                {
                  backgroundColor: glass(0.05),
                  borderColor: glassBorder(0.1),
                },
              ]}>
              <View
                style={[
                  styles.avatar,
                  { backgroundColor: member.avatarColor ?? c.primary },
                ]}>
                <Text style={styles.avatarText}>
                  {(member.name.trim() || '?').charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[typography.headline, { color: c.text }]} numberOfLines={1}>
                  {member.name.trim() || 'Unnamed'}
                </Text>
                <Text style={[typography.caption1, { color: c.textMuted }]}>
                  {memberStatusLine(member)}
                </Text>
              </View>
              {complete ? (
                <MaterialIcons name="check-circle" size={22} color="#34D399" />
              ) : (
                <View style={styles.finishRow}>
                  <Text style={[typography.caption1, { color: c.textSubtle }]}>Finish setup</Text>
                  <MaterialIcons name="chevron-right" size={20} color={c.textSubtle} />
                </View>
              )}
            </Pressable>
          );
        })}

        <Pressable
          onPress={onAddMember}
          style={[
            styles.addRow,
            { borderColor: glassBorder(0.14), backgroundColor: glass(0.04) },
          ]}>
          <MaterialIcons name="person-add" size={20} color={c.primary} />
          <Text style={[typography.headline, { color: c.primary }]}>+ Add family member</Text>
        </Pressable>
      </View>

      <View style={styles.footer}>
        <OrbitButton disabled={!canCreate || busy} onPress={onCreateHousehold}>
          {busy ? 'Creating…' : 'Create household'}
        </OrbitButton>
        {!canCreate ? (
          <Text style={[typography.caption1, { color: c.textSubtle, textAlign: 'center' }]}>
            Confirm at least one member with tasks to create.
          </Text>
        ) : incomplete > 0 ? (
          <Text style={[typography.caption1, { color: c.textSubtle, textAlign: 'center' }]}>
            {incomplete} member{incomplete === 1 ? '' : 's'} still need tasks — you can create anyway
            from the prompt.
          </Text>
        ) : null}
        <Pressable onPress={onFinishLater} disabled={busy} style={styles.secondary}>
          <Text style={[typography.headline, { color: c.textMuted, textAlign: 'center' }]}>
            Save and finish later
          </Text>
          <Text style={[typography.caption1, { color: c.textSubtle, textAlign: 'center' }]}>
            We&apos;ll keep everything you&apos;ve set up. You can add the rest of your family any time
            from Settings → Household.
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.md, flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pencil: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: { gap: 10 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: radius.cardLarge,
    borderWidth: StyleSheet.hairlineWidth,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  finishRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 16,
    borderRadius: radius.cardLarge,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  footer: { gap: 12, marginTop: space.lg },
  secondary: { gap: 6, paddingVertical: 8 },
});
