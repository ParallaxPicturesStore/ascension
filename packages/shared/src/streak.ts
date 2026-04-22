/**
 * Pure streak calculation helpers.
 * No side effects, no database calls - just math.
 */

/**
 * Calculate the current streak in days from when the streak started.
 * streakStartedAt is set at account creation and reset to now() on each relapse.
 */
export function calculateStreak(streakStartedAt: string): number {
  const start = new Date(streakStartedAt);
  const now = new Date();

  start.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);

  const diffDays = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
}

/**
 * Format a streak number for display.
 * Examples: "0 days", "1 day", "42 days"
 */
export function formatStreakDisplay(days: number): string {
  if (days === 1) return '1 day';
  return `${days} days`;
}
