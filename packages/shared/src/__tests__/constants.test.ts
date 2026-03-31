import {
  FLAG_THRESHOLD,
  ALERT_THRESHOLD,
  LOCAL_FLAG_THRESHOLD,
  CAPTURE_INTERVAL_MS,
  REKOGNITION_GRACE_DAYS,
  STREAK_CHECK_INTERVAL,
  SUBSCRIPTION_CHECK_INTERVAL,
  AlertType,
  SubscriptionStatus,
} from '../constants';

// ---------------------------------------------------------------------------
// Threshold values
// ---------------------------------------------------------------------------

describe('threshold constants', () => {
  it('FLAG_THRESHOLD is between 0 and 100 (percentage)', () => {
    expect(FLAG_THRESHOLD).toBeGreaterThanOrEqual(0);
    expect(FLAG_THRESHOLD).toBeLessThanOrEqual(100);
  });

  it('ALERT_THRESHOLD is between 0 and 100 (percentage)', () => {
    expect(ALERT_THRESHOLD).toBeGreaterThanOrEqual(0);
    expect(ALERT_THRESHOLD).toBeLessThanOrEqual(100);
  });

  it('ALERT_THRESHOLD is greater than FLAG_THRESHOLD', () => {
    expect(ALERT_THRESHOLD).toBeGreaterThan(FLAG_THRESHOLD);
  });

  it('LOCAL_FLAG_THRESHOLD is between 0 and 100 (percentage)', () => {
    expect(LOCAL_FLAG_THRESHOLD).toBeGreaterThanOrEqual(0);
    expect(LOCAL_FLAG_THRESHOLD).toBeLessThanOrEqual(100);
  });

  it('LOCAL_FLAG_THRESHOLD is less than FLAG_THRESHOLD (local is more sensitive)', () => {
    expect(LOCAL_FLAG_THRESHOLD).toBeLessThan(FLAG_THRESHOLD);
  });

  it('CAPTURE_INTERVAL_MS is at least 10 seconds', () => {
    expect(CAPTURE_INTERVAL_MS).toBeGreaterThanOrEqual(10_000);
  });

  it('REKOGNITION_GRACE_DAYS is a positive number of days', () => {
    expect(REKOGNITION_GRACE_DAYS).toBeGreaterThan(0);
  });

  it('STREAK_CHECK_INTERVAL equals 24 hours in milliseconds', () => {
    expect(STREAK_CHECK_INTERVAL).toBe(24 * 60 * 60 * 1000);
  });

  it('SUBSCRIPTION_CHECK_INTERVAL equals 12 hours in milliseconds', () => {
    expect(SUBSCRIPTION_CHECK_INTERVAL).toBe(12 * 60 * 60 * 1000);
  });
});

// ---------------------------------------------------------------------------
// AlertType enum
// ---------------------------------------------------------------------------

describe('AlertType enum', () => {
  it('has the expected values', () => {
    expect(AlertType.ContentDetected).toBe('content_detected');
    expect(AlertType.AttemptedAccess).toBe('attempted_access');
    expect(AlertType.Evasion).toBe('evasion');
    expect(AlertType.PartnerInvitation).toBe('partner_invitation');
    expect(AlertType.SubscriptionLapse).toBe('subscription_lapse');
    expect(AlertType.SubscriptionLapsePartner).toBe('subscription_lapse_partner');
  });

  it('has exactly 6 members', () => {
    // Enum with string values: Object.values gives only the values
    const values = Object.values(AlertType);
    expect(values).toHaveLength(6);
  });
});

// ---------------------------------------------------------------------------
// SubscriptionStatus enum
// ---------------------------------------------------------------------------

describe('SubscriptionStatus enum', () => {
  it('has the expected values', () => {
    expect(SubscriptionStatus.Trial).toBe('trial');
    expect(SubscriptionStatus.Active).toBe('active');
    expect(SubscriptionStatus.Cancelled).toBe('cancelled');
    expect(SubscriptionStatus.Expired).toBe('expired');
  });

  it('has exactly 4 members', () => {
    const values = Object.values(SubscriptionStatus);
    expect(values).toHaveLength(4);
  });
});
