/**
 * Themed in-app alerts — replaces system Alert.alert glass boxes.
 * Imperative API mirrors Alert.alert so call sites stay thin.
 *
 * Destructive confirms (Sign out, etc.) run their onPress only after the
 * RN Modal has fully dismissed. Firing navigation / another modal dismiss
 * during the fade freezes iOS when Settings is already an Expo modal.
 */
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { AppText as Text } from '@/components/orbit/app-text';
import { recordAppError } from '@/lib/errors/error-log';
import { friendlyErrorMessage, looksLikeErrorAlert } from '@/lib/errors/friendly-error';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';

export type OrbitAlertButton = {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
};

type AlertRequest = {
  id: number;
  title: string;
  message?: string;
  buttons: OrbitAlertButton[];
  record?: boolean;
};

type HostApi = {
  present: (req: Omit<AlertRequest, 'id'>) => void;
};

let hostApi: HostApi | null = null;
let seq = 0;

/** Fade length — Android may not fire onDismiss; fallback matches this. */
export const ORBIT_ALERT_DISMISS_MS = 320;

export function orbitAlert(
  title: string,
  message?: string,
  buttons?: OrbitAlertButton[],
  options?: { record?: boolean; source?: string }
): void {
  const isError = options?.record ?? looksLikeErrorAlert(title, message);
  const displayMessage = isError ? friendlyErrorMessage(message) : message;
  const resolvedButtons =
    buttons && buttons.length > 0 ? buttons : [{ text: 'OK', style: 'default' as const }];

  if (isError && (message || title)) {
    void recordAppError({
      title,
      message: message?.trim() || title,
      source: options?.source ?? 'alert',
    });
  }

  if (!hostApi) {
    // Provider not mounted yet — fall back so we never swallow the message.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Alert } = require('react-native') as typeof import('react-native');
    Alert.alert(title, displayMessage, resolvedButtons as never);
    return;
  }

  hostApi.present({
    title,
    message: displayMessage,
    buttons: resolvedButtons,
    record: isError,
  });
}

const OrbitAlertContext = createContext<{ dismiss: () => void } | null>(null);

