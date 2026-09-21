/**
 * Tour layer error boundary — skip the tour and keep the app usable.
 */
import { Component, type ErrorInfo, type ReactNode } from 'react';

import { trackAnalytics } from '@/lib/analytics';
import { saveLastAppError } from '@/lib/errors/last-error';

type Props = {
  children: ReactNode;
  onCrash?: () => void;
};

type State = { crashed: boolean };

export class TourErrorBoundary extends Component<Props, State> {
  state: State = { crashed: false };

  static getDerivedStateFromError(): State {
    return { crashed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    void saveLastAppError({
      message: `tour: ${error.message || String(error)}`,
      stack: error.stack,
      componentStack: info.componentStack ?? undefined,
      at: new Date().toISOString(),
    });
    void trackAnalytics('tour.crashed', {
      message: error.message,
    });
    this.props.onCrash?.();
    console.warn('TourErrorBoundary', error, info.componentStack);
  }

  render() {
    if (this.state.crashed) return null;
    return this.props.children;
  }
}
