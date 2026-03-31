/**
 * Platform-agnostic Sentry initialization for Ascension apps.
 *
 * Each app imports its own platform-specific Sentry SDK (@sentry/electron,
 * @sentry/react-native, @sentry/browser) and injects it here so that the
 * rest of the monitoring package can use a single, shared interface.
 */

/** Minimal subset of the Sentry API we actually use. */
export interface SentryLike {
  init(options: {
    dsn: string;
    environment: string;
    release: string;
    tracesSampleRate: number;
  }): void;
  setTag(key: string, value: string): void;
  setUser(user: { id: string; email?: string } | null): void;
  captureException(error: unknown): string;
  captureMessage(message: string): string;
  addBreadcrumb(breadcrumb: {
    category?: string;
    message?: string;
    level?: string;
    data?: Record<string, unknown>;
  }): void;
}

export interface MonitoringConfig {
  dsn: string;
  environment: 'development' | 'staging' | 'production';
  platform: 'desktop' | 'mobile' | 'ally';
  appVersion: string;
  userId?: string;
  userEmail?: string;
}

/** The injected Sentry-compatible instance. */
let sentryInstance: SentryLike | null = null;

/**
 * Returns the current Sentry instance (or null if not yet initialised).
 * Used internally by other modules in this package.
 */
export function getSentryInstance(): SentryLike | null {
  return sentryInstance;
}

/**
 * Initialise monitoring with a platform-specific Sentry SDK.
 *
 * @example
 * // Desktop (Electron)
 * import * as Sentry from '@sentry/electron';
 * import { initMonitoring } from '@ascension/monitoring';
 * initMonitoring(Sentry, { dsn: '...', environment: 'production', platform: 'desktop', appVersion: '1.0.0' });
 *
 * @example
 * // Mobile (React Native)
 * import * as Sentry from '@sentry/react-native';
 * import { initMonitoring } from '@ascension/monitoring';
 * initMonitoring(Sentry, { dsn: '...', environment: 'production', platform: 'mobile', appVersion: '1.0.0' });
 */
export function initMonitoring(
  sentry: SentryLike,
  config: MonitoringConfig,
): void {
  sentryInstance = sentry;

  sentry.init({
    dsn: config.dsn,
    environment: config.environment,
    release: `ascension-${config.platform}@${config.appVersion}`,
    tracesSampleRate: config.environment === 'production' ? 0.1 : 1.0,
  });

  sentry.setTag('platform', config.platform);
  sentry.setTag('environment', config.environment);

  if (config.userId) {
    sentry.setUser({
      id: config.userId,
      ...(config.userEmail ? { email: config.userEmail } : {}),
    });
  }
}

/** Update the Sentry user context (e.g. after login). */
export function setUser(userId: string, email?: string): void {
  if (!sentryInstance) return;
  sentryInstance.setUser({ id: userId, ...(email ? { email } : {}) });
}

/** Clear the Sentry user context (e.g. on logout). */
export function clearUser(): void {
  if (!sentryInstance) return;
  sentryInstance.setUser(null);
}
