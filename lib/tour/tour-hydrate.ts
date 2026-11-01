/**
 * Tour hydration gate — one in-flight run per key, no persist after cancel.
 */
import { offerTourState } from '@/lib/tour/tour-store';
import type { TourId, TourState } from '@/lib/tour/tour-types';

export type HydrationInFlight = {
  begin: (key: string) => object | false;
  end: (key: string, token: object) => void;
  /** True while a begin() for this key has not yet ended. */
  isInFlight: (key: string) => boolean;
};

export function createHydrationInFlight(): HydrationInFlight {
  let current: string | null = null;
  let owner: object | null = null;
  return {
    begin(key: string) {
      if (current === key) return false;
      const token = {};
      current = key;
      owner = token;
      return token;
    },
    end(key: string, token: object) {
      if (current === key && owner === token) {
        current = null;
        owner = null;
      }
    },
    isInFlight(key: string) {
      return current === key;
    },
  };
}

export type HydrateTourPassInput = {
  key: string;
  flight: HydrationInFlight;
  cancelled: () => boolean;
  recover: () => Promise<{ recovered: boolean; reason?: string }>;
  loadState: () => Promise<TourState>;
  saveState: (state: TourState) => Promise<void>;
  trackOffered: (reason: 'upgrade' | 'new') => void;
  isUpgrade: boolean;
  tourId: TourId;
};

export type HydrateTourPassResult = {
  skippedInFlight: boolean;
  state: TourState | null;
  openWelcome: boolean;
  recovered: boolean;
  reason?: string;
};

/**
 * Load / offer tour state for one member. Concurrent calls with the same key
 * share a single recover(); a cancelled run must not persist `offered`.
 */
export async function runHydrateTourPass(
  input: HydrateTourPassInput
): Promise<HydrateTourPassResult> {
  const token = input.flight.begin(input.key);
  if (!token) {
    return { skippedInFlight: true, state: null, openWelcome: false, recovered: false };
  }

  try {
    if (input.cancelled()) {
      return { skippedInFlight: false, state: null, openWelcome: false, recovered: false };
    }

    const recovery = await input.recover();
    if (input.cancelled()) {
      return {
        skippedInFlight: false,
        state: null,
        openWelcome: false,
        recovered: recovery.recovered,
        reason: recovery.reason,
      };
    }

    let state = await input.loadState();
    let openWelcome = false;

    if (state.status === 'not_started') {
      if (input.isUpgrade) {
        state = offerTourState(input.tourId);
        if (!input.cancelled()) {
          await input.saveState(state);
          input.trackOffered('upgrade');
        }
      } else if (!input.cancelled()) {
        openWelcome = true;
        input.trackOffered('new');
      }
    }

    if (input.cancelled()) {
      return {
        skippedInFlight: false,
        state: null,
        openWelcome: false,
        recovered: recovery.recovered,
        reason: recovery.reason,
      };
    }

    return {
      skippedInFlight: false,
      state,
      openWelcome,
      recovered: recovery.recovered,
      reason: recovery.reason,
    };
  } finally {
    input.flight.end(input.key, token);
  }
}
