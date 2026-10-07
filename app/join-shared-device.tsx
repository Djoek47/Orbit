/**
 * Joining a shared device — the one way in.
 *
 * Reached from the device's QR (setup wizard step 4, or People → Show the code), and from one
 * person's own code when that person is on a shared device (join-profile forwards it here with
 * everyone's codes). Every route ends the same: the Welcome card, then the faces.
 *
 * The card shows the household, the device, a code to check against the admin's screen, and
 * the name of everyone on it — before anyone taps Join. Joining saves a session for every one
 * of them, so every face on the picker opens.
 */
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';

import { AppText as Text } from '@/components/orbit/app-text';
import { AuthShell } from '@/components/orbit/auth-shell';
import { SharedDeviceWelcomeCard } from '@/components/orbit/device/shared-device-welcome-card';
import { userFacingMessage } from '@/lib/auth/auth-errors';
import { welcomeFromPeople, type WelcomePerson } from '@/lib/device/shared-device-welcome';
import {
  buildSharedDeviceInviteLink,
  parseSharedDeviceInvitePayload,
} from '@/lib/household/shared-device-invite';
import { resolveMemberByProfileCode } from '@/lib/household/profile-codes';
import { normalizeInviteCode } from '@/lib/invites/parse-invite';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useOrbit } from '@/store/orbit-store';

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default function JoinSharedDeviceScreen() {
  const params = useLocalSearchParams<{
    payload?: string;
    label?: string;
    codes?: string;
    /** The one person's code that brought us here, if any — offers "use as their own". */
    personal?: string;
    deviceId?: string;
  }>();
  const { connectSharedTabletProfiles, lookupProfileInvite, household } = useOrbit();
  const { c } = useOrbitColors();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [failures, setFailures] = useState(0);
  const [lookupsFailed, setLookupsFailed] = useState(false);
  const [looked, setLooked] = useState<{
    householdId: string | null;
    householdName: string | null;
    sharedDeviceId: string | null;
    people: WelcomePerson[];
  } | null>(null);

  const invite = useMemo(() => {
    const rawPayload = first(params.payload);
    if (rawPayload?.trim()) {
      return parseSharedDeviceInvitePayload(rawPayload);
    }
    const label = first(params.label);
    const codesRaw = first(params.codes);
    if (!codesRaw?.trim()) return null;
    return parseSharedDeviceInvitePayload(
      buildSharedDeviceInviteLink({
        label: label?.trim() || 'Shared device',
        codes: codesRaw.split(','),
      })
    );
  }, [params.codes, params.label, params.payload]);

  const personalCode = first(params.personal)?.trim() || null;

  // A fresh tablet has no roster: learn the household and the names from the codes themselves.
  useEffect(() => {
    if (!invite) {
      setError('This shared-device QR code looks broken. Ask an admin for a new one.');
      return;
    }
    let cancelled = false;
    // A lookup that never answers (captive Wi-Fi) must not leave the button disabled forever.
    const withTimeout = <T,>(p: Promise<T>) =>
      Promise.race([p, new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000))]);
    void Promise.all(
      invite.codes.map((code) => withTimeout(lookupProfileInvite(code)).catch(() => null))
    ).then(
      (results) => {
        if (cancelled) return;
        const found = results.filter((r): r is NonNullable<typeof r> => Boolean(r));
        setLookupsFailed(found.length === 0);
        const people: WelcomePerson[] = invite.codes
          .map((code, i) => results[i]?.member ?? resolveMemberByProfileCode(code, household.members))
          .filter((m): m is NonNullable<typeof m> => Boolean(m));
        setLooked({
          householdId: found[0]?.householdId ?? household.id ?? null,
          householdName: found[0]?.householdName ?? household.householdName ?? null,
          sharedDeviceId: found.find((r) => r.sharedDevice?.id)?.sharedDevice?.id ?? null,
          people,
        });
      }
    );
    return () => {
      cancelled = true;
    };
    // Look up once per invite; the roster changing under us must not re-run every lookup.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invite]);

  const welcome = welcomeFromPeople({
    householdId: looked?.householdId,
    householdName: looked?.householdName,
    deviceLabel: invite?.label,
    people: looked?.people ?? [],
  });

  const accept = async () => {
    if (!invite) return;
    try {
      setBusy(true);
      setError('');
      const result = await connectSharedTabletProfiles(
        invite.codes,
        invite.label,
        first(params.deviceId) ?? looked?.sharedDeviceId ?? null
      );
      if (result.skipped.length > 0) {
        console.warn('join-shared-device.skipped', result.skipped);
      }
      router.replace((result.needsProfilePick ? '/select-profile' : '/(tabs)') as never);
    } catch (err) {
      setFailures((n) => n + 1);
      setError(userFacingMessage(err, 'Could not set up this shared device.'));
    } finally {
      setBusy(false);
    }
  };

  const personalName = useMemo(() => {
    if (!personalCode) return undefined;
    const person =
      resolveMemberByProfileCode(personalCode, household.members) ??
      looked?.people.find(
        (p) =>
          normalizeInviteCode((p as { profileInviteCode?: string }).profileInviteCode ?? '') ===
          normalizeInviteCode(personalCode)
      );
    return person?.name.trim().split(/\s+/)[0] || undefined;
  }, [household.members, looked?.people, personalCode]);

  const subtitle = !looked
    ? 'Checking the code…'
    : welcome.peopleLabel
      ? `This tablet is for ${welcome.peopleLabel}. ${
          welcome.hasMatchCode ? "Check the household code matches your admin's screen." : ''
        }`.trim()
      : lookupsFailed
        ? "Couldn't check this code just now. You can still join — or try again on Wi-Fi."
        : 'Nobody is on this device yet. Ask an admin to add people, then scan again.';

  return (
    <>
      <Stack.Screen options={{ headerShown: false, title: 'Join shared device' }} />
      <AuthShell kicker="Shared device" title={`Welcome to ${welcome.householdName}`} subtitle={subtitle}>
        <SharedDeviceWelcomeCard
          welcome={welcome}
          // Disabled while checking, and when the codes turned up nobody. Offline, the lookups
          // all fail but joining still resolves codes itself, so it stays possible then.
          busy={busy || !looked || !invite}
          joinDisabled={Boolean(looked) && welcome.people.length === 0 && !lookupsFailed}
          resetToken={failures}
          onJoin={() => void accept()}
          personalName={personalName}
          onUseAsPersonal={
            personalCode
              ? () =>
                  router.replace(
                    `/join-profile?code=${encodeURIComponent(personalCode)}&own=1` as never
                  )
              : undefined
          }
        />
        {error ? (
          <Text
            style={{ color: c.danger, fontSize: 14, marginTop: 12, textAlign: 'center' }}
            accessibilityLiveRegion="polite">
            {error}
          </Text>
        ) : null}
      </AuthShell>
    </>
  );
}
