import { AlertType } from '../constants';
import {
  ALERT_TYPE_LABELS,
  getAlertSeverity,
  formatRelativeTime,
} from '../alerts';

// ---------------------------------------------------------------------------
// ALERT_TYPE_LABELS (serves as getAlertLabel test)
// ---------------------------------------------------------------------------

describe('ALERT_TYPE_LABELS', () => {
  it('returns "Content Detected" for ContentDetected', () => {
    expect(ALERT_TYPE_LABELS[AlertType.ContentDetected]).toBe('Content Detected');
  });

  it('returns "Blocked Attempt" for AttemptedAccess', () => {
    expect(ALERT_TYPE_LABELS[AlertType.AttemptedAccess]).toBe('Blocked Attempt');
  });

  it('returns "Monitoring Disabled" for Evasion', () => {
    expect(ALERT_TYPE_LABELS[AlertType.Evasion]).toBe('Monitoring Disabled');
  });

  it('returns "Partner Invitation" for PartnerInvitation', () => {
    expect(ALERT_TYPE_LABELS[AlertType.PartnerInvitation]).toBe('Partner Invitation');
  });

  it('returns "Subscription Expired" for SubscriptionLapse', () => {
    expect(ALERT_TYPE_LABELS[AlertType.SubscriptionLapse]).toBe('Subscription Expired');
  });

  it('returns "Subscription Expired (Partner)" for SubscriptionLapsePartner', () => {
    expect(ALERT_TYPE_LABELS[AlertType.SubscriptionLapsePartner]).toBe('Subscription Expired (Partner)');
  });

  it('has a label for every AlertType enum value', () => {
    const alertTypeValues = Object.values(AlertType);
    for (const val of alertTypeValues) {
      expect(ALERT_TYPE_LABELS[val]).toBeDefined();
      expect(typeof ALERT_TYPE_LABELS[val]).toBe('string');
    }
  });
});

// ---------------------------------------------------------------------------
// getAlertSeverity
// ---------------------------------------------------------------------------

describe('getAlertSeverity', () => {
  it('returns "critical" for ContentDetected', () => {
    expect(getAlertSeverity(AlertType.ContentDetected)).toBe('critical');
  });

  it('returns "warning" for Evasion', () => {
    expect(getAlertSeverity(AlertType.Evasion)).toBe('warning');
  });

  it('returns "warning" for AttemptedAccess', () => {
    expect(getAlertSeverity(AlertType.AttemptedAccess)).toBe('warning');
  });

  it('returns "info" for PartnerInvitation', () => {
    expect(getAlertSeverity(AlertType.PartnerInvitation)).toBe('info');
  });

  it('returns "info" for SubscriptionLapse', () => {
    expect(getAlertSeverity(AlertType.SubscriptionLapse)).toBe('info');
  });

  it('returns "info" for an unknown alert type string', () => {
    expect(getAlertSeverity('unknown_type')).toBe('info');
  });
});

// ---------------------------------------------------------------------------
// formatRelativeTime
// ---------------------------------------------------------------------------

describe('formatRelativeTime', () => {
  it('returns "just now" for a timestamp a few seconds ago', () => {
    const fiveSecsAgo = new Date(Date.now() - 5_000).toISOString();
    expect(formatRelativeTime(fiveSecsAgo)).toBe('just now');
  });

  it('returns "just now" for the current timestamp', () => {
    const now = new Date().toISOString();
    expect(formatRelativeTime(now)).toBe('just now');
  });

  it('returns minutes ago for 5 minutes', () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    expect(formatRelativeTime(fiveMinAgo)).toBe('5m ago');
  });

  it('returns hours ago for 3 hours', () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
    expect(formatRelativeTime(threeHoursAgo)).toBe('3h ago');
  });

  it('returns days ago for 5 days', () => {
    const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
    expect(formatRelativeTime(fiveDaysAgo)).toBe('5d ago');
  });

  it('returns months ago for 60 days', () => {
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
    expect(formatRelativeTime(sixtyDaysAgo)).toBe('2mo ago');
  });

  it('returns "1m ago" for exactly 60 seconds', () => {
    const sixtySecsAgo = new Date(Date.now() - 60_000).toISOString();
    expect(formatRelativeTime(sixtySecsAgo)).toBe('1m ago');
  });
});
