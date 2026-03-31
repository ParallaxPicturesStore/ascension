/**
 * React error boundary that catches render errors and reports them to Sentry.
 *
 * Usage:
 * ```tsx
 * import { ErrorBoundary } from '@ascension/monitoring';
 *
 * <ErrorBoundary fallback={<p>Something went wrong.</p>}>
 *   <App />
 * </ErrorBoundary>
 * ```
 */

import React from 'react';
import { getSentryInstance } from './init';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  /** Optional custom fallback UI to show when an error is caught. */
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    const sentry = getSentryInstance();
    if (sentry) {
      sentry.addBreadcrumb({
        category: 'react.error-boundary',
        level: 'error',
        data: {
          componentStack: errorInfo.componentStack ?? undefined,
        },
      });
      sentry.captureException(error);
    }
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback !== undefined) {
        return this.props.fallback;
      }

      return React.createElement(
        'div',
        {
          style: {
            padding: 24,
            textAlign: 'center' as const,
          },
        },
        React.createElement('h2', null, 'Something went wrong'),
        React.createElement(
          'p',
          null,
          'The error has been reported. Please try restarting the app.',
        ),
      );
    }

    return this.props.children;
  }
}
