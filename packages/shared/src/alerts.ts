/**
 * Alert type definitions and helpers.
 * Pure functions - no side effects.
 */

import { AlertType } from './constants';

/** Human-readable labels for alert types */
export const ALERT_TYPE_LABELS: Record<AlertType, string> = {
  [AlertType.ContentDetected]: 'Content Detected',
  [AlertType.AttemptedAccess]: 'Blocked Attempt',
  [AlertType.Evasion]: 'Monitoring Disabled',
  [AlertType.PartnerInvitation]: 'Partner Invitation',
  [AlertType.SubscriptionLapse]: 'Subscription Expired',
  [AlertType.SubscriptionLapsePartner]: 'Subscription Expired (Partner)',
};

/** Icons (unicode) for each alert type - used in mobile/ally UI */
export const ALERT_TYPE_ICONS: Record<AlertType, string> = {
  [AlertType.ContentDetected]: '\u{1F6A8}',       // rotating light
  [AlertType.AttemptedAccess]: '\u{1F6AB}',        // prohibited
  [AlertType.Evasion]: '\u{26A0}\u{FE0F}',        // warning
  [AlertType.PartnerInvitation]: '\u{1F91D}',      // handshake
  [AlertType.SubscriptionLapse]: '\u{1F4B3}',      // credit card
  [AlertType.SubscriptionLapsePartner]: '\u{1F4B3}',
};

/** Severity level for an alert type */
export type AlertSeverity = 'critical' | 'warning' | 'info';

export function getAlertSeverity(type: AlertType | string): AlertSeverity {
  switch (type) {
    case AlertType.ContentDetected:
      return 'critical';
    case AlertType.Evasion:
    case AlertType.AttemptedAccess:
      return 'warning';
    default:
      return 'info';
  }
}

/**
 * Format a timestamp as a relative time string.
 * Examples: "just now", "5m ago", "2h ago", "3d ago"
 */
export function formatRelativeTime(timestamp: string): string {
  const now = Date.now();
  const then = new Date(timestamp).getTime();
  const diffMs = now - then;

  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return 'just now';

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;

  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}