export function OrbitAlertProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<AlertRequest[]>([]);
  const queueRef = useRef(queue);
  queueRef.current = queue;
  const current = queue[0] ?? null;
  const [visible, setVisible] = useState(false);
  const pendingActionRef = useRef<(() => void) | null>(null);
  const flushedIdRef = useRef<number | null>(null);
  const { c, glass, glassBorder, isDark } = useOrbitColors();
  const primary = c.primary;

  const hasDestructive = Boolean(current?.buttons.some((b) => b.style === 'destructive'));

  const present = useCallback((req: Omit<AlertRequest, 'id'>) => {
    setQueue((q) => [...q, { ...req, id: ++seq }]);
  }, []);

  const api = useMemo(() => ({ present }), [present]);
  useEffect(() => {
    hostApi = api;
    return () => {
      if (hostApi === api) hostApi = null;
    };
  }, [api]);

  // Keep the request mounted while the fade-out runs (do not dequeue on button press).
  useEffect(() => {
    if (current) {
      flushedIdRef.current = null;
      setVisible(true);
    }
  }, [current?.id]);

  const flushAfterDismiss = useCallback(() => {
    const active = queueRef.current[0];
    if (!active) return;
    if (flushedIdRef.current === active.id) return;
    flushedIdRef.current = active.id;

    const action = pendingActionRef.current;
    pendingActionRef.current = null;
    setQueue((q) => q.slice(1));

    if (!action) return;
    // Two frames past native dismiss — safe to dismiss Expo Router modals / navigate.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        try {
          action();
        } catch (error) {
          console.warn('orbitAlert.action', error);
        }
      });
    });
  }, []);

  // Android / some hosts skip onDismiss — still run the confirm after the fade.
  useEffect(() => {
    if (visible || !current) return;
    const handle = setTimeout(flushAfterDismiss, ORBIT_ALERT_DISMISS_MS);
    return () => clearTimeout(handle);
  }, [visible, current?.id, flushAfterDismiss]);

  const beginDismiss = useCallback((action?: () => void) => {
    pendingActionRef.current = action ?? null;
    setVisible(false);
  }, []);

  const onButton = (btn: OrbitAlertButton) => {
    beginDismiss(btn.onPress);
  };

  const dismiss = useCallback(() => {
    beginDismiss(undefined);
  }, [beginDismiss]);

  return (
    <OrbitAlertContext.Provider value={{ dismiss }}>
      {children}
      <Modal
        visible={visible && Boolean(current)}
        transparent
        animationType="fade"
        statusBarTranslucent
        presentationStyle="overFullScreen"
        onRequestClose={dismiss}
        onDismiss={flushAfterDismiss}>
        <View style={styles.backdrop} pointerEvents="box-none">
          {hasDestructive ? (
            <View style={StyleSheet.absoluteFill} />
          ) : (
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={dismiss}
              accessibilityLabel="Dismiss"
            />
          )}
          {current ? (
            <View
              style={[
                styles.card,
                {
                  backgroundColor: isDark ? 'rgba(28,18,14,0.96)' : 'rgba(255,248,242,0.97)',
                  borderColor: `${primary}77`,
                },
              ]}>
              <LinearGradient
                colors={[`${primary}40`, 'transparent']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <View style={[styles.iconWrap, { backgroundColor: `${primary}28` }]}>
                <MaterialIcons
                  name={current.record ? 'error-outline' : 'info-outline'}
                  size={22}
                  color={primary}
                />
              </View>
              <Text style={[styles.title, { color: isDark ? '#F7F2EC' : c.text }]}>
                {current.title}
              </Text>
              {current.message ? (
                <Text style={[styles.body, { color: isDark ? '#C9B8AA' : c.textMuted }]}>
                  {current.message}
                </Text>
              ) : null}
              <View style={styles.actions}>
                {current.buttons.map((btn, index) => {
                  const destructive = btn.style === 'destructive';
                  const cancel = btn.style === 'cancel';
                  const primaryIdx = current.buttons.findIndex((b) => b.style !== 'cancel');
                  const primaryBtn = !cancel && !destructive && index === primaryIdx;
                  return (
                    <Pressable
                      key={`${btn.text}-${index}`}
                      onPress={() => onButton(btn)}
                      style={[
                        styles.btn,
                        primaryBtn && { backgroundColor: primary, borderColor: primary },
                        destructive && {
                          backgroundColor: 'rgba(248,113,113,0.18)',
                          borderColor: '#F87171',
                        },
                        (cancel || (!primaryBtn && !destructive)) && {
                          backgroundColor: glass(0.06),
                          borderColor: glassBorder(0.12),
                        },
                      ]}
                      accessibilityRole="button">
                      <Text
                        style={[
                          styles.btnLabel,
                          {
                            color: primaryBtn
                              ? '#041018'
                              : destructive
                                ? '#F87171'
                                : isDark
                                  ? '#F7F2EC'
                                  : c.text,
                          },
                        ]}>
                        {btn.text}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}
        </View>
      </Modal>
    </OrbitAlertContext.Provider>
  );
}

export function useOrbitAlert() {
  return useContext(OrbitAlertContext);
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
    borderCurve: 'continuous',
    borderRadius: 24,
    borderWidth: 1.5,
    gap: 10,
    maxWidth: 360,
    overflow: 'hidden',
    paddingHorizontal: 20,
    paddingVertical: 20,
    width: '100%',
  },
  iconWrap: {
    alignItems: 'center',
    borderRadius: 14,
    height: 40,
    justifyContent: 'center',
    marginBottom: 2,
    width: 40,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  body: {
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 21,
  },
  actions: {
    gap: 8,
    marginTop: 8,
  },
  btn: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'transparent',
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 14,
  },
  btnLabel: {
    fontSize: 16,
    fontWeight: '800',
  },
});
