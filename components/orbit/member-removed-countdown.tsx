import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { AppText as Text } from '@/components/orbit/app-text';
import { space, typography } from '@/constants/orbit-theme';
import {
  MEMBER_REMOVAL_GRACE_SECONDS,
  removalKickCopy,
} from '@/lib/household/member-removal-protocol';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useOrbitOptional } from '@/store/orbit-store';

type Kick = {
  memberId: string;
  memberName: string;
  startedAt: number;
  secondsLeft: number;
};

/**
 * Full-screen grace period after an admin removes this Sidekick / shared profile.
 * Counts down, then the store finishes the kick (sessions wiped, back to Get Started).
 *
 * Keeps the Modal mounted through the fade-out so iOS does not freeze when the
 * follow-on sign-out dismisses Settings / tabs.
 */
export function MemberRemovedCountdown() {
  const orbit = useOrbitOptional();
  const { c, isDark } = useOrbitColors();
  const kick = orbit?.memberRemovalKick ?? null;
  const [left, setLeft] = useState(MEMBER_REMOVAL_GRACE_SECONDS);
  const [displayKick, setDisplayKick] = useState<Kick | null>(null);
  const [visible, setVisible] = useState(false);
  const leaveStartedRef = useRef(false);

  useEffect(() => {
    if (kick) {
      setDisplayKick(kick);
      setVisible(true);
      leaveStartedRef.current = false;
      setLeft(kick.secondsLeft);
      const id = setInterval(() => {
        setLeft((n) => Math.max(0, n - 1));
      }, 1000);
      return () => clearInterval(id);
    }
    // Store cleared the kick (timer) — fade out, keep card mounted until onDismiss.
    setVisible(false);
    return undefined;
  }, [kick?.memberId, kick?.startedAt, kick]);

  if (!displayKick || !orbit) return null;

  const copy = removalKickCopy(displayKick.memberName);
  const primary = orbit.accentTheme.primary;

  const requestLeave = () => {
    if (leaveStartedRef.current) return;
    leaveStartedRef.current = true;
    setVisible(false);
    void orbit.finishMemberRemovalKick();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      presentationStyle="overFullScreen"
      onRequestClose={requestLeave}
      onDismiss={() => {
        if (!kick) setDisplayKick(null);
      }}>
      <View style={styles.backdrop}>
        <View
          style={[
            styles.card,
            {
              backgroundColor: isDark ? 'rgba(28,18,14,0.98)' : 'rgba(255,248,242,0.98)',
              borderColor: `${primary}77`,
            },
          ]}>
          <View style={[styles.iconWrap, { backgroundColor: `${primary}28` }]}>
            <MaterialIcons name="person-off" size={26} color={primary} />
          </View>
          <Text style={[typography.title2, styles.title, { color: isDark ? '#F7F2EC' : c.text }]}>
            {copy.title}
          </Text>
          <Text style={[typography.body, styles.body, { color: isDark ? '#C9B8AA' : c.textMuted }]}>
            {copy.body}
          </Text>
          <Text style={[typography.title3, { color: primary, marginTop: space.md }]}>
            {copy.countdownLabel(left)}
          </Text>
          <Pressable
            onPress={requestLeave}
            style={[styles.btn, { backgroundColor: primary }]}
            accessibilityRole="button"
            accessibilityLabel={copy.leaveLabel}>
            <Text style={styles.btnLabel}>{copy.leaveLabel}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  card: {
    borderRadius: 22,
    borderWidth: 1,
    gap: 8,
    maxWidth: 360,
    paddingHorizontal: 22,
    paddingVertical: 26,
    width: '100%',
  },
  iconWrap: {
    alignItems: 'center',
    alignSelf: 'center',
    borderRadius: 22,
    height: 44,
    justifyContent: 'center',
    marginBottom: 6,
    width: 44,
  },
  title: {
    textAlign: 'center',
  },
  body: {
    textAlign: 'center',
  },
  btn: {
    alignItems: 'center',
    borderRadius: 14,
    marginTop: space.lg,
    minHeight: 48,
    justifyContent: 'center',
  },
  btnLabel: {
    color: '#041018',
    fontSize: 16,
    fontWeight: '800',
  },
});
