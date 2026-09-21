/**
 * Root error boundary — keeps the app alive and records orbit.lastError.v1.
 */
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText as Text } from '@/components/orbit/app-text';
import { saveLastAppError } from '@/lib/errors/last-error';
import { orbitColors, radius, space, typography } from '@/constants/orbit-theme';

type Props = { children: ReactNode };
type State = { error: Error | null };

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
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

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <View style={styles.root} accessibilityRole="alert">
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.body}>
          Choremaxx hit an unexpected error. Restart to keep going. The details are saved under
          Settings → Help → Last error.
        </Text>
        <Text style={styles.detail} numberOfLines={4}>
          {this.state.error.message}
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => this.setState({ error: null })}
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
    backgroundColor: orbitColors.background,
    justifyContent: 'center',
    paddingHorizontal: space.xl,
    gap: space.md,
  },
  title: {
    ...typography.title2,
    color: orbitColors.text,
  },
  body: {
    ...typography.body,
    color: orbitColors.textMuted,
  },
  detail: {
    ...typography.footnote,
    color: orbitColors.textSubtle,
  },
  button: {
    alignSelf: 'flex-start',
    backgroundColor: orbitColors.primary,
    borderCurve: 'continuous',
    borderRadius: radius.control,
    marginTop: space.sm,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  buttonText: {
    color: orbitColors.ink,
    fontSize: 16,
    fontWeight: '700',
  },
});
