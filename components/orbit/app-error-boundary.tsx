/**
 * Root error boundary — keeps the app alive, records Support log, offers restart + feedback.
 */
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText as Text } from '@/components/orbit/app-text';
import { saveLastAppError } from '@/lib/errors/last-error';
import { sendSupportFeedback } from '@/lib/support/send-feedback';
import { orbitColors, radius, space, typography } from '@/constants/orbit-theme';

type Props = { children: ReactNode };
type State = { error: Error | null; sending: boolean };

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null, sending: false };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    void saveLastAppError({
      message: error.message || String(error),
      stack: error.stack,
      componentStack: info.componentStack ?? undefined,
      at: new Date().toISOString(),
    });
    console.warn('AppErrorBoundary', error, info.componentStack);
  }

  private async reload() {
    try {
      const Updates = await import('expo-updates');
      await Updates.reloadAsync();
    } catch {
      this.setState({ error: null, sending: false });
    }
  }

  private async sendAndReload() {
    this.setState({ sending: true });
    try {
      await sendSupportFeedback({
        message: `Crash report: ${this.state.error?.message ?? 'Unknown error'}`,
        includeErrors: true,
        newestOnly: true,
      });
    } catch {
      /* still restart */
    }
    await this.reload();
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <View style={styles.root} accessibilityRole="alert">
        <View style={styles.badge}>
          <Text style={styles.badgeText}>Choremaxx</Text>
        </View>
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.body}>
          Restart to keep going. Details are saved under Settings → Support so you can send them to
          us.
        </Text>
        <Text style={styles.detail} numberOfLines={3}>
          {this.state.error.message}
        </Text>
        <Pressable
          accessibilityRole="button"
          disabled={this.state.sending}
          onPress={() => void this.sendAndReload()}
          style={[styles.button, styles.buttonPrimary]}>
          <Text style={styles.buttonTextPrimary}>
            {this.state.sending ? 'Sending…' : 'Restart and send feedback'}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={this.state.sending}
          onPress={() => void this.reload()}
          style={styles.button}>
          <Text style={styles.buttonText}>Restart</Text>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#140E0C',
    justifyContent: 'center',
    paddingHorizontal: space.xl,
    gap: space.md,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(216,90,48,0.2)',
    borderColor: 'rgba(216,90,48,0.45)',
    borderCurve: 'continuous',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  badgeText: {
    color: '#FF8A3D',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  title: {
    ...typography.title2,
    color: '#F7F2EC',
  },
  body: {
    ...typography.body,
    color: '#C9B8AA',
  },
  detail: {
    ...typography.footnote,
    color: '#8E7F74',
  },
  button: {
    alignSelf: 'stretch',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.12)',
    borderCurve: 'continuous',
    borderRadius: radius.control,
    borderWidth: 1,
    marginTop: space.xs,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  buttonPrimary: {
    backgroundColor: orbitColors.primary,
    borderColor: orbitColors.primary,
  },
  buttonText: {
    color: '#F7F2EC',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  buttonTextPrimary: {
    color: '#041018',
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
});
