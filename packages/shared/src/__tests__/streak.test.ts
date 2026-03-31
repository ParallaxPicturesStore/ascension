import { calculateStreak, shouldIncrementStreak, formatStreakDisplay } from '../streak';

// ---------------------------------------------------------------------------
// calculateStreak
// ---------------------------------------------------------------------------

describe('calculateStreak', () => {
  it('returns currentStreak when lastRelapseDate is null', () => {
    expect(calculateStreak(null, 42)).toBe(42);
  });

  it('returns 0 when relapse was today', () => {
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    expect(calculateStreak(today.toISOString(), 0)).toBe(0);
  });

  it('returns 1 when relapse was yesterday', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(12, 0, 0, 0);
    expect(calculateStreak(yesterday.toISOString(), 0)).toBe(1);
  });

  it('returns 100 when relapse was 100 days ago', () => {
    const past = new Date();
    past.setDate(past.getDate() - 100);
    past.setHours(12, 0, 0, 0);
    expect(calculateStreak(past.toISOString(), 0)).toBe(100);
  });

  it('clamps to 0 for a future relapse date (never negative)', () => {
    const future = new Date();
    future.setDate(future.getDate() + 5);
    expect(calculateStreak(future.toISOString(), 0)).toBe(0);
  });

  it('ignores currentStreak parameter when lastRelapseDate is provided', () => {
    const fiveDaysAgo = new Date();
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
    fiveDaysAgo.setHours(12, 0, 0, 0);
    // currentStreak of 999 should be irrelevant
    expect(calculateStreak(fiveDaysAgo.toISOString(), 999)).toBe(5);
  });

  it('handles relapse date at midnight boundary correctly', () => {
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    twoDaysAgo.setHours(0, 0, 0, 0);
    expect(calculateStreak(twoDaysAgo.toISOString(), 0)).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// shouldIncrementStreak
// ---------------------------------------------------------------------------

describe('shouldIncrementStreak', () => {
  it('returns true when lastUpdateDate is null', () => {
    expect(shouldIncrementStreak(null)).toBe(true);
  });

  it('returns false when last update was just now', () => {
    const now = new Date().toISOString();
    expect(shouldIncrementStreak(now)).toBe(false);
  });

  it('returns false when last update was 12 hours ago', () => {
    const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
    expect(shouldIncrementStreak(twelveHoursAgo)).toBe(false);
  });

  it('returns true when last update was exactly 24 hours ago', () => {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    expect(shouldIncrementStreak(twentyFourHoursAgo)).toBe(true);
  });

  it('returns true when last update was 2 days ago', () => {
    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    expect(shouldIncrementStreak(twoDaysAgo)).toBe(true);
  });

  it('returns false for a future date', () => {
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    expect(shouldIncrementStreak(future)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// formatStreakDisplay
// ---------------------------------------------------------------------------

describe('formatStreakDisplay', () => {
  it('returns "0 days" for 0', () => {
    expect(formatStreakDisplay(0)).toBe('0 days');
  });

  it('returns "1 day" (singular) for 1', () => {
    expect(formatStreakDisplay(1)).toBe('1 day');
  });

  it('returns "2 days" (plural) for 2', () => {
    expect(formatStreakDisplay(2)).toBe('2 days');
  });

  it('returns "365 days" for a full year', () => {
    expect(formatStreakDisplay(365)).toBe('365 days');
  });

  it('returns "1000 days" for large numbers', () => {
    expect(formatStreakDisplay(1000)).toBe('1000 days');
  });
});
