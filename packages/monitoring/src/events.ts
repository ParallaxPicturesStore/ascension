/**
 * Typed analytics events for all Ascension apps.
 *
 * Every trackable action is defined as a discriminated union so that
 * callers get compile-time safety on event names and payloads.
 */

import { getSentryInstance } from './init';

// ---------------------------------------------------------------------------
// Event definitions
// ---------------------------------------------------------------------------

export type AnalyticsEvent =
  | { name: 'signup_completed' }
  | { name: 'onboarding_step'; step: 1 | 2 | 3 }
  | { name: 'partner_invited'; method: 'email' | 'link' }
  | { name: 'first_screenshot_captured' }
  | { name: 'content_flagged'; confidence: number; source: 'local' | 'rekognition' }
  | { name: 'alert_sent'; type: 'content_detected' | 'evasion' | 'attempted_access' }
  | { name: 'subscription_started'; plan: 'monthly' | 'annual' }
  | { name: 'subscription_lapsed' }
  | { name: 'app_opened'; platform: string }
  | { name: 'app_backgrounded' }
  | { name: 'force_quit_attempted' }
  | { name: 'streak_milestone'; days: number }
  | { name: 'encouragement_sent' }
  | { name: 'encouragement_received' }
  | { name: 'blocked_site_attempt'; domain: string }
  | { name: 'vpn_connected' }
  | { name: 'vpn_disconnected' }
  | { name: 'screen_capture_started' }
  | { name: 'screen_capture_denied' };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract the payload (everything except `name`) from an event. */
function eventData(event: AnalyticsEvent): Record<string, unknown> | undefined {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { name, ...rest } = event as AnalyticsEvent & Record<string, unknown>;
  return Object.keys(rest).length > 0 ? rest : undefined;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Track an analytics event.
 *
 * The event is recorded as a Sentry breadcrumb (so it appears in any
 * subsequent error report's timeline) and also as a standalone Sentry
 * message for direct analytics queries.
 *
 * If monitoring has not been initialised yet the call is silently ignored,
 * so it is safe to call from code that runs before `initMonitoring()`.
 */
export function trackEvent(event: AnalyticsEvent): void {
  const sentry = getSentryInstance();
  if (!sentry) return;

  const data = eventData(event);

  // Breadcrumb: attaches to the next captured error for context.
  sentry.addBreadcrumb({
    category: 'analytics',
    message: event.name,
    level: 'info',
    data,
  });

  // Standalone message: queryable in Sentry's Issues / Discover views.
  sentry.captureMessage(`[event] ${event.name}`);
}

/**
 * Track an error with optional extra context.
 *
 * Prefer this over calling Sentry directly so that all error reporting
 * goes through one place and respects the initialisation guard.
 */
export function trackError(
  error: unknown,
  context?: Record<string, unknown>,
): void {
  const sentry = getSentryInstance();
  if (!sentry) return;

  if (context) {
    sentry.addBreadcrumb({
      category: 'error-context',
      level: 'error',
      data: context,
    });
  }

  sentry.captureException(error);
}
