/**
 * Shared constants extracted from the desktop Electron main process.
 * These are used across desktop, mobile, and ally apps.
 */

// --- Capture thresholds (from capture.js) ---

/** Rekognition confidence % that flags a screenshot for review */
export const FLAG_THRESHOLD = 70;

/** Rekognition confidence % that triggers an immediate partner alert */
export const ALERT_THRESHOLD = 90;

/** Local NSFWJS score % that triggers Rekognition verification */
export const LOCAL_FLAG_THRESHOLD = 25;

/** Milliseconds between screen captures */
export const CAPTURE_INTERVAL_MS = 60_000;

// --- Subscription (from subscription.js) ---

/** Days after subscription lapse before Rekognition is disabled */
export const REKOGNITION_GRACE_DAYS = 30;

// --- Timers ---

/** Milliseconds between streak checks (24 hours) */
export const STREAK_CHECK_INTERVAL = 24 * 60 * 60 * 1000;

/** Milliseconds between subscription status checks (12 hours) */
export const SUBSCRIPTION_CHECK_INTERVAL = 12 * 60 * 60 * 1000;

// --- Alert types ---

export enum AlertType {
  ContentDetected = 'content_detected',
  AttemptedAccess = 'attempted_access',
  Evasion = 'evasion',
  PartnerInvitation = 'partner_invitation',
  SubscriptionLapse = 'subscription_lapse',
  SubscriptionLapsePartner = 'subscription_lapse_partner',
}

// --- Subscription statuses ---

export enum SubscriptionStatus {
  Trial = 'trial',
  Active = 'active',
  Cancelled = 'cancelled',
  Expired = 'expired',
}
