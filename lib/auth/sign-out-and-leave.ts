/**
 * One-shot sign-out + leave Get Started.
 *
 * Settings is an Expo Router modal; confirm uses a RN Modal. Starting
 * router.dismissAll while that alert is still dismissing freezes iOS /
 * eats the first press. Callers must invoke this only after the alert
 * Modal has fully dismissed (orbitAlert defers destructive onPress).
 *
 * Concurrent taps coalesce onto the same in-flight promise so a double
 * press cannot stack two wipes or two restarts.
 */

let inFlight: Promise<void> | null = null;

export function isSignOutInFlight(): boolean {
  return inFlight != null;
}

/** Test helper — never call from product UI. */
export function resetSignOutInFlightForTests(): void {
  inFlight = null;
}

export async function signOutAndLeave(signOut: () => Promise<void>): Promise<void> {
  if (inFlight) return inFlight;

  inFlight = (async () => {
    try {
      await signOut();
    } catch (error) {
      console.warn('signOutAndLeave', error);
    } finally {
      try {
        const { resetToGetStarted } = await import('@/lib/navigation/reset-to-get-started');
        resetToGetStarted();
      } catch (navError) {
        console.warn('signOutAndLeave.nav', navError);
      }
    }
  })();

  try {
    await inFlight;
  } finally {
    inFlight = null;
  }
}
